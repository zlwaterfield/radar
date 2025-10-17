import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma, PullRequest } from '@prisma/client';

export interface PullRequestWithRelations extends PullRequest {
  reviewers?: any[];
  labels?: any[];
  checks?: any[];
  assignees?: any[];
}

export interface ListPullRequestsOptions {
  state?: 'open' | 'closed' | 'all';
  repositoryIds?: string[];
  authorGithubId?: string;
  reviewerGithubId?: string;
  assigneeGithubId?: string;
  hasLabel?: string;
  ciStatus?: 'passing' | 'failing' | 'pending' | 'all';
  isDraft?: boolean;
  sort?: 'updated' | 'created' | 'reviews';
  limit?: number;
  offset?: number;
  includeReviewers?: boolean;
  includeLabels?: boolean;
  includeChecks?: boolean;
  includeAssignees?: boolean;
}

export interface PullRequestStatsResponse {
  waitingOnMe: number;
  approvedReadyToMerge: number;
  myOpenPRs: number;
  myDraftPRs: number;
  assignedToMe: number;
}

@Injectable()
export class PullRequestService {
  private readonly logger = new Logger(PullRequestService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Find pull request by GitHub ID
   */
  async findByGithubId(
    githubId: string,
    includeRelations = false,
  ): Promise<PullRequestWithRelations | null> {
    const include = includeRelations
      ? {
          reviewers: true,
          labels: true,
          checks: true,
          assignees: true,
        }
      : undefined;

    return this.databaseService.pullRequest.findUnique({
      where: { githubId },
      include,
    });
  }

  /**
   * Find pull request by repository and number
   */
  async findByRepoAndNumber(
    repositoryId: string,
    number: number,
    includeRelations = false,
  ): Promise<PullRequestWithRelations | null> {
    const include = includeRelations
      ? {
          reviewers: true,
          labels: true,
          checks: true,
          assignees: true,
        }
      : undefined;

    return this.databaseService.pullRequest.findUnique({
      where: {
        repositoryId_number: {
          repositoryId,
          number,
        },
      },
      include,
    });
  }

  /**
   * Find pull request by internal ID
   */
  async findById(
    id: string,
    includeRelations = false,
  ): Promise<PullRequestWithRelations | null> {
    const include = includeRelations
      ? {
          reviewers: true,
          labels: true,
          checks: true,
          assignees: true,
        }
      : undefined;

    return this.databaseService.pullRequest.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * List pull requests with advanced filtering
   */
  async listPullRequests(
    options: ListPullRequestsOptions,
  ): Promise<PullRequestWithRelations[]> {
    const {
      state = 'all',
      repositoryIds,
      authorGithubId,
      reviewerGithubId,
      assigneeGithubId,
      hasLabel,
      ciStatus = 'all',
      isDraft,
      sort = 'updated',
      limit = 50,
      offset = 0,
      includeReviewers = true,
      includeLabels = true,
      includeChecks = true,
      includeAssignees = true,
    } = options;

    // Build where clause
    const where: Prisma.PullRequestWhereInput = {};

    if (state !== 'all') {
      where.state = state;
    }

    if (repositoryIds && repositoryIds.length > 0) {
      where.repositoryId = { in: repositoryIds };
    }

    if (authorGithubId) {
      where.authorGithubId = authorGithubId;
    }

    if (isDraft !== undefined) {
      where.isDraft = isDraft;
    }

    if (reviewerGithubId) {
      where.reviewers = {
        some: {
          githubId: reviewerGithubId,
        },
      };
    }

    if (assigneeGithubId) {
      where.assignees = {
        some: {
          githubId: assigneeGithubId,
        },
      };
    }

    if (hasLabel) {
      where.labels = {
        some: {
          name: hasLabel,
        },
      };
    }

    // Handle CI status filtering
    if (ciStatus !== 'all') {
      if (ciStatus === 'passing') {
        where.checks = {
          every: {
            OR: [
              { conclusion: 'success' },
              { status: { not: 'completed' } }, // Exclude incomplete checks from "every" check
            ],
          },
        };
      } else if (ciStatus === 'failing') {
        where.checks = {
          some: {
            conclusion: 'failure',
          },
        };
      } else if (ciStatus === 'pending') {
        where.checks = {
          some: {
            status: { in: ['queued', 'in_progress'] },
          },
        };
      }
    }

    // Build orderBy clause
    let orderBy: Prisma.PullRequestOrderByWithRelationInput = {};
    if (sort === 'updated') {
      orderBy = { updatedAt: 'desc' };
    } else if (sort === 'created') {
      orderBy = { createdAt: 'desc' };
    }

    // Build include clause
    const include: Prisma.PullRequestInclude = {
      reviewers: includeReviewers,
      labels: includeLabels,
      checks: includeChecks,
      assignees: includeAssignees,
    };

    try {
      const pullRequests = await this.databaseService.pullRequest.findMany({
        where,
        include,
        orderBy,
        take: limit,
        skip: offset,
      });

      return pullRequests;
    } catch (error) {
      this.logger.error('Error listing pull requests:', error);
      throw error;
    }
  }

  /**
   * Get PR stats for a user
   */
  async getPullRequestStats(
    userGithubId: string,
    repositoryIds?: string[],
  ): Promise<PullRequestStatsResponse> {
    const baseWhere: Prisma.PullRequestWhereInput = {
      state: 'open',
    };

    if (repositoryIds && repositoryIds.length > 0) {
      baseWhere.repositoryId = { in: repositoryIds };
    }

    try {
      // Waiting on me (review requested and pending)
      const waitingOnMe = await this.databaseService.pullRequest.count({
        where: {
          ...baseWhere,
          reviewers: {
            some: {
              githubId: userGithubId,
              reviewState: 'pending',
            },
          },
        },
      });

      // Approved & ready to merge (I approved + all checks pass)
      // This is a simplified version - in reality, we'd need more complex logic
      const approvedByMe = await this.databaseService.pullRequest.findMany({
        where: {
          ...baseWhere,
          reviewers: {
            some: {
              githubId: userGithubId,
              reviewState: 'approved',
            },
          },
        },
        include: {
          checks: true,
        },
      });

      const approvedReadyToMerge = approvedByMe.filter((pr) => {
        if (pr.checks.length === 0) return true;
        return pr.checks.every(
          (check) =>
            check.status === 'completed' && check.conclusion === 'success',
        );
      }).length;

      // My open PRs
      const myOpenPRs = await this.databaseService.pullRequest.count({
        where: {
          ...baseWhere,
          authorGithubId: userGithubId,
          isDraft: false,
        },
      });

      // My draft PRs
      const myDraftPRs = await this.databaseService.pullRequest.count({
        where: {
          ...baseWhere,
          authorGithubId: userGithubId,
          isDraft: true,
        },
      });

      // Assigned to me
      const assignedToMe = await this.databaseService.pullRequest.count({
        where: {
          ...baseWhere,
          assignees: {
            some: {
              githubId: userGithubId,
            },
          },
        },
      });

      return {
        waitingOnMe,
        approvedReadyToMerge,
        myOpenPRs,
        myDraftPRs,
        assignedToMe,
      };
    } catch (error) {
      this.logger.error('Error getting PR stats:', error);
      throw error;
    }
  }

  /**
   * Get open PRs that haven't been synced recently
   */
  async getStaleOpenPRs(
    minutesSinceLastSync: number,
    limit = 100,
  ): Promise<PullRequest[]> {
    const cutoffTime = new Date(Date.now() - minutesSinceLastSync * 60 * 1000);

    return this.databaseService.pullRequest.findMany({
      where: {
        state: 'open',
        lastSyncedAt: {
          lt: cutoffTime,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Update last synced timestamp
   */
  async updateLastSynced(id: string): Promise<void> {
    await this.databaseService.pullRequest.update({
      where: { id },
      data: {
        lastSyncedAt: new Date(),
      },
    });
  }
}
