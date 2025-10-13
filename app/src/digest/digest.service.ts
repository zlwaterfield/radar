import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GitHubService } from '../github/services/github.service';
import { SlackService } from '../slack/services/slack.service';
import { DigestConfigService } from './digest-config.service';
import { GitHubIntegrationService } from '../integrations/services/github-integration.service';
import { AnalyticsService } from '../analytics/analytics.service';
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
    private readonly analyticsService: AnalyticsService,
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
   * Check if user's PR is approved by others and ready to merge
   */
  private async isPRApprovedByOthersAndReady(
    pr: GitHubPullRequest,
    owner: string,
    repo: string,
    userLogin: string,
    accessToken: string,
  ): Promise<boolean> {
    try {
      // Must be user's own PR
      if (pr.user.login !== userLogin) {
        return false;
      }

      // Check if PR is not a draft
      if (pr.draft) {
        this.logger.debug(`PR #${pr.number} is draft, not ready to merge`);
        return false;
      }

      // Check if PR is mergeable (null means unknown, treat as potentially mergeable)
      if (pr.mergeable === false) {
        this.logger.debug(`PR #${pr.number} is not mergeable, skipping`);
        return false;
      }

      // Get PR reviews to check if others have approved
      const octokit = this.githubService.createUserClient(accessToken);
      const { data: reviews } = await octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: pr.number,
      });

      // Check if there are any approvals from other users (not the PR author)
      const otherApprovals = reviews
        .filter((review) => review.user?.login !== userLogin)
        .filter((review) => review.state === 'APPROVED');

      this.logger.debug(
        `PR #${pr.number} has ${otherApprovals.length} approvals from others`,
      );

      return otherApprovals.length > 0;
    } catch (error) {
      this.logger.warn(`Error checking PR approval status: ${error}`);
      return false;
    }
  }

  /**
   * Check if current time matches user's digest time (within 15-minute window)
   * and if today is one of the configured days
   */
  isDigestTimeMatched(
    digestTime: string,
    timezone: string,
    daysOfWeek: number[],
    now: Date = new Date(),
  ): boolean {
    const [hours, minutes] = digestTime.split(':').map(Number);

    // Round minutes to nearest 15-minute interval
    const roundedMinutes = Math.floor(minutes / 15) * 15;

    // Convert current time to user's timezone
    const userTime = new Date(
      now.toLocaleString('en-US', { timeZone: timezone }),
    );

    // Check if current day is in the configured days
    const currentDay = userTime.getDay(); // 0=Sunday, 6=Saturday
    if (!daysOfWeek.includes(currentDay)) {
      return false;
    }

    return (
      userTime.getHours() === hours && userTime.getMinutes() === roundedMinutes
    );
  }

  /**
   * Check if digest was already sent today for this config
   */
  async wasDigestSentToday(
    configId: string,
    timezone: string,
  ): Promise<boolean> {
    // Get current time in user's timezone
    const now = new Date();
    const userTime = new Date(
      now.toLocaleString('en-US', { timeZone: timezone }),
    );

    // Create start of day (00:00:00) in user's timezone
    const today = new Date(userTime);
    today.setHours(0, 0, 0, 0);

    // Create start of next day in user's timezone
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingDigest = await this.databaseService.userDigest.findFirst({
      where: {
        digestConfigId: configId,
        sentAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return !!existingDigest;
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
        userDraftPRs: [],
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

      // Fetch team members if scope is 'team'
      let teamMemberLogins: string[] = [];
      if (
        executionData.config.scopeType === 'team' &&
        executionData.config.scopeValue
      ) {
        teamMemberLogins = await this.getTeamMemberLogins(
          executionData.config.scopeValue,
          executionData.userId,
          accessToken,
        );
      }

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
              teamMemberLogins,
            );
            break; // Success, exit retry loop
          } catch (error) {
            if (error.status === 401 && retryCount < maxRetries) {
              // Token refresh attempt
              this.logger.warn(
                `GitHub token invalid for user ${executionData.userId} - attempting token refresh`,
              );

              const newAccessToken =
                await this.githubIntegrationService.getValidTokenForApiCall(
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
        `Generated digest for config ${executionData.configId}: ${digest.waitingOnUser.length} waiting, ${digest.approvedReadyToMerge.length} approved, ${digest.userOpenPRs.length} open PRs, ${digest.userDraftPRs.length} draft PRs`,
      );

      return digest;
    } catch (error) {
      this.logger.error(
        `Error generating digest for config ${executionData.configId}:`,
        error,
      );
      await this.analyticsService.trackError(
        executionData.userId,
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'digest_generation',
          configId: executionData.configId,
          category: 'digest_critical',
        },
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
        digest.userOpenPRs.length +
        digest.userDraftPRs.length;
      if (totalPRs === 0) {
        this.logger.log(
          `No PRs to report for config ${config.id}, skipping digest`,
        );
        return true;
      }

      // Get team name if scope is 'team'
      let teamName: string | undefined;
      if (config.scopeType === 'team' && config.scopeValue) {
        const userTeam = await this.databaseService.userTeam.findFirst({
          where: {
            userId: executionData.userId,
            teamId: config.scopeValue,
          },
          select: {
            teamName: true,
          },
        });
        teamName = userTeam?.teamName;
      }

      // Create digest message
      const message = this.createDigestSlackMessage(
        digest,
        config.name,
        config.scopeType,
        teamName,
        executionData.userGithubLogin,
      );

      let result: any = null;

      // Send based on delivery type
      if (deliveryInfo.type === 'dm') {
        if (!deliveryInfo.slackId || !deliveryInfo.slackBotToken) {
          this.logger.warn(
            `Config ${config.id} missing Slack credentials for DM delivery`,
          );
          return false;
        }

        result = await this.slackService.sendDirectMessage(
          deliveryInfo.slackBotToken,
          deliveryInfo.slackId,
          message,
        );
      } else if (deliveryInfo.type === 'channel') {
        if (!deliveryInfo.target || !deliveryInfo.slackBotToken) {
          this.logger.warn(
            `Config ${config.id} missing channel or Slack bot token for channel delivery`,
          );
          return false;
        }

        result = await this.slackService.sendChannelMessage(
          deliveryInfo.slackBotToken,
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
      await this.analyticsService.trackError(
        executionData.userId,
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'digest_delivery',
          configId: executionData.configId,
          deliveryType: executionData.deliveryInfo.type,
          category: 'digest_critical',
        },
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
    teamMemberLogins?: string[],
  ): boolean {
    if (scopeType === 'user') {
      // For user scope, include PRs where:
      // 1. User is the author
      // 2. User is requested as reviewer
      // 3. User is assigned to the PR

      // Check if user is the PR author
      if (pr.user.login === userLogin) {
        return true;
      }

      // Check if user is a requested reviewer
      const isRequestedReviewer = pr.requested_reviewers.some(
        (reviewer: any) => reviewer.login === userLogin,
      );
      if (isRequestedReviewer) {
        return true;
      }

      // Check if user is assigned to the PR
      const isAssigned =
        pr.assignees &&
        pr.assignees.some((assignee: any) => assignee.login === userLogin);
      if (isAssigned) {
        return true;
      }

      return false;
    }

    if (scopeType === 'team' && teamMemberLogins && teamMemberLogins.length > 0) {
      // For team scope, include PRs where any team member is involved
      return this.isPRInTeamScope(pr, teamMemberLogins);
    }

    return false;
  }

  /**
   * Check if PR involves any team members
   */
  private isPRInTeamScope(
    pr: GitHubPullRequest,
    teamMemberLogins: string[],
  ): boolean {
    // Check if PR author is a team member
    if (teamMemberLogins.includes(pr.user.login)) {
      return true;
    }

    // Check if any requested reviewer is a team member
    const reviewerLogins = pr.requested_reviewers.map((r: any) => r.login);
    const hasTeamReviewer = pr.requested_reviewers.some((reviewer: any) =>
      teamMemberLogins.includes(reviewer.login),
    );
    if (hasTeamReviewer) {
      return true;
    }

    // Check if any assignee is a team member
    const assigneeLogins = pr.assignees?.map((a: any) => a.login) || [];
    const hasTeamAssignee =
      pr.assignees &&
      pr.assignees.some((assignee: any) =>
        teamMemberLogins.includes(assignee.login),
      );
    if (hasTeamAssignee) {
      return true;
    }

    return false;
  }

  /**
   * Create Slack message for digest with config name
   */
  private createDigestSlackMessage(
    digest: DigestPRCategory,
    configName?: string,
    scopeType?: DigestScopeType,
    teamName?: string,
    currentUserLogin?: string,
  ) {
    const blocks = [];
    const attachments = [];

    // Determine if this is a team-scoped digest
    const isTeamScope = scopeType === 'team';
    const scopeContext = isTeamScope && teamName ? teamName : 'your';

    // Header with config name if provided
    const headerText = configName
      ? `${configName} - Radar digest`
      : 'Radar digest';

    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText,
        emoji: true,
      },
    });

    // PRs waiting for user review (red color)
    if (digest.waitingOnUser.length > 0) {
      const waitingText = isTeamScope
        ? `*PRs waiting for review (${digest.waitingOnUser.length})*`
        : `*PRs waiting for your review (${digest.waitingOnUser.length})*`;

      const waitingBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: waitingText,
          },
        },
      ];

      for (const pr of digest.waitingOnUser.slice(0, 5)) {
        waitingBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• <${pr.html_url}|*${pr.title} (#${pr.number})*>\n  ${pr.base.repo.full_name} (<https://github.com/${pr.user.login}|${pr.user.login}>)`,
          },
        });
      }

      if (digest.waitingOnUser.length > 5) {
        waitingBlocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_...and ${digest.waitingOnUser.length - 5} more_`,
            },
          ],
        } as any);
      }

      attachments.push({
        color: '#f56565', // Pastel red
        blocks: waitingBlocks,
      });
    }

    // User's PRs approved and ready to merge (green color)
    if (digest.approvedReadyToMerge.length > 0) {
      const approvedText = isTeamScope
        ? `*PRs approved and ready to merge (${digest.approvedReadyToMerge.length})*`
        : `*Your PRs approved and ready to merge (${digest.approvedReadyToMerge.length})*`;

      const approvedBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: approvedText,
          },
        },
      ];

      for (const pr of digest.approvedReadyToMerge.slice(0, 5)) {
        approvedBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• <${pr.html_url}|*${pr.title} (#${pr.number})*>\n  ${pr.base.repo.full_name}`,
          },
        });
      }

      if (digest.approvedReadyToMerge.length > 5) {
        approvedBlocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_...and ${digest.approvedReadyToMerge.length - 5} more_`,
            },
          ],
        } as any);
      }

      attachments.push({
        color: '#48bb78', // Pastel green
        blocks: approvedBlocks,
      });
    }

    // User's open PRs (yellow/orange color)
    if (digest.userOpenPRs.length > 0) {
      const openText = isTeamScope
        ? `*Open PRs (${digest.userOpenPRs.length})*`
        : `*Your open PRs (${digest.userOpenPRs.length})*`;

      const openBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: openText,
          },
        },
      ];

      for (const pr of digest.userOpenPRs.slice(0, 5)) {
        const authorInfo = pr.user.login !== currentUserLogin
          ? ` (<https://github.com/${pr.user.login}|${pr.user.login}>)`
          : '';
        openBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• <${pr.html_url}|*${pr.title} (#${pr.number})*>\n  ${pr.base.repo.full_name}${authorInfo}`,
          },
        });
      }

      if (digest.userOpenPRs.length > 5) {
        openBlocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_...and ${digest.userOpenPRs.length - 5} more_`,
            },
          ],
        } as any);
      }

      attachments.push({
        color: '#ed8936', // Pastel orange
        blocks: openBlocks,
      });
    }

    // User's draft PRs (blue color)
    if (digest.userDraftPRs.length > 0) {
      const draftText = isTeamScope
        ? `*Draft PRs (${digest.userDraftPRs.length})*`
        : `*Your draft PRs (${digest.userDraftPRs.length})*`;

      const draftBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: draftText,
          },
        },
      ];

      for (const pr of digest.userDraftPRs.slice(0, 5)) {
        const authorInfo = pr.user.login !== currentUserLogin
          ? ` (<https://github.com/${pr.user.login}|${pr.user.login}>)`
          : '';
        draftBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• <${pr.html_url}|*${pr.title} (#${pr.number})*>\n  ${pr.base.repo.full_name}${authorInfo}`,
          },
        });
      }

      if (digest.userDraftPRs.length > 5) {
        draftBlocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_...and ${digest.userDraftPRs.length - 5} more_`,
            },
          ],
        } as any);
      }

      attachments.push({
        color: '#4299e1', // Pastel blue
        blocks: draftBlocks,
      });
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

    return { blocks, attachments };
  }

  /**
   * Get team member logins for a given team ID
   */
  private async getTeamMemberLogins(
    teamId: string,
    userId: string,
    accessToken: string,
  ): Promise<string[]> {
    try {
      this.logger.log(
        `[GET TEAM MEMBERS] Looking up team ${teamId} for user ${userId}`,
      );

      // Get team details from database
      const userTeam = await this.databaseService.userTeam.findFirst({
        where: {
          userId,
          teamId,
        },
        select: {
          organization: true,
          teamSlug: true,
          teamName: true,
        },
      });

      if (!userTeam) {
        this.logger.warn(
          `[GET TEAM MEMBERS] ✗ Team ${teamId} not found for user ${userId}`,
        );
        return [];
      }

      this.logger.log(
        `[GET TEAM MEMBERS] Found team: ${userTeam.teamName} (${userTeam.organization}/${userTeam.teamSlug})`,
      );

      // Fetch team members from GitHub
      const memberLogins = await this.githubService.getTeamMembers(
        userTeam.organization,
        userTeam.teamSlug,
        accessToken,
      );

      this.logger.log(
        `[GET TEAM MEMBERS] ✓ Fetched ${memberLogins.length} members from GitHub: ${JSON.stringify(memberLogins)}`,
      );

      return memberLogins;
    } catch (error) {
      this.logger.error(
        `[GET TEAM MEMBERS] ✗ Error fetching team members for team ${teamId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Process a single repository for digest generation
   */
  private async processRepositoryForDigest(
    repo: { owner: string; repo: string; githubId: string },
    digest: DigestPRCategory,
    executionData: DigestExecutionData,
    accessToken: string,
    teamMemberLogins: string[] = [],
  ): Promise<void> {
    // Get open PRs for this repository
    const openPRs = await this.githubService.getPullRequests(
      repo.owner,
      repo.repo,
      'open',
      accessToken,
    );

    this.logger.log(
      `[Digest Debug] Found ${openPRs.length} open PRs in ${repo.owner}/${repo.repo}`,
    );

    for (const pr of openPRs) {
      this.logger.log(
        `[Digest Debug] Processing PR #${pr.number}: "${pr.title}" by ${pr.user.login}, draft: ${pr.draft}, state: ${pr.state}`,
      );

      // Filter PRs based on digest scope
      if (
        !this.isPRInScope(
          pr,
          executionData.config.scopeType,
          executionData.userGithubLogin,
          teamMemberLogins,
        )
      ) {
        this.logger.log(
          `[Digest Debug] PR #${pr.number} NOT in scope (scopeType: ${executionData.config.scopeType}, userLogin: ${executionData.userGithubLogin})`,
        );
        continue;
      }

      this.logger.log(`[Digest Debug] PR #${pr.number} IS in scope`);

      // Check if this is the user's own PR first
      const isUsersPR = pr.user.login === executionData.userGithubLogin;
      const isWaitingOnUser = this.isPRWaitingOnUser(pr, executionData.userGithubLogin);

      this.logger.log(
        `[CATEGORIZATION] PR #${pr.number}: isUsersPR=${isUsersPR}, isWaitingOnUser=${isWaitingOnUser}, scopeType=${executionData.config.scopeType}, teamMembersCount=${teamMemberLogins.length}`,
      );

      if (isUsersPR) {
        this.logger.log(
          `[Digest Debug] Processing user's own PR #${pr.number}: ${pr.title}`,
        );

        // Category 2: User's PRs approved by others and ready to merge
        const isApprovedAndReady = await this.isPRApprovedByOthersAndReady(
          pr,
          repo.owner,
          repo.repo,
          executionData.userGithubLogin,
          accessToken,
        );

        if (isApprovedAndReady) {
          this.logger.log(
            `[Digest Debug] PR #${pr.number} categorized as approvedReadyToMerge`,
          );
          digest.approvedReadyToMerge.push(pr);
        }
        // Category 3 & 4: User's own PRs (separate draft from not-yet-approved)
        else if (pr.draft) {
          this.logger.log(`[Digest Debug] PR #${pr.number} categorized as userDraftPRs (draft=${pr.draft})`);
          digest.userDraftPRs.push(pr);
        } else {
          this.logger.log(`[Digest Debug] PR #${pr.number} categorized as userOpenPRs`);
          digest.userOpenPRs.push(pr);
        }
      }
      // For team scope: categorize team member PRs differently
      // Include both PRs waiting on user AND other team member PRs
      else if (executionData.config.scopeType === 'team' && teamMemberLogins.length > 0) {
        this.logger.log(
          `[TEAM MEMBER PR] PR #${pr.number} is team member's PR (author: ${pr.user.login})`,
        );
        this.logger.log(
          `[TEAM MEMBER PR] PR #${pr.number} isWaitingOnUser=${isWaitingOnUser}, draft=${pr.draft}`,
        );

        // If user is requested as reviewer, add to waitingOnUser
        if (isWaitingOnUser) {
          this.logger.log(
            `[TEAM MEMBER PR] ✓ PR #${pr.number} categorized as waitingOnUser (team member's PR, review requested)`,
          );
          digest.waitingOnUser.push(pr);
        }
        // Otherwise add to open or draft
        else if (!pr.draft) {
          this.logger.log(`[TEAM MEMBER PR] ✓ PR #${pr.number} categorized as userOpenPRs (team member's PR)`);
          digest.userOpenPRs.push(pr);
        } else {
          this.logger.log(`[TEAM MEMBER PR] ✓ PR #${pr.number} categorized as userDraftPRs (team member's draft)`);
          digest.userDraftPRs.push(pr);
        }
      }
      // For user scope: PRs waiting on user (review requested) - other people's PRs
      else if (isWaitingOnUser) {
        this.logger.log(
          `[Digest Debug] PR #${pr.number} categorized as waitingOnUser (review requested from ${executionData.userGithubLogin})`,
        );
        digest.waitingOnUser.push(pr);
      } else {
        this.logger.log(
          `[CATEGORIZATION] ✗ PR #${pr.number} did NOT match any category - SKIPPED!`,
        );
        this.logger.log(
          `[CATEGORIZATION] Debug info - scopeType: ${executionData.config.scopeType}, teamMembersCount: ${teamMemberLogins.length}, author: ${pr.user.login}, currentUser: ${executionData.userGithubLogin}`,
        );
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
            digest.userOpenPRs.length +
            digest.userDraftPRs.length,
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
