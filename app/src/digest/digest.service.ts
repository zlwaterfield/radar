import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GitHubService } from '../github/services/github.service';
import { SlackService } from '../slack/services/slack.service';
import { DigestConfigService } from './digest-config.service';
import { GitHubIntegrationService } from '../integrations/services/github-integration.service';
import type { GitHubPullRequest } from '../common/types/github.types';
import type {
  DigestPRCategory,
  DigestExecutionData,
  DigestScopeType,
} from '../common/types/digest.types';

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly githubService: GitHubService,
    private readonly slackService: SlackService,
    private readonly digestConfigService: DigestConfigService,
    private readonly githubIntegrationService: GitHubIntegrationService,
  ) {}

  /**
   * Check if PR is waiting on user for review
   */
  private isPRWaitingOnUser(pr: GitHubPullRequest, userLogin: string): boolean {
    // Check if user is in requested_reviewers
    return pr.requested_reviewers.some(
      (reviewer: any) => reviewer.login === userLogin,
    );
  }

  /**
   * Check if PR is approved by user and ready to merge
   */
  private async isPRApprovedByUserAndReady(
    pr: GitHubPullRequest,
    owner: string,
    repo: string,
    userLogin: string,
    accessToken: string,
  ): Promise<boolean> {
    try {
      // Check if PR is mergeable
      if (!pr.mergeable || pr.draft) {
        return false;
      }

      // Get PR reviews to check if user approved
      const octokit = this.githubService.createUserClient(accessToken);
      const { data: reviews } = await octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: pr.number,
      });

      // Check if user has approved this PR
      const userApproval = reviews
        .filter((review) => review.user?.login === userLogin)
        .find((review) => review.state === 'APPROVED');

      return !!userApproval;
    } catch (error) {
      this.logger.warn(`Error checking PR approval status: ${error}`);
      return false;
    }
  }

  /**
   * Calculate the next digest time for a user
   */
  calculateUserDigestTime(digestTime: string): Date {
    const now = new Date();
    const [hours, minutes] = digestTime.split(':').map(Number);

    const nextDigest = new Date();
    nextDigest.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (nextDigest <= now) {
      nextDigest.setDate(nextDigest.getDate() + 1);
    }

    return nextDigest;
  }

  // NEW METHODS FOR MULTIPLE DIGEST CONFIGURATIONS

  /**
   * Generate digest content for a specific digest configuration
   */
  async generateDigestForConfig(
    executionData: DigestExecutionData,
  ): Promise<DigestPRCategory> {
    try {
      this.logger.log(
        `Generating digest for config ${executionData.configId} (user ${executionData.userId})`,
      );

      const digest: DigestPRCategory = {
        waitingOnUser: [],
        approvedReadyToMerge: [],
        userOpenPRs: [],
      };

      // Get user's access token
      const user = await this.databaseService.user.findUnique({
        where: { id: executionData.userId },
        select: { githubAccessToken: true },
      });

      if (!user?.githubAccessToken) {
        this.logger.warn(
          `No GitHub access token for user ${executionData.userId}`,
        );
        return digest;
      }

      const accessToken = user.githubAccessToken;

      // Process each repository configured for this digest
      for (const repo of executionData.repositories) {
        let currentAccessToken = accessToken;
        let retryCount = 0;
        const maxRetries = 1;

        while (retryCount <= maxRetries) {
          try {
            await this.processRepositoryForDigest(
              repo,
              digest,
              executionData,
              currentAccessToken,
            );
            break; // Success, exit retry loop
          } catch (error) {
            if (error.status === 401 && retryCount < maxRetries) {
              // Token refresh attempt
              this.logger.warn(
                `GitHub token invalid for user ${executionData.userId} - attempting token refresh`,
              );

              const newAccessToken =
                await this.githubIntegrationService.refreshAccessToken(
                  executionData.userId,
                );

              if (newAccessToken) {
                this.logger.log(
                  `Successfully refreshed token for user ${executionData.userId}, retrying repository ${repo.owner}/${repo.repo}`,
                );
                currentAccessToken = newAccessToken;
                retryCount++;
                continue; // Retry with new token
              }

              this.logger.warn(
                `Token refresh failed for user ${executionData.userId} - needs manual re-authentication`,
              );
              throw new Error('GITHUB_TOKEN_INVALID');
            }

            // Non-401 error or max retries exceeded
            this.logger.warn(
              `Error processing repository ${repo.owner}/${repo.repo} for config ${executionData.configId}:`,
              error,
            );
            break; // Exit retry loop, continue to next repo
          }
        }
      }

      this.logger.log(
        `Generated digest for config ${executionData.configId}: ${digest.waitingOnUser.length} waiting, ${digest.approvedReadyToMerge.length} approved, ${digest.userOpenPRs.length} own PRs`,
      );

      return digest;
    } catch (error) {
      this.logger.error(
        `Error generating digest for config ${executionData.configId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send digest using the configured delivery method
   */
  async sendDigestForConfig(
    executionData: DigestExecutionData,
    digest: DigestPRCategory,
  ): Promise<boolean> {
    try {
      const { config, deliveryInfo } = executionData;

      // Skip if no PRs to report
      const totalPRs =
        digest.waitingOnUser.length +
        digest.approvedReadyToMerge.length +
        digest.userOpenPRs.length;
      if (totalPRs === 0) {
        this.logger.log(
          `No PRs to report for config ${config.id}, skipping digest`,
        );
        return true;
      }

      // Create digest message
      const message = this.createDigestSlackMessage(digest, config.name);

      let result: any = null;

      // Send based on delivery type
      if (deliveryInfo.type === 'dm') {
        if (!deliveryInfo.slackId || !deliveryInfo.slackAccessToken) {
          this.logger.warn(
            `Config ${config.id} missing Slack credentials for DM delivery`,
          );
          return false;
        }

        result = await this.slackService.sendDirectMessage(
          deliveryInfo.slackAccessToken,
          deliveryInfo.slackId,
          message,
        );
      } else if (deliveryInfo.type === 'channel') {
        if (!deliveryInfo.target || !deliveryInfo.slackAccessToken) {
          this.logger.warn(
            `Config ${config.id} missing channel or Slack token for channel delivery`,
          );
          return false;
        }

        result = await this.slackService.sendChannelMessage(
          deliveryInfo.slackAccessToken,
          deliveryInfo.target,
          message,
        );
      }

      if (result) {
        // Record digest in database
        await this.recordDigestSentForConfig(executionData, digest, result.ts);
        this.logger.log(`Successfully sent digest for config ${config.id}`);
        return true;
      } else {
        this.logger.warn(`Failed to send digest for config ${config.id}`);
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Error sending digest for config ${executionData.configId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Check if PR is within the digest scope (user or team)
   */
  private isPRInScope(
    pr: GitHubPullRequest,
    scopeType: DigestScopeType,
    userLogin: string,
  ): boolean {
    // For now, we only support user scope since team filtering would require
    // more complex team membership checks against PR authors/reviewers
    if (scopeType === 'user') {
      return true; // User scope includes all PRs user is involved in
    } else if (scopeType === 'team') {
      // For team scope, we would need to check if PR author/reviewers are team members
      // This would require GitHub API calls to check team membership
      // For now, return true and implement proper team filtering later
      return true;
    }
    return true;
  }

  /**
   * Create Slack message for digest with config name
   */
  private createDigestSlackMessage(
    digest: DigestPRCategory,
    configName?: string,
  ) {
    const blocks = [];

    // Header with config name if provided
    const headerText = configName
      ? `📊 ${configName} - Daily GitHub Digest`
      : '📊 Daily GitHub Digest';

    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText,
        emoji: true,
      },
    });

    // Rest of the message is the same as the original
    if (digest.waitingOnUser.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔍 PRs waiting for your review (${digest.waitingOnUser.length})*`,
        },
      });

      for (const pr of digest.waitingOnUser.slice(0, 5)) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• <${pr.html_url}|*${pr.title}*>\n  \`${pr.base.repo.full_name}\` by ${pr.user.login}`,
          },
        });
      }

      if (digest.waitingOnUser.length > 5) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_...and ${digest.waitingOnUser.length - 5} more_`,
            },
          ],
        });
      }
    }

    if (digest.approvedReadyToMerge.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*✅ PRs you approved - ready to merge (${digest.approvedReadyToMerge.length})*`,
        },
      });

      for (const pr of digest.approvedReadyToMerge.slice(0, 5)) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• <${pr.html_url}|*${pr.title}*>\n  \`${pr.base.repo.full_name}\` by ${pr.user.login}`,
          },
        });
      }

      if (digest.approvedReadyToMerge.length > 5) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_...and ${digest.approvedReadyToMerge.length - 5} more_`,
            },
          ],
        });
      }
    }

    if (digest.userOpenPRs.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🚀 Your open PRs (${digest.userOpenPRs.length})*`,
        },
      });

      for (const pr of digest.userOpenPRs.slice(0, 5)) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• <${pr.html_url}|*${pr.title}*>\n  \`${pr.base.repo.full_name}\``,
          },
        });
      }

      if (digest.userOpenPRs.length > 5) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_...and ${digest.userOpenPRs.length - 5} more_`,
            },
          ],
        });
      }
    }

    // Footer
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📅 ${new Date().toLocaleDateString()} • Manage digest settings in your dashboard`,
        },
      ],
    });

    return { blocks };
  }

  /**
   * Process a single repository for digest generation
   */
  private async processRepositoryForDigest(
    repo: { owner: string; repo: string; githubId: string },
    digest: DigestPRCategory,
    executionData: DigestExecutionData,
    accessToken: string,
  ): Promise<void> {
    // Get open PRs for this repository
    const openPRs = await this.githubService.getPullRequests(
      repo.owner,
      repo.repo,
      'open',
      accessToken,
    );

    for (const pr of openPRs) {
      // Filter PRs based on digest scope
      if (
        !this.isPRInScope(
          pr,
          executionData.config.scopeType,
          executionData.userGithubLogin,
        )
      ) {
        continue;
      }

      // Category 1: PRs waiting on user (review requested)
      if (this.isPRWaitingOnUser(pr, executionData.userGithubLogin)) {
        digest.waitingOnUser.push(pr);
      }
      // Category 2: PRs approved by user and ready to merge
      else if (
        await this.isPRApprovedByUserAndReady(
          pr,
          repo.owner,
          repo.repo,
          executionData.userGithubLogin,
          accessToken,
        )
      ) {
        digest.approvedReadyToMerge.push(pr);
      }
      // Category 3: User's own open PRs
      else if (pr.user.login === executionData.userGithubLogin) {
        digest.userOpenPRs.push(pr);
      }
    }
  }

  /**
   * Record that digest was sent for a specific configuration
   */
  private async recordDigestSentForConfig(
    executionData: DigestExecutionData,
    digest: DigestPRCategory,
    messageTs?: string,
  ): Promise<void> {
    try {
      await this.databaseService.userDigest.create({
        data: {
          userId: executionData.userId,
          digestConfigId: executionData.configId,
          sentAt: new Date(),
          messageTs: messageTs || '',
          pullRequestCount:
            digest.waitingOnUser.length +
            digest.approvedReadyToMerge.length +
            digest.userOpenPRs.length,
          issueCount: 0,
          deliveryType: executionData.deliveryInfo.type,
          deliveryTarget: executionData.deliveryInfo.target || null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Error recording digest for config ${executionData.configId}:`,
        error,
      );
    }
  }
}
