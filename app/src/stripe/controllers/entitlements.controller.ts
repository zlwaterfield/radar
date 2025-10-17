import { Controller, Get, UseGuards, Logger, Query } from '@nestjs/common';
import { EntitlementsService } from '../services/entitlements.service';
import { DatabaseService } from '@/database/database.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { AdminGuard } from '@/auth/guards/admin.guard';

@Controller('entitlements')
@UseGuards(AuthGuard, AdminGuard)
export class EntitlementsController {
  private readonly logger = new Logger(EntitlementsController.name);

  constructor(
    private readonly entitlementsService: EntitlementsService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('backfill')
  async backfillEntitlements(@Query('force') force?: string) {
    const forceReset = force === 'true';
    this.logger.log(`Starting entitlements backfill... (force reset: ${forceReset})`);

    try {
      // Get all users
      const users = await this.databaseService.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      this.logger.log(`Found ${users.length} users to process`);

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      const errors: Array<{ userId: string; email: string; error: string }> = [];

      for (const user of users) {
        try {
          // Check if user already has entitlements
          const existingEntitlements = await this.databaseService.featureEntitlement.count({
            where: { userId: user.id },
          });

          if (existingEntitlements > 0 && !forceReset) {
            this.logger.log(`User ${user.id} (${user.email}) already has ${existingEntitlements} entitlements - skipping`);
            skipCount++;
            continue;
          }

          if (existingEntitlements > 0 && forceReset) {
            this.logger.log(`User ${user.id} (${user.email}) has ${existingEntitlements} entitlements - forcing reset`);
          }

          // Sync entitlements for this user (this will delete and recreate)
          await this.entitlementsService.syncUserEntitlements(user.id);

          // Verify entitlements were created
          const newEntitlements = await this.databaseService.featureEntitlement.count({
            where: { userId: user.id },
          });

          this.logger.log(`✓ ${forceReset && existingEntitlements > 0 ? 'Reset' : 'Created'} ${newEntitlements} entitlements for user ${user.id} (${user.email})`);
          successCount++;

        } catch (error) {
          this.logger.error(`✗ Failed to ${forceReset ? 'reset' : 'create'} entitlements for user ${user.id} (${user.email}):`, error);
          errorCount++;
          errors.push({
            userId: user.id,
            email: user.email || 'unknown',
            error: error.message,
          });
        }
      }

      const summary = {
        totalUsers: users.length,
        successCount,
        skipCount,
        errorCount,
        forceReset,
        errors: errors.length > 0 ? errors : undefined,
      };

      this.logger.log('\n=== Backfill Summary ===');
      this.logger.log(`Mode: ${forceReset ? 'FORCE RESET' : 'Normal (skip existing)'}`);
      this.logger.log(`Total users: ${summary.totalUsers}`);
      this.logger.log(`Successfully ${forceReset ? 'reset/created' : 'created'}: ${summary.successCount}`);
      this.logger.log(`Skipped (already exists): ${summary.skipCount}`);
      this.logger.log(`Errors: ${summary.errorCount}`);
      this.logger.log('========================\n');

      return {
        success: true,
        message: `Backfill completed${forceReset ? ' (force reset mode)' : ''}`,
        summary,
      };

    } catch (error) {
      this.logger.error('Fatal error during backfill:', error);
      return {
        success: false,
        message: 'Backfill failed',
        error: error.message,
      };
    }
  }
}
