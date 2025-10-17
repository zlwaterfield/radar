import { task, logger } from '@trigger.dev/sdk/v3';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../src/database/database.service';
import { GitHubService } from '../src/github/services/github.service';
import { GitHubTokenService } from '../src/github/services/github-token.service';
import { PullRequestSyncService } from '../src/pull-requests/services/pull-request-sync.service';
import { AnalyticsService } from '../src/analytics/analytics.service';

// Initialize Prisma client for the task
const prisma = new PrismaClient();

// Initialize services
const configService = new ConfigService();
const analyticsService = new AnalyticsService(configService);
const databaseService = new DatabaseService();
const githubTokenService = new GitHubTokenService(configService, databaseService);
const githubService = new GitHubService(configService, databaseService, analyticsService, githubTokenService);
const pullRequestSyncService = new PullRequestSyncService(databaseService, githubService);

// In-memory cache to track recent backfill runs (prevents duplicate runs within 5 minutes)
const recentBackfillRuns = new Map<string, number>();
const BACKFILL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export const backfillPullRequests = task({
  id: 'backfill-pull-requests',
  maxDuration: 900, // 15 minutes
  run: async (payload: {
    userId: string;
    daysBack?: number;
  }) => {
    try {
      const { userId, daysBack = 30 } = payload;

      logger.info('Starting PR backfill', { userId, daysBack });

      // Check if backfill was recently run for this user
      const lastRun = recentBackfillRuns.get(userId);
      const now = Date.now();

      if (lastRun && (now - lastRun) < BACKFILL_COOLDOWN_MS) {
        const remainingMs = BACKFILL_COOLDOWN_MS - (now - lastRun);
        const remainingMin = Math.ceil(remainingMs / 1000 / 60);
        logger.warn('Skipping duplicate backfill (cooldown active)', {
          userId,
          cooldownRemainingMinutes: remainingMin,
        });
        return {
          success: true,
          skipped: true,
          reason: `Backfill ran recently. Please wait ${remainingMin} more minute(s).`,
          cooldownRemainingMs: remainingMs,
        };
      }

      // Mark this user as running a backfill
      recentBackfillRuns.set(userId, now);

      // Get user's GitHub access token
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true },
      });

      if (!user?.githubAccessToken) {
        const error = `User ${userId} does not have a GitHub access token`;
        logger.error('Missing GitHub access token', { userId });
        recentBackfillRuns.delete(userId); // Remove from cache on error
        return {
          success: false,
          error,
        };
      }

      logger.info('User validated, starting sync process', { userId });

      // Run backfill
      const result = await pullRequestSyncService.backfillUserPullRequests(
        userId,
        user.githubAccessToken,
        daysBack,
      );

      logger.info('PR backfill completed', {
        userId,
        repositories: result.repositories,
        pullRequestsProcessed: result.pullRequestsProcessed,
        pullRequestsCreated: result.pullRequestsCreated,
        pullRequestsUpdated: result.pullRequestsUpdated,
        errors: result.errors.length,
      });

      // Track analytics
      await analyticsService.track(userId, 'pr_backfill_completed', {
        repositories: result.repositories,
        pullRequestsProcessed: result.pullRequestsProcessed,
        pullRequestsCreated: result.pullRequestsCreated,
        pullRequestsUpdated: result.pullRequestsUpdated,
        errorCount: result.errors.length,
        daysBack,
      });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      logger.error('Fatal error in PR backfill', { error });
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  },
});
