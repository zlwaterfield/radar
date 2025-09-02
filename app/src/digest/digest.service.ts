import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GitHubService } from '../github/services/github.service';
import { SlackService } from '../slack/services/slack.service';
import type { GitHubPullRequest } from '../common/types/github.types';
import type { 
  DigestPRCategory, 
  UserDigestData 
} from '../common/types/digest.types';

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly githubService: GitHubService,
    private readonly slackService: SlackService,
  ) {}

  /**
   * Get all users who have digest enabled
   */
  async getUsersWithDigestEnabled(): Promise<UserDigestData[]> {
    try {
      const users = await this.databaseService.user.findMany({
        where: {
          isActive: true,
          githubAccessToken: { not: null },
          githubLogin: { not: null },
        },
        include: {
          settings: true,
          repositories: {
            where: {
              enabled: true,
              isActive: true,
            },
          },
        },
      });

      // Filter users who have digest enabled
      const digestUsers = users.filter((user) => {
        const schedule = user.settings?.notificationSchedule as any;
        return schedule?.digest_enabled === true;
      });

      return digestUsers.map((user) => ({
        userId: user.id,
        userGithubLogin: user.githubLogin!,
        repositories: user.repositories.map((repo) => ({
          owner: repo.ownerName,
          repo: repo.name,
          githubId: repo.githubId,
        })),
        digestTime: (user.settings?.notificationSchedule as any)?.digest_time || '09:00',
        slackId: user.slackId || undefined,
        slackAccessToken: user.slackAccessToken || undefined,
      }));
    } catch (error) {
      this.logger.error('Error fetching users with digest enabled:', error);
      throw error;
    }
  }

  /**
   * Generate digest content for a user
   */
  async generateDigestForUser(userData: UserDigestData): Promise<DigestPRCategory> {
    try {
      this.logger.log(`Generating digest for user ${userData.userId}`);
      
      const digest: DigestPRCategory = {
        waitingOnUser: [],
        approvedReadyToMerge: [],
        userOpenPRs: [],
      };

      // Get user's access token
      const user = await this.databaseService.user.findUnique({
        where: { id: userData.userId },
        select: { githubAccessToken: true },
      });

      if (!user?.githubAccessToken) {
        this.logger.warn(`No GitHub access token for user ${userData.userId}`);
        return digest;
      }

      const accessToken = user.githubAccessToken;

      // Process each repository
      for (const repo of userData.repositories) {
        try {
          // Get open PRs for this repository
          const openPRs = await this.githubService.getPullRequests(
            repo.owner,
            repo.repo,
            'open',
            accessToken
          );

          for (const pr of openPRs) {
            // Category 1: PRs waiting on user (review requested)
            if (this.isPRWaitingOnUser(pr, userData.userGithubLogin)) {
              digest.waitingOnUser.push(pr);
            }
            // Category 2: PRs approved by user and ready to merge
            else if (await this.isPRApprovedByUserAndReady(pr, repo.owner, repo.repo, userData.userGithubLogin, accessToken)) {
              digest.approvedReadyToMerge.push(pr);
            }
            // Category 3: User's own open PRs
            else if (pr.user.login === userData.userGithubLogin) {
              digest.userOpenPRs.push(pr);
            }
          }
        } catch (error) {
          this.logger.warn(`Error processing repository ${repo.owner}/${repo.repo}:`, error);
          continue;
        }
      }

      this.logger.log(
        `Generated digest for user ${userData.userId}: ${digest.waitingOnUser.length} waiting, ${digest.approvedReadyToMerge.length} approved, ${digest.userOpenPRs.length} own PRs`
      );

      return digest;
    } catch (error) {
      this.logger.error(`Error generating digest for user ${userData.userId}:`, error);
      throw error;
    }
  }

  /**
   * Send digest to user via Slack
   */
  async sendDigestToUser(userData: UserDigestData, digest: DigestPRCategory): Promise<boolean> {
    try {
      if (!userData.slackId || !userData.slackAccessToken) {
        this.logger.warn(`User ${userData.userId} missing Slack credentials, skipping digest`);
        return false;
      }

      // Skip if no PRs to report
      const totalPRs = digest.waitingOnUser.length + digest.approvedReadyToMerge.length + digest.userOpenPRs.length;
      if (totalPRs === 0) {
        this.logger.log(`No PRs to report for user ${userData.userId}, skipping digest`);
        return true;
      }

      // Create digest message
      const message = this.createDigestSlackMessage(digest);

      // Send to Slack
      const result = await this.slackService.sendDirectMessage(
        userData.slackAccessToken,
        userData.slackId,
        message
      );

      if (result) {
        // Record digest in database
        await this.recordDigestSent(userData.userId, digest, result.ts);
        this.logger.log(`Successfully sent digest to user ${userData.userId}`);
        return true;
      } else {
        this.logger.warn(`Failed to send digest to user ${userData.userId}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error sending digest to user ${userData.userId}:`, error);
      return false;
    }
  }

  /**
   * Check if PR is waiting on user for review
   */
  private isPRWaitingOnUser(pr: GitHubPullRequest, userLogin: string): boolean {
    // Check if user is in requested_reviewers
    return pr.requested_reviewers.some((reviewer: any) => reviewer.login === userLogin);
  }

  /**
   * Check if PR is approved by user and ready to merge
   */
  private async isPRApprovedByUserAndReady(
    pr: GitHubPullRequest,
    owner: string,
    repo: string,
    userLogin: string,
    accessToken: string
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
        .filter(review => review.user?.login === userLogin)
        .find(review => review.state === 'APPROVED');

      return !!userApproval;
    } catch (error) {
      this.logger.warn(`Error checking PR approval status: ${error}`);
      return false;
    }
  }

  /**
   * Create Slack message for digest
   */
  private createDigestSlackMessage(digest: DigestPRCategory) {
    const blocks = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📊 Daily GitHub Digest',
        emoji: true
      }
    });

    // Waiting on user section
    if (digest.waitingOnUser.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔍 PRs waiting for your review (${digest.waitingOnUser.length})*`
        }
      });

      for (const pr of digest.waitingOnUser.slice(0, 5)) { // Limit to 5 PRs
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• <${pr.html_url}|*${pr.title}*>\n  \`${pr.base.repo.full_name}\` by ${pr.user.login}`
          }
        });
      }

      if (digest.waitingOnUser.length > 5) {
        blocks.push({
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `_...and ${digest.waitingOnUser.length - 5} more_`
          }]
        });
      }
    }

    // Approved and ready section
    if (digest.approvedReadyToMerge.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*✅ PRs you approved - ready to merge (${digest.approvedReadyToMerge.length})*`
        }
      });

      for (const pr of digest.approvedReadyToMerge.slice(0, 5)) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• <${pr.html_url}|*${pr.title}*>\n  \`${pr.base.repo.full_name}\` by ${pr.user.login}`
          }
        });
      }

      if (digest.approvedReadyToMerge.length > 5) {
        blocks.push({
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `_...and ${digest.approvedReadyToMerge.length - 5} more_`
          }]
        });
      }
    }

    // User's open PRs section
    if (digest.userOpenPRs.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🚀 Your open PRs (${digest.userOpenPRs.length})*`
        }
      });

      for (const pr of digest.userOpenPRs.slice(0, 5)) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• <${pr.html_url}|*${pr.title}*>\n  \`${pr.base.repo.full_name}\``
          }
        });
      }

      if (digest.userOpenPRs.length > 5) {
        blocks.push({
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `_...and ${digest.userOpenPRs.length - 5} more_`
          }]
        });
      }
    }

    // Footer
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `📅 ${new Date().toLocaleDateString()} • Manage digest settings in your dashboard`
      }]
    });

    return { blocks };
  }

  /**
   * Record that digest was sent
   */
  private async recordDigestSent(
    userId: string,
    digest: DigestPRCategory,
    messageTs?: string
  ): Promise<void> {
    try {
      await this.databaseService.userDigest.create({
        data: {
          userId,
          sentAt: new Date(),
          messageTs: messageTs || '',
          pullRequestCount: digest.waitingOnUser.length + digest.approvedReadyToMerge.length + digest.userOpenPRs.length,
          issueCount: 0, // We're only doing PRs for now
        },
      });
    } catch (error) {
      this.logger.warn(`Error recording digest for user ${userId}:`, error);
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
}