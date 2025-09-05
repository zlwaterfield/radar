import { task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";
import { WebClient } from "@slack/web-api";
import { NotificationService } from "../src/notifications/services/notification.service";
import { NotificationProfileService } from "../src/notifications/services/notification-profile.service";
import { LLMAnalyzerService } from "../src/notifications/services/llm-analyzer.service";
import { DatabaseService } from "../src/database/database.service";
import { GitHubService } from "../src/github/services/github.service";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { ConfigService } from "@nestjs/config";

// Initialize Prisma client for the task
const prisma = new PrismaClient();

// Initialize services
const configService = new ConfigService();
const databaseService = new DatabaseService();
const githubService = new GitHubService(configService, databaseService);
const llmAnalyzerService = new LLMAnalyzerService(configService, databaseService);
const analyticsService = new AnalyticsService(configService);
// Initialize all services properly
const notificationProfileService = new NotificationProfileService(databaseService);
const notificationService = new NotificationService(databaseService, githubService, llmAnalyzerService, notificationProfileService, analyticsService);

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
        console.log(`Event ${payload.eventId} already processed, skipping`);
        return { success: true, message: "Event already processed" };
      }

      const success = await processEventNotifications(event);

      if (success) {
        await prisma.event.update({
          where: { id: payload.eventId },
          data: {
            processed: true,
            updatedAt: new Date(),
          },
        });

        console.log(`Successfully processed event ${payload.eventId}`);
        return {
          success: true,
          message: `Successfully processed ${payload.eventType} event`,
          eventId: payload.eventId,
        };
      } else {
        throw new Error(`Failed to process event ${payload.eventId}`);
      }
    } catch (error) {
      console.error(`Error processing event ${payload.eventId}:`, error);
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
    console.log(`Processing notifications for event ${event.id} (${event.eventType})`);
    
    const { eventType, action, payload, repositoryName } = event;
    
    // Track webhook event
    analyticsService.trackWebhook(payload.repository?.id?.toString() || 'unknown', eventType, {
      action,
      repositoryName,
      eventId: event.id,
    });
    
    // Get users who should receive this notification
    const relevantUsers = await getRelevantUsers(repositoryName, payload);
    
    if (relevantUsers.length === 0) {
      console.log(`No relevant users found for ${eventType} in ${repositoryName}`);
      return true;
    }

    // Create notifications for each relevant user
    let notificationCount = 0;
    console.log(`Processing notifications for ${relevantUsers.length} users for ${eventType} in ${repositoryName}`);
    
    for (const user of relevantUsers) {
      const startTime = Date.now();
      let shouldNotify = false;
      let matchedKeywords: string[] = [];
      let matchDetails = {};
      let reason: string | undefined;
      let context: any | undefined;
      
      console.log(`\n--- Processing user ${user.id} (${user.githubLogin}) for ${eventType} ---`);
      
      // Use the profile-based notification service
      const eventTypeMap = {
        'pull_request': 'pull_request' as const,
        'issue_comment': 'issue_comment' as const, 
        'issues': 'issue' as const,
        'pull_request_review': 'pull_request_review' as const,
        'pull_request_review_comment': 'pull_request_review_comment' as const,
      };

      const mappedEventType = eventTypeMap[eventType as keyof typeof eventTypeMap];
      if (mappedEventType) {
        const decision = await notificationService.processEvent(user.id, payload, event.id, mappedEventType);
        shouldNotify = decision.shouldNotify;
        matchedKeywords = decision.primaryProfile?.matchedKeywords || [];
        matchDetails = decision.primaryProfile?.matchDetails || {};
        reason = decision.reason;
        context = decision.context;
      } else {
        // For other event types, use the legacy shouldNotifyUser for now
        console.log(`Using legacy notification logic for ${eventType}`);
        shouldNotify = await shouldNotifyUser(user, eventType, action, payload);
        reason = shouldNotify ? 'LEGACY_LOGIC' : 'LEGACY_SKIP';
        context = { eventType, action, legacyLogic: true };
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`Decision: ${shouldNotify ? 'NOTIFY' : 'SKIP'} - Reason: ${reason} (${processingTime}ms)`);
      
      if (shouldNotify) {
        // Create and send the actual notification
        const notification = await createNotification(user, event, eventType, action, payload, repositoryName, reason, context);
        if (notification) {
          notificationCount++;
          console.log(`✅ Successfully created notification ${notification.id} for user ${user.githubLogin}`);
          
          // Log keyword matches if any
          if (matchedKeywords.length > 0) {
            console.log(`🔍 Keywords matched: ${matchedKeywords.join(', ')}`);
          }
        } else {
          console.error(`❌ Failed to create notification for user ${user.githubLogin}`);
        }
      } else {
        console.log(`⏭️ Skipped notification for user ${user.githubLogin} - ${reason}`);
      }
    }

    console.log(`Created ${notificationCount} notifications for ${eventType} in ${repositoryName}`);
    return true;
  } catch (error) {
    console.error('Error processing event notifications:', error);
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
        settings: true,
        repositories: {
          where: {
            githubId: repositoryId,
          },
        },
      },
    });

    return users;
  } catch (error) {
    console.error('Error getting relevant users:', error);
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
    console.error('Error checking if user should be notified:', error);
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
  context?: any
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
    });

    if (slackResult.success && slackResult.messageTs) {
      // Update notification with message timestamp
      await prisma.notification.update({
        where: { id: notification.id },
        data: { messageTs: slackResult.messageTs }
      });
      console.log(`Successfully sent Slack notification ${notification.id} for user ${user.id} (ts: ${slackResult.messageTs})`);
    } else {
      console.warn(`Failed to send Slack notification ${notification.id} for user ${user.id}`);
    }
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Send Slack notification to user with result details
 */
