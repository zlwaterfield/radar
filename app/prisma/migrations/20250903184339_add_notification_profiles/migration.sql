-- CreateTable
CREATE TABLE "public"."notification_profile" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "scope_type" TEXT NOT NULL,
    "scope_value" TEXT,
    "repository_filter" JSONB NOT NULL DEFAULT '{"type": "all"}',
    "delivery_type" TEXT NOT NULL,
    "delivery_target" TEXT,
    "notification_preferences" JSONB NOT NULL DEFAULT '{}',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keyword_llm_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "notification_profile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."notification_profile" ADD CONSTRAINT "notification_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
