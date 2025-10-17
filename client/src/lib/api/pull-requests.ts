import axios from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

export interface PullRequestReviewer {
  githubId: string;
  login: string;
  avatarUrl: string;
  reviewState: 'pending' | 'approved' | 'changes_requested' | 'commented' | 'dismissed';
  reviewedAt?: string;
  reviewUrl?: string;
  isTeamReview: boolean;
  teamSlug?: string;
}

export interface PullRequestLabel {
  name: string;
  color: string;
  description?: string;
}

export interface PullRequestCheck {
  githubCheckId: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';
  detailsUrl?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PullRequestAssignee {
  githubId: string;
  login: string;
  avatarUrl: string;
}

// Backend DTO structure
interface PullRequestDto {
  id: string;
  githubId: string;
  number: number;
  title: string;
  body?: string;
  url: string;
  state: 'open' | 'closed';
  isDraft: boolean;
  isMerged: boolean;
  repositoryName: string;

  author: {
    githubId: string;
    login: string;
    avatarUrl: string;
  };

  stats: {
    additions: number;
    deletions: number;
    changedFiles: number;
  };

  checks: {
    passing: number;
    failing: number;
    pending: number;
    total: number;
  };

  reviewers?: PullRequestReviewer[];
  labels?: PullRequestLabel[];

  openedAt: string;
  closedAt?: string;
  mergedAt?: string;
  updatedAt: string;
  createdAt: string;
}

// Frontend-friendly interface with flattened fields
export interface PullRequest {
  id: string;
  githubId: string;
  number: number;
  title: string;
  body?: string;
  url: string;
  state: 'open' | 'closed';
  isDraft: boolean;
  isMerged: boolean;
  repositoryName: string;

  // Flattened author fields
  authorGithubId: string;
  authorLogin: string;
  authorAvatarUrl: string;

  // Flattened stats
  additions: number;
  deletions: number;
  changedFiles: number;

  // Check summary -  For backward compatibility, keep as optional array
  // Backend returns summary object, but we'll convert to empty array for now
  checks?: PullRequestCheck[];

  // Timestamps
  openedAt: string;
  closedAt?: string;
  mergedAt?: string;
  updatedAt: string;
  createdAt: string;

  // Relations
  reviewers?: PullRequestReviewer[];
  labels?: PullRequestLabel[];
  assignees?: PullRequestAssignee[];
}

// Transform backend DTO to frontend-friendly format
function transformPullRequest(dto: PullRequestDto): PullRequest {
  return {
    ...dto,
    authorGithubId: dto.author.githubId,
    authorLogin: dto.author.login,
    authorAvatarUrl: dto.author.avatarUrl,
    additions: dto.stats.additions,
    deletions: dto.stats.deletions,
    changedFiles: dto.stats.changedFiles,
    checks: [], // Backend returns check summary, not individual checks for list view
  };
}

export interface PullRequestStats {
  waitingOnMe: number;
  approvedReadyToMerge: number;
  myOpenPRs: number;
  myDraftPRs: number;
  assignedToMe: number;
}

export interface ListPullRequestsParams {
  state?: 'open' | 'closed' | 'all';
  repositoryIds?: string[];
  assignedToMe?: boolean;
  authorMe?: boolean;
  reviewRequested?: boolean;
  hasLabel?: string;
  ciStatus?: 'passing' | 'failing' | 'pending';
  sort?: 'updated' | 'created';
  limit?: number;
  offset?: number;
}

// Backend response structure
interface ListPullRequestsResponseDto {
  pullRequests: PullRequestDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListPullRequestsResponse {
  pullRequests: PullRequest[];
  total: number;
  limit: number;
  offset: number;
}

export const pullRequestsApi = {
  /**
   * List pull requests with filtering
   */
  async list(params?: ListPullRequestsParams): Promise<ListPullRequestsResponse> {
    const response = await axios.get<ListPullRequestsResponseDto>(`${API_URL}/api/pull-requests`, { params });

    // Transform backend DTOs to frontend-friendly format
    return {
      ...response.data,
      pullRequests: response.data.pullRequests.map(transformPullRequest),
    };
  },

  /**
   * Get pull request statistics
   */
  async getStats(): Promise<PullRequestStats> {
    const response = await axios.get(`${API_URL}/api/pull-requests/stats`);
    return response.data;
  },

  /**
   * Get a single pull request by ID
   */
  async getById(id: string): Promise<PullRequest> {
    const response = await axios.get(`${API_URL}/api/pull-requests/${id}`);
    return response.data;
  },

  /**
   * Force sync a pull request from GitHub
   */
  async sync(id: string): Promise<PullRequest> {
    const response = await axios.post(`${API_URL}/api/pull-requests/${id}/sync`);
    return response.data;
  },
};
