import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class SlackIntegrationService {
  private readonly logger = new Logger(SlackIntegrationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async exchangeCodeForTokens(code: string): Promise<any> {
    try {
      const tokenResponse = await fetch(
        'https://slack.com/api/oauth.v2.access',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: this.configService.get('slack.clientId')!,
            client_secret: this.configService.get('slack.clientSecret')!,
            code,
          }),
        },
      );

      const tokens = await tokenResponse.json();

      if (!tokens.ok) {
        throw new Error(tokens.error || 'Failed to exchange code for tokens');
      }

      return tokens;
    } catch (error) {
      this.logger.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  async connectSlackForUser(userId: string, slackTokens: any): Promise<void> {
    try {
      // Update user with Slack connection info
      await this.databaseService.user.update({
        where: { id: userId },
        data: {
          slackId: slackTokens.authed_user.id,
          slackAccessToken: slackTokens.access_token,
          slackRefreshToken: slackTokens.refresh_token,
          slackTeamId: slackTokens.team?.id,
        },
      });

      this.logger.log(`Slack connected for user ${userId}`);
    } catch (error) {
      this.logger.error('Error connecting Slack for user:', error);
      throw error;
    }
  }

  async disconnectSlackForUser(userId: string): Promise<void> {
    try {
      // Since slackId is required in the current schema, we can't set it to null
      // For now, we'll update the tokens only
      await this.databaseService.user.update({
        where: { id: userId },
        data: {
          slackAccessToken: '',
          slackRefreshToken: '',
        },
      });

      this.logger.log(`Slack disconnected for user ${userId}`);
    } catch (error) {
      this.logger.error('Error disconnecting Slack for user:', error);
      throw error;
    }
  }

  generateAuthUrl(userId: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.configService.get('slack.clientId')!,
      scope: [
        'chat:write',
        'chat:write.public',
        'commands',
        'users:read',
        'users:read.email',
        'team:read',
        'im:history',
        'im:read',
        'im:write',
        'app_mentions:read',
      ].join(','),
      redirect_uri: `${this.configService.get('app.callbackHost')}/api/integrations/slack/callback`,
      state: state || userId,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }
}
