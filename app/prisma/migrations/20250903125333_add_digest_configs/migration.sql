-- CreateTable first
CREATE TABLE "public"."digest_config" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "digest_time" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "scope_type" TEXT NOT NULL,
    "scope_value" TEXT,
    "repository_filter" JSONB NOT NULL DEFAULT '{}',
    "delivery_type" TEXT NOT NULL,
    "delivery_target" TEXT,

    CONSTRAINT "digest_config_pkey" PRIMARY KEY ("id")
);

-- AlterTable - Add columns with defaults first
ALTER TABLE "public"."user_digest" ADD COLUMN     "delivery_target" TEXT,
ADD COLUMN     "delivery_type" TEXT DEFAULT 'dm',
ADD COLUMN     "digest_config_id" TEXT;

-- Update existing records to have delivery_type = 'dm'
UPDATE "public"."user_digest" SET "delivery_type" = 'dm' WHERE "delivery_type" IS NULL;

-- Now make delivery_type NOT NULL
ALTER TABLE "public"."user_digest" ALTER COLUMN "delivery_type" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."digest_config" ADD CONSTRAINT "digest_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_digest" ADD CONSTRAINT "user_digest_digest_config_id_fkey" FOREIGN KEY ("digest_config_id") REFERENCES "public"."digest_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
