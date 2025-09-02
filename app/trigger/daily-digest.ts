import { schedules, wait, task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";
import { DigestService } from "../src/digest/digest.service";
import { DatabaseService } from "../src/database/database.service";
import { GitHubService } from "../src/github/services/github.service";
import { SlackService } from "../src/slack/services/slack.service";
import { ConfigService } from "@nestjs/config";

// Initialize services for the task
const prisma = new PrismaClient();
const configService = new ConfigService();
const databaseService = new DatabaseService();
const githubService = new GitHubService(configService, databaseService);
const slackService = new SlackService(configService, databaseService);
const digestService = new DigestService(databaseService, githubService, slackService);

export const dailyDigest = schedules.task({
  id: "daily-digest",
  // Run every day at midnight UTC
  cron: "0 0 * * *",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload, { ctx }) => {
    try {
      console.log("Starting daily digest processing...");

      // Get all users who have digest enabled
      const users = await digestService.getUsersWithDigestEnabled();
      
      if (users.length === 0) {
        console.log("No users have digest enabled, skipping");
        return { success: true, message: "No users to process" };
      }

      console.log(`Processing digests for ${users.length} users`);

      let successCount = 0;
      let errorCount = 0;

      // Process each user individually
      for (const userData of users) {
        try {
          console.log(`Processing digest for user ${userData.userId} (${userData.userGithubLogin})`);

          // Calculate when to send this user's digest
          const digestTime = digestService.calculateUserDigestTime(userData.digestTime);
          const now = new Date();

          console.log(`User ${userData.userId} digest scheduled for ${digestTime.toISOString()}`);

          // Wait until the user's preferred time
          if (digestTime > now) {
            console.log(`Waiting until ${digestTime.toISOString()} for user ${userData.userId}`);
            await wait.until({ 
              date: digestTime,
              idempotencyKey: `digest-${userData.userId}-${digestTime.toDateString()}`,
              idempotencyKeyTTL: "1d"
            });
          }

          // Generate digest content
          console.log(`Generating digest content for user ${userData.userId}`);
          const digest = await digestService.generateDigestForUser(userData);

          // Send digest if there's content
          const totalPRs = digest.waitingOnUser.length + 
                           digest.approvedReadyToMerge.length + 
                           digest.userOpenPRs.length;

          if (totalPRs > 0) {
            const sent = await digestService.sendDigestToUser(userData, digest);
            if (sent) {
              successCount++;
              console.log(`Successfully sent digest to user ${userData.userId}`);
            } else {
              errorCount++;
              console.log(`Failed to send digest to user ${userData.userId}`);
            }
          } else {
            console.log(`No PRs to report for user ${userData.userId}, skipping`);
            successCount++; // Count as success since there was nothing to send
          }

        } catch (userError) {
          errorCount++;
          console.error(`Error processing digest for user ${userData.userId}:`, userError);
          // Continue with next user even if this one fails
        }
      }

      console.log(`Daily digest processing complete: ${successCount} successful, ${errorCount} errors`);

      return {
        success: true,
        message: `Processed ${users.length} users`,
        stats: {
          totalUsers: users.length,
          successful: successCount,
          errors: errorCount
        }
      };

    } catch (error) {
      console.error("Error in daily digest task:", error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  },
});

// Helper task for testing individual user digests
export const testUserDigest = task({
  id: "test-user-digest",
  run: async (payload: { userId: string }) => {
    try {
      const { userId } = payload;
      
      // Get user data
      const users = await digestService.getUsersWithDigestEnabled();
      const userData = users.find(u => u.userId === userId);
      
      if (!userData) {
        throw new Error(`User ${userId} not found or digest not enabled`);
      }

      // Generate and send digest immediately (no waiting)
      const digest = await digestService.generateDigestForUser(userData);
      const sent = await digestService.sendDigestToUser(userData, digest);

      return {
        success: sent,
        message: sent ? "Test digest sent successfully" : "Failed to send test digest",
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