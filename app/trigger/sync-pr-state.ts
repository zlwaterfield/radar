import { task, schedules, logger } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";
import { DatabaseService } from "../src/database/database.service";
import { GitHubService } from "../src/github/services/github.service";
import { GitHubTokenService } from "../src/github/services/github-token.service";
import { PullRequestService } from "../src/pull-requests/services/pull-request.service";
import { PullRequestSyncService } from "../src/pull-requests/services/pull-request-sync.service";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { ConfigService } from "@nestjs/config";

// Initialize Prisma client for the task
const prisma = new PrismaClient();

// Initialize services
const configService = new ConfigService();
const analyticsService = new AnalyticsService(configService);
const databaseService = new DatabaseService();
const githubTokenService = new GitHubTokenService(configService, databaseService);
const githubService = new GitHubService(configService, databaseService, analyticsService, githubTokenService);
const pullRequestService = new PullRequestService(databaseService);
const pullRequestSyncService = new PullRequestSyncService(databaseService, githubService);

/**
 * Background task to sync PR state for stale open PRs
 * Runs every 30 minutes to keep PR data fresh
 */
export const syncPullRequestState = schedules.task({
  id: "sync-pull-request-state",
  // Run every 30 minutes
  cron: "*/30 * * * *",
  run: async () => {
    try {
      logger.info("Starting PR state sync task");

      // Get open PRs that haven't been synced in 30+ minutes
      const stalePRs = await pullRequestService.getStaleOpenPRs(30, 50);

      logger.info("Found stale PRs to sync", { count: stalePRs.length });

      if (stalePRs.length === 0) {
        return {
          success: true,
          message: 'No stale PRs to sync',
          synced: 0,
        };
      }

      let successCount = 0;
      let errorCount = 0;

      // Sync each stale PR
      for (const pr of stalePRs) {
        try {
          const [owner, repo] = pr.repositoryName.split('/');

          logger.info("Syncing PR", {
            repositoryName: pr.repositoryName,
            prNumber: pr.number
          });

          // Sync from GitHub API
          // Note: This uses installation token, so it works without user tokens
          await pullRequestSyncService.syncFromAPI(owner, repo, pr.number);

          // Update last synced timestamp
          await pullRequestService.updateLastSynced(pr.id);

          successCount++;
        } catch (error) {
          logger.error("Error syncing PR", {
            repositoryName: pr.repositoryName,
            prNumber: pr.number,
            error
          });
          errorCount++;
        }
      }

      logger.info("PR sync task completed", {
        synced: successCount,
        errors: errorCount,
        total: stalePRs.length
      });

      return {
        success: true,
        message: `Synced ${successCount} PRs`,
        synced: successCount,
        errors: errorCount,
        total: stalePRs.length,
      };
    } catch (error) {
      logger.error("Error in PR sync task", { error });
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  },
});
