export interface CreateUserDto {
  name?: string;
  email?: string;
  image?: string;
  slackId: string;
  slackTeamId: string;
  slackAccessToken: string;
  slackRefreshToken?: string;
  githubId?: string;
  githubLogin?: string;
  githubAccessToken?: string;
  githubRefreshToken?: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  image?: string;
  isActive?: boolean;
  slackTeamId?: string;
  githubLogin?: string;
}

export interface LoginDto {
  code: string;
  state?: string;
}

export interface AuthResponse {
  user: any;
  accessToken: string;
  refreshToken?: string;
}