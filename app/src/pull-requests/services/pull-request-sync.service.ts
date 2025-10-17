import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GitHubService } from '../../github/services/github.service';
import { Prisma } from '@prisma/client';

interface GitHubWebhookPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  html_url: string;
  state: string;
  draft?: boolean;
  merged?: boolean;
  created_at: string;
  closed_at?: string;
  merged_at?: string;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
  additions?: number;
  deletions?: number;
  changed_files?: number;
  requested_reviewers?: Array<{
    id: number;
    login: string;
    avatar_url: string;
  }>;
  requested_teams?: Array<{
    id: number;
    slug: string;
    name: string;
  }>;
  assignees?: Array<{
    id: number;
    login: string;
    avatar_url: string;
  }>;
  labels?: Array<{
    name: string;
    color: string;
    description?: string;
  }>;
}

interface GitHubWebhookPayload {
  action?: string;
  pull_request?: GitHubWebhookPullRequest;
  review?: any;
  check_run?: any;
  check_suite?: any;
  repository: {
    id: number;
    full_name: string;
  };
  sender: {
    id: number;
    login: string;
  };
}

@Injectable()
export class PullRequestSyncService {
  private readonly logger = new Logger(PullRequestSyncService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly githubService: GitHubService,
  ) {}

  /**
   * Sync PR state from GitHub webhook payload
   */
  async syncFromWebhook(payload: GitHubWebhookPayload): Promise<void> {
    try {
      const { pull_request, repository, action } = payload;

      if (!pull_request) {
        return;
      }

      const githubId = pull_request.id.toString();
      const repositoryId = repository.id.toString();

      // Check if PR exists
      let existingPR = await this.databaseService.pullRequest.findUnique({
        where: { githubId },
        include: {
          reviewers: true,
          labels: true,
          checks: true,
          assignees: true,
        },
      });

      if (!existingPR) {
        // Create new PR
        await this.createPullRequest(pull_request, repositoryId, repository.full_name);
        this.logger.log(`Created PR ${repository.full_name}#${pull_request.number}`);
      } else {
        // Update existing PR
        await this.updatePullRequest(existingPR.id, pull_request);
        this.logger.log(`Updated PR ${repository.full_name}#${pull_request.number}`);
      }

      // Handle specific webhook actions
      if (action === 'review_requested' || action === 'review_request_removed') {
        await this.syncReviewers(githubId, pull_request);
      }

      if (action === 'labeled' || action === 'unlabeled') {
        await this.syncLabels(githubId, pull_request);
      }

      if (action === 'assigned' || action === 'unassigned') {
        await this.syncAssignees(githubId, pull_request);
      }

      // Handle review submission
      if (payload.review) {
        await this.syncReviewState(githubId, payload.review);
      }

      // Handle check run updates
      if (payload.check_run) {
        await this.syncCheckRun(githubId, payload.check_run);
      }

      // Handle check suite updates
      if (payload.check_suite && payload.check_suite.pull_requests) {
        for (const pr of payload.check_suite.pull_requests) {
          const prGithubId = pr.id.toString();
          await this.syncCheckSuiteForPR(prGithubId, payload.check_suite);
        }
      }
    } catch (error) {
      this.logger.error('Error syncing PR from webhook:', error);
      throw error;
    }
  }

  /**
   * Sync PR state from GitHub API
   */
  async syncFromAPI(
    owner: string,
    repo: string,
    prNumber: number,
    accessToken?: string,
  ): Promise<void> {
    try {
      const pr = await this.githubService.getPullRequest(owner, repo, prNumber, accessToken);
      const repositoryId = pr.base.repo.id.toString();
      const repositoryName = pr.base.repo.full_name;
      const githubId = pr.id.toString();

      let existingPR = await this.databaseService.pullRequest.findUnique({
        where: { githubId },
      });

      if (!existingPR) {
        await this.createPullRequest(pr as any, repositoryId, repositoryName);
      } else {
        await this.updatePullRequest(existingPR.id, pr as any);
      }

      // Sync related data
      await this.syncReviewers(githubId, pr as any);
      await this.syncLabels(githubId, pr as any);
      await this.syncAssignees(githubId, pr as any);

      // Fetch and sync checks
      if (accessToken) {
        await this.syncChecksFromAPI(owner, repo, prNumber, githubId, accessToken);
      }

      this.logger.log(`Synced PR ${repositoryName}#${prNumber} from API`);
    } catch (error) {
      this.logger.error(`Error syncing PR ${owner}/${repo}#${prNumber} from API:`, error);
      throw error;
    }
  }

