-- Add new slackUserToken column
ALTER TABLE "user" ADD COLUMN "slack_user_token" TEXT;

-- Copy existing slack_access_token to slack_bot_token (since it was already the bot token)
-- The slackBotToken field should already exist from previous migration
UPDATE "user" SET "slack_bot_token" = "slack_access_token" WHERE "slack_access_token" IS NOT NULL;

-- Drop the old slack_access_token column
ALTER TABLE "user" DROP COLUMN "slack_access_token";
