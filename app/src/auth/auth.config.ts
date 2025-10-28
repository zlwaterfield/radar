import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../email/email.service';

const prisma = new PrismaClient();
const emailService = new EmailService();

/**
 * Initialize default notification profile and digest for new users
 */
async function initializeNewUser(userId: string) {
  try {
    // Check if user already has profiles (to avoid duplicates on re-auth)
    const existingProfile = await prisma.notificationProfile.findFirst({
      where: { userId },
    });

    if (existingProfile) {
      console.log(`User ${userId} already has notification profiles, skipping initialization`);
      return;
    }

    // Create default notification profile
    await prisma.notificationProfile.create({
      data: {
        userId,
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
        priority: 0,
      },
    });
    console.log(`Created default notification profile for user ${userId}`);

    // Create default digest config
    await prisma.digestConfig.create({
      data: {
        userId,
        name: 'Daily Digest',
        description: 'Daily summary of GitHub activity',
        isEnabled: false, // Disabled by default
        digestTime: '09:00',
        timezone: 'UTC',
        daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
        scopeType: 'user',
        repositoryFilter: { type: 'all' },
        deliveryType: 'dm',
      },
    });
    console.log(`Created default digest config for user ${userId}`);

    // Initialize feature entitlements based on payment mode
    const paymentEnabled = process.env.PAYMENT_ENABLED === 'true';
    const entitlements = paymentEnabled
      ? [
          { featureLookupKey: 'repositories', featureName: 'Repository Limit', value: '1' },
          { featureLookupKey: 'notification_profiles', featureName: 'Notification Configurations', value: '1' },
          { featureLookupKey: 'digest_configs', featureName: 'Digest Configs', value: '1' },
          { featureLookupKey: 'keyword_limit', featureName: 'Keyword Limit', value: '0' },
          { featureLookupKey: 'ai_keyword_matching', featureName: 'AI Keyword Matching', value: 'false' },
        ]
      : [
          { featureLookupKey: 'repositories', featureName: 'Repository Limit', value: '-1' }, // unlimited
          { featureLookupKey: 'notification_profiles', featureName: 'Notification Configurations', value: '-1' },
          { featureLookupKey: 'digest_configs', featureName: 'Digest Configs', value: '-1' },
          { featureLookupKey: 'keyword_limit', featureName: 'Keyword Limit', value: '-1' },
          { featureLookupKey: 'ai_keyword_matching', featureName: 'AI Keyword Matching', value: 'true' },
        ];

    await prisma.featureEntitlement.createMany({
      data: entitlements.map((ent) => ({
        userId,
        ...ent,
        isActive: true,
      })),
    });
    console.log(`Initialized feature entitlements for user ${userId}`);
  } catch (error) {
    console.error(`Failed to initialize new user ${userId}:`, error);
    // Don't throw - we don't want to block user signup if this fails
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  baseURL: process.env.FRONTEND_URL,

  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      if (!emailService.isConfigured()) {
        console.warn(
          'Email service not configured. Password reset email not sent.',
        );
        return;
      }

      await emailService.sendPasswordResetEmail({
        to: user.email,
        resetUrl: url,
        expirationTime: '1 hour',
      });
    },
    resetPasswordTokenExpiresIn: 3600, // 1 hour in seconds
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectURI: `${process.env.FRONTEND_URL}/api/auth/callback/google`,
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Run after any sign-up (email/password or OAuth) to initialize defaults
      if (ctx.path.startsWith('/sign-up') || ctx.path.includes('/callback/')) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          // Initialize default notification profile, digest, and entitlements
          await initializeNewUser(newSession.user.id);
        }
      }
    }),
  },

  advanced: {
    useSecureCookies: true,
  },

  logger: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  },

  trustedOrigins: [process.env.FRONTEND_URL!],
});
