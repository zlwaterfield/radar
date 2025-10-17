import { task, logger } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";
import { WebClient } from "@slack/web-api";
import { NotificationService } from "../src/notifications/services/notification.service";
import { NotificationProfileService } from "../src/notifications/services/notification-profile.service";
import { LLMAnalyzerService } from "../src/notifications/services/llm-analyzer.service";
import { DatabaseService } from "../src/database/database.service";
import { GitHubService } from "../src/github/services/github.service";
import { GitHubTokenService } from "../src/github/services/github-token.service";
import { GitHubIntegrationService } from "../src/integrations/services/github-integration.service";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { EntitlementsService } from "../src/stripe/services/entitlements.service";
import { PullRequestSyncService } from "../src/pull-requests/services/pull-request-sync.service";
import { PullRequestService } from "../src/pull-requests/services/pull-request.service";
import { ConfigService } from "@nestjs/config";

// Initialize Prisma client for the task
const prisma = new PrismaClient();

// Initialize services
const configService = new ConfigService();
const analyticsService = new AnalyticsService(configService);
const databaseService = new DatabaseService();
// Create GitHub token service first (no circular dependencies)
const githubTokenService = new GitHubTokenService(configService, databaseService);
const githubService = new GitHubService(configService, databaseService, analyticsService, githubTokenService);
const llmAnalyzerService = new LLMAnalyzerService(configService, databaseService);
const entitlementsService = new EntitlementsService(databaseService, configService);
const pullRequestSyncService = new PullRequestSyncService(databaseService, githubService);
const pullRequestService = new PullRequestService(databaseService);
// Initialize all services properly
const notificationProfileService = new NotificationProfileService(databaseService, analyticsService, entitlementsService);
const notificationService = new NotificationService(databaseService, githubService, githubTokenService, llmAnalyzerService, notificationProfileService, analyticsService);

// Event processing task payload
interface GitHubEventPayload {
  eventId: string;
  eventType: string;
  action?: string;
  repositoryName: string;
  repositoryId: string;
  senderId: string;
  senderLogin: string;
  payload: any;
  createdAt: string;
}

export const processGitHubEvent = task({
  id: "process-github-event",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: GitHubEventPayload) => {
    
    try {
      const event = await prisma.event.findUnique({
        where: { id: payload.eventId },
      });

      if (!event) {
        throw new Error(`Event ${payload.eventId} not found`);
      }

      if (event.processed) {
        logger.info("Event already processed, skipping", { eventId: payload.eventId });
        return { success: true, message: "Event already processed" };
      }

      // Sync PR state if this is a PR-related event
      await syncPullRequestState(event);

      const success = await processEventNotifications(event);

      if (success) {
        await prisma.event.update({
          where: { id: payload.eventId },
          data: {
            processed: true,
            updatedAt: new Date(),
          },
        });

        logger.info("Successfully processed event", {
          eventId: payload.eventId,
          eventType: payload.eventType
        });
        return {
          success: true,
          message: `Successfully processed ${payload.eventType} event`,
          eventId: payload.eventId,
        };
      } else {
        throw new Error(`Failed to process event ${payload.eventId}`);
      }
    } catch (error) {
      logger.error("Error processing event", {
        eventId: payload.eventId,
        error
      });
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  },
});

/**
 * Process event notifications - this would integrate with the existing notification system
 */
