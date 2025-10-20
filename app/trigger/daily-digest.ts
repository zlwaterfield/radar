import { schedules, wait, task, logger } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";
import { DigestService } from "../src/digest/digest.service";
import { DigestConfigService } from "../src/digest/digest-config.service";
import { DatabaseService } from "../src/database/database.service";
import { GitHubService } from "../src/github/services/github.service";
import { GitHubTokenService } from "../src/github/services/github-token.service";
import { SlackService } from "../src/slack/services/slack.service";
import { EmailService } from "../src/email/email.service";
import { GitHubIntegrationService } from "../src/integrations/services/github-integration.service";
import { UserTeamsSyncService } from "../src/users/services/user-teams-sync.service";
import { UserRepositoriesService } from "../src/users/services/user-repositories.service";
import { PullRequestService } from "../src/pull-requests/services/pull-request.service";
import { ConfigService } from "@nestjs/config";
import { AnalyticsService } from "../src/analytics/analytics.service";
import appConfig from "../src/config/app.config";
import slackConfig from "../src/config/slack.config";
import githubConfig from "../src/config/github.config";
import databaseConfig from "../src/config/database.config";
import monitoringConfig from "../src/config/monitoring.config";

// Initialize services for the task
const prisma = new PrismaClient();

// Create properly configured ConfigService with all configs loaded
const configService = new ConfigService({
  app: appConfig(),
  slack: slackConfig(),
  github: githubConfig(),
  database: databaseConfig(),
  monitoring: monitoringConfig(),
});

const analyticsService = new AnalyticsService(configService);
const databaseService = new DatabaseService();

// Create GitHub token service first (no circular dependencies)
const githubTokenService = new GitHubTokenService(configService, databaseService);
const githubService = new GitHubService(configService, databaseService, analyticsService, githubTokenService);
const digestConfigService = new DigestConfigService(databaseService, analyticsService);
const pullRequestService = new PullRequestService(databaseService);

const userRepositoriesService = new UserRepositoriesService(databaseService, githubService, githubTokenService);
const userTeamsSyncService = new UserTeamsSyncService(databaseService, githubService, githubTokenService, userRepositoriesService);
const githubIntegrationService = new GitHubIntegrationService(configService, databaseService, githubTokenService, userTeamsSyncService);



