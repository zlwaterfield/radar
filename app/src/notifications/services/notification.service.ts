import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GitHubService } from '../../github/services/github.service';
import { LLMAnalyzerService } from './llm-analyzer.service';
import {
  WatchingReason,
  NotificationTrigger,
} from '../../common/types/notification-enums';
import type { NotificationPreferences } from '../../common/types/user.types';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly githubService: GitHubService,
    private readonly llmAnalyzerService: LLMAnalyzerService,
  ) {}

  /**
   * Determine the reasons why a user is watching a PR or issue
   */
  async determineWatchingReasons(
    userId: string,
    data: any,
  ): Promise<Set<WatchingReason>> {
    const watchingReasons = new Set<WatchingReason>();

    try {
      // Get user data including teams
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        include: {
          teams: true,
        },
      });

      if (!user || !user.githubId) {
        return watchingReasons;
      }

      const githubUsername = user.githubLogin;
      if (!githubUsername) {
        return watchingReasons;
      }

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
        // For issue comments on PRs, we need to fetch the full PR data
        let prData = data;

        // If this is an issue comment on a PR, fetch the PR details
        if (data.issue && data.issue.pull_request) {
          try {
            // Extract repository and PR number
            const repository = data.repository?.full_name;
            const prNumber = data.issue?.number;

            if (repository && prNumber && user.githubAccessToken) {
              // Fetch PR details from GitHub
              const githubClient = this.githubService.createUserClient(
                user.githubAccessToken,
              );
              const prDetails = await githubClient.rest.pulls.get({
                owner: repository.split('/')[0],
                repo: repository.split('/')[1],
                pull_number: prNumber,
              });

              if (prDetails.data) {
                prData = prDetails.data;
              }
            }
          } catch (error) {
            this.logger.error(`Error fetching PR details: ${error}`);
          }
        }

        // Check if user is a reviewer
        const requestedReviewers = prData.requested_reviewers || [];
        for (const reviewer of requestedReviewers) {
          if (reviewer.login === githubUsername) {
            watchingReasons.add(WatchingReason.REVIEWER);
            break;
          }
        }

        // Check if user's teams are requested for review
        const requestedTeams = prData.requested_teams || [];
        const userTeamSlugs = user.teams.map(
          (t) => `${t.organization}/${t.teamSlug}`,
        );

        for (const team of requestedTeams) {
          const teamPath = `${team.parent?.login || data.repository?.owner?.login}/${team.slug}`;
          if (userTeamSlugs.includes(teamPath)) {
            watchingReasons.add(WatchingReason.TEAM_REVIEWER);
            break;
          }
        }
      }

      // Check if user is assigned (works for both PRs and issues)
      const assignees = data.assignees || [];
      for (const assignee of assignees) {
        if (assignee.login === githubUsername) {
          watchingReasons.add(WatchingReason.ASSIGNED);
          break;
        }

        // Check if any of user's teams are assigned
        if (assignee.type === 'Team') {
          const userTeamSlugs = user.teams.map(
            (t) => `${t.organization}/${t.teamSlug}`,
          );
          if (userTeamSlugs.includes(assignee.name)) {
            watchingReasons.add(WatchingReason.TEAM_ASSIGNED);
            break;
          }
        }
      }

      // Check if user is mentioned in the PR/issue description
      const body = data.body || '';
      if (body && body.includes(`@${githubUsername}`)) {
        watchingReasons.add(WatchingReason.MENTIONED);
      }

      // Check if user's teams are mentioned in the PR/issue description
      if (body && user.teams.length > 0) {
        for (const team of user.teams) {
          if (body.includes(`@${team.organization}/${team.teamSlug}`)) {
            watchingReasons.add(WatchingReason.TEAM_MENTIONED);
            break;
          }
        }
      }

      return watchingReasons;
    } catch (error) {
      this.logger.error(`Error determining watching reasons: ${error}`);
      return watchingReasons;
    }
  }

  /**
   * Determine if a user should be notified based on their preferences and watching reasons.
   */
  async shouldNotify(
    userId: string,
    prData: any,
    trigger: NotificationTrigger,
    actorId?: string,
  ): Promise<boolean> {
    try {
      // Get user settings
      const settings = await this.databaseService.userSettings.findUnique({
        where: { userId },
      });

      let preferences: NotificationPreferences;
      if (!settings) {
        // Use default settings
        preferences = this.getDefaultNotificationPreferences();
      } else {
        preferences =
          settings.notificationPreferences as NotificationPreferences;
      }

      // Get watching reasons for this PR
      const watchingReasons = await this.determineWatchingReasons(
        userId,
        prData,
      );

      // If the user isn't watching the PR, don't notify
      if (watchingReasons.size === 0) {
        return false;
      }

      // Check if this is the user's own activity
      if (actorId && preferences.mute_own_activity) {
        const user = await this.databaseService.user.findUnique({
          where: { id: userId },
        });
        if (user && actorId === user.githubId) {
          return false;
        }
      }

      // Check if this is a draft PR and user has muted draft PRs
      if (preferences.mute_draft_pull_requests && prData.draft) {
        return false;
      }

      // Always notify if mentioned (regardless of other preferences)
      if (watchingReasons.has(WatchingReason.MENTIONED)) {
        return preferences.mentioned_in_comments ?? true;
      }

      // Always notify if team is mentioned (regardless of other preferences)
      if (watchingReasons.has(WatchingReason.TEAM_MENTIONED)) {
        return preferences.team_mentions ?? true;
      }

      // Check preferences based on activity type
      switch (trigger) {
        case NotificationTrigger.COMMENTED:
          return preferences.pull_request_commented ?? true;
        case NotificationTrigger.REVIEWED:
          return preferences.pull_request_reviewed ?? true;
        case NotificationTrigger.MERGED:
          return preferences.pull_request_merged ?? true;
        case NotificationTrigger.CLOSED:
        case NotificationTrigger.REOPENED:
          return preferences.pull_request_closed ?? true;
        case NotificationTrigger.ASSIGNED:
        case NotificationTrigger.UNASSIGNED:
          // Check individual assignment
          const individualAssigned =
            watchingReasons.has(WatchingReason.ASSIGNED) &&
            (preferences.pull_request_assigned ?? true);

          // Check team assignment
          const teamAssigned =
            watchingReasons.has(WatchingReason.TEAM_ASSIGNED) &&
            (preferences.team_assignments ?? true);

          return individualAssigned || teamAssigned;
        case NotificationTrigger.REVIEW_REQUESTED:
        case NotificationTrigger.REVIEW_REQUEST_REMOVED:
          // Check individual review request
          const individualReviewer =
            watchingReasons.has(WatchingReason.REVIEWER) &&
            (preferences.pull_request_assigned ?? true);

          // Check team review request
          const teamReviewer =
            watchingReasons.has(WatchingReason.TEAM_REVIEWER) &&
            (preferences.team_review_requests ?? true);

          return individualReviewer || teamReviewer;
        case NotificationTrigger.OPENED:
          return preferences.pull_request_opened ?? true;
        case NotificationTrigger.CHECK_FAILED:
          return preferences.check_failures ?? true;
        case NotificationTrigger.CHECK_SUCCEEDED:
          return preferences.check_successes ?? false;
        default:
          return false;
      }
    } catch (error) {
      this.logger.error(`Error checking if user should be notified: ${error}`);
      return false;
    }
  }

  /**
   * Process a pull request event and determine if a user should be notified.
   */
  async processPullRequestEvent(
    userId: string,
    payload: any,
    eventId: string,
  ): Promise<{
    shouldNotify: boolean;
    matchedKeywords: string[];
    matchDetails: any;
    reason?: string;
    context?: any;
  }> {
    try {
      // Extract data from payload
      const action = payload.action;
      const pr = payload.pull_request || {};
      const sender = payload.sender || {};

      // Skip if action is not interesting
      if (
        ![
          'opened',
          'closed',
          'reopened',
          'review_requested',
          'review_request_removed',
          'assigned',
          'unassigned',
          'edited',
        ].includes(action)
      ) {
        this.logger.debug(
          `Skipping PR event with uninteresting action: ${action} for user ${userId}`,
        );
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'UNINTERESTING_ACTION',
          context: { action, eventId },
        };
      }

      // Get watching reasons for this PR to check if user is actually involved
      const watchingReasons = await this.determineWatchingReasons(userId, pr);

      this.logger.debug(
        `User ${userId} watching reasons for PR: ${Array.from(watchingReasons).join(', ')}`,
      );

      // Safety check: If user has no watching reasons, don't notify
      if (watchingReasons.size === 0) {
        this.logger.log(
          `User ${userId} has no watching reasons for PR #${pr.number} - skipping notification`,
        );
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'NOT_WATCHING',
          context: {
            prNumber: pr.number,
            prTitle: pr.title,
            action,
            eventId,
            repository: payload.repository?.full_name,
          },
        };
      }

      // Determine notification trigger based on action
      let trigger: NotificationTrigger | null = null;
      if (action === 'opened') {
        trigger = NotificationTrigger.OPENED;
      } else if (action === 'reopened') {
        trigger = NotificationTrigger.REOPENED;
      } else if (action === 'closed' && pr.merged) {
        trigger = NotificationTrigger.MERGED;
      } else if (action === 'closed' && !pr.merged) {
        trigger = NotificationTrigger.CLOSED;
      } else if (action === 'review_requested') {
        trigger = NotificationTrigger.REVIEW_REQUESTED;
      } else if (action === 'review_request_removed') {
        trigger = NotificationTrigger.REVIEW_REQUEST_REMOVED;
      } else if (action === 'assigned') {
        trigger = NotificationTrigger.ASSIGNED;
      } else if (action === 'unassigned') {
        trigger = NotificationTrigger.UNASSIGNED;
      }

      if (!trigger) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'NO_TRIGGER_MAPPED',
          context: { action, eventId },
        };
      }

      // Check if user should be notified based on notification preferences
      const shouldNotifyPreferences = await this.shouldNotify(
        userId,
        pr,
        trigger,
        sender.id?.toString(),
      );

      // Extract content for AI analysis
      const prContent = `Title: ${pr.title || ''}\nDescription: ${pr.body || ''}`;

      // Check if user should be notified based on keyword analysis
      const keywordResult = await this.llmAnalyzerService.analyzeContent(
        prContent,
        userId,
      );
      const shouldNotifyKeywords = keywordResult.shouldNotify;
      const matchedKeywords = keywordResult.matchedKeywords;
      const matchDetails = keywordResult.matchDetails;

      // Determine if notification should be sent and the primary reason
      const shouldNotify = shouldNotifyPreferences || shouldNotifyKeywords;

      let reason: string;
      const context: any = {
        watchingReasons: Array.from(watchingReasons),
        trigger: trigger,
        action,
        prNumber: pr.number,
        prTitle: pr.title,
        repository: payload.repository?.full_name,
        eventId,
        shouldNotifyPreferences,
        shouldNotifyKeywords,
      };

      if (shouldNotifyKeywords && matchedKeywords.length > 0) {
        reason = 'KEYWORD_MATCH';
        context.matchedKeywords = matchedKeywords;
        context.matchDetails = matchDetails;
      } else if (shouldNotifyPreferences) {
        // Determine the primary watching reason
        if (watchingReasons.has(WatchingReason.MENTIONED)) {
          reason = 'MENTIONED';
        } else if (watchingReasons.has(WatchingReason.AUTHOR)) {
          reason = 'AUTHOR';
        } else if (watchingReasons.has(WatchingReason.REVIEWER)) {
          reason = 'REVIEWER';
        } else if (watchingReasons.has(WatchingReason.ASSIGNED)) {
          reason = 'ASSIGNED';
        } else if (watchingReasons.has(WatchingReason.TEAM_REVIEWER)) {
          reason = 'TEAM_REVIEWER';
        } else if (watchingReasons.has(WatchingReason.TEAM_ASSIGNED)) {
          reason = 'TEAM_ASSIGNED';
        } else {
          reason = 'PREFERENCES';
        }
      } else {
        reason = 'NO_MATCH';
      }

      this.logger.log(
        `PR notification decision for user ${userId}: ${shouldNotify ? 'NOTIFY' : 'SKIP'} - Reason: ${reason}`,
      );

      return { shouldNotify, matchedKeywords, matchDetails, reason, context };
    } catch (error) {
      this.logger.error(`Error processing pull request event: ${error}`);
      return { shouldNotify: false, matchedKeywords: [], matchDetails: {}, reason: 'ERROR', context: { error: error.message } };
    }
  }

  /**
   * Process an issue comment event and determine if a user should be notified.
   */
  async processIssueCommentEvent(
    userId: string,
    payload: any,
    eventId: string,
  ): Promise<{
    shouldNotify: boolean;
    matchedKeywords: string[];
    matchDetails: any;
    reason?: string;
    context?: any;
  }> {
    try {
      // Extract data from payload
      const comment = payload.comment || {};
      const issue = payload.issue || {};
      const sender = payload.sender || {};

      // Get user settings
      const settings = await this.databaseService.userSettings.findUnique({
        where: { userId },
      });

      let preferences: NotificationPreferences;
      if (!settings) {
        preferences = this.getDefaultNotificationPreferences();
      } else {
        preferences =
          settings.notificationPreferences as NotificationPreferences;
      }

      // Check if this is the user's own activity
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'USER_NOT_FOUND',
          context: { userId, eventId },
        };
      }

      const githubUsername = user.githubLogin;
      const isOwnActivity = sender.login === githubUsername;

      // Don't notify for own activity if muted
      if (isOwnActivity && preferences.mute_own_activity) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'OWN_ACTIVITY_MUTED',
          context: {
            userId,
            eventId,
            senderLogin: sender.login,
            githubUsername,
            issueNumber: issue.number,
            repository: payload.repository?.full_name,
          },
        };
      }

      // Check for keyword matches in comment body
      const contentToCheck = [comment.body || ''];
      const commentContent = contentToCheck.join('\n\n');
      const keywordResult = await this.llmAnalyzerService.analyzeContent(
        commentContent,
        userId,
      );
      const shouldNotifyKeywords = keywordResult.shouldNotify;
      const matchedKeywords = keywordResult.matchedKeywords;
      const matchDetails = keywordResult.matchDetails;

      // If we have keyword matches, always notify
      if (shouldNotifyKeywords) {
        return {
          shouldNotify: true,
          matchedKeywords,
          matchDetails,
          reason: 'KEYWORD_MATCH',
          context: {
            userId,
            eventId,
            issueNumber: issue.number,
            repository: payload.repository?.full_name,
            matchedKeywords,
            matchDetails,
          },
        };
      }

      // Check if user is mentioned in the comment first
      const commentBody = comment.body || '';
      if (commentBody && commentBody.includes(`@${githubUsername}`)) {
        // User is mentioned, check their mention preference
        if (preferences.mentioned_in_comments) {
          return {
            shouldNotify: true,
            matchedKeywords: [],
            matchDetails: {},
            reason: 'MENTIONED',
            context: {
              userId,
              eventId,
              issueNumber: issue.number,
              repository: payload.repository?.full_name,
              mentionedIn: 'comment',
            },
          };
        } else {
          return {
            shouldNotify: false,
            matchedKeywords: [],
            matchDetails: {},
            reason: 'MENTIONED_BUT_DISABLED',
            context: {
              userId,
              eventId,
              issueNumber: issue.number,
              repository: payload.repository?.full_name,
            },
          };
        }
      }

      // Get watching reasons for this issue (only check if no keyword matches)
      const watchingReasons = await this.determineWatchingReasons(
        userId,
        issue,
      );

      this.logger.debug(
        `User ${userId} watching reasons for issue comment: ${Array.from(watchingReasons).join(', ')}`,
      );

      // If the user isn't watching the issue, don't notify
      if (watchingReasons.size === 0) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'NOT_WATCHING',
          context: {
            userId,
            eventId,
            issueNumber: issue.number,
            repository: payload.repository?.full_name,
          },
        };
      }

      // Use general comment preference for all users involved with the PR/issue
      // Check if this is a PR or issue based on whether it has pull_request field
      const isPR = !!issue.pull_request;

      let shouldNotifyPreferences: boolean;
      if (isPR) {
        shouldNotifyPreferences = preferences.pull_request_commented ?? true;
      } else {
        shouldNotifyPreferences = preferences.issue_commented ?? true;
      }

      // Always notify if mentioned
      if (watchingReasons.has(WatchingReason.MENTIONED)) {
        shouldNotifyPreferences = true;
      }

      let reason: string;
      if (watchingReasons.has(WatchingReason.MENTIONED)) {
        reason = 'MENTIONED';
      } else if (watchingReasons.has(WatchingReason.AUTHOR)) {
        reason = 'AUTHOR';
      } else if (watchingReasons.has(WatchingReason.ASSIGNED)) {
        reason = 'ASSIGNED';
      } else {
        reason = isPR ? 'PR_COMMENT_PREFERENCES' : 'ISSUE_COMMENT_PREFERENCES';
      }

      this.logger.log(
        `Issue comment notification decision for user ${userId}: ${shouldNotifyPreferences ? 'NOTIFY' : 'SKIP'} - Reason: ${reason}`,
      );

      return {
        shouldNotify: shouldNotifyPreferences,
        matchedKeywords: [],
        matchDetails: {},
        reason,
        context: {
          userId,
          eventId,
          watchingReasons: Array.from(watchingReasons),
          isPR,
          issueNumber: issue.number,
          repository: payload.repository?.full_name,
          shouldNotifyPreferences,
        },
      };
    } catch (error) {
      this.logger.error(`Error processing issue comment event: ${error}`);
      return { shouldNotify: false, matchedKeywords: [], matchDetails: {}, reason: 'ERROR', context: { error: error.message } };
    }
  }

  /**
   * Get default notification preferences
   */
  private getDefaultNotificationPreferences(): NotificationPreferences {
    return {
      // PR Activity
      pull_request_opened: true,
      pull_request_closed: true,
      pull_request_merged: true,
      pull_request_reviewed: true,
      pull_request_commented: true,
      pull_request_assigned: true,

      // Issue Activity
      issue_opened: true,
      issue_closed: true,
      issue_commented: true,
      issue_assigned: true,

      // CI/CD
      check_failures: true,
      check_successes: false,

      // Mentions
      mention_in_comment: true,
      mention_in_pull_request: true,
      mention_in_issue: true,
      mentioned_in_comments: true,

      // Team notifications
      team_assignments: true,
      team_mentions: true,
      team_review_requests: true,

      // Noise Control
      mute_own_activity: true,
      mute_bot_comments: true,
      mute_draft_pull_requests: true,
    };
  }

  /**
   * Process an issue event and determine if a user should be notified.
   */
  async processIssueEvent(
    userId: string,
    payload: any,
    eventId: string,
  ): Promise<{
    shouldNotify: boolean;
    matchedKeywords: string[];
    matchDetails: any;
    reason?: string;
    context?: any;
  }> {
    try {
      // Extract data from payload
      const action = payload.action;
      const issue = payload.issue || {};
      const sender = payload.sender || {};

      // Skip if action is not interesting
      if (
        !['opened', 'closed', 'reopened', 'assigned', 'edited'].includes(action)
      ) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'UNINTERESTING_ACTION',
          context: { action, eventId },
        };
      }

      // Get user settings
      const settings = await this.databaseService.userSettings.findUnique({
        where: { userId },
      });

      let preferences: NotificationPreferences;
      if (!settings) {
        preferences = this.getDefaultNotificationPreferences();
      } else {
        preferences =
          settings.notificationPreferences as NotificationPreferences;
      }

      // Check if this is the user's own activity
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'USER_NOT_FOUND',
          context: { userId, eventId },
        };
      }

      const githubUsername = user.githubLogin;
      const isOwnActivity = sender.login === githubUsername;

      // Don't notify for own activity if muted
      if (isOwnActivity && preferences.mute_own_activity) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'OWN_ACTIVITY_MUTED',
          context: {
            userId,
            eventId,
            senderLogin: sender.login,
            githubUsername,
            issueNumber: issue.number,
            repository: payload.repository?.full_name,
          },
        };
      }

      // Check for keyword matches in issue title and body
      const contentToCheck = [issue.title || '', issue.body || ''];
      const issueContent = contentToCheck.join('\n\n');
      const keywordResult = await this.llmAnalyzerService.analyzeContent(
        issueContent,
        userId,
      );
      const shouldNotifyKeywords = keywordResult.shouldNotify;
      const matchedKeywords = keywordResult.matchedKeywords;
      const matchDetails = keywordResult.matchDetails;

      if (matchedKeywords.length > 0) {
        this.logger.log(
          `Keywords matched for user ${userId} in issue ${action}: ${matchedKeywords.join(', ')}`,
        );
      }

      // If we have keyword matches, always notify
      if (shouldNotifyKeywords) {
        return {
          shouldNotify: true,
          matchedKeywords,
          matchDetails,
          reason: 'KEYWORD_MATCH',
          context: {
            userId,
            eventId,
            issueNumber: issue.number,
            repository: payload.repository?.full_name,
            matchedKeywords,
            matchDetails,
          },
        };
      }

      // Get watching reasons for this issue (only check if no keyword matches)
      const watchingReasons = await this.determineWatchingReasons(
        userId,
        issue,
      );

      this.logger.debug(
        `User ${userId} watching reasons for issue: ${Array.from(watchingReasons).join(', ')}`,
      );

      // If the user isn't watching the issue, don't notify
      if (watchingReasons.size === 0) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'NOT_WATCHING',
          context: {
            userId,
            eventId,
            issueNumber: issue.number,
            repository: payload.repository?.full_name,
          },
        };
      }

      // Always notify if mentioned (regardless of other preferences)
      if (watchingReasons.has(WatchingReason.MENTIONED)) {
        return {
          shouldNotify: preferences.mentioned_in_comments ?? true,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'MENTIONED',
          context: {
            userId,
            eventId,
            watchingReasons: Array.from(watchingReasons),
            issueNumber: issue.number,
            repository: payload.repository?.full_name,
          },
        };
      }

      // Check notification preferences based on issue action
      let shouldNotifyPreferences: boolean;
      if (action === 'opened') {
        shouldNotifyPreferences = preferences.issue_opened ?? true;
      } else if (action === 'closed') {
        shouldNotifyPreferences = preferences.issue_closed ?? true;
      } else if (action === 'assigned') {
        shouldNotifyPreferences = preferences.issue_assigned ?? true;
      } else {
        // Default for other actions
        shouldNotifyPreferences = true;
      }

      let reason: string;
      if (watchingReasons.has(WatchingReason.AUTHOR)) {
        reason = 'AUTHOR';
      } else if (watchingReasons.has(WatchingReason.ASSIGNED)) {
        reason = 'ASSIGNED';
      } else {
        reason = `ISSUE_${action.toUpperCase()}_PREFERENCES`;
      }

      this.logger.log(
        `Issue notification decision for user ${userId}: ${shouldNotifyPreferences ? 'NOTIFY' : 'SKIP'} - Reason: ${reason}`,
      );

      return {
        shouldNotify: shouldNotifyPreferences,
        matchedKeywords: [],
        matchDetails: {},
        reason,
        context: {
          userId,
          eventId,
          watchingReasons: Array.from(watchingReasons),
          action,
          issueNumber: issue.number,
          repository: payload.repository?.full_name,
          shouldNotifyPreferences,
        },
      };
    } catch (error) {
      this.logger.error(`Error processing issue event: ${error}`);
      return { shouldNotify: false, matchedKeywords: [], matchDetails: {}, reason: 'ERROR', context: { error: error.message } };
    }
  }

  /**
   * Process a pull request review event and determine if a user should be notified.
   */
  async processPullRequestReviewEvent(
    userId: string,
    payload: any,
    eventId: string,
  ): Promise<{
    shouldNotify: boolean;
    matchedKeywords: string[];
    matchDetails: any;
    reason?: string;
    context?: any;
  }> {
    try {
      const action = payload.action;
      const pr = payload.pull_request || {};
      const sender = payload.sender || {};

      // Only handle submitted reviews for now
      if (action !== 'submitted') {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'UNINTERESTING_ACTION',
          context: { action, eventId },
        };
      }

      // Get user settings
      const settings = await this.databaseService.userSettings.findUnique({
        where: { userId },
      });

      if (!settings) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'NO_SETTINGS',
          context: { userId, eventId },
        };
      }

      // Get user
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'USER_NOT_FOUND',
          context: { userId, eventId },
        };
      }

      // Get watching reasons for this PR
      const watchingReasons = await this.determineWatchingReasons(userId, pr);

      // Check if user should be notified
      const shouldNotify = await this.shouldNotify(
        userId,
        pr,
        NotificationTrigger.REVIEWED,
        sender.id?.toString(),
      );

      let reason: string;
      if (shouldNotify) {
        if (watchingReasons.has(WatchingReason.AUTHOR)) {
          reason = 'AUTHOR';
        } else if (watchingReasons.has(WatchingReason.MENTIONED)) {
          reason = 'MENTIONED';
        } else {
          reason = 'REVIEW_PREFERENCES';
        }
      } else {
        reason = 'REVIEW_DISABLED';
      }

      this.logger.log(
        `PR review notification decision for user ${userId}: ${shouldNotify ? 'NOTIFY' : 'SKIP'} - Reason: ${reason}`,
      );

      return {
        shouldNotify,
        matchedKeywords: [],
        matchDetails: {},
        reason,
        context: {
          userId,
          eventId,
          watchingReasons: Array.from(watchingReasons),
          prNumber: pr.number,
          prTitle: pr.title,
          repository: payload.repository?.full_name,
          reviewState: payload.review?.state,
        },
      };
    } catch (error) {
      this.logger.error(`Error processing pull request review event: ${error}`);
      return { shouldNotify: false, matchedKeywords: [], matchDetails: {}, reason: 'ERROR', context: { error: error.message } };
    }
  }

  /**
   * Process a pull request review comment event and determine if a user should be notified.
   */
  async processPullRequestReviewCommentEvent(
    userId: string,
    payload: any,
    eventId: string,
  ): Promise<{
    shouldNotify: boolean;
    matchedKeywords: string[];
    matchDetails: any;
    reason?: string;
    context?: any;
  }> {
    try {
      // Extract data from payload
      const comment = payload.comment || {};
      const pr = payload.pull_request || {};
      const sender = payload.sender || {};

      // Get user settings
      const settings = await this.databaseService.userSettings.findUnique({
        where: { userId },
      });

      let preferences: NotificationPreferences;
      if (!settings) {
        preferences = this.getDefaultNotificationPreferences();
      } else {
        preferences =
          settings.notificationPreferences as NotificationPreferences;
      }

      // Check if this is the user's own activity
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'USER_NOT_FOUND',
          context: { userId, eventId },
        };
      }

      const githubUsername = user.githubLogin;
      const isOwnActivity = sender.login === githubUsername;

      // Don't notify for own activity if muted
      if (isOwnActivity && preferences.mute_own_activity) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'OWN_ACTIVITY_MUTED',
          context: {
            userId,
            eventId,
            senderLogin: sender.login,
            githubUsername,
            prNumber: pr.number,
            repository: payload.repository?.full_name,
          },
        };
      }

      // Check for keyword matches in comment body
      const contentToCheck = [comment.body || ''];
      const commentContent = contentToCheck.join('\n\n');
      const keywordResult = await this.llmAnalyzerService.analyzeContent(
        commentContent,
        userId,
      );
      const shouldNotifyKeywords = keywordResult.shouldNotify;
      const matchedKeywords = keywordResult.matchedKeywords;
      const matchDetails = keywordResult.matchDetails;

      // If we have keyword matches, always notify
      if (shouldNotifyKeywords) {
        return {
          shouldNotify: true,
          matchedKeywords,
          matchDetails,
          reason: 'KEYWORD_MATCH',
          context: {
            userId,
            eventId,
            prNumber: pr.number,
            repository: payload.repository?.full_name,
            matchedKeywords,
            matchDetails,
          },
        };
      }

      // Check if user is mentioned in the comment first
      const commentBody = comment.body || '';
      if (commentBody && commentBody.includes(`@${githubUsername}`)) {
        // User is mentioned, check their mention preference
        if (preferences.mentioned_in_comments) {
          return {
            shouldNotify: true,
            matchedKeywords: [],
            matchDetails: {},
            reason: 'MENTIONED',
            context: {
              userId,
              eventId,
              prNumber: pr.number,
              repository: payload.repository?.full_name,
              mentionedIn: 'pr_review_comment',
            },
          };
        } else {
          return {
            shouldNotify: false,
            matchedKeywords: [],
            matchDetails: {},
            reason: 'MENTIONED_BUT_DISABLED',
            context: {
              userId,
              eventId,
              prNumber: pr.number,
              repository: payload.repository?.full_name,
            },
          };
        }
      }

      // Get watching reasons for this PR (only check if no keyword matches)
      const watchingReasons = await this.determineWatchingReasons(
        userId,
        pr,
      );

      this.logger.debug(
        `User ${userId} watching reasons for PR review comment: ${Array.from(watchingReasons).join(', ')}`,
      );

      // If the user isn't watching the PR, don't notify
      if (watchingReasons.size === 0) {
        return {
          shouldNotify: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'NOT_WATCHING',
          context: {
            userId,
            eventId,
            prNumber: pr.number,
            repository: payload.repository?.full_name,
          },
        };
      }

      // Use general PR comment preference for all users involved with the PR
      const shouldNotifyPreferences = preferences.pull_request_commented ?? true;

      // Always notify if mentioned
      if (watchingReasons.has(WatchingReason.MENTIONED)) {
        return {
          shouldNotify: true,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'MENTIONED',
          context: {
            userId,
            eventId,
            watchingReasons: Array.from(watchingReasons),
            prNumber: pr.number,
            repository: payload.repository?.full_name,
            shouldNotifyPreferences,
          },
        };
      }

      let reason: string;
      if (watchingReasons.has(WatchingReason.AUTHOR)) {
        reason = 'AUTHOR';
      } else if (watchingReasons.has(WatchingReason.REVIEWER)) {
        reason = 'REVIEWER';
      } else if (watchingReasons.has(WatchingReason.ASSIGNED)) {
        reason = 'ASSIGNED';
      } else if (watchingReasons.has(WatchingReason.TEAM_REVIEWER)) {
        reason = 'TEAM_REVIEWER';
      } else if (watchingReasons.has(WatchingReason.TEAM_ASSIGNED)) {
        reason = 'TEAM_ASSIGNED';
      } else {
        reason = 'PR_REVIEW_COMMENT_PREFERENCES';
      }

      this.logger.log(
        `PR review comment notification decision for user ${userId}: ${shouldNotifyPreferences ? 'NOTIFY' : 'SKIP'} - Reason: ${reason}`,
      );

      return {
        shouldNotify: shouldNotifyPreferences,
        matchedKeywords: [],
        matchDetails: {},
        reason,
        context: {
          userId,
          eventId,
          watchingReasons: Array.from(watchingReasons),
          prNumber: pr.number,
          repository: payload.repository?.full_name,
          shouldNotifyPreferences,
        },
      };
    } catch (error) {
      this.logger.error(`Error processing pull request review comment event: ${error}`);
      return { shouldNotify: false, matchedKeywords: [], matchDetails: {}, reason: 'ERROR', context: { error: error.message } };
    }
  }
}