async function processEventNotifications(event: any): Promise<boolean> {
  try {
    logger.info("Processing event notifications", {
      eventId: event.id,
      eventType: event.eventType
    });

    const { eventType, action, payload, repositoryName } = event;
    
    // Track webhook event
    await analyticsService.trackWebhook(payload.repository?.id?.toString() || 'unknown', eventType, {
      action,
      repositoryName,
      eventId: event.id,
    });
    
    // Get users who should receive this notification
    const relevantUsers = await getRelevantUsers(repositoryName, payload);
    
    if (relevantUsers.length === 0) {
      logger.debug("No relevant users found", { eventType, repositoryName });
      return true;
    }

    // Create notifications for each relevant user
    let notificationCount = 0;
    logger.info("Processing notifications for users", {
      userCount: relevantUsers.length,
      eventType,
      repositoryName
    });
    
    for (const user of relevantUsers) {
      const startTime = Date.now();
      let shouldNotify = false;
      let matchedKeywords: string[] = [];
      let matchDetails = {};
      let reason: string | undefined;
      let context: any | undefined;

      logger.debug("Processing user for event", {
        userId: user.id,
        userGithubLogin: user.githubLogin,
        eventType
      });

      // Use the profile-based notification service
      const eventTypeMap = {
        'pull_request': 'pull_request' as const,
        'issue_comment': 'issue_comment' as const,
        'issues': 'issue' as const,
        'pull_request_review': 'pull_request_review' as const,
        'pull_request_review_comment': 'pull_request_review_comment' as const,
      };

      let decision: any = null;
      const mappedEventType = eventTypeMap[eventType as keyof typeof eventTypeMap];
      if (mappedEventType) {
        decision = await notificationService.processEvent(user.id, payload, event.id, mappedEventType);
        shouldNotify = decision.shouldNotify;
        matchedKeywords = decision.primaryProfile?.matchedKeywords || [];
        matchDetails = decision.primaryProfile?.matchDetails || {};
        reason = decision.reason;
        context = decision.context;
      } else {
        // For other event types, use the legacy shouldNotifyUser for now
        logger.debug("Using legacy notification logic", { eventType });
        shouldNotify = await shouldNotifyUser(user, eventType, action, payload);
        reason = shouldNotify ? 'LEGACY_LOGIC' : 'LEGACY_SKIP';
        context = { eventType, action, legacyLogic: true };
      }

      const processingTime = Date.now() - startTime;
      logger.info("Notification decision made", {
        decision: shouldNotify ? 'NOTIFY' : 'SKIP',
        reason,
        processingTimeMs: processingTime,
        userId: user.id
      });
      
      if (shouldNotify) {
        // Create and send the actual notification
        const notification = await createNotification(user, event, eventType, action, payload, repositoryName, reason, context, decision);
        if (notification) {
          notificationCount++;
          logger.info("Successfully created notification", {
            notificationId: notification.id,
            userId: user.id,
            userGithubLogin: user.githubLogin,
            matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : undefined
          });
        } else {
          logger.error("Failed to create notification", {
            userId: user.id,
            userGithubLogin: user.githubLogin
          });
        }
      } else {
        logger.debug("Skipped notification for user", {
          userId: user.id,
          userGithubLogin: user.githubLogin,
          reason
        });
      }
    }

    logger.info("Event notification processing complete", {
      notificationCount,
      eventType,
      repositoryName
    });
    return true;
  } catch (error) {
    logger.error("Error processing event notifications", { error });
    return false;
  }
}

/**
 * Get users who should potentially receive notifications for this repository
 */
async function getRelevantUsers(repositoryName: string, payload: any): Promise<any[]> {
  try {
    const repositoryId = payload.repository?.id?.toString();
    
    if (!repositoryId) {
      return [];
    }

    // Get users who have this repository tracked
    const users = await prisma.user.findMany({
      where: {
        repositories: {
          some: {
            githubId: repositoryId,
            enabled: true,
            isActive: true,
          },
        },
        isActive: true,
      },
      include: {
        repositories: {
          where: {
            githubId: repositoryId,
          },
        },
      },
    });

    return users;
  } catch (error) {
    logger.error("Error getting relevant users", { error });
    return [];
  }
}

/**
 * Check if user should receive notification for this event
 */
async function shouldNotifyUser(user: any, eventType: string, action: string, payload: any): Promise<boolean> {
  try {
    // Check user settings to see if they want notifications for this event type
    const settings = user.settings;
    if (!settings) {
      return true; // Default to sending notifications if no settings
    }

    const preferences = settings.notificationPreferences || {};
    
    // Map event types to preference keys
    const eventKey = getNotificationPreferenceKey(eventType, action, payload);
    if (eventKey && preferences[eventKey] === false) {
      return false;
    }

    // Additional logic for checking if the user is the one who triggered the event
    if (payload.sender?.id?.toString() === user.githubId) {
      return false; // Don't notify users about their own actions
    }

    return true;
  } catch (error) {
    logger.error("Error checking if user should be notified", { error });
    return true; // Default to sending notification on error
  }
}