  /**
   * Create new pull request record
   */
  private async createPullRequest(
    pr: GitHubWebhookPullRequest,
    repositoryId: string,
    repositoryName: string,
  ): Promise<void> {
    const data: Prisma.PullRequestCreateInput = {
      githubId: pr.id.toString(),
      number: pr.number,
      repositoryId,
      repositoryName,
      title: pr.title,
      body: pr.body || null,
      url: pr.html_url,
      state: pr.state,
      isDraft: pr.draft || false,
      isMerged: pr.merged || false,
      openedAt: new Date(pr.created_at),
      closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      authorGithubId: pr.user.id.toString(),
      authorLogin: pr.user.login,
      authorAvatarUrl: pr.user.avatar_url,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changedFiles: pr.changed_files || 0,
      lastSyncedAt: new Date(),
    };

    await this.databaseService.pullRequest.create({ data });

    // Create related records
    const githubId = pr.id.toString();
    await this.syncReviewers(githubId, pr);
    await this.syncLabels(githubId, pr);
    await this.syncAssignees(githubId, pr);
  }

  /**
   * Update existing pull request record
   */
  private async updatePullRequest(
    id: string,
    pr: GitHubWebhookPullRequest,
  ): Promise<void> {
    const data: Prisma.PullRequestUpdateInput = {
      title: pr.title,
      body: pr.body || null,
      state: pr.state,
      isDraft: pr.draft || false,
      isMerged: pr.merged || false,
      closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changedFiles: pr.changed_files || 0,
      lastSyncedAt: new Date(),
    };

    await this.databaseService.pullRequest.update({
      where: { id },
      data,
    });
  }

  /**
   * Sync reviewers from PR data
   */
  private async syncReviewers(
    pullRequestGithubId: string,
    pr: GitHubWebhookPullRequest,
  ): Promise<void> {
    const pullRequest = await this.databaseService.pullRequest.findUnique({
      where: { githubId: pullRequestGithubId },
      include: { reviewers: true },
    });

    if (!pullRequest) return;

    const requestedReviewers = pr.requested_reviewers || [];
    const requestedTeams = pr.requested_teams || [];

    // Delete existing reviewers that are no longer requested
    const currentReviewerIds = new Set(
      requestedReviewers.map((r) => r.id.toString()),
    );
    const currentTeamIds = new Set(
      requestedTeams.map((t) => `team_${t.id}`),
    );

    for (const existingReviewer of pullRequest.reviewers) {
      const shouldKeep = existingReviewer.isTeamReview
        ? currentTeamIds.has(`team_${existingReviewer.githubId}`)
        : currentReviewerIds.has(existingReviewer.githubId);

      if (!shouldKeep && existingReviewer.reviewState === 'pending') {
        await this.databaseService.pullRequestReviewer.delete({
          where: { id: existingReviewer.id },
        });
      }
    }

    // Upsert user reviewers
    for (const reviewer of requestedReviewers) {
      await this.databaseService.pullRequestReviewer.upsert({
        where: {
          pullRequestId_githubId: {
            pullRequestId: pullRequest.id,
            githubId: reviewer.id.toString(),
          },
        },
        create: {
          pullRequestId: pullRequest.id,
          githubId: reviewer.id.toString(),
          login: reviewer.login,
          avatarUrl: reviewer.avatar_url,
          reviewState: 'pending',
          isTeamReview: false,
        },
        update: {
          login: reviewer.login,
          avatarUrl: reviewer.avatar_url,
        },
      });
    }

    // Upsert team reviewers
    for (const team of requestedTeams) {
      await this.databaseService.pullRequestReviewer.upsert({
        where: {
          pullRequestId_githubId: {
            pullRequestId: pullRequest.id,
            githubId: team.id.toString(),
          },
        },
        create: {
          pullRequestId: pullRequest.id,
          githubId: team.id.toString(),
          login: team.name,
          avatarUrl: '', // Teams don't have avatars in webhook payload
          reviewState: 'pending',
          isTeamReview: true,
          teamSlug: team.slug,
        },
        update: {
          login: team.name,
          teamSlug: team.slug,
        },
      });
    }
  }

  /**
   * Sync review state when review is submitted
   */
  private async syncReviewState(
    pullRequestGithubId: string,
    review: any,
  ): Promise<void> {
    const pullRequest = await this.databaseService.pullRequest.findUnique({
      where: { githubId: pullRequestGithubId },
    });

    if (!pullRequest) return;

    const reviewerGithubId = review.user.id.toString();
    const reviewState = this.mapReviewState(review.state);

    await this.databaseService.pullRequestReviewer.upsert({
      where: {
        pullRequestId_githubId: {
          pullRequestId: pullRequest.id,
          githubId: reviewerGithubId,
        },
      },
      create: {
        pullRequestId: pullRequest.id,
        githubId: reviewerGithubId,
        login: review.user.login,
        avatarUrl: review.user.avatar_url,
        reviewState,
        reviewedAt: new Date(review.submitted_at),
        reviewUrl: review.html_url,
        isTeamReview: false,
      },
      update: {
        reviewState,
        reviewedAt: new Date(review.submitted_at),
        reviewUrl: review.html_url,
      },
    });
  }

