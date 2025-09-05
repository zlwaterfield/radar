import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private posthog: PostHog | null = null;
  private isEnabled = false;

  constructor(private configService: ConfigService) {
    this.initializePostHog();
  }

  private initializePostHog() {
    try {
      const apiKey = this.configService.get<string>('POSTHOG_API_KEY');
      const host = 'https://us.posthog.com';

      if (!apiKey) {
        this.logger.warn('PostHog API key not configured, analytics disabled');
        return;
      }

      this.posthog = new PostHog(apiKey, {
        host: host,
        enableExceptionAutocapture: true,
      });

      this.isEnabled = true;
      this.logger.log('PostHog analytics initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PostHog:', error);
    }
  }

  /**
   * Track an event
   */
  track(
    distinctId: string,
    event: string,
    properties: Record<string, any> = {},
  ) {
    if (!this.isEnabled || !this.posthog) {
      return;
    }

    try {
      this.posthog.capture({
        distinctId,
        event,
        properties: {
          ...properties,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to track event:', error);
    }
  }

  /**
   * Track an error using PostHog's exception tracking
   */
  trackError(
    distinctId: string,
    error: Error,
    context: Record<string, any> = {},
  ) {
    if (!this.isEnabled || !this.posthog) {
      return;
    }

    try {
      this.posthog.captureException(error, distinctId, context);
    } catch (err) {
      this.logger.error('Failed to track error:', err);
    }
  }

  /**
   * Identify a user
   */
  identify(distinctId: string, properties: Record<string, any> = {}) {
    if (!this.isEnabled || !this.posthog) {
      return;
    }

    try {
      this.posthog.identify({
        distinctId,
        properties,
      });
    } catch (error) {
      this.logger.error('Failed to identify user:', error);
    }
  }

  /**
   * Track notification events
   */
  trackNotification(
    userId: string,
    event: 'sent' | 'failed' | 'skipped',
    properties: Record<string, any> = {},
  ) {
    this.track(userId, `notification_${event}`, {
      category: 'notification',
      ...properties,
    });
  }

  /**
   * Track GitHub webhook events
   */
  trackWebhook(
    repositoryId: string,
    event: string,
    properties: Record<string, any> = {},
  ) {
    this.track(`repo_${repositoryId}`, `webhook_${event}`, {
      category: 'webhook',
      ...properties,
    });
  }

  /**
   * Track user actions
   */
  trackUserAction(
    userId: string,
    action: string,
    properties: Record<string, any> = {},
  ) {
    this.track(userId, `user_${action}`, {
      category: 'user_action',
      ...properties,
    });
  }

  /**
   * Shutdown PostHog client gracefully
   */
  async shutdown() {
    if (this.posthog) {
      await this.posthog.shutdown();
    }
  }
}
