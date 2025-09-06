/*
  Warnings:

  - You are about to drop the `user_setting` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."user_setting" DROP CONSTRAINT "user_setting_user_id_fkey";

-- DropTable
DROP TABLE "public"."user_setting";