/**
 * Create notification for user and send Slack message
 */
async function createNotification(
  user: any,
  event: any,
  eventType: string,
  action: string,
  payload: any,
  repositoryName: string,
  reason?: string,
  context?: any,
  notificationDecision?: any
): Promise<any> {
  try {
    const title = generateNotificationTitle(eventType, action, payload);
    const message = generateNotificationMessage(eventType, action, payload);
    const url = payload.html_url || payload.pull_request?.html_url || payload.issue?.html_url;
    
    // Create notification record with reason and context
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        eventId: event.id,
        messageType: eventType,
        payload: {
          eventType,
          action,
          repositoryName,
          title,
          message,
          url,
        },
        reason: reason || 'UNKNOWN',
        context: context || {},
      },
    });

    // Send Slack message immediately
    const slackResult = await sendSlackNotificationWithResult(user, {
      eventType,
      action,
      repositoryName,
      title,
      message,
      url,
      payload,
    }, notificationDecision);

    if (slackResult.success && slackResult.messageTs) {
      // Update notification with message timestamp
      await prisma.notification.update({
        where: { id: notification.id },
        data: { messageTs: slackResult.messageTs }
      });
      logger.info("Successfully sent Slack notification", {
        notificationId: notification.id,
        userId: user.id,
        messageTs: slackResult.messageTs
      });
    } else {
      logger.warn("Failed to send Slack notification", {
        notificationId: notification.id,
        userId: user.id
      });
    }

    return notification;
  } catch (error) {
    logger.error("Error creating notification", { error });
    return null;
  }
}

/**
 * Send Slack notification to user with result details based on notification profile settings
 */
async function sendSlackNotificationWithResult(user: any, notificationData: any, notificationDecision?: any): Promise<{ success: boolean; messageTs?: string }> {
  try {
    if (!user.slackId || !user.slackBotToken) {
      logger.warn("User missing Slack credentials", { userId: user.id });
      return { success: false };
    }

    // Initialize Slack client with user's bot token
    const slack = new WebClient(user.slackBotToken);
    const slackMessage = await createSlackMessage(notificationData, notificationDecision);

    // Determine delivery target based on notification profile
    let targetChannel: string;
    let deliveryType = 'dm'; // Default to DM if no profile match

    // Check if we have a notification decision with profile information
    if (notificationDecision?.primaryProfile?.profile) {
      const profile = notificationDecision.primaryProfile.profile;
      deliveryType = profile.deliveryType;

      if (profile.deliveryType === 'channel' && profile.deliveryTarget) {
        // Send to specified channel
        targetChannel = profile.deliveryTarget;
        logger.info("Routing notification to channel", {
          channel: targetChannel,
          profileName: profile.name,
          userId: user.id
        });
      } else {
        // Send to DM (deliveryType is 'dm' or no deliveryTarget specified)
        const dmResponse = await slack.conversations.open({
          users: user.slackId
        });

        if (!dmResponse.ok || !dmResponse.channel?.id) {
          logger.error("Failed to open DM channel", {
            userId: user.id,
            error: dmResponse.error
          });
          return { success: false };
        }

        targetChannel = dmResponse.channel.id;
        logger.info("Routing notification to DM", {
          profileName: profile.name,
          userId: user.id
        });
      }
    } else {
      // Fallback to DM if no profile information available
      const dmResponse = await slack.conversations.open({
        users: user.slackId
      });

      if (!dmResponse.ok || !dmResponse.channel?.id) {
        logger.error("Failed to open DM channel (fallback)", {
          userId: user.id,
          error: dmResponse.error
        });
        return { success: false };
      }

      targetChannel = dmResponse.channel.id;
      logger.info("Routing notification to DM (fallback)", { userId: user.id });
    }

    // Send message to the determined target
    const messageResponse = await slack.chat.postMessage({
      channel: targetChannel,
      ...slackMessage
    });

    if (messageResponse.ok && messageResponse.ts) {
      const deliveryLocation = deliveryType === 'channel' ? `channel ${targetChannel}` : 'DM';
      logger.info("Successfully sent Slack message", {
        userId: user.id,
        deliveryLocation,
        messageTs: messageResponse.ts
      });
      return { success: true, messageTs: messageResponse.ts };
    } else {
      logger.error("Failed to send Slack message", {
        userId: user.id,
        error: messageResponse.error
      });
      return { success: false };
    }

  } catch (error) {
    logger.error("Error sending Slack notification", { error });
    return { success: false };
  }
}

