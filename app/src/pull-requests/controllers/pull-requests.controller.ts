import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { PullRequestService } from '../services/pull-request.service';
import { PullRequestSyncService } from '../services/pull-request-sync.service';
import { DatabaseService } from '../../database/database.service';
import {
  ListPullRequestsDto,
  PullRequestListItemDto,
  PullRequestDetailDto,
  PullRequestStatsDto,
  ListPullRequestsResponseDto,
} from '../dtos/pull-request.dto';

@Controller('pull-requests')
@UseGuards(AuthGuard)
export class PullRequestsController {
  constructor(
    private readonly pullRequestService: PullRequestService,
    private readonly pullRequestSyncService: PullRequestSyncService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Get pull request stats for the current user
   */
  @Get('stats')
  async getPullRequestStats(@Request() req: any): Promise<PullRequestStatsDto> {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    // Fetch full user data from database to get githubId
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { githubId: true },
    });

    if (!user?.githubId) {
      throw new BadRequestException('User not connected to GitHub');
    }

    return this.pullRequestService.getPullRequestStats(user.githubId);
  }

  /**
   * List pull requests with filtering
   */
  @Get()
  async listPullRequests(
    @Request() req: any,
    @Query() query: ListPullRequestsDto,
  ): Promise<ListPullRequestsResponseDto> {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    // Fetch full user data from database to get githubId
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { githubId: true },
    });

    if (!user?.githubId) {
      throw new BadRequestException('User not connected to GitHub');
    }

    // Map query params to service options
    const options: any = {
      state: query.state || 'open',
      repositoryIds: query.repositoryIds,
      hasLabel: query.hasLabel,
      ciStatus: query.ciStatus || 'all',
      isDraft: query.isDraft,
      sort: query.sort || 'updated',
      limit: query.limit || 50,
      offset: query.offset || 0,
      includeReviewers: true,
      includeLabels: true,
      includeChecks: true,
      includeAssignees: false,
    };

    // Handle user-specific filters
    if (query.assignedToMe) {
      options.assigneeGithubId = user.githubId;
    }

    if (query.authorMe) {
      options.authorGithubId = user.githubId;
    }

    if (query.reviewRequested) {
      options.reviewerGithubId = user.githubId;
    }

    const pullRequests =
      await this.pullRequestService.listPullRequests(options);

    // Map to DTO format
    const pullRequestDtos = pullRequests.map((pr) => this.mapToListItemDto(pr));

    return {
      pullRequests: pullRequestDtos,
      total: pullRequestDtos.length,
      limit: options.limit,
      offset: options.offset,
    };
  }

  /**
   * Get single pull request with full details
   */
  @Get(':id')
  async getPullRequest(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<PullRequestDetailDto> {
    const pullRequest = await this.pullRequestService.findById(id, true);

    if (!pullRequest) {
      throw new NotFoundException('Pull request not found');
    }

    return this.mapToDetailDto(pullRequest);
  }

  /**
   * Force sync PR from GitHub
   */
  @Post(':id/sync')
  async syncPullRequest(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<PullRequestDetailDto> {
    const pullRequest = await this.pullRequestService.findById(id, false);

    if (!pullRequest) {
      throw new NotFoundException('Pull request not found');
    }

    // Parse owner/repo from repository name
    const [owner, repo] = pullRequest.repositoryName.split('/');

    try {
      // Sync from GitHub API (requires user token - we'll use installation token for now)
      await this.pullRequestSyncService.syncFromAPI(
        owner,
        repo,
        pullRequest.number,
      );

      // Fetch updated PR
      const updatedPR = await this.pullRequestService.findById(id, true);

      return this.mapToDetailDto(updatedPR!);
    } catch (error) {
      throw new BadRequestException('Failed to sync pull request from GitHub');
    }
  }

  /**
   * Map PR entity to list item DTO
   */
  private mapToListItemDto(pr: any): PullRequestListItemDto {
    const checks = pr.checks || [];
    const passing = checks.filter(
      (c: any) => c.status === 'completed' && c.conclusion === 'success',
    ).length;
    const failing = checks.filter(
      (c: any) => c.status === 'completed' && c.conclusion === 'failure',
    ).length;
    const pending = checks.filter((c: any) => c.status !== 'completed').length;

    return {
      id: pr.id,
      githubId: pr.githubId,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      isDraft: pr.isDraft,
      isMerged: pr.isMerged,
      repositoryName: pr.repositoryName,
      author: {
        githubId: pr.authorGithubId,
        login: pr.authorLogin,
        avatarUrl: pr.authorAvatarUrl,
      },
      reviewers: (pr.reviewers || []).map((r: any) => ({
        githubId: r.githubId,
        login: r.login,
        avatarUrl: r.avatarUrl,
        reviewState: r.reviewState,
        reviewedAt: r.reviewedAt?.toISOString(),
        reviewUrl: r.reviewUrl,
        isTeamReview: r.isTeamReview,
        teamSlug: r.teamSlug,
      })),
      labels: (pr.labels || []).map((l: any) => ({
        name: l.name,
        color: l.color,
        description: l.description,
      })),
      checks: {
        passing,
        failing,
        pending,
        total: checks.length,
      },
      stats: {
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
      },
      updatedAt: pr.updatedAt.toISOString(),
      createdAt: pr.createdAt.toISOString(),
      openedAt: pr.openedAt.toISOString(),
      closedAt: pr.closedAt?.toISOString(),
      mergedAt: pr.mergedAt?.toISOString(),
    };
  }

  /**
   * Map PR entity to detail DTO
   */
  private mapToDetailDto(pr: any): PullRequestDetailDto {
    const listItem = this.mapToListItemDto(pr);

    return {
      ...listItem,
      body: pr.body,
      baseBranch: pr.baseBranch,
      headBranch: pr.headBranch,
      assignees: (pr.assignees || []).map((a: any) => ({
        githubId: a.githubId,
        login: a.login,
        avatarUrl: a.avatarUrl,
      })),
      allChecks: (pr.checks || []).map((c: any) => ({
        githubCheckId: c.githubCheckId,
        name: c.name,
        status: c.status,
        conclusion: c.conclusion,
        detailsUrl: c.detailsUrl,
        startedAt: c.startedAt?.toISOString(),
        completedAt: c.completedAt?.toISOString(),
      })),
      lastSyncedAt: pr.lastSyncedAt.toISOString(),
    };
  }
}
