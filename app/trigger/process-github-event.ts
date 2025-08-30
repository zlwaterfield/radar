import { task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";
import { WebClient } from "@slack/web-api";

// Initialize Prisma client for the task
const prisma = new PrismaClient();

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
    
    // Here we would:
    // 1. Get relevant users for this repository
    // 2. Check their notification preferences 
    // 3. Create and send notifications via Slack
    // 4. Store notification records
    
    // Process notifications for this event
    
    const { eventType, action, payload, repositoryName } = event;
    
    // Get users who should receive this notification
    const relevantUsers = await getRelevantUsers(repositoryName, payload);
    
    if (relevantUsers.length === 0) {
      console.log(`No relevant users found for ${eventType} in ${repositoryName}`);
      return true;
    }

    // Create notifications for each relevant user
    let notificationCount = 0;
    for (const user of relevantUsers) {
      const shouldNotify = await shouldNotifyUser(user, eventType, action, payload);
      
      if (shouldNotify) {
        // This is where we'd create and send the actual notification
        const notification = await createNotification(user, event, eventType, action, payload, repositoryName);
        if (notification) {
          notificationCount++;
        }
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
    const eventKey = getNotificationPreferenceKey(eventType, action);
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
  repositoryName: string
): Promise<any> {
  try {
    const title = generateNotificationTitle(eventType, action, payload);
    const message = generateNotificationMessage(eventType, action, payload);
    const url = payload.html_url || payload.pull_request?.html_url || payload.issue?.html_url;
    
    // Create notification record
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

/**
 * Create Slack message structure
 */
function createSlackMessage(data: any) {
  const { eventType, action, repositoryName, title, message, url, payload } = data;
  
  if (eventType === 'pull_request') {
    return createPRSlackMessage(data);
  } else if (eventType === 'issues') {
    return createIssueSlackMessage(data);
  } else {
    return createGenericSlackMessage(data);
  }
}

/**
 * Create Slack message for pull request notifications
 */
function createPRSlackMessage(data: any) {
  const actionText = getPRActionText(`${data.eventType}.${data.action}`);
  const color = getPRColor(`${data.eventType}.${data.action}`, data.payload);

  return {
    text: `${actionText} pull request in ${data.repositoryName}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${actionText}* pull request in \`${data.repositoryName}\``,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Title:*\n<${data.url}|${data.title}>`,
          },
          {
            type: 'mrkdwn',
            text: `*Author:*\n@${data.payload.pull_request?.user?.login || data.payload.sender?.login}`,
          },
          {
            type: 'mrkdwn',
            text: `*PR #:*\n${data.payload.pull_request?.number || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Branch:*\n\`${data.payload.pull_request?.head?.ref}\` → \`${data.payload.pull_request?.base?.ref}\``,
          },
        ],
      },
    ],
    attachments: data.message && data.message !== data.title ? [
      {
        color,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Description:*\n${truncateText(data.message, 300)}`,
            },
          },
        ],
      },
    ] : [],
  };
}

/**
 * Create Slack message for issue notifications
 */
function createIssueSlackMessage(data: any) {
  const actionText = getIssueActionText(`${data.eventType}.${data.action}`);
  const color = getIssueColor(`${data.eventType}.${data.action}`);

  return {
    text: `${actionText} issue in ${data.repositoryName}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${actionText}* issue in \`${data.repositoryName}\``,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Title:*\n<${data.url}|${data.title}>`,
          },
          {
            type: 'mrkdwn',
            text: `*Author:*\n@${data.payload.issue?.user?.login || data.payload.sender?.login}`,
          },
          {
            type: 'mrkdwn',
            text: `*Issue #:*\n${data.payload.issue?.number || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Labels:*\n${data.payload.issue?.labels?.map((l: any) => l.name).join(', ') || 'None'}`,
          },
        ],
      },
    ],
    attachments: data.message && data.message !== data.title ? [
      {
        color,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Description:*\n${truncateText(data.message, 300)}`,
            },
          },
        ],
      },
    ] : [],
  };
}

/**
 * Create generic Slack message for other notification types
 */
function createGenericSlackMessage(data: any) {
  return {
    text: `${data.title} in ${data.repositoryName}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*<${data.url}|${data.title}>*\nby @${data.payload.sender?.login} in \`${data.repositoryName}\``,
        },
      },
      data.message && data.message !== data.title ? {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: truncateText(data.message, 300),
        },
      } : null,
    ].filter(Boolean),
  };
}

/**
 * Get PR action text
 */
function getPRActionText(type: string): string {
  const mapping: Record<string, string> = {
    'pull_request.opened': '🟢 Opened',
    'pull_request.closed': '🔴 Closed',
    'pull_request.merged': '🟣 Merged',
    'pull_request.reopened': '🟡 Reopened',
    'pull_request_review.submitted': '✅ Reviewed',
    'pull_request_review_comment.created': '💬 Commented',
  };

  return mapping[type] || '🔄 Updated';
}

/**
 * Get PR color
 */
function getPRColor(type: string, payload: any): string {
  if (payload.pull_request?.merged) return '#6f42c1';
  if (type === 'pull_request.closed') return '#d73a49';
  if (type === 'pull_request.opened') return '#28a745';
  return '#0366d6';
}

/**
 * Get issue action text
 */
function getIssueActionText(type: string): string {
  const mapping: Record<string, string> = {
    'issues.opened': '🟢 Opened',
    'issues.closed': '🔴 Closed',
    'issues.reopened': '🟡 Reopened',
    'issues.assigned': '👤 Assigned',
    'issue_comment.created': '💬 Commented',
  };

  return mapping[type] || '🔄 Updated';
}

/**
 * Get issue color
 */
function getIssueColor(type: string): string {
  if (type === 'issues.closed') return '#d73a49';
  if (type === 'issues.opened') return '#28a745';
  return '#0366d6';
}

/**
 * Truncate text to specified length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get notification preference key based on event type and action
 */
function getNotificationPreferenceKey(eventType: string, action: string): string | null {
  if (eventType === 'pull_request') {
    switch (action) {
      case 'opened':
        return 'pull_request_opened';
      case 'closed':
        return 'pull_request_closed';
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
    return `${sender} ${action} pull request #${prNumber} in ${repoName}`;
  } else if (eventType === 'issues') {
    const issueNumber = payload.issue?.number;
    return `${sender} ${action} issue #${issueNumber} in ${repoName}`;
  } else if (eventType === 'issue_comment') {
    const issueNumber = payload.issue?.number;
    return `${sender} commented on issue #${issueNumber} in ${repoName}`;
  } else if (eventType === 'pull_request_review') {
    const prNumber = payload.pull_request?.number;
    return `${sender} reviewed pull request #${prNumber} in ${repoName}`;
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