// Color scheme for different event types (matching Python example)
const EVENT_COLORS: Record<string, string> = {
  // Pull request actions
  "opened": "#2EB67D",       // Green
  "reopened": "#2EB67D",     // Green
  "closed": "#E01E5A",       // Red
  "merged": "#4A154B",       // Purple
  "review_requested": "#ECB22E", // Yellow
  "assigned": "#1D9BD1",     // Blue
  
  // Review states
  "approved": "#2EB67D",     // Green
  "changes_requested": "#E01E5A", // Red
  "commented": "#1D9BD1",    // Blue
  "dismissed": "#ECB22E",    // Yellow
  
  // Issue actions
  "issue_opened": "#2EB67D", // Green
  "issue_closed": "#E01E5A", // Red
  "issue_reopened": "#2EB67D", // Green
  "issue_commented": "#1D9BD1", // Blue
  
  // Default
  "default": "#1D9BD1"       // Blue
};

/**
 * Create Slack message structure with proper formatting
 */
async function createSlackMessage(data: any, notificationDecision?: any) {
  const { eventType } = data;

  if (eventType === 'pull_request') {
    return await createPRSlackMessage(data, notificationDecision);
  } else if (eventType === 'issues') {
    return createIssueSlackMessage(data, notificationDecision);
  } else if (eventType === 'pull_request_review') {
    return await createPRReviewSlackMessage(data, notificationDecision);
  } else if (eventType === 'pull_request_review_comment') {
    return await createPRReviewCommentSlackMessage(data, notificationDecision);
  } else if (eventType === 'issue_comment') {
    return await createIssueCommentSlackMessage(data, notificationDecision);
  } else {
    throw new Error(`Unknown event type: ${eventType}`);
  }
}

/**
 * Create keyword match context block for Slack messages
 */
function createKeywordMatchBlock(notificationDecision?: any): any[] {
  if (!notificationDecision?.primaryProfile?.matchedKeywords?.length) {
    return [];
  }

  const matchedKeywords = notificationDecision.primaryProfile.matchedKeywords;
  const matchDetails = notificationDecision.primaryProfile.matchDetails || {};

  const keywordText = matchedKeywords.length === 1
    ? `🎯 *Keyword Match*: ${matchedKeywords[0]}`
    : `🎯 *Keywords Matched*: ${matchedKeywords.join(', ')}`;

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: keywordText
      }
    },
    {
      type: 'divider'
    }
  ];
}

/**
 * Fetch PR state from database
 */
async function fetchPRState(repositoryName: string, prNumber: number): Promise<any | null> {
  try {
    const repository = await prisma.userRepository.findFirst({
      where: {
        fullName: repositoryName
      },
      select: { githubId: true },
    });

    if (!repository?.githubId) {
      return null;
    }

    const pr = await pullRequestService.findByRepoAndNumber(
      repository.githubId,
      prNumber,
      true, // include relations
    );

    return pr;
  } catch (error) {
    logger.error("Error fetching PR state", { error, repositoryName, prNumber });
    return null;
  }
}

/**
 * Format PR state blocks for Slack
 */
