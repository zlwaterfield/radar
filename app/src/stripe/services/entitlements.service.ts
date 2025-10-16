import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);
  private readonly paymentEnabled: boolean;

  constructor(
    private db: DatabaseService,
    private configService: ConfigService,
  ) {
    this.paymentEnabled = this.configService.get<string>('PAYMENT_ENABLED', 'true') === 'true';
    if (!this.paymentEnabled) {
      this.logger.log('Running in open-source mode: Payment system disabled, full features granted to all users');
    }
  }

  async syncUserEntitlements(userId: string) {
    // If payment is disabled, grant full pro-level entitlements
    if (!this.paymentEnabled) {
      return this.setOpenSourceEntitlements(userId);
    }

    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.subscription || user.subscription.planName === 'free') {
      return this.setFreeEntitlements(userId);
    }

    const planName = user.subscription.planName;

    // Clear existing entitlements
    await this.db.featureEntitlement.deleteMany({ where: { userId } });

    // Set entitlements based on plan
    let entitlements: Array<{
      featureLookupKey: string;
      featureName: string;
      value: string;
    }> = [];

    switch (planName) {
      case 'basic':
        entitlements = [
          {
            featureLookupKey: 'repository_limit',
            featureName: 'Repository Limit',
            value: '5',
          },
          {
            featureLookupKey: 'notification_profiles',
            featureName: 'Notification Profiles',
            value: '3',
          },
          {
            featureLookupKey: 'digest_configs',
            featureName: 'Digest Configs',
            value: '3',
          },
          {
            featureLookupKey: 'github_team_support',
            featureName: 'GitHub Team Support',
            value: 'false',
          },
          {
            featureLookupKey: 'keyword_matching',
            featureName: 'Keyword Matching',
            value: 'true',
          },
          {
            featureLookupKey: 'ai_keyword_matching',
            featureName: 'AI Keyword Matching',
            value: 'false',
          },
        ];
        break;

      case 'pro':
        entitlements = [
          {
            featureLookupKey: 'repository_limit',
            featureName: 'Repository Limit',
            value: '-1',
          },
          {
            featureLookupKey: 'notification_profiles',
            featureName: 'Notification Profiles',
            value: '-1',
          },
          {
            featureLookupKey: 'digest_configs',
            featureName: 'Digest Configs',
            value: '-1',
          },
          {
            featureLookupKey: 'github_team_support',
            featureName: 'GitHub Team Support',
            value: 'true',
          },
          {
            featureLookupKey: 'keyword_matching',
            featureName: 'Keyword Matching',
            value: 'true',
          },
          {
            featureLookupKey: 'ai_keyword_matching',
            featureName: 'AI Keyword Matching',
            value: 'true',
          },
          {
            featureLookupKey: 'priority_support',
            featureName: 'Priority Support',
            value: 'true',
          },
        ];
        break;

      default:
        return this.setFreeEntitlements(userId);
    }

    await this.db.featureEntitlement.createMany({
      data: entitlements.map((ent) => ({
        userId,
        ...ent,
        isActive: true,
      })),
    });

    return entitlements;
  }

  async hasFeature(userId: string, featureLookupKey: string): Promise<boolean> {
    // If payment is disabled, grant all features
    if (!this.paymentEnabled) {
      return true;
    }

    const entitlement = await this.db.featureEntitlement.findUnique({
      where: {
        userId_featureLookupKey: {
          userId,
          featureLookupKey,
        },
      },
    });

    return entitlement?.isActive || false;
  }

  async getFeatureValue(
    userId: string,
    featureLookupKey: string,
  ): Promise<number | boolean | null> {
    // If payment is disabled, return unlimited/true values
    if (!this.paymentEnabled) {
      // Return unlimited for limits, true for boolean features
      if (featureLookupKey.includes('limit')) {
        return -1; // unlimited
      }
      return true;
    }

    const entitlement = await this.db.featureEntitlement.findUnique({
      where: {
        userId_featureLookupKey: {
          userId,
          featureLookupKey,
        },
      },
    });

    if (!entitlement) return null;

    // Parse value
    const value = entitlement.value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === '-1') return -1; // unlimited
    const numValue = parseInt(value, 10);
    return isNaN(numValue) ? null : numValue;
  }

  async checkLimit(
    userId: string,
    featureLookupKey: string,
    currentCount: number,
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const limit = await this.getFeatureValue(userId, featureLookupKey);

    if (limit === null) {
      return { allowed: false, limit: 0, current: currentCount };
    }

    if (limit === -1) {
      return { allowed: true, limit: -1, current: currentCount };
    }

    return {
      allowed: currentCount < (limit as number),
      limit: limit as number,
      current: currentCount,
    };
  }

  async getUserEntitlements(userId: string) {
    return this.db.featureEntitlement.findMany({
      where: { userId, isActive: true },
      select: {
        featureLookupKey: true,
        featureName: true,
        value: true,
        isActive: true,
      },
    });
  }

  private async setFreeEntitlements(userId: string) {
    await this.db.featureEntitlement.deleteMany({ where: { userId } });

    const freeEntitlements = [
      {
        featureLookupKey: 'repository_limit',
        featureName: 'Repository Limit',
        value: '2',
      },
      {
        featureLookupKey: 'notification_profiles',
        featureName: 'Notification Profiles',
        value: '1',
      },
      {
        featureLookupKey: 'digest_configs',
        featureName: 'Digest Configs',
        value: '1',
      },
      {
        featureLookupKey: 'github_team_support',
        featureName: 'GitHub Team Support',
        value: 'false',
      },
      {
        featureLookupKey: 'keyword_matching',
        featureName: 'Keyword Matching',
        value: 'false',
      },
      {
        featureLookupKey: 'ai_keyword_matching',
        featureName: 'AI Keyword Matching',
        value: 'false',
      },
    ];

    await this.db.featureEntitlement.createMany({
      data: freeEntitlements.map((ent) => ({
        userId,
        ...ent,
        isActive: true,
      })),
    });

    return freeEntitlements;
  }

  private async setOpenSourceEntitlements(userId: string) {
    await this.db.featureEntitlement.deleteMany({ where: { userId } });

    // Grant full pro-level entitlements for open-source mode
    const openSourceEntitlements = [
      {
        featureLookupKey: 'repository_limit',
        featureName: 'Repository Limit',
        value: '-1',
      },
      {
        featureLookupKey: 'notification_profiles',
        featureName: 'Notification Profiles',
        value: '-1',
      },
      {
        featureLookupKey: 'digest_configs',
        featureName: 'Digest Configs',
        value: '-1',
      },
      {
        featureLookupKey: 'github_team_support',
        featureName: 'GitHub Team Support',
        value: 'true',
      },
      {
        featureLookupKey: 'keyword_matching',
        featureName: 'Keyword Matching',
        value: 'true',
      },
      {
        featureLookupKey: 'ai_keyword_matching',
        featureName: 'AI Keyword Matching',
        value: 'true',
      },
    ];

    await this.db.featureEntitlement.createMany({
      data: openSourceEntitlements.map((ent) => ({
        userId,
        ...ent,
        isActive: true,
      })),
    });

    return openSourceEntitlements;
  }
}
