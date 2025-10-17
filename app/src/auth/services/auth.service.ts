import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { NotificationProfileService } from '../../notifications/services/notification-profile.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { EntitlementsService } from '../../stripe/services/entitlements.service';
import { auth } from '../auth.config';
import * as crypto from 'crypto-js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly notificationProfileService: NotificationProfileService,
    private readonly analyticsService: AnalyticsService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  /**
   * Get Better Auth instance
   */
  getAuth() {
    return auth;
  }

  /**
   * Create or update user from OAuth provider data
   */
  async createOrUpdateUser(providerData: {
    providerId: string;
    accountId: string;
    email?: string;
    name?: string;
    image?: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    const {
      providerId,
      accountId,
      email,
      name,
      image,
      accessToken,
      refreshToken,
    } = providerData;

    try {
      // Find existing user by account
      const existingAccount = await this.databaseService.account.findFirst({
        where: {
          providerId,
          accountId,
        },
        include: {
          user: true,
        },
      });

      let user;

      if (existingAccount) {
        // Update existing user
        user = await this.databaseService.user.update({
          where: { id: existingAccount.userId },
          data: {
            name: name || existingAccount.user.name,
            email: email || existingAccount.user.email,
            image: image || existingAccount.user.image,
            updatedAt: new Date(),
          },
        });

        // Update account tokens
        await this.databaseService.account.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: accessToken
              ? this.encryptToken(accessToken)
              : existingAccount.accessToken,
            refreshToken: refreshToken
              ? this.encryptToken(refreshToken)
              : existingAccount.refreshToken,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new user with provider-specific required fields
        const userData = {
          name,
          email,
          image,
        };

        if (providerId === 'slack') {
          Object.assign(userData, {
            slackId: accountId,
            slackTeamId: '', // Will be updated with actual team ID
            slackAccessToken: accessToken ? this.encryptToken(accessToken) : '',
            slackRefreshToken: refreshToken
              ? this.encryptToken(refreshToken)
              : null,
          });
        } else if (providerId === 'github') {
          Object.assign(userData, {
            // For GitHub-only users, we need a placeholder slackId since it's required
            slackId: `github-${accountId}`,
            slackTeamId: 'github-placeholder',
            slackAccessToken: 'placeholder',
            githubId: accountId,
            githubLogin: name || '',
            githubAccessToken: accessToken
              ? this.encryptToken(accessToken)
              : null,
            githubRefreshToken: refreshToken
              ? this.encryptToken(refreshToken)
              : null,
          });
        }

        user = await this.databaseService.user.create({
          data: userData as any,
        });

        // Track new user signup in PostHog
        await this.analyticsService.track(user.id, 'user_signed_up', {
          providerId,
          hasGitHub: !!user.githubId,
          hasSlack: !!user.slackId,
          email: user.email,
          name: user.name,
        });

        // Create account record
        const now = new Date();
        await this.databaseService.account.create({
          data: {
            id: require('crypto').randomBytes(16).toString('hex'),
            accountId,
            providerId,
            userId: user.id,
            accessToken: accessToken ? this.encryptToken(accessToken) : null,
            refreshToken: refreshToken ? this.encryptToken(refreshToken) : null,
            createdAt: now,
            updatedAt: now,
          },
        });

        // Create default notification profile
        try {
          await this.notificationProfileService.createNotificationProfile(
            user.id,
            {
              name: 'Default Notifications',
              description: 'Default notification profile for all activities',
              isEnabled: true,
              scopeType: 'user',
              repositoryFilter: { type: 'all' },
              deliveryType: 'dm',
              notificationPreferences: {
                // PR Activity
                pull_request_opened: true,
                pull_request_closed: true,
                pull_request_merged: true,
                pull_request_reviewed: true,
                pull_request_commented: true,
                pull_request_assigned: true,
                pull_request_review_requested: true,
                mention_in_pull_request: true,

                // Issue Activity
                issue_opened: true,
                issue_closed: true,
                issue_commented: true,
                issue_assigned: true,
                mention_in_issue: true,

                // CI/CD
                check_failures: false,
                check_successes: false,

                // Noise Control
                mute_own_activity: true,
                mute_bot_comments: true,
                mute_draft_pull_requests: true,
              },
              keywordIds: [],
              priority: 0,
            },
          );

          this.logger.log(
            `Created default notification profile for new user ${user.id}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to create default notification profile for user ${user.id}:`,
            error,
          );
        }

        // Initialize feature entitlements
        try {
          await this.entitlementsService.syncUserEntitlements(user.id);
          this.logger.log(
            `Initialized feature entitlements for new user ${user.id}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to initialize feature entitlements for user ${user.id}:`,
            error,
          );
        }
      }

      this.logger.log(`User ${user.id} authenticated via ${providerId}`);
      return user;
    } catch (error) {
      this.logger.error(
        `Error creating/updating user from ${providerId}:`,
        error,
      );
      await this.analyticsService.trackError(
        accountId || 'unknown',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'user_authentication',
          providerId,
          category: 'auth_critical',
        },
      );
      throw error;
    }
  }

  /**
   * Get user by ID with decrypted tokens
   */
  async getUserWithTokens(userId: string, decryptTokens = false) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      include: {
        accounts: true,
      },
    });

    if (!user || !decryptTokens) {
      return user;
    }

    // Decrypt tokens if requested
    return {
      ...user,
      slackBotToken: user.slackBotToken
        ? this.decryptToken(user.slackBotToken)
        : null,
      slackUserToken: user.slackUserToken
        ? this.decryptToken(user.slackUserToken)
        : null,
      slackRefreshToken: user.slackRefreshToken
        ? this.decryptToken(user.slackRefreshToken)
        : null,
      githubAccessToken: user.githubAccessToken
        ? this.decryptToken(user.githubAccessToken)
        : null,
      githubRefreshToken: user.githubRefreshToken
        ? this.decryptToken(user.githubRefreshToken)
        : null,
    };
  }

  /**
   * Encrypt external service tokens
   */
  private encryptToken(token: string): string {
    const secretKey = this.configService.get('app.secretKey')!;
    return crypto.AES.encrypt(token, secretKey).toString();
  }

  /**
   * Decrypt external service tokens
   */
  private decryptToken(encryptedToken: string): string {
    const secretKey = this.configService.get('app.secretKey')!;
    const bytes = crypto.AES.decrypt(encryptedToken, secretKey);
    return bytes.toString(crypto.enc.Utf8);
  }

  /**
   * Validate user session
   */
  async validateSession(sessionId: string) {
    try {
      const session = await this.databaseService.session.findUnique({
        where: { id: sessionId },
        include: {
          user: true,
        },
      });

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      return session;
    } catch (error) {
      this.logger.error('Error validating session:', error);
      await this.analyticsService.trackError(
        sessionId || 'unknown',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'session_validation',
          category: 'auth_critical',
        },
      );
      return null;
    }
  }

  /**
   * Sign out user and cleanup sessions
   */
  async signOut(userId: string) {
    try {
      await this.databaseService.session.deleteMany({
        where: { userId },
      });

      this.logger.log(`User ${userId} signed out`);
    } catch (error) {
      this.logger.error(`Error signing out user ${userId}:`, error);
      throw error;
    }
  }
}