function createPRStateBlocks(prState: any): any[] {
  if (!prState) return [];

  const blocks: any[] = [];

  // Reviewers section
  if (prState.reviewers && prState.reviewers.length > 0) {
    const reviewerText = prState.reviewers
      .map((r: any) => {
        let icon = '⏳'; // Pending
        if (r.reviewState === 'approved') icon = '✅';
        else if (r.reviewState === 'changes_requested') icon = '❌';
        else if (r.reviewState === 'commented') icon = '💬';
        else if (r.reviewState === 'dismissed') icon = '🚫';
        return `${icon} @${r.login}`;
      })
      .join(', ');

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `👥 *Reviewers:* ${reviewerText}`,
        },
      ],
    });
  }

  // Labels section
  if (prState.labels && prState.labels.length > 0) {
    const labelsText = prState.labels
      .map((l: any) => `\`${l.name}\``)
      .join(' ');
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🏷️ ${labelsText}`,
        },
      ],
    });
  }

  // CI/CD checks section
  if (prState.checks && prState.checks.length > 0) {
    const passing = prState.checks.filter(
      (c: any) => c.status === 'completed' && c.conclusion === 'success'
    ).length;
    const failing = prState.checks.filter(
      (c: any) => c.status === 'completed' && c.conclusion === 'failure'
    ).length;
    const pending = prState.checks.filter((c: any) => c.status !== 'completed').length;
    const total = prState.checks.length;

    let icon = '✅';
    let text = `${passing}/${total} checks passing`;

    if (failing > 0) {
      icon = '❌';
      text = `${passing}/${total} checks passing, ${failing} failing`;
    } else if (pending > 0) {
      icon = '⏳';
      text = `${passing}/${total} checks completed`;
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🔧 *CI:* ${icon} ${text}`,
        },
      ],
    });
  }

  return blocks;
}

/**
 * Create Slack message for pull request notifications
 */
async function createPRSlackMessage(data: any, notificationDecision?: any) {
  const { action, repositoryName, title, url, payload } = data;
  const prNumber = payload.pull_request?.number;

  // Fetch PR state from database
  const prState = prNumber ? await fetchPRState(repositoryName, prNumber) : null;

  // Determine actual action for merged PRs
  const actualAction = (action === "closed" && payload.pull_request?.merged) ? "merged" : action;
  const color = EVENT_COLORS[actualAction] || EVENT_COLORS.default;

  // Create icon based on action
  let icon = "🔄";  // Default icon
  if (action === "opened") icon = "🆕";
  else if (action === "closed") icon = payload.pull_request?.merged ? "🔀" : "🚫";
  else if (action === "reopened") icon = "🔄";
  else if (action === "merged") icon = "🔀";
  else if (action === "review_requested") icon = "👀";
  else if (action === "assigned") icon = "👤";

  // Create GitHub user link
  const user = payload.pull_request?.user?.login || payload.sender?.login;
  const githubUserLink = `<https://github.com/${user}|${user}>`;

  // Create contextual text based on action
  let contextText;
  if (action === "opened") {
    contextText = `${githubUserLink} opened a PR in *${repositoryName}*`;
  } else if (action === "closed") {
    if (payload.pull_request?.merged) {
      contextText = `${githubUserLink} merged a PR in *${repositoryName}*`;
    } else {
      contextText = `${githubUserLink} closed a PR in *${repositoryName}*`;
    }
  } else if (action === "merged") {
    contextText = `${githubUserLink} merged a PR in *${repositoryName}*`;
  } else if (action === "reopened") {
    contextText = `${githubUserLink} reopened a PR in *${repositoryName}*`;
  } else if (action === "assigned") {
    contextText = `${githubUserLink} assigned you to a PR in *${repositoryName}*`;
  } else if (action === "review_requested") {
    contextText = `${githubUserLink} requested a review for a PR in *${repositoryName}*`;
  } else {
    contextText = `${githubUserLink} ${action} a PR in *${repositoryName}*`;
  }

  // Create blocks with attachment styling, putting PR title in main message
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${icon} ${contextText}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${url}|${title}>*`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View PR',
          emoji: true
        },
        url: url,
        action_id: 'view_pr'
      }
    },
  ];

  // Add keyword match information if this was triggered by keywords
  const keywordBlocks = createKeywordMatchBlock(notificationDecision);
  blocks.push(...keywordBlocks);

  // Add PR state blocks (reviewers, labels, CI checks)
  if (prState) {
    const prStateBlocks = createPRStateBlocks(prState);
    blocks.push(...prStateBlocks);
  }

  // Add PR statistics for opened and review_requested actions
  if (action === "opened" || action === "review_requested") {
    const additions = payload.pull_request?.additions || 0;
    const deletions = payload.pull_request?.deletions || 0;
    const changedFiles = payload.pull_request?.changed_files || 0;

    const statsText = `*${changedFiles}* ${changedFiles === 1 ? 'file' : 'files'} changed • ` +
      `🟩 *+${additions}* • ` +
      `🟥 *-${deletions}*`;

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: statsText
        }
      ]
    } as any);
  }

  // Add PR description for opened and review_requested actions
  if ((action === "opened" || action === "review_requested") && payload.pull_request?.body) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: processMarkdownForSlack(payload.pull_request.body),
      }
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${repositoryName}`
      }
    ]
  } as any);

  return {
    blocks: [],
    attachments: [
      {
        color,
        blocks
      }
    ]
  };
}

