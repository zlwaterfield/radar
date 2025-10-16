import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EntitlementsService } from '../src/stripe/services/entitlements.service';
import { DatabaseService } from '../src/database/database.service';
import { Logger } from '@nestjs/common';

/**
 * Backfill script to create feature entitlements for existing users
 *
 * Usage:
 *   npm run backfill:entitlements
 *
 * Or with ts-node:
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-entitlements.ts
 */
async function backfillEntitlements() {
  const logger = new Logger('BackfillEntitlements');

  logger.log('Starting entitlements backfill...');

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule);

  const entitlementsService = app.get(EntitlementsService);
  const databaseService = app.get(DatabaseService);

  try {
    // Get all users
    const users = await databaseService.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    logger.log(`Found ${users.length} users to process`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Check if user already has entitlements
        const existingEntitlements = await databaseService.featureEntitlement.count({
          where: { userId: user.id },
        });

        if (existingEntitlements > 0) {
          logger.log(`User ${user.id} (${user.email}) already has ${existingEntitlements} entitlements - skipping`);
          skipCount++;
          continue;
        }

        // Sync entitlements for this user
        await entitlementsService.syncUserEntitlements(user.id);

        // Verify entitlements were created
        const newEntitlements = await databaseService.featureEntitlement.count({
          where: { userId: user.id },
        });

        logger.log(`✓ Created ${newEntitlements} entitlements for user ${user.id} (${user.email})`);
        successCount++;

      } catch (error) {
        logger.error(`✗ Failed to create entitlements for user ${user.id} (${user.email}):`, error);
        errorCount++;
      }
    }

    logger.log('\n=== Backfill Summary ===');
    logger.log(`Total users: ${users.length}`);
    logger.log(`Successfully created: ${successCount}`);
    logger.log(`Skipped (already exists): ${skipCount}`);
    logger.log(`Errors: ${errorCount}`);
    logger.log('========================\n');

  } catch (error) {
    logger.error('Fatal error during backfill:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the backfill
backfillEntitlements()
  .then(() => {
    console.log('Backfill completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