  /**
   * Sync labels from PR data
   */
  private async syncLabels(
    pullRequestGithubId: string,
    pr: GitHubWebhookPullRequest,
  ): Promise<void> {
    const pullRequest = await this.databaseService.pullRequest.findUnique({
      where: { githubId: pullRequestGithubId },
    });

    if (!pullRequest) return;

    const labels = pr.labels || [];

    // Delete all existing labels and recreate
    await this.databaseService.pullRequestLabel.deleteMany({
      where: { pullRequestId: pullRequest.id },
    });

    // Create new labels
    for (const label of labels) {
      await this.databaseService.pullRequestLabel.create({
        data: {
          pullRequestId: pullRequest.id,
          name: label.name,
          color: label.color,
          description: label.description || null,
        },
      });
    }
  }

  /**
   * Sync assignees from PR data
   */
  private async syncAssignees(
    pullRequestGithubId: string,
    pr: GitHubWebhookPullRequest,
  ): Promise<void> {
    const pullRequest = await this.databaseService.pullRequest.findUnique({
      where: { githubId: pullRequestGithubId },
    });

    if (!pullRequest) return;

    const assignees = pr.assignees || [];

    // Delete all existing assignees and recreate
    await this.databaseService.pullRequestAssignee.deleteMany({
      where: { pullRequestId: pullRequest.id },
    });

    // Create new assignees
    for (const assignee of assignees) {
      await this.databaseService.pullRequestAssignee.create({
        data: {
          pullRequestId: pullRequest.id,
          githubId: assignee.id.toString(),
          login: assignee.login,
          avatarUrl: assignee.avatar_url,
        },
      });
    }
  }

  /**
   * Sync single check run
   */
  private async syncCheckRun(
    pullRequestGithubId: string,
    checkRun: any,
  ): Promise<void> {
    const pullRequest = await this.databaseService.pullRequest.findUnique({
      where: { githubId: pullRequestGithubId },
    });

    if (!pullRequest) return;

    await this.databaseService.pullRequestCheck.upsert({
      where: {
        githubCheckId: checkRun.id.toString(),
      },
      create: {
        pullRequestId: pullRequest.id,
        githubCheckId: checkRun.id.toString(),
        name: checkRun.name,
        status: checkRun.status,
        conclusion: checkRun.conclusion,
        detailsUrl: checkRun.html_url || checkRun.details_url,
        startedAt: checkRun.started_at ? new Date(checkRun.started_at) : null,
        completedAt: checkRun.completed_at ? new Date(checkRun.completed_at) : null,
      },
      update: {
        status: checkRun.status,
        conclusion: checkRun.conclusion,
        completedAt: checkRun.completed_at ? new Date(checkRun.completed_at) : null,
      },
    });
  }

  /**
   * Sync check suite for a PR
   */
  private async syncCheckSuiteForPR(
    pullRequestGithubId: string,
    checkSuite: any,
  ): Promise<void> {
    // This would require fetching all check runs in the suite
    // For now, we'll just log it
    this.logger.debug(`Check suite update for PR ${pullRequestGithubId}`);
  }

