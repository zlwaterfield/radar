import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GitHubService } from '../../github/services/github.service';
import { LLMAnalyzerService } from './llm-analyzer.service';
import { NotificationProfileService } from './notification-profile.service';
import {
  WatchingReason,
  NotificationTrigger,
} from '../../common/types/notification-enums';
import type { NotificationPreferences } from '../../common/types/user.types';
import type {
  NotificationDecision,
  NotificationProfileMatch,
  NotificationProfileWithMeta,
} from '../../common/types/notification-profile.types';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly githubService: GitHubService,
    private readonly llmAnalyzerService: LLMAnalyzerService,
    private readonly notificationProfileService: NotificationProfileService,
  ) {}

  /**
   * Main entry point - process any GitHub event using notification profiles
   */
  async processEvent(
    userId: string,
    payload: any,
    eventId: string,
    eventType:
      | 'pull_request'
      | 'issue_comment'
      | 'issue'
      | 'pull_request_review'
      | 'pull_request_review_comment',
  ): Promise<NotificationDecision> {
    try {
      // Get user's enabled notification profiles
      const profiles =
        await this.notificationProfileService.getEnabledNotificationProfiles(
          userId,
        );

      if (profiles.length === 0) {
        this.logger.log(`No notification profiles found for user ${userId}`);
        return {
          shouldNotify: false,
          matchedProfiles: [],
          reason: 'NO_PROFILES',
          context: { userId, eventId, eventType },
        };
      }

      const matchedProfiles: NotificationProfileMatch[] = [];

      // Check each profile for matches (in priority order)
      for (const profile of profiles) {
        const match = await this.checkProfileMatch(
          userId,
          profile,
          payload,
          eventId,
          eventType,
        );
        if (match.shouldMatch) {
          matchedProfiles.push({
            profile,
            matchedKeywords: match.matchedKeywords,
            matchDetails: match.matchDetails,
            reason: match.reason,
            context: match.context,
          });
        }
      }

      // Determine primary profile (highest priority match)
      const primaryProfile =
        matchedProfiles.length > 0 ? matchedProfiles[0] : undefined;

      const decision: NotificationDecision = {
        shouldNotify: matchedProfiles.length > 0,
        matchedProfiles,
        primaryProfile,
        reason: primaryProfile ? primaryProfile.reason : 'NO_PROFILE_MATCH',
        context: {
          userId,
          eventId,
          eventType,
          profilesChecked: profiles.length,
          matchedProfilesCount: matchedProfiles.length,
        },
      };

      this.logger.log(
        `Notification decision for user ${userId}: ${decision.shouldNotify ? 'NOTIFY' : 'SKIP'} - Reason: ${decision.reason}, Profiles matched: ${matchedProfiles.length}/${profiles.length}`,
      );

      return decision;
    } catch (error) {
      this.logger.error(`Error processing event with profiles: ${error}`);
      return {
        shouldNotify: false,
        matchedProfiles: [],
        reason: 'ERROR',
        context: { error: error.message },
      };
    }
  }

  /**
   * Check if a specific profile matches the event
   */
  private async checkProfileMatch(
    userId: string,
    profile: NotificationProfileWithMeta,
    payload: any,
    eventId: string,
    eventType: string,
  ): Promise<{
    shouldMatch: boolean;
    matchedKeywords: string[];
    matchDetails: Record<string, string>;
    reason: string;
    context?: any;
  }> {
    try {
      // Extract content for keyword matching
      const content = this.extractContentFromPayload(payload, eventType);

      // Check keyword matches first (highest priority)
      if (profile.keywords.length > 0 && profile.keywordLLMEnabled) {
        const keywordResult =
          await this.llmAnalyzerService.matchKeywordsWithLLM(
            content,
            profile.keywords,
          );
        if (keywordResult.matchedKeywords.length > 0) {
          return {
            shouldMatch: true,
            matchedKeywords: keywordResult.matchedKeywords,
            matchDetails: keywordResult.matchDetails,
            reason: 'KEYWORD_MATCH',
            context: { profileId: profile.id, profileName: profile.name },
          };
        }
      }

      // Check watching reasons
      const data = this.extractDataFromPayload(payload, eventType);
      const watchingReasons = await this.determineWatchingReasons(userId, data);

      if (watchingReasons.size === 0) {
        return {
          shouldMatch: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'NOT_WATCHING',
          context: { profileId: profile.id, profileName: profile.name },
        };
      }

      // Check if this matches the profile's scope
      if (!this.checkProfileScope(profile, userId, payload)) {
        return {
          shouldMatch: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'SCOPE_MISMATCH',
          context: {
            profileId: profile.id,
            profileName: profile.name,
            scopeType: profile.scopeType,
          },
        };
      }

      // Check notification preferences for this event type
      const trigger = this.getTriggerFromEvent(payload, eventType);
      if (
        trigger &&
        this.shouldNotifyBasedOnPreferences(
          profile.notificationPreferences,
          trigger,
          watchingReasons,
        )
      ) {
        let reason = 'PREFERENCES_MATCH';
        if (watchingReasons.has(WatchingReason.MENTIONED)) {
          reason = 'MENTIONED';
        } else if (watchingReasons.has(WatchingReason.AUTHOR)) {
          reason = 'AUTHOR';
        } else if (watchingReasons.has(WatchingReason.REVIEWER)) {
          reason = 'REVIEWER';
        } else if (watchingReasons.has(WatchingReason.ASSIGNED)) {
          reason = 'ASSIGNED';
        }

        return {
          shouldMatch: true,
          matchedKeywords: [],
          matchDetails: {},
          reason,
          context: {
            profileId: profile.id,
            profileName: profile.name,
            watchingReasons: Array.from(watchingReasons),
            trigger,
          },
        };
      }

      return {
        shouldMatch: false,
        matchedKeywords: [],
        matchDetails: {},
        reason: 'PREFERENCES_NO_MATCH',
        context: { profileId: profile.id, profileName: profile.name },
      };
    } catch (error) {
      this.logger.error(`Error checking profile match: ${error}`);
      return {
        shouldMatch: false,
        matchedKeywords: [],
        matchDetails: {},
        reason: 'ERROR',
        context: { error: error.message, profileId: profile.id },
      };
    }
  }

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
      if (data.head || data.requested_reviewers) {
        isPR = true;
      } else if (data.issue && data.issue.pull_request) {
        isPR = true;
      } else if (data.pull_request) {
        isPR = true;
      } else if (data.html_url && data.html_url.includes('/pull/')) {
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
            const repository = data.repository?.full_name;
            const prNumber = data.issue?.number;

            if (repository && prNumber && user.githubAccessToken) {
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
   * Helper to extract content for keyword matching from payload
   */
  private extractContentFromPayload(payload: any, eventType: string): string {
    const parts: string[] = [];

    switch (eventType) {
      case 'pull_request':
        const pr = payload.pull_request || {};
        parts.push(pr.title || '', pr.body || '');
        break;
      case 'issue':
        const issue = payload.issue || {};
        parts.push(issue.title || '', issue.body || '');
        break;
      case 'issue_comment':
        const comment = payload.comment || {};
        parts.push(comment.body || '');
        break;
      case 'pull_request_review':
        const review = payload.review || {};
        parts.push(review.body || '');
        break;
      case 'pull_request_review_comment':
        const reviewComment = payload.comment || {};
        parts.push(reviewComment.body || '');
        break;
    }

    return parts.join('\n\n');
  }

  /**
   * Helper to extract data object for watching reasons from payload
   */
  private extractDataFromPayload(payload: any, eventType: string): any {
    switch (eventType) {
      case 'pull_request':
        return payload.pull_request || {};
      case 'issue':
      case 'issue_comment':
        return payload.issue || {};
      case 'pull_request_review':
      case 'pull_request_review_comment':
        return payload.pull_request || {};
      default:
        return {};
    }
  }

  /**
   * Helper to get notification trigger from event
   */
  private getTriggerFromEvent(
    payload: any,
    eventType: string,
  ): NotificationTrigger | null {
    const action = payload.action;

    switch (eventType) {
      case 'pull_request':
        if (action === 'opened') return NotificationTrigger.OPENED;
        if (action === 'reopened') return NotificationTrigger.REOPENED;
        if (action === 'closed' && payload.pull_request?.merged)
          return NotificationTrigger.MERGED;
        if (action === 'closed' && !payload.pull_request?.merged)
          return NotificationTrigger.CLOSED;
        if (action === 'review_requested')
          return NotificationTrigger.REVIEW_REQUESTED;
        if (action === 'review_request_removed')
          return NotificationTrigger.REVIEW_REQUEST_REMOVED;
        if (action === 'assigned') return NotificationTrigger.ASSIGNED;
        if (action === 'unassigned') return NotificationTrigger.UNASSIGNED;
        break;
      case 'issue_comment':
      case 'pull_request_review_comment':
        return NotificationTrigger.COMMENTED;
      case 'pull_request_review':
        if (action === 'submitted') return NotificationTrigger.REVIEWED;
        break;
      case 'issue':
        if (action === 'opened') return NotificationTrigger.OPENED;
        if (action === 'closed') return NotificationTrigger.CLOSED;
        if (action === 'reopened') return NotificationTrigger.REOPENED;
        if (action === 'assigned') return NotificationTrigger.ASSIGNED;
        if (action === 'unassigned') return NotificationTrigger.UNASSIGNED;
        break;
    }

    return null;
  }

  /**
   * Check if profile scope matches the current context
   */
  private checkProfileScope(
    profile: NotificationProfileWithMeta,
    userId: string,
    payload: any,
  ): boolean {
    // For now, we'll implement basic scope checking
    // TODO: Add team scope validation when we have team context in payloads
    return true; // All scopes match for now
  }

  /**
   * Check notification preferences for a specific trigger
   */
  private shouldNotifyBasedOnPreferences(
    preferences: NotificationPreferences,
    trigger: NotificationTrigger,
    watchingReasons: Set<WatchingReason>,
  ): boolean {
    // Always notify if mentioned
    if (watchingReasons.has(WatchingReason.MENTIONED)) {
      return preferences.mentioned_in_comments ?? true;
    }

    if (watchingReasons.has(WatchingReason.TEAM_MENTIONED)) {
      return preferences.team_mentions ?? true;
    }

    // Check preferences based on trigger
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
        const individualAssigned =
          watchingReasons.has(WatchingReason.ASSIGNED) &&
          (preferences.pull_request_assigned ?? true);
        const teamAssigned =
          watchingReasons.has(WatchingReason.TEAM_ASSIGNED) &&
          (preferences.team_assignments ?? true);
        return individualAssigned || teamAssigned;
      case NotificationTrigger.REVIEW_REQUESTED:
      case NotificationTrigger.REVIEW_REQUEST_REMOVED:
        const individualReviewer =
          watchingReasons.has(WatchingReason.REVIEWER) &&
          (preferences.pull_request_assigned ?? true);
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
  }
}
