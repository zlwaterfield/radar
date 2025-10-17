-- DropForeignKey
ALTER TABLE "profile_keyword" DROP CONSTRAINT "profile_keyword_keyword_id_fkey";

-- DropForeignKey
ALTER TABLE "profile_keyword" DROP CONSTRAINT "profile_keyword_profile_id_fkey";

-- DropTable
DROP TABLE "profile_keyword";