/**
 * Create Slack message for issue notifications
 */
function createIssueSlackMessage(data: any, notificationDecision?: any) {
  const { action, repositoryName, title, url, payload } = data;
  
  // Map issue action to color
  const actionColorKey = `issue_${action}`;
  const color = EVENT_COLORS[actionColorKey] || EVENT_COLORS.default;
  
  // Create icon based on action
  let icon = "🔄";  // Default icon
  if (action === "opened") icon = "🆕";
  else if (action === "closed") icon = "🚫";
  else if (action === "reopened") icon = "🔄";
  else if (action === "assigned") icon = "👤";
  
  // Create GitHub user link
  const user = payload.issue?.user?.login || payload.sender?.login;
  const githubUserLink = `<https://github.com/${user}|${user}>`;
  
  // Create contextual text based on action
  let contextText;
  if (action === "opened") {
    contextText = `${githubUserLink} opened an issue in *${repositoryName}*`;
  } else if (action === "closed") {
    contextText = `${githubUserLink} closed an issue in *${repositoryName}*`;
  } else if (action === "reopened") {
    contextText = `${githubUserLink} reopened an issue in *${repositoryName}*`;
  } else if (action === "assigned") {
    contextText = `${githubUserLink} assigned an issue in *${repositoryName}*`;
  } else {
    contextText = `${githubUserLink} ${action} an issue in *${repositoryName}*`;
  }

  // Create blocks with issue/PR title prominently displayed
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${icon} ${contextText}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${url}|${title}>*`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Issue',
          emoji: true
        },
        url: url,
        action_id: 'view_issue'
      }
    },
  ];

  // Add keyword match information if this was triggered by keywords
  const keywordBlocks = createKeywordMatchBlock(notificationDecision);
  blocks.push(...keywordBlocks);

  if (action in ["opened"]) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: data.body,
      }
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${repositoryName}`
      }
    ]
  } as any);

  return {
    blocks: [],
    attachments: [
      {
        color,
        blocks
      }
    ]
  };
}

/**
 * Create Slack message for pull request review notifications
 */
async function createPRReviewSlackMessage(data: any, notificationDecision?: any) {
  const { action, repositoryName, title, message, url, payload } = data;
  const prNumber = payload.pull_request?.number;

  // Fetch PR state from database
  const prState = prNumber ? await fetchPRState(repositoryName, prNumber) : null;

  // Map review state to color
  const reviewState = payload.review?.state || action;
  const color = EVENT_COLORS[reviewState] || EVENT_COLORS.default;

  // Create icon based on review state
  let icon = "💬";  // Default icon
  if (reviewState === "approved") icon = "✅";
  else if (reviewState === "changes_requested") icon = "❌";
  else if (reviewState === "commented") icon = "💬";
  else if (reviewState === "dismissed") icon = "🚫";

  // Create GitHub user link
  const user = payload.review?.user?.login || payload.sender?.login;
  const githubUserLink = `<https://github.com/${user}|${user}>`;

  let reviewStateText = reviewState;
  if (reviewState === "changes_requested") reviewStateText = "requested changes";

  // Create blocks with PR title prominently displayed
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${icon} ${githubUserLink} ${reviewStateText} a PR in *${repositoryName}*`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${url}|${title}>*`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View PR',
          emoji: true
        },
        url: url,
        action_id: 'view_pr'
      }
    },
  ];

  // Add keyword match information if this was triggered by keywords
  const keywordBlocks = createKeywordMatchBlock(notificationDecision);
  blocks.push(...keywordBlocks);

  // Add PR state blocks (reviewers, labels, CI checks)
  if (prState) {
    const prStateBlocks = createPRStateBlocks(prState);
    blocks.push(...prStateBlocks);
  }

  // Add review comment if present
  if (payload.review?.body) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${processMarkdownForSlack(payload.review.body)}`
      }
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${repositoryName}`
      }
    ]
  } as any);

  return {
    blocks: [],
    attachments: [
      {
        color,
        blocks
      }
    ]
  };
}

