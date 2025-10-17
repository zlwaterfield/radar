import { task } from '@trigger.dev/sdk/v3';
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

export const backfillPullRequests = task({
  id: 'backfill-pull-requests',
  maxDuration: 900, // 15 minutes
  run: async (payload: {
    userId: string;
    daysBack?: number;
  }) => {
    try {
      const { userId, daysBack = 30 } = payload;

      console.log(`Starting PR backfill task for user ${userId}`);

      // Get user's GitHub access token
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true },
      });

      if (!user?.githubAccessToken) {
        const error = `User ${userId} does not have a GitHub access token`;
        console.error(error);
        return {
          success: false,
          error,
        };
      }

      // Run backfill
      const result = await pullRequestSyncService.backfillUserPullRequests(
        userId,
        user.githubAccessToken,
        daysBack,
      );

      console.log(
        `PR backfill completed for user ${userId}: ${result.pullRequestsProcessed} PRs processed`,
      );

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
      console.error('Error in PR backfill task:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  },
});
