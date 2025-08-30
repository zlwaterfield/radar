export interface SlackUser {
  id: string;
  name?: string;
  real_name?: string;
  email?: string;
  image_original?: string;
  team_id: string;
}

export interface SlackTeam {
  id: string;
  name: string;
  domain: string;
  image_original?: string;
}

export interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  thread_ts?: string;
  mrkdwn?: boolean;
}

export interface SlackBlock {
  type: string;
  text?: SlackText;
  elements?: SlackElement[];
  fields?: SlackText[];
  accessory?: SlackElement;
  block_id?: string;
}

export interface SlackText {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

export interface SlackElement {
  type: string;
  text?: SlackText;
  value?: string;
  url?: string;
  action_id?: string;
  style?: 'primary' | 'danger';
}

export interface SlackAttachment {
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
  blocks?: SlackBlock[];
}

// Message templates from the original Python app
export interface PullRequestMessage extends SlackMessage {
  pull_request_number: number;
  pull_request_title: string;
  pull_request_url: string;
  repository: string;
  action: string;
  user: string;
  keyword_text?: string;
}

export interface IssueMessage extends SlackMessage {
  issue_number: number;
  issue_title: string;
  issue_url: string;
  repository: string;
  action: string;
  user: string;
  keyword_text?: string;
}

export interface NotificationMessage extends SlackMessage {
  message_type: 'pull_request' | 'issue' | 'review' | 'comment' | 'discussion';
  repository: string;
  event_id: string;
  user_id: string;
  payload: Record<string, any>;
}

export interface DigestMessage extends SlackMessage {
  time_window: number;
  pull_request_count: number;
  issue_count: number;
  repositories: string[];
  date_range: {
    start: string;
    end: string;
  };
}

// Slack API response types
export interface SlackOAuthResponse {
  access_token: string;
  token_type: 'bot';
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
}

export interface SlackApiResponse {
  ok: boolean;
  error?: string;
  response_metadata?: {
    next_cursor?: string;
  };
}

export interface SlackMessageResponse extends SlackApiResponse {
  ts?: string;
  channel?: string;
  message?: {
    ts: string;
    text: string;
    user: string;
  };
}
