/**
 * Tests for Slack message formatting functions
 * Extracted from process-github-event.ts to test message structure and content
 */

describe('Slack Message Formatting', () => {
  // Extract the formatting functions for testing
  function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  function createPRSlackMessage(data: any) {
    const { eventType, action, repositoryName, title, message, url, payload } =
      data;
    const EVENT_COLORS: Record<string, string> = {
      opened: '#2EB67D',
      reopened: '#2EB67D',
      closed: '#E01E5A',
      merged: '#4A154B',
      review_requested: '#ECB22E',
      assigned: '#1D9BD1',
      default: '#1D9BD1',
    };

    const color = EVENT_COLORS[action] || EVENT_COLORS.default;

    let icon = '🔄';
    if (action === 'opened') icon = '🆕';
    else if (action === 'closed') icon = '🚫';
    else if (action === 'reopened') icon = '🔄';
    else if (action === 'merged') icon = '🔀';
    else if (action === 'review_requested') icon = '👀';
    else if (action === 'assigned') icon = '👤';

    const actionText =
      action.replace('_', ' ').charAt(0).toUpperCase() +
      action.replace('_', ' ').slice(1);
    const user = payload.pull_request?.user?.login || payload.sender?.login;
    const githubUserLink = `<https://github.com/${user}|${user}>`;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${icon} *Pull Request ${actionText}* by ${githubUserLink}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<${url}|*PR #${payload.pull_request?.number}* ${title}>`,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View PR',
            emoji: true,
          },
          url: url,
          action_id: 'view_pr',
        },
      },
    ];

    return {
      blocks: [],
      attachments: [
        {
          color,
          blocks,
        },
      ],
    };
  }

  function createIssueSlackMessage(data: any) {
    const { eventType, action, repositoryName, title, message, url, payload } =
      data;
    const EVENT_COLORS = {
      issue_opened: '#2EB67D',
      issue_closed: '#E01E5A',
      issue_reopened: '#2EB67D',
      default: '#1D9BD1',
    };

    const actionColorKey = `issue_${action}`;
    const color =
      EVENT_COLORS[actionColorKey as keyof typeof EVENT_COLORS] ||
      EVENT_COLORS.default;

    let icon = '🔄';
    if (action === 'opened') icon = '🆕';
    else if (action === 'closed') icon = '🚫';
    else if (action === 'reopened') icon = '🔄';
    else if (action === 'assigned') icon = '👤';

    const actionText =
      action.replace('_', ' ').charAt(0).toUpperCase() +
      action.replace('_', ' ').slice(1);
    const user = payload.issue?.user?.login || payload.sender?.login;
    const githubUserLink = `<https://github.com/${user}|${user}>`;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${icon} *GitHub Issue ${actionText}* by ${githubUserLink}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<${url}|*Issue #${payload.issue?.number}* ${title}>`,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Issue',
            emoji: true,
          },
          url: url,
          action_id: 'view_issue',
        },
      },
    ];

    return {
      blocks: [],
      attachments: [
        {
          color,
          blocks,
        },
      ],
    };
  }

  describe('Pull Request Messages', () => {
    it('should create correctly formatted PR opened message', () => {
      const data = {
        eventType: 'pull_request',
        action: 'opened',
        repositoryName: 'testuser/test-repo',
        title: 'Fix critical bug in authentication',
        url: 'https://github.com/testuser/test-repo/pull/123',
        payload: {
          pull_request: {
            number: 123,
            user: { login: 'developer123' },
          },
          sender: { login: 'developer123' },
        },
      };

      const message = createPRSlackMessage(data);

      // Verify message structure
      expect(message).toHaveProperty('attachments');
      expect(message.attachments).toHaveLength(1);

      const attachment = message.attachments[0];
      expect(attachment).toHaveProperty('color', '#2EB67D'); // Green for opened
      expect(attachment).toHaveProperty('blocks');
      expect(attachment.blocks).toHaveLength(3);

      // Verify title block
      const titleBlock = attachment.blocks[0];
      expect(titleBlock.type).toBe('section');
      expect(titleBlock.text.text).toContain('🆕 *Pull Request Opened* by');
      expect(titleBlock.text.text).toContain(
        '<https://github.com/developer123|developer123>',
      );

      // Verify divider
      expect(attachment.blocks[1].type).toBe('divider');

      // Verify content block with link and button
      const contentBlock = attachment.blocks[2];
      expect(contentBlock.type).toBe('section');
      expect(contentBlock.text.text).toContain(
        '*PR #123* Fix critical bug in authentication',
      );
      expect(contentBlock.text.text).toContain(data.url);
      expect(contentBlock.accessory.type).toBe('button');
      expect(contentBlock.accessory.text.text).toBe('View PR');
      expect(contentBlock.accessory.url).toBe(data.url);
    });

    it('should use correct colors and icons for different PR actions', () => {
      const testCases = [
        { action: 'opened', expectedColor: '#2EB67D', expectedIcon: '🆕' },
        { action: 'closed', expectedColor: '#E01E5A', expectedIcon: '🚫' },
        { action: 'merged', expectedColor: '#4A154B', expectedIcon: '🔀' },
        {
          action: 'review_requested',
          expectedColor: '#ECB22E',
          expectedIcon: '👀',
        },
        { action: 'assigned', expectedColor: '#1D9BD1', expectedIcon: '👤' },
      ];

      testCases.forEach(({ action, expectedColor, expectedIcon }) => {
        const data = {
          action,
          title: 'Test PR',
          url: 'https://github.com/user/repo/pull/1',
          payload: {
            pull_request: { number: 1, user: { login: 'testuser' } },
            sender: { login: 'testuser' },
          },
        };

        const message = createPRSlackMessage(data);

        expect(message.attachments[0].color).toBe(expectedColor);
        expect(message.attachments[0].blocks[0].text.text).toContain(
          expectedIcon,
        );
      });
    });
  });

  describe('Issue Messages', () => {
    it('should create correctly formatted issue opened message', () => {
      const data = {
        eventType: 'issues',
        action: 'opened',
        repositoryName: 'testuser/test-repo',
        title: 'Database connection timeout',
        url: 'https://github.com/testuser/test-repo/issues/456',
        payload: {
          issue: {
            number: 456,
            user: { login: 'reporter789' },
          },
          sender: { login: 'reporter789' },
        },
      };

      const message = createIssueSlackMessage(data);

      // Verify message structure
      expect(message).toHaveProperty('attachments');
      expect(message.attachments).toHaveLength(1);

      const attachment = message.attachments[0];
      expect(attachment).toHaveProperty('color', '#2EB67D'); // Green for opened
      expect(attachment).toHaveProperty('blocks');

      // Verify title block
      const titleBlock = attachment.blocks[0];
      expect(titleBlock.text.text).toContain('🆕 *GitHub Issue Opened* by');
      expect(titleBlock.text.text).toContain(
        '<https://github.com/reporter789|reporter789>',
      );

      // Verify content block
      const contentBlock = attachment.blocks[2];
      expect(contentBlock.text.text).toContain(
        '*Issue #456* Database connection timeout',
      );
      expect(contentBlock.text.text).toContain(data.url);
      expect(contentBlock.accessory.text.text).toBe('View Issue');
    });

    it('should use correct colors for different issue actions', () => {
      const testCases = [
        { action: 'opened', expectedColor: '#2EB67D' },
        { action: 'closed', expectedColor: '#E01E5A' },
        { action: 'reopened', expectedColor: '#2EB67D' },
      ];

      testCases.forEach(({ action, expectedColor }) => {
        const data = {
          action,
          title: 'Test Issue',
          url: 'https://github.com/user/repo/issues/1',
          payload: {
            issue: { number: 1, user: { login: 'testuser' } },
            sender: { login: 'testuser' },
          },
        };

        const message = createIssueSlackMessage(data);
        expect(message.attachments[0].color).toBe(expectedColor);
      });
    });
  });

  describe('Text Utilities', () => {
    it('should truncate long text correctly', () => {
      const longText =
        'This is a very long text that should be truncated when it exceeds the maximum length limit';

      const truncated = truncateText(longText, 50);

      expect(truncated).toHaveLength(50);
      expect(truncated.endsWith('...')).toBe(true);
      expect(truncated).toBe(
        'This is a very long text that should be truncat...',
      );
    });

    it('should not truncate short text', () => {
      const shortText = 'Short text';

      const result = truncateText(shortText, 50);

      expect(result).toBe(shortText);
    });

    it('should handle edge case where text length equals max length', () => {
      const exactText = '12345';

      const result = truncateText(exactText, 5);

      expect(result).toBe('12345');
    });
  });

  describe('Message Structure Validation', () => {
    it('should always include required Slack Block Kit elements', () => {
      const data = {
        action: 'opened',
        title: 'Test',
        url: 'https://github.com/user/repo/pull/1',
        payload: {
          pull_request: { number: 1, user: { login: 'user' } },
          sender: { login: 'user' },
        },
      };

      const message = createPRSlackMessage(data);

      // Validate Slack Block Kit structure
      expect(message.attachments[0].blocks[0]).toHaveProperty(
        'type',
        'section',
      );
      expect(message.attachments[0].blocks[0]).toHaveProperty('text');
      expect(message.attachments[0].blocks[0].text).toHaveProperty(
        'type',
        'mrkdwn',
      );

      expect(message.attachments[0].blocks[1]).toHaveProperty(
        'type',
        'divider',
      );

      expect(message.attachments[0].blocks[2]).toHaveProperty('accessory');
      expect(message.attachments[0].blocks[2].accessory).toHaveProperty(
        'type',
        'button',
      );
    });
  });
});
