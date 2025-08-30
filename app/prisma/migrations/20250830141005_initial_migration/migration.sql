-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "slack_id" TEXT NOT NULL,
    "slack_team_id" TEXT NOT NULL,
    "slack_access_token" TEXT NOT NULL,
    "slack_refresh_token" TEXT,
    "github_id" TEXT,
    "github_login" TEXT,
    "github_access_token" TEXT,
    "github_refresh_token" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_settings" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_preferences" JSONB NOT NULL DEFAULT '{}',
    "notification_schedule" JSONB NOT NULL DEFAULT '{}',
    "stats_time_window" INTEGER NOT NULL DEFAULT 14,
    "keywords" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_repositories" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "github_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "is_fork" BOOLEAN NOT NULL DEFAULT false,
    "owner_name" TEXT NOT NULL DEFAULT '',
    "owner_avatar_url" TEXT NOT NULL DEFAULT '',
    "owner_url" TEXT NOT NULL DEFAULT '',
    "organization" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "event_type" TEXT NOT NULL,
    "action" TEXT,
    "repository_id" TEXT NOT NULL,
    "repository_name" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_login" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT,
    "message_type" TEXT NOT NULL,
    "channel" TEXT,
    "message_ts" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_digests" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "message_ts" TEXT NOT NULL,
    "pull_request_count" INTEGER NOT NULL DEFAULT 0,
    "issue_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_slack_id_key" ON "public"."users"("slack_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "public"."users"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_github_login_key" ON "public"."users"("github_login");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "public"."user_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_repositories_user_id_github_id_key" ON "public"."user_repositories"("user_id", "github_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "public"."session"("token");

-- AddForeignKey
ALTER TABLE "public"."user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_repositories" ADD CONSTRAINT "user_repositories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_digests" ADD CONSTRAINT "user_digests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
