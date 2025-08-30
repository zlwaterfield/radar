/**
 * Validation utilities ported from the Python app
 */

/**
 * Sanitize string input to prevent XSS and trim whitespace
 */
export function sanitizeString(
  value: string | null | undefined,
  maxLength?: number,
): string {
  if (!value) return '';

  // Basic sanitization - remove potential script tags and trim
  let sanitized = value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim();

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate GitHub username format
 */
export function isValidGitHubUsername(username: string): boolean {
  const githubUsernameRegex =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  return githubUsernameRegex.test(username);
}

/**
 * Validate Slack user ID format
 */
export function isValidSlackId(slackId: string): boolean {
  const slackIdRegex = /^[UW][A-Z0-9]{8,10}$/;
  return slackIdRegex.test(slackId);
}

/**
 * Validate webhook payload structure for GitHub
 */
export function validateGitHubWebhookPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  // Check for required GitHub webhook fields
  return !!(
    payload.repository &&
    payload.sender &&
    payload.repository.full_name &&
    payload.sender.login
  );
}

/**
 * Extract GitHub usernames mentioned in text using @username syntax
 */
export function extractMentionedUsernames(text: string): string[] {
  if (!text) return [];

  // Find all @username mentions
  // GitHub usernames can contain letters, numbers, and hyphens
  // They cannot start with a hyphen and are case insensitive
  const mentions = text.match(
    /(?:^|[^a-zA-Z0-9.])@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)/g,
  );

  if (!mentions) return [];

  return mentions
    .map((mention) => mention.replace(/^[^@]*@/, '')) // Remove everything before @
    .filter((username, index, array) => array.indexOf(username) === index); // Remove duplicates
}

/**
 * Validate time format (HH:MM)
 */
export function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Validate day of week format
 */
export function isValidDayOfWeek(day: string): boolean {
  const validDays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  return validDays.includes(day);
}

/**
 * Generate a secure random string
 */
export function generateSecureRandomString(length: number = 32): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * Parse GitHub repository full name into owner and repo
 */
export function parseRepositoryFullName(
  fullName: string,
): { owner: string; repo: string } | null {
  const parts = fullName.split('/');
  if (parts.length !== 2) {
    return null;
  }

  const [owner, repo] = parts;
  if (!owner || !repo) {
    return null;
  }

  return { owner: owner.trim(), repo: repo.trim() };
}

/**
 * Validate JSON structure for notification preferences
 */
export function validateNotificationPreferences(preferences: any): boolean {
  if (!preferences || typeof preferences !== 'object') {
    return false;
  }

  // Check that all values are boolean if they exist
  const validKeys = [
    'pull_request_opened',
    'pull_request_closed',
    'pull_request_merged',
    'pull_request_reviewed',
    'pull_request_commented',
    'pull_request_assigned',
    'issue_opened',
    'issue_closed',
    'issue_commented',
    'issue_assigned',
    'discussion_created',
    'discussion_answered',
    'discussion_commented',
    'push_to_branch',
    'mention_in_comment',
    'mention_in_pr',
    'mention_in_issue',
  ];

  for (const [key, value] of Object.entries(preferences)) {
    if (
      !validKeys.includes(key) ||
      (value !== undefined && typeof value !== 'boolean')
    ) {
      return false;
    }
  }

  return true;
}
