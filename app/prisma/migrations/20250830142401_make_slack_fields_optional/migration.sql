-- AlterTable
ALTER TABLE "public"."users" ALTER COLUMN "slack_id" DROP NOT NULL,
ALTER COLUMN "slack_team_id" DROP NOT NULL,
ALTER COLUMN "slack_access_token" DROP NOT NULL;
