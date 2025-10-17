import { IsOptional, IsString, IsInt, IsBoolean, IsEnum, Min } from 'class-validator';

export class ListPullRequestsDto {
  @IsOptional()
  @IsEnum(['open', 'closed', 'all'])
  state?: 'open' | 'closed' | 'all';

  @IsOptional()
  @IsString({ each: true })
  repositoryIds?: string[];

  @IsOptional()
  @IsBoolean()
  assignedToMe?: boolean;

  @IsOptional()
  @IsBoolean()
  authorMe?: boolean;

  @IsOptional()
  @IsBoolean()
  reviewRequested?: boolean;

  @IsOptional()
  @IsString()
  hasLabel?: string;

  @IsOptional()
  @IsEnum(['passing', 'failing', 'pending', 'all'])
  ciStatus?: 'passing' | 'failing' | 'pending' | 'all';

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsEnum(['updated', 'created', 'reviews'])
  sort?: 'updated' | 'created' | 'reviews';

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export interface PullRequestReviewerDto {
  githubId: string;
  login: string;
  avatarUrl: string;
  reviewState: string;
  reviewedAt?: string;
  reviewUrl?: string;
  isTeamReview: boolean;
  teamSlug?: string;
}

export interface PullRequestLabelDto {
  name: string;
  color: string;
  description?: string;
}

export interface PullRequestCheckDto {
  githubCheckId: string;
  name: string;
  status: string;
  conclusion?: string;
  detailsUrl?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PullRequestAssigneeDto {
  githubId: string;
  login: string;
  avatarUrl: string;
}

export interface PullRequestListItemDto {
  id: string;
  githubId: string;
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  isMerged: boolean;
  repositoryName: string;

  author: {
    githubId: string;
    login: string;
    avatarUrl: string;
  };

  reviewers: PullRequestReviewerDto[];
  labels: PullRequestLabelDto[];

  checks: {
    passing: number;
    failing: number;
    pending: number;
    total: number;
  };

  stats: {
    additions: number;
    deletions: number;
    changedFiles: number;
  };

  updatedAt: string;
  createdAt: string;
  openedAt: string;
  closedAt?: string;
  mergedAt?: string;
}

export interface PullRequestDetailDto extends PullRequestListItemDto {
  body?: string;
  baseBranch: string;
  headBranch: string;
  assignees: PullRequestAssigneeDto[];
  allChecks: PullRequestCheckDto[];
  lastSyncedAt: string;
}

export interface PullRequestStatsDto {
  waitingOnMe: number;
  approvedReadyToMerge: number;
  myOpenPRs: number;
  myDraftPRs: number;
  assignedToMe: number;
}

export interface ListPullRequestsResponseDto {
  pullRequests: PullRequestListItemDto[];
  total: number;
  limit: number;
  offset: number;
}
