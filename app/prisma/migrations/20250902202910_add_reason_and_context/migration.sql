-- AlterTable
ALTER TABLE "public"."notification" ADD COLUMN     "context" JSONB,
ADD COLUMN     "reason" TEXT;
