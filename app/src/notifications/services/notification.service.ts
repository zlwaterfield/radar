import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GitHubService } from '../../github/services/github.service';
import { GitHubTokenService } from '../../github/services/github-token.service';
import { LLMAnalyzerService } from './llm-analyzer.service';
import { NotificationProfileService } from './notification-profile.service';
import { AnalyticsService } from '../../analytics/analytics.service';
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
    private readonly githubTokenService: GitHubTokenService,
    private readonly llmAnalyzerService: LLMAnalyzerService,
    private readonly notificationProfileService: NotificationProfileService,
    private readonly analyticsService: AnalyticsService,
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

      // Track notification decision
      await this.analyticsService.track(userId, 'notification_decision', {
        eventType,
        eventId,
        shouldNotify: decision.shouldNotify,
        reason: decision.reason,
        profilesChecked: profiles.length,
        matchedProfilesCount: matchedProfiles.length,
        primaryProfileName: primaryProfile?.profile.name,
        primaryProfileId: primaryProfile?.profile.id,
      });

      return decision;
    } catch (error) {
      this.logger.error(`Error processing event with profiles: ${error}`);
      await this.analyticsService.trackError(
        userId,
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'notification_decision_processing',
          eventId,
          eventType,
          category: 'notification_critical',
        },
      );
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
      const data = await this.extractDataFromPayload(
        payload,
        eventType,
        userId,
      );
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
          reason: 'REPOSITORY_FILTER_MISMATCH',
          context: {
            profileId: profile.id,
            profileName: profile.name,
            scopeType: profile.scopeType,
            repositoryId: payload.repository?.id?.toString(),
            repositoryName: payload.repository?.full_name,
            repositoryFilter: profile.repositoryFilter,
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
      await this.analyticsService.trackError(
        userId,
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'watching_reasons_determination',
          category: 'notification_critical',
        },
      );
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
  private async extractDataFromPayload(
    payload: any,
    eventType: string,
    userId?: string,
  ): Promise<any> {
    switch (eventType) {
      case 'pull_request':
        return payload.pull_request || {};
      case 'issue':
        // Regular issue, not a PR
        return payload.issue || {};
      case 'issue_comment':
        // Check if this is a comment on a pull request
        if (payload.issue?.pull_request) {
          try {
            // This is a comment on a PR, fetch full PR data
            const repoFullName = payload.repository?.full_name;
            const prNumber = payload.issue.number;

            if (repoFullName && prNumber) {
              const [owner, repo] = repoFullName.split('/');

              // Try to get user's valid GitHub token first, fall back to app client
              let accessToken: string | undefined;
              if (userId) {
                accessToken =
                  (await this.githubTokenService.getValidTokenForApiCall(
                    userId,
                  )) || undefined;
              }

              const fullPRData = await this.githubService.getPullRequest(
                owner,
                repo,
                prNumber,
                accessToken,
              );
              return fullPRData;
            }
          } catch (error) {
            this.logger.warn(
              'Failed to fetch full PR data for issue comment, falling back to issue object:',
              error,
            );
          }
        }
        // Fall back to issue object for regular issues or if PR fetch failed
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
    // Check repository filtering
    if (!this.checkRepositoryFilter(profile, payload)) {
      this.logger.debug(
        `Profile ${profile.name} (${profile.id}) repository filter mismatch for repository ${payload.repository?.full_name}`
      );
      return false;
    }

    // TODO: Add team scope validation when we have team context in payloads
    return true;
  }

  /**
   * Check if the repository from the event matches the profile's repository filter
   */
  private checkRepositoryFilter(
    profile: NotificationProfileWithMeta,
    payload: any,
  ): boolean {
    const repositoryId = payload.repository?.id?.toString();
    
    if (!repositoryId) {
      this.logger.warn('No repository ID found in payload');
      return false;
    }

    const repositoryFilter = profile.repositoryFilter;
    
    // If filter type is 'all', include all repositories
    if (repositoryFilter.type === 'all') {
      this.logger.debug(
        `Profile ${profile.name} accepts all repositories, allowing ${payload.repository?.full_name}`
      );
      return true;
    }
    
    // If filter type is 'selected', check if repository is in the selected list
    if (repositoryFilter.type === 'selected') {
      if (!repositoryFilter.repoIds || repositoryFilter.repoIds.length === 0) {
        this.logger.warn(
          `Profile ${profile.name} has selected filter but no repository IDs configured`
        );
        return false;
      }
      
      const isIncluded = repositoryFilter.repoIds.includes(repositoryId);
      this.logger.debug(
        `Profile ${profile.name} repository filter: ${isIncluded ? 'INCLUDED' : 'EXCLUDED'} - ${payload.repository?.full_name} (${repositoryId})`
      );
      return isIncluded;
    }
    
    // Unknown filter type, default to false for safety
    this.logger.warn(
      `Profile ${profile.name} has unknown repository filter type: ${repositoryFilter.type}`
    );
    return false;
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
    if (
      watchingReasons.has(WatchingReason.MENTIONED) ||
      watchingReasons.has(WatchingReason.TEAM_MENTIONED)
    ) {
      return preferences.mention_in_comment ?? true;
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
        return (
          watchingReasons.has(WatchingReason.ASSIGNED) &&
          (preferences.pull_request_assigned ?? true)
        );
      case NotificationTrigger.REVIEW_REQUESTED:
      case NotificationTrigger.REVIEW_REQUEST_REMOVED:
        return (
          watchingReasons.has(WatchingReason.REVIEWER) &&
          (preferences.pull_request_review_requested ?? true)
        );
      case NotificationTrigger.OPENED:
        return preferences.pull_request_opened ?? true;
      case NotificationTrigger.CHECK_FAILED:
        return preferences.check_failures ?? false;
      case NotificationTrigger.CHECK_SUCCEEDED:
        return preferences.check_successes ?? false;
      default:
        return false;
    }
  }
}