export const dailyDigest = schedules.task({
  id: "daily-digest",
  // Run every 15 minutes
  cron: "*/15 * * * *",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload, { ctx }) => {
    const slackService = new SlackService(configService, databaseService, pullRequestService);
    const emailService = new EmailService();
    const digestService = new DigestService(databaseService, githubService, slackService, emailService, digestConfigService, githubIntegrationService, analyticsService, pullRequestService);
    
    try {
      logger.info("Starting multiple digest processing");

      // Get all users with enabled digest configurations
      const users = await digestConfigService.getUsersWithEnabledDigests();

      if (users.length === 0) {
        logger.info("No users have digest configurations enabled, skipping");
        return { success: true, message: "No users to process" };
      }

      logger.info("Processing digest configs", { userCount: users.length });

      let totalConfigs = 0;
      let successCount = 0;
      let errorCount = 0;

      // Process each user's digest configurations
      for (const userData of users) {
        try {
          logger.info("Processing user digest configs", {
            userId: userData.userId,
            userGithubLogin: userData.userGithubLogin,
            configCount: userData.digestConfigs.length
          });

          for (const config of userData.digestConfigs) {
            totalConfigs++;
            try {
              logger.info("Processing digest config", {
                configId: config.id,
                configName: config.name,
                userId: userData.userId
              });

              // Check if it's time to send this digest
              const now = new Date();
              if (!digestService.isDigestTimeMatched(config.digestTime, config.timezone, config.daysOfWeek, now)) {
                logger.debug("Skipping config (not scheduled time)", {
                  configId: config.id,
                  scheduledTime: config.digestTime,
                  timezone: config.timezone,
                  currentTime: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
                });
                successCount++; // Count as success since it's not time yet
                continue;
              }

              // Check if digest was already sent today for this config
              const alreadySent = await digestService.wasDigestSentToday(config.id, config.timezone);
              if (alreadySent) {
                logger.debug("Skipping config (already sent today)", { configId: config.id });
                successCount++; // Count as success since already sent
                continue;
              }

              logger.info("Time matches, processing digest", { configId: config.id });

              // Get execution data for this config
              const executionData = await digestConfigService.getDigestExecutionData(config.id);

              // Generate digest content
              logger.info("Generating digest content", { configId: config.id });
              const digest = await digestService.generateDigestForConfig(executionData);

              // Send digest using the configured delivery method
              const totalPRs = digest.waitingOnUser.length +
                               digest.approvedReadyToMerge.length +
                               digest.userOpenPRs.length +
                               digest.userDraftPRs.length;

              if (totalPRs > 0) {
                const sent = await digestService.sendDigestForConfig(executionData, digest);
                if (sent) {
                  successCount++;
                  logger.info("Successfully sent digest", {
                    configId: config.id,
                    configName: config.name,
                    totalPRs
                  });
                } else {
                  errorCount++;
                  logger.error("Failed to send digest", {
                    configId: config.id,
                    configName: config.name
                  });
                }
              } else {
                logger.debug("No PRs to report, skipping", { configId: config.id });
                successCount++; // Count as success since there was nothing to send
              }

            } catch (configError) {
              errorCount++;
              logger.error("Error processing config", {
                configId: config.id,
                error: configError
              });
              // Continue with next config even if this one fails
            }
          }

        } catch (userError) {
          errorCount++;
          logger.error("Error processing user configs", {
            userId: userData.userId,
            error: userError
          });
          // Continue with next user even if this one fails
        }
      }

      logger.info("Multiple digest processing complete", {
        totalConfigs,
        successful: successCount,
        errors: errorCount
      });

      return {
        success: true,
        message: `Processed ${totalConfigs} digest configurations for ${users.length} users`,
        stats: {
          totalUsers: users.length,
          totalConfigs: totalConfigs,
          successful: successCount,
          errors: errorCount
        }
      };

    } catch (error) {
      logger.error("Error in digest task", { error });
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  },
});

// Helper task for testing individual digest configurations
export const testDigestConfig = task({
  id: "test-digest-config",
  run: async (payload: { configId: string }) => {
    logger.info("Initializing services for test digest");
    const slackService = new SlackService(configService, databaseService, pullRequestService);
    const emailService = new EmailService();
    logger.info("SlackService and EmailService initialized successfully");

    const digestService = new DigestService(databaseService, githubService, slackService, emailService, digestConfigService, githubIntegrationService, analyticsService, pullRequestService);

    try {
      const { configId } = payload;

      logger.info("Getting execution data for test digest", { configId });

      // Get execution data for this config
      const executionData = await digestConfigService.getDigestExecutionData(configId);

      // Generate and send digest immediately (no waiting)
      const digest = await digestService.generateDigestForConfig(executionData);
      const sent = await digestService.sendDigestForConfig(executionData, digest);

      logger.info("Test digest completed", {
        configId,
        configName: executionData.config.name,
        sent,
        totalPRs: digest.waitingOnUser.length + digest.approvedReadyToMerge.length + digest.userOpenPRs.length
      });

      return {
        success: sent,
        message: sent ? "Test digest sent successfully" : "Failed to send test digest",
        configName: executionData.config.name,
        digest: {
          waitingOnUser: digest.waitingOnUser.length,
          approvedReadyToMerge: digest.approvedReadyToMerge.length,
          userOpenPRs: digest.userOpenPRs.length
        }
      };

    } catch (error) {
      logger.error("Error in test digest config", { error });
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  },
});