async function sendSlackNotificationWithResult(user: any, notificationData: any): Promise<{ success: boolean; messageTs?: string }> {
  try {
    if (!user.slackId || !user.slackAccessToken) {
      console.warn(`User ${user.id} missing Slack credentials`);
      return { success: false };
    }

    // Initialize Slack client with user's token
    const slack = new WebClient(user.slackAccessToken);
    
    // Open DM channel with user
    const dmResponse = await slack.conversations.open({
      users: user.slackId
    });
    
    if (!dmResponse.ok || !dmResponse.channel?.id) {
      console.error(`Failed to open DM channel for user ${user.id}:`, dmResponse.error);
      return { success: false };
    }
    
    const channelId = dmResponse.channel.id;
    const slackMessage = createSlackMessage(notificationData);
    
    // Send message to Slack
    const messageResponse = await slack.chat.postMessage({
      channel: channelId,
      ...slackMessage
    });
    
    if (messageResponse.ok && messageResponse.ts) {
      console.log(`Successfully sent Slack notification to user ${user.id} (ts: ${messageResponse.ts})`);
      return { success: true, messageTs: messageResponse.ts };
    } else {
      console.error(`Failed to send Slack message to user ${user.id}:`, messageResponse.error);
      return { success: false };
    }
    
  } catch (error) {
    console.error('Error sending Slack notification:', error);
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
function createSlackMessage(data: any) {
  const { eventType } = data;
  
  if (eventType === 'pull_request') {
    return createPRSlackMessage(data);
  } else if (eventType === 'issues') {
    return createIssueSlackMessage(data);
  } else if (eventType === 'pull_request_review') {
    return createPRReviewSlackMessage(data);
  } else if (eventType === 'pull_request_review_comment') {
    return createPRReviewCommentSlackMessage(data);
  } else if (eventType === 'issue_comment') {
    return createIssueCommentSlackMessage(data);
  } else {
    throw new Error(`Unknown event type: ${eventType}`);
  }
}

/**
 * Create Slack message for pull request notifications
 */
function createPRSlackMessage(data: any) {
  const { action, repositoryName, title, url, payload } = data;
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
    contextText = `${githubUserLink} opened this pull request in *${repositoryName}*`;
  } else if (action === "closed") {
    if (payload.pull_request?.merged) {
      contextText = `${githubUserLink} merged this pull request in *${repositoryName}*`;
    } else {
      contextText = `${githubUserLink} closed this pull request in *${repositoryName}*`;
    }
  } else if (action === "merged") {
    contextText = `${githubUserLink} merged this pull request in *${repositoryName}*`;
  } else if (action === "reopened") {
    contextText = `${githubUserLink} reopened this pull request in *${repositoryName}*`;
  } else if (action === "assigned") {
    contextText = `${githubUserLink} assigned someone to this pull request in *${repositoryName}*`;
  } else if (action === "review_requested") {
    contextText = `${githubUserLink} request a review for this pull request in *${repositoryName}*`;
  } else {
    contextText = `${githubUserLink} ${action} this pull request in *${repositoryName}*`;
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

  if (action in ["opened", "review_requested"]) {
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
 * Create Slack message for issue notifications
 */
function createIssueSlackMessage(data: any) {
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
    contextText = `${githubUserLink} opened this issue in *${repositoryName}*`;
  } else if (action === "closed") {
    contextText = `${githubUserLink} closed this issue in *${repositoryName}*`;
  } else if (action === "reopened") {
    contextText = `${githubUserLink} reopened this issue in *${repositoryName}*`;
  } else if (action === "assigned") {
    contextText = `${githubUserLink} assigned someone to this issue in *${repositoryName}*`;
  } else {
    contextText = `${githubUserLink} ${action} this issue in *${repositoryName}*`;
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
function createPRReviewSlackMessage(data: any) {
  const { action, repositoryName, title, message, url, payload } = data;
  
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
        text: `${icon} ${githubUserLink} ${reviewStateText} this pull request in *${repositoryName}*`
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
  
  // Add review comment if present
  if (payload.review?.body) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${processMarkdownForSlack(payload.review.body, 300)}`
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
function createPRReviewCommentSlackMessage(data: any) {
  const { repositoryName, title, message, url, payload } = data;
  const color = EVENT_COLORS.commented;
  
  // Create GitHub user link
  const user = payload.comment?.user?.login || payload.sender?.login;
  const githubUserLink = `<https://github.com/${user}|${user}>`;
  
  // Create blocks with PR title prominently displayed  
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `💬 ${githubUserLink} commented on this pull request in *${repositoryName}`
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
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: processMarkdownForSlack(payload.comment?.body || message, 1000)
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
  ];

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
function createIssueCommentSlackMessage(data: any) {
  const { repositoryName, title, url, payload } = data;
  const color = EVENT_COLORS.issue_commented;
  
  // Create GitHub user link
  const user = payload.comment?.user?.login || payload.sender?.login;
  const githubUserLink = `<https://github.com/${user}|${user}>`;
  
  // Check if this is a pull request by examining the URL
  const isPullRequest = url.includes('/pull/');
  
  // Set the appropriate title and context based on whether it's a PR or issue
  let contextText, viewText;
  if (isPullRequest) {
    contextText = `${githubUserLink} commented on this pull request in *${repositoryName}*`;
    viewText = "View PR";
  } else {
    contextText = `${githubUserLink} commented on this issue in *${repositoryName}*`;
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
  
  // Add comment content if available
  if (payload.comment?.body) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: processMarkdownForSlack(payload.comment.body, 300)
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
function processMarkdownForSlack(text: string, maxLength: number = 300): string {
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
  if (processed.length > maxLength) {
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