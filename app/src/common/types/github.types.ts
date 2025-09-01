export interface GitHubEvent {
  id: string;
  eventType: string;
  action?: string;
  repositoryId: string;
  repositoryName: string;
  senderId: string;
  senderLogin: string;
  processed: boolean;
  payload: Record<string, any>;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  private: boolean;
  fork: boolean;
  owner: GitHubUser;
  created_at: string;
  updated_at: string;
  pushed_at?: string;
  language?: string;
  default_branch: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url: string;
  html_url: string;
  type?: 'User' | 'Organization';
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  html_url: string;
  state: 'open' | 'closed';
  draft: boolean;
  merged: boolean;
  mergeable?: boolean;
  mergeable_state?: string;
  user: GitHubUser;
  assignees: GitHubUser[];
  requested_reviewers: GitHubUser[];
  head: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
  base: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  merged_at?: string;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  html_url: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  assignees: GitHubUser[];
  labels: GitHubLabel[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface GitHubWebhookPayload {
  action: string;
  repository: GitHubRepository;
  sender: GitHubUser;
  pull_request?: GitHubPullRequest;
  issue?: GitHubIssue;
  comment?: {
    id: number;
    body: string;
    html_url: string;
    user: GitHubUser;
    created_at: string;
    updated_at: string;
  };
  review?: {
    id: number;
    body?: string;
    html_url: string;
    state: 'approved' | 'changes_requested' | 'commented';
    user: GitHubUser;
    submitted_at: string;
  };
}

// GitHub API response types
export interface GitHubInstallation {
  id: number;
  account: GitHubUser;
  repository_selection: 'selected' | 'all';
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
  updated_at: string;
}

export interface GitHubAppToken {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repositories?: GitHubRepository[];
}

export interface GitHubTeam {
  id: number;
  slug: string;
  name: string;
  description?: string;
  permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin';
  privacy: 'secret' | 'closed';
  organization: {
    login: string;
    id: number;
    avatar_url: string;
  };
  members_count?: number;
  repos_count?: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubTeamMember {
  id: number;
  login: string;
  role: 'member' | 'maintainer';
  avatar_url: string;
}

export interface UserTeam {
  id: string;
  userId: string;
  teamId: string;
  teamSlug: string;
  teamName: string;
  organization: string;
  permission: string;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook response types
export interface WebhookProcessResult {
  processed: boolean;
  event?: GitHubEvent;
}

export interface WebhookResponse {
  message: string;
  deliveryId: string;
  eventType: string;
}
