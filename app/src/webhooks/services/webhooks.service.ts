import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { UserTeamsSyncService } from '../../users/services/user-teams-sync.service';
import type {
  GitHubWebhookPayload,
  WebhookProcessResult,
} from '../../common/types';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly userTeamsSyncService: UserTeamsSyncService,
  ) {}

  /**
   * Verify GitHub webhook signature
   */
  verifyGitHubSignature(payload: string, signature: string): boolean {
    try {
      const secret = this.configService.get('github.webhookSecret');
      if (!secret) {
        this.logger.error('GitHub webhook secret not configured');
        return false;
      }

      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload, 'utf8');
      const expectedSignature = `sha256=${hmac.digest('hex')}`;

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error('Error verifying GitHub signature:', error);
      return false;
    }
  }

  /**
   * Process GitHub webhook payload
   */
  async processGitHubWebhook(
    eventType: string,
    payload: GitHubWebhookPayload,
  ): Promise<WebhookProcessResult | null> {
    try {
      if (!this.isRelevantEvent(eventType, payload)) {
        this.logger.debug(`Skipping irrelevant event: ${eventType}`);
        return { processed: false };
      }

      // Handle special events that don't need to be stored as regular events
      if (eventType === 'membership') {
        await this.processTeamMembershipEvent(payload);
        return { processed: true };
      }

      if (eventType === 'installation') {
        await this.processInstallationEvent(payload);
        return { processed: true };
      }

      const event = await this.storeEvent(eventType, payload);
      if (!event) {
        this.logger.error('Failed to store event in database');
        return null;
      }

      this.logger.log(
        `Processed ${eventType} event for repository ${payload.repository?.name}`,
      );
      return { processed: true, event };
    } catch (error) {
      this.logger.error(
        `Error processing GitHub webhook (${eventType}):`,
        error,
      );
      return null;
    }
  }

  /**
   * Check if event is relevant for processing
   */
  private isRelevantEvent(eventType: string, payload: any): boolean {
    const relevantEvents = [
      'pull_request',
      'pull_request_review',
      'pull_request_review_comment',
      'issues',
      'issue_comment',
      'push',
      'create',
      'delete',
      'release',
      'star',
      'fork',
      'membership',
      'installation',
    ];

    if (!relevantEvents.includes(eventType)) {
      return false;
    }

    // Handle team membership events
    if (eventType === 'membership') {
      return ['added', 'removed'].includes(payload.action);
    }

    // Handle installation events for auto-sync
    if (eventType === 'installation') {
      return ['created'].includes(payload.action);
    }

    // Skip bot events for regular events (but not for team/installation events)
    if (
      !['membership', 'team', 'installation'].includes(eventType) &&
      payload.sender?.type === 'Bot'
    ) {
      return false;
    }

    // For pull_request events, only process specific actions
    if (eventType === 'pull_request') {
      const relevantActions = [
        'opened',
        'closed',
        'reopened',
        'ready_for_review',
        'review_requested',
        'assigned',
        'unassigned',
      ];
      return relevantActions.includes(payload.action);
    }

    // For issues events, only process specific actions
    if (eventType === 'issues') {
      const relevantActions = [
        'opened',
        'closed',
        'reopened',
        'assigned',
        'unassigned',
      ];
      return relevantActions.includes(payload.action);
    }

    // For review events, only process submitted reviews
    if (eventType === 'pull_request_review') {
      return payload.action === 'submitted';
    }

    // For comments, skip if it's just editing
    if (
      eventType === 'issue_comment' ||
      eventType === 'pull_request_review_comment'
    ) {
      return payload.action === 'created';
    }

    return true;
  }

  /**
   * Store event in database
   */
  private async storeEvent(eventType: string, payload: any): Promise<any> {
    try {
      const repositoryId = payload.repository?.id?.toString() || '';
      const repositoryName = payload.repository?.full_name || '';
      const senderId = payload.sender?.id?.toString() || '';
      const senderLogin = payload.sender?.login || '';

      return await this.databaseService.event.create({
        data: {
          eventType,
          action: payload.action || null,
          repositoryId,
          repositoryName,
          senderId,
          senderLogin,
          processed: false,
          payload: payload,
        },
      });
    } catch (error) {
      this.logger.error('Error storing event:', error);
      return null;
    }
  }

  /**
   * Process team membership webhook event
   */
  async processTeamMembershipEvent(payload: any): Promise<void> {
    try {
      const { action, member, team, organization } = payload;

      if (!member?.id || !team?.id) {
        this.logger.warn(
          'Invalid team membership payload: missing member or team',
        );
        return;
      }

      // Find user by GitHub ID
      const user = await this.databaseService.user.findFirst({
        where: { githubId: member.id.toString() },
      });

      if (!user) {
        this.logger.debug(
          `No user found for GitHub ID ${member.id}, skipping team membership update`,
        );
        return;
      }

      if (action === 'added') {
        await this.userTeamsSyncService.addTeamMembership(
          user.id,
          team.id.toString(),
          team.slug,
          team.name,
          organization.login,
          member.role || 'member',
        );
        this.logger.log(
          `Added user ${user.id} to team ${team.slug} in ${organization.login}`,
        );
      } else if (action === 'removed') {
        await this.userTeamsSyncService.removeTeamMembership(
          user.id,
          team.id.toString(),
        );
        this.logger.log(
          `Removed user ${user.id} from team ${team.slug} in ${organization.login}`,
        );
      }
    } catch (error) {
      this.logger.error('Error processing team membership event:', error);
      throw error;
    }
  }

  /**
   * Process installation webhook event for auto-sync
   */
  async processInstallationEvent(payload: any): Promise<void> {
    try {
      const { action, installation, sender } = payload;

      if (action === 'created' && sender?.id) {
        // Find user by GitHub ID
        const user = await this.databaseService.user.findFirst({
          where: { githubId: sender.id.toString() },
        });

        if (user) {
          this.logger.log(
            `GitHub App installed by user ${user.id}, triggering auto-sync`,
          );

          // Update installation ID
          await this.databaseService.user.update({
            where: { id: user.id },
            data: { githubInstallationId: installation.id.toString() },
          });

          // Trigger full sync of repos and teams
          await this.userTeamsSyncService.syncUserGitHubData(user.id);

          this.logger.log(
            `Completed auto-sync for user ${user.id} after app installation`,
          );
        } else {
          this.logger.debug(
            `No user found for GitHub ID ${sender.id}, skipping auto-sync`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error processing installation event:', error);
      throw error;
    }
  }
}