/**
 * Create Slack message for pull request comment notifications
 */
async function createPRReviewCommentSlackMessage(data: any, notificationDecision?: any) {
  const { repositoryName, title, message, url, payload } = data;
  const prNumber = payload.pull_request?.number;
  const color = EVENT_COLORS.commented;

  // Fetch PR state from database
  const prState = prNumber ? await fetchPRState(repositoryName, prNumber) : null;

  // Create GitHub user link
  const user = payload.comment?.user?.login || payload.sender?.login;
  const githubUserLink = `<https://github.com/${user}|${user}>`;

  // Create blocks with PR title prominently displayed
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `💬 ${githubUserLink} commented on a PR in *${repositoryName}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${url}|${title}>*`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View PR',
          emoji: true
        },
        url: url,
        action_id: 'view_pr'
      }
    },
  ];

  // Add keyword match information if this was triggered by keywords
  const keywordBlocks = createKeywordMatchBlock(notificationDecision);
  blocks.push(...keywordBlocks);

  // Add PR state blocks (reviewers, labels, CI checks)
  if (prState) {
    const prStateBlocks = createPRStateBlocks(prState);
    blocks.push(...prStateBlocks);
  }

  blocks.push(
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: processMarkdownForSlack(payload.comment?.body || message)
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${repositoryName}`
        }
      ]
    } as any
  );

  return {
    blocks: [],
    attachments: [
      {
        color,
        blocks
      }
    ]
  };
}

/**
 * Create Slack message for issue comment notifications
 */
async function createIssueCommentSlackMessage(data: any, notificationDecision?: any) {
  const { repositoryName, title, url, payload } = data;
  const color = EVENT_COLORS.issue_commented;

  // Check if this is a pull request by examining the URL or payload
  const isPullRequest = url.includes('/pull/') || payload.issue?.pull_request;
  const prNumber = isPullRequest ? payload.issue?.number : null;

  // Fetch PR state from database if this is a PR comment
  const prState = (isPullRequest && prNumber) ? await fetchPRState(repositoryName, prNumber) : null;

  // Create GitHub user link
  const user = payload.comment?.user?.login || payload.sender?.login;
  const githubUserLink = `<https://github.com/${user}|${user}>`;

  // Set the appropriate title and context based on whether it's a PR or issue
  let contextText, viewText;
  if (isPullRequest) {
    contextText = `${githubUserLink} commented on a PR in *${repositoryName}*`;
    viewText = "View PR";
  } else {
    contextText = `${githubUserLink} commented on an issue in *${repositoryName}*`;
    viewText = "View Issue";
  }

  // Create blocks with issue/PR title prominently displayed
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `💬 ${contextText}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${url}|${title}>*`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: viewText,
          emoji: true
        },
        url: url,
        action_id: 'view_issue'
      }
    },
  ];

  // Add keyword match information if this was triggered by keywords
  const keywordBlocks = createKeywordMatchBlock(notificationDecision);
  blocks.push(...keywordBlocks);

  // Add PR state blocks if this is a PR comment (reviewers, labels, CI checks)
  if (prState) {
    const prStateBlocks = createPRStateBlocks(prState);
    blocks.push(...prStateBlocks);
  }

  // Add comment content if available
  if (payload.comment?.body) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: processMarkdownForSlack(payload.comment.body)
      }
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${repositoryName}`
      }
    ]
  } as any);

  return {
    blocks: [],
    attachments: [
      {
        color,
        blocks
      }
    ]
  };
}


/**
 * Convert GitHub markdown to Slack-compatible mrkdwn and truncate
 */
function processMarkdownForSlack(text: string, maxLength?: number): string {
  if (!text) return '';
  
  // Basic markdown conversions for Slack
  let processed = text
    // Convert GitHub-style code blocks to Slack format
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '```$2```')
    // Convert inline code
    .replace(/`([^`]+)`/g, '`$1`')
    // Convert bold
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    // Convert italic (Slack doesn't support italic, so keep as is or convert to emphasis)
    .replace(/\*([^*]+)\*/g, '_$1_')
    // Convert strikethrough
    .replace(/~~([^~]+)~~/g, '~$1~')
    // Convert GitHub-style links [text](url) to Slack format <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    // Escape special characters that might break Slack formatting
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Truncate if too long
  if (maxLength && processed.length > maxLength) {
    processed = processed.substring(0, maxLength - 3) + '...';
  }
  
  return processed;
}

