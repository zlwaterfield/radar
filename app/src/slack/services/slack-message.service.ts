import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  SlackMessage,
  GitHubPullRequest,
  GitHubIssue,
  NotificationData,
} from '@/common/types';

@Injectable()
export class SlackMessageService {
  private readonly logger = new Logger(SlackMessageService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Create pull request notification message
   */
  createPullRequestMessage(
    pr: GitHubPullRequest,
    eventType: string,
    repositoryName: string,
  ): SlackMessage {
    const action = this.getPRActionText(eventType, pr);
    const color = this.getPRColor(eventType, pr);

    return {
      channel: '',
      text: `${action} pull request in ${repositoryName}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${action}* pull request in \`${repositoryName}\``,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Title:*\n<${pr.html_url}|${pr.title}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Author:*\n<${pr.user.html_url}|@${pr.user.login}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${pr.state}${pr.merged ? ' (merged)' : ''}`,
            },
            {
              type: 'mrkdwn',
              text: `*Branch:*\n\`${pr.head.ref}\` → \`${pr.base.ref}\``,
            },
          ],
        },
      ],
      attachments: [
        {
          color,
          blocks: pr.body
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*Description:*\n${this.truncateText(pr.body, 200)}`,
                  },
                },
              ]
            : [],
        },
      ],
    };
  }

  /**
   * Create issue notification message
   */
  createIssueMessage(
    issue: GitHubIssue,
    eventType: string,
    repositoryName: string,
  ): SlackMessage {
    const action = this.getIssueActionText(eventType, issue);
    const color = this.getIssueColor(eventType, issue);

    return {
      channel: '',
      text: `${action} issue in ${repositoryName}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${action}* issue in \`${repositoryName}\``,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Title:*\n<${issue.html_url}|${issue.title}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Author:*\n<${issue.user.html_url}|@${issue.user.login}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${issue.state}`,
            },
            {
              type: 'mrkdwn',
              text: `*Labels:*\n${issue.labels?.map((l) => l.name).join(', ') || 'None'}`,
            },
          ],
        },
      ],
      attachments: [
        {
          color,
          blocks: issue.body
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*Description:*\n${this.truncateText(issue.body, 200)}`,
                  },
                },
              ]
            : [],
        },
      ],
    };
  }

  /**
   * Create digest message with multiple notifications
   */
  createDigestMessage(
    notifications: NotificationData[],
    timeWindow: string,
  ): SlackMessage {
    const pullRequests = notifications.filter((n) =>
      n.type.includes('pull_request'),
    );
    const issues = notifications.filter((n) => n.type.includes('issue'));

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🎯 Your GitHub Activity Digest (${timeWindow})`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary:* ${pullRequests.length} PR${pullRequests.length !== 1 ? 's' : ''}, ${issues.length} issue${issues.length !== 1 ? 's' : ''}`,
        },
      },
      {
        type: 'divider',
      },
    ];

    if (pullRequests.length > 0) {
      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🔄 Pull Requests*',
          },
        },
        ...this.createDigestPRBlocks(pullRequests.slice(0, 10)),
      );
    }

    if (issues.length > 0) {
      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🐛 Issues*',
          },
        },
        ...this.createDigestIssueBlocks(issues.slice(0, 10)),
      );
    }

    if (pullRequests.length + issues.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🌟 No new activity in your tracked repositories.',
        },
      });
    }

    return {
      channel: '',
      text: `GitHub Activity Digest (${timeWindow})`,
      blocks,
    };
  }

  /**
   * Create error notification message
   */
  createErrorMessage(error: string, context?: string): SlackMessage {
    return {
      channel: '',
      text: 'Radar Error Notification',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*⚠️ Radar Error*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error:* ${error}`,
          },
        },
      ],
      attachments: context
        ? [
            {
              color: 'danger',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*Context:* ${context}`,
                  },
                },
              ],
            },
          ]
        : [],
    };
  }

  /**
   * Create welcome message for new users
   */
  createWelcomeMessage(): SlackMessage {
    return {
      channel: '',
      text: 'Welcome to Radar!',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎯 Welcome to Radar!',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "Thanks for installing Radar! I'll help you track GitHub activity and keep you informed about what matters most.",
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Next steps:*\n• Visit the Home tab to configure your settings\n• Connect your GitHub repositories\n• Customize your notification preferences',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🚀 Get Started',
              },
              url: `${this.configService.get('app.frontendUrl')}/settings`,
              action_id: 'welcome_get_started',
              style: 'primary',
            },
          ],
        },
      ],
    };
  }

  /**
   * Get PR action text based on event type
   */
  private getPRActionText(eventType: string, pr: GitHubPullRequest): string {
    switch (eventType) {
      case 'pull_request.opened':
        return '🟢 Opened';
      case 'pull_request.closed':
        return pr.merged ? '🟣 Merged' : '🔴 Closed';
      case 'pull_request.reopened':
        return '🟡 Reopened';
      case 'pull_request.ready_for_review':
        return '👀 Ready for review';
      case 'pull_request.review_requested':
        return '📝 Review requested';
      case 'pull_request_review.submitted':
        return '✅ Reviewed';
      default:
        return '🔄 Updated';
    }
  }

  /**
   * Get PR color based on event type and state
   */
  private getPRColor(eventType: string, pr: GitHubPullRequest): string {
    if (pr.merged) return '#6f42c1';
    if (pr.state === 'closed') return '#d73a49';
    if (eventType === 'pull_request.opened') return '#28a745';
    return '#0366d6';
  }

  /**
   * Get issue action text based on event type
   */
  private getIssueActionText(eventType: string, issue: GitHubIssue): string {
    switch (eventType) {
      case 'issues.opened':
        return '🟢 Opened';
      case 'issues.closed':
        return '🔴 Closed';
      case 'issues.reopened':
        return '🟡 Reopened';
      case 'issues.assigned':
        return '👤 Assigned';
      case 'issue_comment.created':
        return '💬 Commented';
      default:
        return '🔄 Updated';
    }
  }

  /**
   * Get issue color based on event type and state
   */
  private getIssueColor(eventType: string, issue: GitHubIssue): string {
    if (issue.state === 'closed') return '#d73a49';
    if (eventType === 'issues.opened') return '#28a745';
    return '#0366d6';
  }

  /**
   * Create digest blocks for pull requests
   */
  private createDigestPRBlocks(prs: NotificationData[]): any[] {
    return prs.map((pr) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• <${pr.url}|${pr.title}> by @${pr.author} in \`${pr.repository}\``,
      },
    }));
  }

  /**
   * Create digest blocks for issues
   */
  private createDigestIssueBlocks(issues: NotificationData[]): any[] {
    return issues.map((issue) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• <${issue.url}|${issue.title}> by @${issue.author} in \`${issue.repository}\``,
      },
    }));
  }

  /**
   * Truncate text to specified length with ellipsis
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
