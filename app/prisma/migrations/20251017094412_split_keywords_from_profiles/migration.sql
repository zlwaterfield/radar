-- CreateTable
CREATE TABLE "keyword" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "llm_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,

    CONSTRAINT "keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_keyword" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profile_id" TEXT NOT NULL,
    "keyword_id" TEXT NOT NULL,

    CONSTRAINT "profile_keyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_user_id_idx" ON "keyword"("user_id");

-- CreateIndex
CREATE INDEX "profile_keyword_profile_id_idx" ON "profile_keyword"("profile_id");

-- CreateIndex
CREATE INDEX "profile_keyword_keyword_id_idx" ON "profile_keyword"("keyword_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_keyword_profile_id_keyword_id_key" ON "profile_keyword"("profile_id", "keyword_id");

-- AddForeignKey
ALTER TABLE "keyword" ADD CONSTRAINT "keyword_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_keyword" ADD CONSTRAINT "profile_keyword_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "notification_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_keyword" ADD CONSTRAINT "profile_keyword_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Remove keywords columns from notification_profile
ALTER TABLE "notification_profile" DROP COLUMN "keywords";
ALTER TABLE "notification_profile" DROP COLUMN "keyword_llm_enabled";
