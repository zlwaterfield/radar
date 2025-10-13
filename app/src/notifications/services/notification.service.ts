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
      // Fetch user data to get githubId for preference checks
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        select: { githubId: true },
      });

      if (!user?.githubId) {
        this.logger.warn(`User ${userId} has no githubId, skipping profile match`);
        return {
          shouldMatch: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'NO_GITHUB_ID',
          context: { profileId: profile.id, profileName: profile.name },
        };
      }

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
      const watchingReasons = await this.determineWatchingReasons(userId, data, payload, eventType);

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
      if (!(await this.checkProfileScope(profile, userId, payload))) {
        return {
          shouldMatch: false,
          matchedKeywords: [],
          matchDetails: {},
          reason: 'SCOPE_MISMATCH',
          context: {
            profileId: profile.id,
            profileName: profile.name,
            scopeType: profile.scopeType,
            scopeValue: profile.scopeValue,
            repositoryId: payload.repository?.id?.toString(),
            repositoryName: payload.repository?.full_name,
            repositoryFilter: profile.repositoryFilter,
          },
        };
      }

      // Check notification preferences for this event type
      const trigger = this.getTriggerFromEvent(payload, eventType);
      const isPullRequest = this.isPullRequestEvent(eventType, payload);
      const isIssue = this.isIssueEvent(eventType, payload);
      
      if (
        trigger &&
        this.shouldNotifyBasedOnPreferences(
          profile.notificationPreferences,
          trigger,
          watchingReasons,
          isPullRequest,
          isIssue,
          payload,
          user.githubId,
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
      await this.analyticsService.trackError(
        userId,
        error instanceof Error ? error : new Error(String(error)),
        {
          eventId,
          eventType,
          operation: 'notification_profile_match',
          category: 'notification_critical',
        },
      );
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
    payload: any,
    eventType: string,
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

      // Special handling for review_requested event
      // Only notify the specific reviewer(s) being requested, not everyone watching
      if (payload.action === 'review_requested') {
        const requestedReviewer = payload.requested_reviewer;
        const requestedTeam = payload.requested_team;

        console.log(`[REVIEW_REQUEST_DEBUG] Processing review request for user ${githubUsername} (ID: ${user.githubId})`);
        console.log(`[REVIEW_REQUEST_DEBUG] Requested reviewer:`, requestedReviewer);
        console.log(`[REVIEW_REQUEST_DEBUG] Requested team:`, requestedTeam);
        console.log(`[REVIEW_REQUEST_DEBUG] Repository:`, payload.repository?.owner?.login);

        // Check if this user is the requested reviewer
        if (requestedReviewer && requestedReviewer.login === githubUsername) {
          console.log(`[REVIEW_REQUEST_DEBUG] ✅ User ${githubUsername} is the requested reviewer`);
          watchingReasons.add(WatchingReason.REVIEWER);
          return watchingReasons; // Return early, only notify this specific reviewer
        }

        // Check if this user's team is the requested team
        if (requestedTeam) {
          const userTeamSlugs = user.teams.map(
            (t) => `${t.organization}/${t.teamSlug}`,
          );
          const requestedTeamPath = `${payload.repository?.owner?.login}/${requestedTeam.slug}`;

          console.log(`[REVIEW_REQUEST_DEBUG] User teams:`, userTeamSlugs);
          console.log(`[REVIEW_REQUEST_DEBUG] Requested team path:`, requestedTeamPath);

          if (userTeamSlugs.includes(requestedTeamPath)) {
            console.log(`[REVIEW_REQUEST_DEBUG] ✅ User ${githubUsername} is in the requested team`);
            watchingReasons.add(WatchingReason.TEAM_REVIEWER);
            return watchingReasons; // Return early, only notify team members
          } else {
            console.log(`[REVIEW_REQUEST_DEBUG] ❌ User ${githubUsername} is not in the requested team`);
          }
        } else {
          console.log(`[REVIEW_REQUEST_DEBUG] No team requested, only individual reviewer`);
        }

        // If this user is not the requested reviewer/team, return empty set
        // This prevents notifying others who are watching the PR (like the author)
        console.log(`[REVIEW_REQUEST_DEBUG] ❌ User ${githubUsername} is not the requested reviewer or team member - no notification`);
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

      // Check for mentions in both the main content and any comment content
      const textToCheck = this.getTextContentForMentions(data, payload, eventType);
      
      // Check if user is mentioned (using word boundaries for accurate matching)
      if (this.isUserMentioned(textToCheck, githubUsername)) {
        watchingReasons.add(WatchingReason.MENTIONED);
      }

      // Check if user's teams are mentioned
      if (this.areTeamsMentioned(textToCheck, user.teams)) {
        watchingReasons.add(WatchingReason.TEAM_MENTIONED);
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
  private async checkProfileScope(
    profile: NotificationProfileWithMeta,
    userId: string,
    payload: any,
  ): Promise<boolean> {
    // Check repository filtering
    if (!this.checkRepositoryFilter(profile, payload)) {
      this.logger.debug(
        `Profile ${profile.name} (${profile.id}) repository filter mismatch for repository ${payload.repository?.full_name}`
      );
      return false;
    }

    // Check team scope if profile is scoped to a team
    if (profile.scopeType === 'team' && profile.scopeValue) {
      return await this.checkTeamScope(profile, userId, payload);
    }

    // For 'user' scope, no additional checks needed
    return true;
  }

  /**
   * Check if the event involves any team members
   */
  private async checkTeamScope(
    profile: NotificationProfileWithMeta,
    userId: string,
    payload: any,
  ): Promise<boolean> {
    try {
      // Get team details and fetch member logins
      const userTeam = await this.databaseService.userTeam.findFirst({
        where: {
          userId,
          teamId: profile.scopeValue!,
        },
        select: {
          organization: true,
          teamSlug: true,
        },
      });

      if (!userTeam) {
        this.logger.warn(
          `Team ${profile.scopeValue} not found for user ${userId}`,
        );
        return false;
      }

      // Get user's access token to fetch team members
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true },
      });

      if (!user?.githubAccessToken) {
        this.logger.warn(
          `No GitHub access token for user ${userId} to fetch team members`,
        );
        return false;
      }

      // Fetch team members from GitHub
      const teamMemberLogins = await this.githubService.getTeamMembers(
        userTeam.organization,
        userTeam.teamSlug,
        user.githubAccessToken,
      );

      if (teamMemberLogins.length === 0) {
        this.logger.warn(
          `No team members found for ${userTeam.organization}/${userTeam.teamSlug}`,
        );
        return false;
      }

      // Check if any team member is involved in the event
      return this.isTeamInvolvedInEvent(payload, teamMemberLogins);
    } catch (error) {
      this.logger.error(
        `Error checking team scope for profile ${profile.id}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Check if any team member is involved in the event (author, reviewer, assignee)
   */
  private isTeamInvolvedInEvent(
    payload: any,
    teamMemberLogins: string[],
  ): boolean {
    // Get the main object (PR or issue)
    const mainObject = payload.pull_request || payload.issue || {};

    // Check if author is a team member
    if (mainObject.user?.login && teamMemberLogins.includes(mainObject.user.login)) {
      return true;
    }

    // Check if any requested reviewer is a team member
    const requestedReviewers = mainObject.requested_reviewers || [];
    for (const reviewer of requestedReviewers) {
      if (teamMemberLogins.includes(reviewer.login)) {
        return true;
      }
    }

    // Check if any assignee is a team member
    const assignees = mainObject.assignees || [];
    for (const assignee of assignees) {
      if (teamMemberLogins.includes(assignee.login)) {
        return true;
      }
    }

    // Check if comment author is a team member (for comment events)
    if (payload.comment?.user?.login && teamMemberLogins.includes(payload.comment.user.login)) {
      return true;
    }

    // Check if review author is a team member (for review events)
    if (payload.review?.user?.login && teamMemberLogins.includes(payload.review.user.login)) {
      return true;
    }

    return false;
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
   * Determine if event type is for a pull request (context-aware for issue_comment)
   */
  private isPullRequestEvent(eventType: string, payload?: any): boolean {
    // Direct PR event types
    if (eventType === 'pull_request' || 
        eventType === 'pull_request_review' || 
        eventType === 'pull_request_review_comment') {
      return true;
    }
    
    // For issue_comment, check if it's a comment on a PR
    if (eventType === 'issue_comment' && payload?.issue?.pull_request) {
      return true;
    }
    
    return false;
  }

  /**
   * Determine if event type is for an issue (context-aware for issue_comment)
   */
  private isIssueEvent(eventType: string, payload?: any): boolean {
    // Direct issue event
    if (eventType === 'issue') {
      return true;
    }
    
    // For issue_comment, check if it's a comment on a regular issue (not a PR)
    if (eventType === 'issue_comment' && !payload?.issue?.pull_request) {
      return true;
    }
    
    return false;
  }

  /**
   * Get the appropriate mention preference based on event type
   */
  private getMentionPreference(
    preferences: NotificationPreferences,
    isPullRequest: boolean,
    isIssue: boolean,
  ): boolean {
    if (isIssue) {
      return preferences.mention_in_issue ?? true;
    } else if (isPullRequest) {
      return preferences.mention_in_pull_request ?? true;
    } else {
      // This should not happen with context-aware event detection, but fallback to PR preference
      this.logger.warn('Unexpected event type context: not PR and not Issue for mention preference');
      return preferences.mention_in_pull_request ?? true;
    }
  }

  /**
   * Get the appropriate event preference based on trigger and event type
   */
  private getEventPreference(
    preferences: NotificationPreferences,
    trigger: NotificationTrigger,
    isPullRequest: boolean,
    isIssue: boolean,
    watchingReasons: Set<WatchingReason>,
  ): boolean {
    switch (trigger) {
      case NotificationTrigger.COMMENTED:
        return isIssue 
          ? (preferences.issue_commented ?? true)
          : (preferences.pull_request_commented ?? true);
        
      case NotificationTrigger.REVIEWED:
        // Reviews only apply to PRs
        return preferences.pull_request_reviewed ?? true;
        
      case NotificationTrigger.MERGED:
        // Merging only applies to PRs
        return preferences.pull_request_merged ?? true;
        
      case NotificationTrigger.CLOSED:
      case NotificationTrigger.REOPENED:
        return isIssue 
          ? (preferences.issue_closed ?? true)
          : (preferences.pull_request_closed ?? true);
        
      case NotificationTrigger.ASSIGNED:
      case NotificationTrigger.UNASSIGNED:
        const assignedPref = isIssue 
          ? (preferences.issue_assigned ?? true)
          : (preferences.pull_request_assigned ?? true);
        return watchingReasons.has(WatchingReason.ASSIGNED) && assignedPref;
        
      case NotificationTrigger.REVIEW_REQUESTED:
      case NotificationTrigger.REVIEW_REQUEST_REMOVED:
        // Review requests only apply to PRs
        return (watchingReasons.has(WatchingReason.REVIEWER) ||
                watchingReasons.has(WatchingReason.TEAM_REVIEWER)) &&
               (preferences.pull_request_review_requested ?? true);
        
      case NotificationTrigger.OPENED:
        return isIssue 
          ? (preferences.issue_opened ?? true)
          : (preferences.pull_request_opened ?? true);
        
      case NotificationTrigger.CHECK_FAILED:
        return preferences.check_failures ?? false;
        
      case NotificationTrigger.CHECK_SUCCEEDED:
        return preferences.check_successes ?? false;
        
      default:
        return false;
    }
  }

  /**
   * Check notification preferences for a specific trigger
   */
  private shouldNotifyBasedOnPreferences(
    preferences: NotificationPreferences,
    trigger: NotificationTrigger,
    watchingReasons: Set<WatchingReason>,
    isPullRequest: boolean,
    isIssue: boolean,
    payload: any,
    githubId: string,
  ): boolean {
    // Self-action filtering: Don't notify for own actions if mute_own_activity is enabled (default true)
    if (payload.sender?.id?.toString() === githubId && preferences.mute_own_activity !== false) {
      return false;
    }
    
    // Bot comment filtering: Don't notify for bot actions if mute_bot_comments is enabled
    if (payload.sender?.type === 'Bot' && preferences.mute_bot_comments === true) {
      return false;
    }
    
    // Draft PR filtering: Don't notify for draft PR activity if mute_draft_pull_requests is enabled
    if (isPullRequest && preferences.mute_draft_pull_requests === true) {
      const isDraft = payload.pull_request?.draft === true;
      if (isDraft) {
        return false;
      }
    }

    // Always notify if mentioned - use appropriate preference based on event type
    if (
      watchingReasons.has(WatchingReason.MENTIONED) ||
      watchingReasons.has(WatchingReason.TEAM_MENTIONED)
    ) {
      return this.getMentionPreference(preferences, isPullRequest, isIssue);
    }

    // Check preferences based on trigger and event type
    return this.getEventPreference(preferences, trigger, isPullRequest, isIssue, watchingReasons);
  }

  /**
   * Get all text content that should be checked for mentions
   */
  private getTextContentForMentions(data: any, payload: any, eventType: string): string {
    const textParts: string[] = [];
    
    // Always include the main body (PR/issue description)
    if (data.body) {
      textParts.push(data.body);
    }
    
    // For comment events, also include the comment body
    switch (eventType) {
      case 'issue_comment':
        if (payload.comment?.body) {
          textParts.push(payload.comment.body);
        }
        break;
      case 'pull_request_review':
        if (payload.review?.body) {
          textParts.push(payload.review.body);
        }
        break;
      case 'pull_request_review_comment':
        if (payload.comment?.body) {
          textParts.push(payload.comment.body);
        }
        break;
    }
    
    return textParts.join('\n\n');
  }

  /**
   * Check if user is mentioned in text using word boundaries for accurate matching
   */
  private isUserMentioned(text: string, githubUsername: string): boolean {
    if (!text || !githubUsername) {
      return false;
    }
    
    // Use word boundary regex to prevent false positives like @johndoe matching @johndoesthings
    const mentionRegex = new RegExp(`\\B@${githubUsername}\\b`, 'i');
    return mentionRegex.test(text);
  }

  /**
   * Check if any of the user's teams are mentioned in text
   */
  private areTeamsMentioned(text: string, teams: any[]): boolean {
    if (!text || !teams?.length) {
      return false;
    }
    
    for (const team of teams) {
      // Check for @org/team-name mentions
      const teamMentionRegex = new RegExp(`\\B@${team.organization}/${team.teamSlug}\\b`, 'i');
      if (teamMentionRegex.test(text)) {
        return true;
      }
    }
    
    return false;
  }
}
