/**
 * Tests for watching reasons logic - determines why a user is watching a PR/issue
 * Based on logic from notification.service.ts
 */

describe('Watching Reasons Logic', () => {
  // Simulate the watching reasons enum
  enum WatchingReason {
    AUTHOR = 'author',
    REVIEWER = 'reviewer',
    ASSIGNED = 'assigned',
    MENTIONED = 'mentioned',
    TEAM_ASSIGNED = 'team_assigned',
    TEAM_MENTIONED = 'team_mentioned',
    TEAM_REVIEWER = 'team_reviewer',
    SUBSCRIBED = 'subscribed',
    MANUAL = 'manual',
  }

  // Extract the watching reasons determination logic
  function determineWatchingReasons(user: any, data: any): Set<WatchingReason> {
    const watchingReasons = new Set<WatchingReason>();

    if (!user?.githubLogin) {
      return watchingReasons;
    }

    const githubUsername = user.githubLogin;

    // Determine if this is a PR or an issue
    let isPR = false;

    // Check for direct PR indicators
    if (data.head || data.requested_reviewers) {
      isPR = true;
    }
    // Check for PR in issue (issue comment case)
    else if (data.issue && data.issue.pull_request) {
      isPR = true;
    }
    // Check for pull_request field directly
    else if (data.pull_request) {
      isPR = true;
    }
    // Check URL for PR pattern as fallback
    else if (data.html_url && data.html_url.includes('/pull/')) {
      isPR = true;
    }

    // Check if user is the author
    if (data.user?.login === githubUsername) {
      watchingReasons.add(WatchingReason.AUTHOR);
    }

    if (isPR) {
      // For PRs, check various involvement types
      const prData = data;

      // If this is an issue comment on a PR, we'd need the PR data
      // For testing, assume we have the data already

      // Check if user is requested reviewer
      if (prData.requested_reviewers) {
        const isRequestedReviewer = prData.requested_reviewers.some(
          (reviewer: any) => reviewer.login === githubUsername,
        );
        if (isRequestedReviewer) {
          watchingReasons.add(WatchingReason.REVIEWER);
        }
      }

      // Check if user is assigned
      if (prData.assignees) {
        const isAssigned = prData.assignees.some(
          (assignee: any) => assignee.login === githubUsername,
        );
        if (isAssigned) {
          watchingReasons.add(WatchingReason.ASSIGNED);
        }
      }

      // Check team assignments if user has teams
      if (user.teams && user.teams.length > 0) {
        const userTeamSlugs = user.teams.map((team: any) => team.slug);

        // Check team reviewers
        if (prData.requested_teams) {
          const hasTeamReviewRequest = prData.requested_teams.some(
            (team: any) => userTeamSlugs.includes(team.slug),
          );
          if (hasTeamReviewRequest) {
            watchingReasons.add(WatchingReason.TEAM_REVIEWER);
          }
        }
      }
    } else {
      // For issues
      // Check if user is assigned to issue
      if (data.assignees) {
        const isAssigned = data.assignees.some(
          (assignee: any) => assignee.login === githubUsername,
        );
        if (isAssigned) {
          watchingReasons.add(WatchingReason.ASSIGNED);
        }
      }

      // Check team assignments for issues
      if (user.teams && user.teams.length > 0 && data.assignees) {
        // This would require checking if any assignees are teams the user belongs to
        // Simplified for testing - assume we can detect team assignments
      }
    }

    // Check for mentions in title or body - use word boundary to avoid partial matches
    const textToCheck = [data.title, data.body].filter(Boolean).join(' ');
    const mentionRegex = new RegExp(`@${githubUsername}\\b`);
    if (mentionRegex.test(textToCheck)) {
      watchingReasons.add(WatchingReason.MENTIONED);
    }

    // Check for team mentions
    if (user.teams && user.teams.length > 0) {
      const userTeamSlugs = user.teams.map((team: any) => team.slug);
      const hasTeamMention = userTeamSlugs.some((teamSlug) => {
        const teamMentionRegex = new RegExp(`@${teamSlug}\\b`);
        return teamMentionRegex.test(textToCheck);
      });
      if (hasTeamMention) {
        watchingReasons.add(WatchingReason.TEAM_MENTIONED);
      }
    }

    return watchingReasons;
  }

  // Test data factory
  function createTestUser(overrides = {}) {
    return {
      id: 'user-123',
      githubId: '12345',
      githubLogin: 'testuser',
      teams: [],
      ...overrides,
    };
  }

  function createPRData(overrides = {}) {
    return {
      html_url: 'https://github.com/owner/repo/pull/123',
      user: { login: 'author' },
      title: 'Fix critical bug',
      body: 'This fixes the authentication issue',
      requested_reviewers: [],
      assignees: [],
      requested_teams: [],
      ...overrides,
    };
  }

  function createIssueData(overrides = {}) {
    return {
      html_url: 'https://github.com/owner/repo/issues/456',
      user: { login: 'author' },
      title: 'Database connection timeout',
      body: 'Getting timeouts on production',
      assignees: [],
      ...overrides,
    };
  }

  describe('Author Detection', () => {
    it('should identify user as author of PR', () => {
      const user = createTestUser({ githubLogin: 'testuser' });
      const prData = createPRData({ user: { login: 'testuser' } });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.AUTHOR)).toBe(true);
      expect(reasons.size).toBe(1);
    });

    it('should identify user as author of issue', () => {
      const user = createTestUser({ githubLogin: 'testuser' });
      const issueData = createIssueData({ user: { login: 'testuser' } });

      const reasons = determineWatchingReasons(user, issueData);

      expect(reasons.has(WatchingReason.AUTHOR)).toBe(true);
      expect(reasons.size).toBe(1);
    });

    it('should not identify user as author when they are not', () => {
      const user = createTestUser({ githubLogin: 'testuser' });
      const prData = createPRData({ user: { login: 'otheruser' } });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.AUTHOR)).toBe(false);
    });
  });

  describe('PR/Issue Detection', () => {
    it('should detect PR from html_url', () => {
      const user = createTestUser({ githubLogin: 'reviewer' });
      const prData = createPRData({
        html_url: 'https://github.com/owner/repo/pull/123',
        requested_reviewers: [{ login: 'reviewer' }],
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.REVIEWER)).toBe(true);
    });

    it('should detect issue from html_url', () => {
      const user = createTestUser({ githubLogin: 'assignee' });
      const issueData = createIssueData({
        html_url: 'https://github.com/owner/repo/issues/456',
        assignees: [{ login: 'assignee' }],
      });

      const reasons = determineWatchingReasons(user, issueData);

      expect(reasons.has(WatchingReason.ASSIGNED)).toBe(true);
    });
  });

  describe('PR Reviewer Detection', () => {
    it('should identify user as requested reviewer', () => {
      const user = createTestUser({ githubLogin: 'reviewer' });
      const prData = createPRData({
        requested_reviewers: [
          { login: 'reviewer' },
          { login: 'other-reviewer' },
        ],
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.REVIEWER)).toBe(true);
    });

    it('should not identify user as reviewer when not requested', () => {
      const user = createTestUser({ githubLogin: 'testuser' });
      const prData = createPRData({
        requested_reviewers: [{ login: 'other-reviewer' }],
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.REVIEWER)).toBe(false);
    });
  });

  describe('Assignment Detection', () => {
    it('should identify user as assigned to PR', () => {
      const user = createTestUser({ githubLogin: 'assignee' });
      const prData = createPRData({
        assignees: [{ login: 'assignee' }],
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.ASSIGNED)).toBe(true);
    });

    it('should identify user as assigned to issue', () => {
      const user = createTestUser({ githubLogin: 'assignee' });
      const issueData = createIssueData({
        assignees: [{ login: 'assignee' }],
      });

      const reasons = determineWatchingReasons(user, issueData);

      expect(reasons.has(WatchingReason.ASSIGNED)).toBe(true);
    });
  });

  describe('Mention Detection', () => {
    it('should detect user mention in PR title', () => {
      const user = createTestUser({ githubLogin: 'testuser' });
      const prData = createPRData({
        title: 'Fix for @testuser review feedback',
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.MENTIONED)).toBe(true);
    });

    it('should detect user mention in PR body', () => {
      const user = createTestUser({ githubLogin: 'testuser' });
      const prData = createPRData({
        body: 'This addresses the concerns raised by @testuser',
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.MENTIONED)).toBe(true);
    });

    it('should detect user mention in issue body', () => {
      const user = createTestUser({ githubLogin: 'testuser' });
      const issueData = createIssueData({
        body: 'CC @testuser for database expertise',
      });

      const reasons = determineWatchingReasons(user, issueData);

      expect(reasons.has(WatchingReason.MENTIONED)).toBe(true);
    });

    it('should not detect partial username matches', () => {
      const user = createTestUser({ githubLogin: 'user' });
      const prData = createPRData({
        body: 'This mentions @testuser but should not match user',
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.MENTIONED)).toBe(false);
    });
  });

  describe('Team Detection', () => {
    it('should identify team review request', () => {
      const user = createTestUser({
        githubLogin: 'teamember',
        teams: [{ id: 'team-1', slug: 'backend-team', name: 'Backend Team' }],
      });
      const prData = createPRData({
        requested_teams: [{ slug: 'backend-team' }],
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.TEAM_REVIEWER)).toBe(true);
    });

    it('should detect team mention', () => {
      const user = createTestUser({
        githubLogin: 'teammember',
        teams: [{ id: 'team-1', slug: 'frontend-team', name: 'Frontend Team' }],
      });
      const prData = createPRData({
        body: 'This needs input from @frontend-team',
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.TEAM_MENTIONED)).toBe(true);
    });

    it('should not match teams user is not part of', () => {
      const user = createTestUser({
        githubLogin: 'developer',
        teams: [{ id: 'team-1', slug: 'backend-team', name: 'Backend Team' }],
      });
      const prData = createPRData({
        requested_teams: [{ slug: 'frontend-team' }],
        body: 'This needs @frontend-team review',
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.TEAM_REVIEWER)).toBe(false);
      expect(reasons.has(WatchingReason.TEAM_MENTIONED)).toBe(false);
    });
  });

  describe('Multiple Reasons', () => {
    it('should detect multiple watching reasons', () => {
      const user = createTestUser({
        githubLogin: 'developer',
        teams: [{ id: 'team-1', slug: 'dev-team', name: 'Dev Team' }],
      });
      const prData = createPRData({
        user: { login: 'developer' }, // Author
        assignees: [{ login: 'developer' }], // Assigned
        body: 'Self-assigned PR, also tagging @dev-team', // Team mentioned
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.AUTHOR)).toBe(true);
      expect(reasons.has(WatchingReason.ASSIGNED)).toBe(true);
      expect(reasons.has(WatchingReason.TEAM_MENTIONED)).toBe(true);
      expect(reasons.size).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user github login', () => {
      const user = createTestUser({ githubLogin: null });
      const prData = createPRData();

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.size).toBe(0);
    });

    it('should handle missing PR data fields', () => {
      const user = createTestUser({ githubLogin: 'testuser' });
      const prData = {
        html_url: 'https://github.com/owner/repo/pull/123',
        // Missing other fields
      };

      const reasons = determineWatchingReasons(user, prData);

      // Should not crash and should return empty set
      expect(reasons.size).toBe(0);
    });

    it('should handle user with no teams', () => {
      const user = createTestUser({
        githubLogin: 'developer',
        teams: null,
      });
      const prData = createPRData({
        requested_teams: [{ slug: 'some-team' }],
      });

      const reasons = determineWatchingReasons(user, prData);

      expect(reasons.has(WatchingReason.TEAM_REVIEWER)).toBe(false);
      expect(reasons.size).toBe(0);
    });
  });
});
