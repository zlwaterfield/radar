/**
 * Simple migration script to create default notification profiles for users
 * who don't have any profiles yet
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LegacyNotificationPreferences {
  pull_request_opened?: boolean;
  pull_request_closed?: boolean;
  pull_request_merged?: boolean;
  pull_request_reviewed?: boolean;
  pull_request_commented?: boolean;
  pull_request_assigned?: boolean;
  issue_opened?: boolean;
  issue_closed?: boolean;
  issue_commented?: boolean;
  issue_assigned?: boolean;
  check_failures?: boolean;
  check_successes?: boolean;
  mention_in_comment?: boolean;
  mention_in_pull_request?: boolean;
  mention_in_issue?: boolean;
  mentioned_in_comments?: boolean;
  team_assignments?: boolean;
  team_mentions?: boolean;
  team_review_requests?: boolean;
  mute_own_activity?: boolean;
  mute_bot_comments?: boolean;
  mute_draft_pull_requests?: boolean;
}

interface LegacyKeywordPreferences {
  enabled?: boolean;
  keywords?: string[];
  threshold?: number;
}

const DEFAULT_NOTIFICATION_PREFERENCES: LegacyNotificationPreferences = {
  pull_request_opened: true,
  pull_request_closed: true,
  pull_request_merged: true,
  pull_request_reviewed: true,
  pull_request_commented: true,
  pull_request_assigned: true,
  issue_opened: true,
  issue_closed: true,
  issue_commented: true,
  issue_assigned: true,
  check_failures: true,
  check_successes: false,
  mention_in_comment: true,
  mention_in_pull_request: true,
  mention_in_issue: true,
  mentioned_in_comments: true,
  team_assignments: true,
  team_mentions: true,
  team_review_requests: true,
  mute_own_activity: true,
  mute_bot_comments: true,
  mute_draft_pull_requests: true,
};

async function createDefaultProfiles() {
  console.log(
    '🚀 Creating default notification profiles for users without profiles...',
  );

  try {
    // Get all users without notification profiles
    const users = await prisma.user.findMany({
      where: {
        notificationProfiles: {
          none: {},
        },
      },
      include: {
        settings: true,
      },
    });

    console.log(`📊 Found ${users.length} users without notification profiles`);

    let created = 0;

    for (const user of users) {
      try {
        // Get existing preferences if they exist
        const notificationPreferences =
          (user.settings
            ?.notificationPreferences as LegacyNotificationPreferences) ||
          DEFAULT_NOTIFICATION_PREFERENCES;
        const keywordPreferences = (user.settings
          ?.keywordPreferences as LegacyKeywordPreferences) || {
          enabled: false,
          keywords: [],
        };

        // Create default profile
        await prisma.notificationProfile.create({
          data: {
            userId: user.id,
            name: 'Default Notifications',
            description: 'Your main notification profile',
            isEnabled: true,
            scopeType: 'user',
            scopeValue: null,
            repositoryFilter: { type: 'all' },
            deliveryType: 'dm',
            deliveryTarget: null,
            notificationPreferences: notificationPreferences as any,
            keywords: keywordPreferences.keywords || [],
            keywordLLMEnabled: keywordPreferences.enabled || false,
            priority: 0,
          },
        });

        console.log(
          `✅ Created default profile for user ${user.githubLogin || user.id}`,
        );
        created++;
      } catch (error) {
        console.error(
          `❌ Error creating profile for user ${user.githubLogin || user.id}:`,
          error,
        );
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`✅ Successfully created default profiles: ${created} users`);
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    process.exit(1);
  }
}

async function main() {
  try {
    await createDefaultProfiles();
  } catch (error) {
    console.error('💥 Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { createDefaultProfiles };
