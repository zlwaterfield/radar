/*
  Warnings:

  - Made the column `keyword_preferences` on table `user_setting` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."user_setting" ALTER COLUMN "keyword_preferences" SET NOT NULL;
