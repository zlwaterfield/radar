import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);
  private readonly paymentDisabled: boolean;

  constructor(
    private db: DatabaseService,
    private configService: ConfigService,
  ) {
    this.paymentDisabled = this.configService.get<string>('PAYMENT_DISABLED', 'false') === 'true';
    if (this.paymentDisabled) {
      this.logger.log('Running in open-source mode: Payment system disabled, full features granted to all users');
    }
  }

  async syncUserEntitlements(userId: string) {
    // If payment is disabled, grant full pro-level entitlements
    if (this.paymentDisabled) {
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
            featureName: 'Notification Configurations',
            value: '3',
          },
          {
            featureLookupKey: 'digest_configs',
            featureName: 'Digest Configs',
            value: '3',
          },
          {
            featureLookupKey: 'keyword_limit',
            featureName: 'Keyword Limit',
            value: '3',
          },
          {
            featureLookupKey: 'ai_keyword_matching',
            featureName: 'AI Keyword Matching',
            value: 'true',
          },
        ];
        break;

      case 'pro':
        entitlements = [
          {
            featureLookupKey: 'repository_limit',
            featureName: 'Repository Limit',
            value: '-1', // unlimited
          },
          {
            featureLookupKey: 'notification_profiles',
            featureName: 'Notification Configurations',
            value: '-1', // unlimited
          },
          {
            featureLookupKey: 'digest_configs',
            featureName: 'Digest Configs',
            value: '-1', // unlimited
          },
          {
            featureLookupKey: 'keyword_limit',
            featureName: 'Keyword Limit',
            value: '-1', // unlimited
          },
          {
            featureLookupKey: 'ai_keyword_matching',
            featureName: 'AI Keyword Matching',
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
    if (this.paymentDisabled) {
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
    if (this.paymentDisabled) {
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
    const entitlements = await this.db.featureEntitlement.findMany({
      where: { userId, isActive: true },
      select: {
        featureLookupKey: true,
        featureName: true,
        value: true,
        isActive: true,
      },
    });

    // Backfill entitlements if user has none
    if (entitlements.length === 0) {
      this.logger.log(`Backfilling entitlements for user ${userId}`);
      await this.syncUserEntitlements(userId);

      // Fetch the newly created entitlements
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

    return entitlements;
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
        featureName: 'Notification Configurations',
        value: '1',
      },
      {
        featureLookupKey: 'digest_configs',
        featureName: 'Digest Configs',
        value: '1',
      },
      {
        featureLookupKey: 'keyword_limit',
        featureName: 'Keyword Limit',
        value: '1',
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

    // Grant full entitlements for open-source mode
    const openSourceEntitlements = [
      {
        featureLookupKey: 'repository_limit',
        featureName: 'Repository Limit',
        value: '-1',
      },
      {
        featureLookupKey: 'notification_profiles',
        featureName: 'Notification Configurations',
        value: '-1',
      },
      {
        featureLookupKey: 'digest_configs',
        featureName: 'Digest Configs',
        value: '-1',
      },
      {
        featureLookupKey: 'keyword_limit',
        featureName: 'Keyword Limit',
        value: '-1',
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
