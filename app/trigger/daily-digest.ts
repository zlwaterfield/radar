import { schedules, wait, task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";
import { DigestService } from "../src/digest/digest.service";
import { DigestConfigService } from "../src/digest/digest-config.service";
import { DatabaseService } from "../src/database/database.service";
import { GitHubService } from "../src/github/services/github.service";
import { SlackService } from "../src/slack/services/slack.service";
import { GitHubIntegrationService } from "../src/integrations/services/github-integration.service";
import { UserTeamsSyncService } from "../src/users/services/user-teams-sync.service";
import { UserRepositoriesService } from "../src/users/services/user-repositories.service";
import { ConfigService } from "@nestjs/config";
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

// Log configuration status for debugging
console.log('ConfigService initialized with configs:');
console.log(`- Slack signing secret: ${configService.get('slack.signingSecret') ? 'present' : 'missing'}`);
console.log(`- Slack bot token: ${configService.get('slack.botToken') ? 'present' : 'missing'}`);
console.log(`- GitHub app ID: ${configService.get('github.appId') ? 'present' : 'missing'}`);

const databaseService = new DatabaseService();
const githubService = new GitHubService(configService, databaseService);
const digestConfigService = new DigestConfigService(databaseService);

// Create GitHub integration service first (it will be passed to other services)
// Note: We'll create it with null for userTeamsSyncService initially to avoid circular dependency
const githubIntegrationService = new GitHubIntegrationService(configService, databaseService, null as any);

const userRepositoriesService = new UserRepositoriesService(databaseService, githubService, githubIntegrationService);
const userTeamsSyncService = new UserTeamsSyncService(databaseService, githubService, githubIntegrationService, userRepositoriesService);

// Now set the userTeamsSyncService on the githubIntegrationService to complete the circular dependency
(githubIntegrationService as any).userTeamsSyncService = userTeamsSyncService;


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
    console.log('Initializing SlackService in dailyDigest task...');
    const slackService = new SlackService(configService, databaseService);
    console.log('SlackService initialized successfully in dailyDigest task');
    
    const digestService = new DigestService(databaseService, githubService, slackService, digestConfigService, githubIntegrationService);
    
    try {
      console.log("Starting multiple digest processing...");

      // Get all users with enabled digest configurations
      const users = await digestConfigService.getUsersWithEnabledDigests();
      
      if (users.length === 0) {
        console.log("No users have digest configurations enabled, skipping");
        return { success: true, message: "No users to process" };
      }

      console.log(`Processing digest configs for ${users.length} users`);

      let totalConfigs = 0;
      let successCount = 0;
      let errorCount = 0;

      // Process each user's digest configurations
      for (const userData of users) {
        try {
          console.log(`Processing ${userData.digestConfigs.length} digest configs for user ${userData.userId} (${userData.userGithubLogin})`);

          for (const config of userData.digestConfigs) {
            totalConfigs++;
            try {
              console.log(`Processing digest config "${config.name}" (${config.id}) for user ${userData.userId}`);

              // Check if it's time to send this digest
              const now = new Date();
              if (!digestService.isDigestTimeMatched(config.digestTime, now)) {
                console.log(`Config ${config.id} scheduled for ${config.digestTime}, current time ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}, skipping`);
                successCount++; // Count as success since it's not time yet
                continue;
              }

              // Check if digest was already sent today for this config
              const alreadySent = await digestService.wasDigestSentToday(config.id);
              if (alreadySent) {
                console.log(`Digest already sent today for config ${config.id}, skipping`);
                successCount++; // Count as success since already sent
                continue;
              }

              console.log(`Time matches for config ${config.id}, processing digest`);

              // Get execution data for this config
              const executionData = await digestConfigService.getDigestExecutionData(config.id);

              // Generate digest content
              console.log(`Generating digest content for config ${config.id}`);
              const digest = await digestService.generateDigestForConfig(executionData);

              // Send digest using the configured delivery method
              const totalPRs = digest.waitingOnUser.length + 
                               digest.approvedReadyToMerge.length + 
                               digest.userOpenPRs.length;

              if (totalPRs > 0) {
                const sent = await digestService.sendDigestForConfig(executionData, digest);
                if (sent) {
                  successCount++;
                  console.log(`Successfully sent digest for config ${config.id} (${config.name})`);
                } else {
                  errorCount++;
                  console.log(`Failed to send digest for config ${config.id} (${config.name})`);
                }
              } else {
                console.log(`No PRs to report for config ${config.id}, skipping`);
                successCount++; // Count as success since there was nothing to send
              }

            } catch (configError) {
              errorCount++;
              console.error(`Error processing config ${config.id}:`, configError);
              // Continue with next config even if this one fails
            }
          }

        } catch (userError) {
          errorCount++;
          console.error(`Error processing configs for user ${userData.userId}:`, userError);
          // Continue with next user even if this one fails
        }
      }

      console.log(`Multiple digest processing complete: ${successCount} successful, ${errorCount} errors out of ${totalConfigs} total configs`);

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
      console.error("Error in digest task:", error);
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
    console.log('Initializing SlackService in testDigestConfig task...');
    const slackService = new SlackService(configService, databaseService);
    console.log('SlackService initialized successfully in testDigestConfig task');
    
    const digestService = new DigestService(databaseService, githubService, slackService, digestConfigService, githubIntegrationService);
    
    try {
      const { configId } = payload;
      
      // Get execution data for this config
      const executionData = await digestConfigService.getDigestExecutionData(configId);

      // Generate and send digest immediately (no waiting)
      const digest = await digestService.generateDigestForConfig(executionData);
      const sent = await digestService.sendDigestForConfig(executionData, digest);

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
      console.error("Error in test digest config:", error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  },
});

// Legacy task for testing individual user digests (for backward compatibility)
export const testUserDigest = task({
  id: "test-user-digest", 
  run: async (payload: { userId: string }) => {
    console.log('Initializing SlackService in testUserDigest task...');
    const slackService = new SlackService(configService, databaseService);
    console.log('SlackService initialized successfully in testUserDigest task');
    
    const digestService = new DigestService(databaseService, githubService, slackService, digestConfigService, githubIntegrationService);
    
    try {
      const { userId } = payload;
      
      // Get user data - use new multiple digest system
      const users = await digestConfigService.getUsersWithEnabledDigests();
      const userData = users.find(u => u.userId === userId);
      
      if (!userData || userData.digestConfigs.length === 0) {
        throw new Error(`User ${userId} not found or no digest configurations enabled`);
      }

      // Test the first enabled digest config
      const config = userData.digestConfigs[0];
      const executionData = await digestConfigService.getDigestExecutionData(config.id);

      // Generate and send digest immediately (no waiting)
      const digest = await digestService.generateDigestForConfig(executionData);
      const sent = await digestService.sendDigestForConfig(executionData, digest);

      return {
        success: sent,
        message: sent ? "Test digest sent successfully" : "Failed to send test digest",
        configName: config.name,
        digest: {
          waitingOnUser: digest.waitingOnUser.length,
          approvedReadyToMerge: digest.approvedReadyToMerge.length,
          userOpenPRs: digest.userOpenPRs.length
        }
      };

    } catch (error) {
      console.error("Error in test user digest:", error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  },
});