  /**
   * Sync checks from GitHub API (for background sync)
   */
  private async syncChecksFromAPI(
    owner: string,
    repo: string,
    prNumber: number,
    pullRequestId: string,
    accessToken: string,
  ): Promise<void> {
    try {
      const octokit = this.githubService.createUserClient(accessToken);

      // Get the PR to find the head SHA
      const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      // Fetch check runs for the head commit
      const { data: checkRuns } = await octokit.checks.listForRef({
        owner,
        repo,
        ref: pr.head.sha,
        per_page: 100,
      });

      // Sync each check run
      for (const checkRun of checkRuns.check_runs) {
        await this.databaseService.pullRequestCheck.upsert({
          where: {
            githubCheckId: checkRun.id.toString(),
          },
          create: {
            pullRequestId,
            githubCheckId: checkRun.id.toString(),
            name: checkRun.name,
            status: checkRun.status,
            conclusion: checkRun.conclusion || null,
            detailsUrl: checkRun.html_url || checkRun.details_url || null,
            startedAt: checkRun.started_at ? new Date(checkRun.started_at) : null,
            completedAt: checkRun.completed_at ? new Date(checkRun.completed_at) : null,
          },
          update: {
            status: checkRun.status,
            conclusion: checkRun.conclusion || null,
            completedAt: checkRun.completed_at ? new Date(checkRun.completed_at) : null,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error syncing checks from API for ${owner}/${repo}#${prNumber}:`, error);
      // Don't throw - we don't want to fail the entire sync if checks fail
    }
  }

  /**
   * Map GitHub review state to our internal state
   */
  private mapReviewState(githubState: string): string {
    const stateMap: Record<string, string> = {
      'PENDING': 'pending',
      'COMMENTED': 'commented',
      'APPROVED': 'approved',
      'CHANGES_REQUESTED': 'changes_requested',
      'DISMISSED': 'dismissed',
    };

    return stateMap[githubState] || 'pending';
  }

  /**
   * Backfill pull requests for a user's repositories
   * Fetches PRs from the last 30 days for all repositories with access
   * @param userId - User ID to backfill PRs for
   * @param accessToken - GitHub access token
   * @param daysBack - Number of days to look back (default: 30)
   * @returns Summary of backfill operation
   */
  async backfillUserPullRequests(
    userId: string,
    accessToken: string,
    daysBack: number = 30,
  ): Promise<{
    repositories: number;
    pullRequestsProcessed: number;
    pullRequestsCreated: number;
    pullRequestsUpdated: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    this.logger.log(
      `Starting PR backfill for user ${userId}: ${daysBack} days back (since ${since.toISOString()})`,
    );

    const result = {
      repositories: 0,
      pullRequestsProcessed: 0,
      pullRequestsCreated: 0,
      pullRequestsUpdated: 0,
      errors: [] as string[],
    };

    try {
      // Get user's repositories from database
      const userRepositories = await this.databaseService.userRepository.findMany({
        where: {
          userId,
          enabled: true,
          isActive: true,
        },
      });

      this.logger.log(
        `Found ${userRepositories.length} enabled repositories for user ${userId}`,
      );

      // Process each repository
      for (const userRepo of userRepositories) {
        try {
          // Parse owner and repo from full_name (e.g., "owner/repo")
          const [owner, repo] = userRepo.fullName.split('/');
          if (!owner || !repo) {
            this.logger.warn(`Invalid repository full name: ${userRepo.fullName}`);
            continue;
          }

          this.logger.log(
            `Fetching PRs for ${userRepo.fullName} (since ${since.toISOString()})`,
          );

          // Fetch PRs with pagination
          const pullRequests = await this.githubService.getPullRequestsPaginated(
            owner,
            repo,
            {
              state: 'all',
              since,
              accessToken,
              maxPages: 10, // Limit to 10 pages (1000 PRs) per repo to avoid excessive API calls
            },
          );

          this.logger.log(
            `Found ${pullRequests.length} PRs for ${userRepo.fullName}`,
          );

          // Sync each PR
          for (const pr of pullRequests) {
            try {
              const githubId = pr.id.toString();
              const existingPR = await this.databaseService.pullRequest.findUnique({
                where: { githubId },
              });

              if (!existingPR) {
                // Create new PR
                await this.createPullRequest(
                  pr as any,
                  userRepo.githubId,
                  userRepo.fullName,
                );
                result.pullRequestsCreated++;
              } else {
                // Update existing PR
                await this.updatePullRequest(existingPR.id, pr as any);
                result.pullRequestsUpdated++;
              }

              // Sync related data
              await this.syncReviewers(githubId, pr as any);
              await this.syncLabels(githubId, pr as any);
              await this.syncAssignees(githubId, pr as any);

              // Sync checks if we have an access token
              if (accessToken) {
                await this.syncChecksFromAPI(
                  owner,
                  repo,
                  pr.number,
                  githubId,
                  accessToken,
                );
              }

              result.pullRequestsProcessed++;
            } catch (prError) {
              const errorMsg = `Error syncing PR #${pr.number} in ${userRepo.fullName}: ${prError instanceof Error ? prError.message : String(prError)}`;
              this.logger.error(errorMsg);
              result.errors.push(errorMsg);
            }
          }

          result.repositories++;
        } catch (repoError) {
          const errorMsg = `Error processing repository ${userRepo.fullName}: ${repoError instanceof Error ? repoError.message : String(repoError)}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
          // Continue with next repository
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(
        `Completed PR backfill for user ${userId} in ${duration}s: ` +
        `${result.repositories} repos, ${result.pullRequestsProcessed} PRs ` +
        `(${result.pullRequestsCreated} created, ${result.pullRequestsUpdated} updated), ` +
        `${result.errors.length} errors`,
      );

      return result;
    } catch (error) {
      const errorMsg = `Fatal error in PR backfill for user ${userId}: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMsg);
      result.errors.push(errorMsg);
      throw error;
    }
  }
}