/**
 * Get notification preference key based on event type and action
 */
function getNotificationPreferenceKey(eventType: string, action: string, payload?: any): string | null {
  if (eventType === 'pull_request') {
    switch (action) {
      case 'opened':
        return 'pull_request_opened';
      case 'closed':
        // Check if the PR was merged to use the correct preference key
        if (payload?.pull_request?.merged) {
          return 'pull_request_merged';
        } else {
          return 'pull_request_closed';
        }
      case 'reopened':
        return 'pull_request_reopened';
      default:
        return 'pull_request_opened';
    }
  } else if (eventType === 'issues') {
    switch (action) {
      case 'opened':
        return 'issue_opened';
      case 'closed':
        return 'issue_closed';
      case 'reopened':
        return 'issue_reopened';
      default:
        return 'issue_opened';
    }
  } else if (eventType === 'issue_comment') {
    return 'issue_commented';
  } else if (eventType === 'pull_request_review') {
    return 'pull_request_reviewed';
  } else if (eventType === 'pull_request_review_comment') {
    return 'pull_request_commented';
  }
  
  return null;
}

/**
 * Generate notification title
 */
function generateNotificationTitle(eventType: string, action: string, payload: any): string {
  const repoName = payload.repository?.name || 'Repository';
  const sender = payload.sender?.login || 'Someone';
  
  if (eventType === 'pull_request') {
    const prNumber = payload.pull_request?.number;
    return `PR #${prNumber}: ${payload.pull_request?.title || 'Pull request'}`;
  } else if (eventType === 'issues') {
    const issueNumber = payload.issue?.number;
    return `Issue #${issueNumber}: ${payload.issue?.title || 'Issue'}`;
  } else if (eventType === 'issue_comment') {
    const issueNumber = payload.issue?.number;
    // Check if this is a comment on a pull request
    if (payload.issue?.pull_request) {
      return `PR #${issueNumber}: ${payload.issue?.title || 'Pull request'}`;
    } else {
      return `Issue #${issueNumber}: ${payload.issue?.title || 'Issue'}`;
    }
  } else if (eventType === 'pull_request_review') {
    const prNumber = payload.pull_request?.number;
    return `PR #${prNumber}: ${payload.pull_request?.title || 'Pull request'}`;
  } else if (eventType === 'pull_request_review_comment') {
    const prNumber = payload.pull_request?.number;
    return `PR #${prNumber}: ${payload.pull_request?.title || 'Pull request'}`;
  }
  
  return `${sender} performed ${eventType} action in ${repoName}`;
}

/**
 * Generate notification message
 */
function generateNotificationMessage(eventType: string, action: string, payload: any): string {
  if (eventType === 'pull_request') {
    return payload.pull_request?.title || 'Pull request update';
  } else if (eventType === 'issues') {
    return payload.issue?.title || 'Issue update';
  } else if (eventType === 'issue_comment') {
    return payload.comment?.body?.substring(0, 200) || 'New comment';
  } else if (eventType === 'pull_request_review') {
    return payload.review?.body?.substring(0, 200) || 'Pull request reviewed';
  }

  return 'GitHub activity update';
}

/**
 * Sync pull request state from GitHub webhook
 */
async function syncPullRequestState(event: any): Promise<void> {
  const { eventType, payload } = event;

  // Check if this is a PR-related event
  const prEvents = [
    'pull_request',
    'pull_request_review',
    'pull_request_review_comment',
    'check_run',
    'check_suite'
  ];

  if (!prEvents.includes(eventType)) {
    return;
  }

  try {
    logger.info("Syncing PR state from webhook", { eventType });
    await pullRequestSyncService.syncFromWebhook(payload);
    logger.info("Successfully synced PR state", { eventType });
  } catch (error) {
    logger.error("Error syncing PR state", { eventType, error });
    // Don't throw - we don't want to fail the entire event processing if PR sync fails
  }
}