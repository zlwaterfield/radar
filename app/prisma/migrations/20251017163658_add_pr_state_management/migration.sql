-- AlterTable
ALTER TABLE "public"."event" ADD COLUMN     "pull_request_id" TEXT;

-- CreateTable
CREATE TABLE "public"."pull_request" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "github_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "repository_id" TEXT NOT NULL,
    "repository_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "url" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "is_merged" BOOLEAN NOT NULL DEFAULT false,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "merged_at" TIMESTAMP(3),
    "author_github_id" TEXT NOT NULL,
    "author_login" TEXT NOT NULL,
    "author_avatar_url" TEXT NOT NULL,
    "base_branch" TEXT NOT NULL,
    "head_branch" TEXT NOT NULL,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "changed_files" INTEGER NOT NULL DEFAULT 0,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pull_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pull_request_reviewer" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "pull_request_id" TEXT NOT NULL,
    "github_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "avatar_url" TEXT NOT NULL,
    "review_state" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "review_url" TEXT,
    "is_team_review" BOOLEAN NOT NULL DEFAULT false,
    "team_slug" TEXT,

    CONSTRAINT "pull_request_reviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pull_request_label" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pull_request_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "pull_request_label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pull_request_check" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "pull_request_id" TEXT NOT NULL,
    "github_check_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "conclusion" TEXT,
    "details_url" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "pull_request_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pull_request_assignee" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pull_request_id" TEXT NOT NULL,
    "github_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "avatar_url" TEXT NOT NULL,

    CONSTRAINT "pull_request_assignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_github_id_key" ON "public"."pull_request"("github_id");

-- CreateIndex
CREATE INDEX "pull_request_repository_id_state_idx" ON "public"."pull_request"("repository_id", "state");

-- CreateIndex
CREATE INDEX "pull_request_author_github_id_idx" ON "public"."pull_request"("author_github_id");

-- CreateIndex
CREATE INDEX "pull_request_state_updated_at_idx" ON "public"."pull_request"("state", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_repository_id_number_key" ON "public"."pull_request"("repository_id", "number");

-- CreateIndex
CREATE INDEX "pull_request_reviewer_pull_request_id_idx" ON "public"."pull_request_reviewer"("pull_request_id");

-- CreateIndex
CREATE INDEX "pull_request_reviewer_github_id_idx" ON "public"."pull_request_reviewer"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_reviewer_pull_request_id_github_id_key" ON "public"."pull_request_reviewer"("pull_request_id", "github_id");

-- CreateIndex
CREATE INDEX "pull_request_label_pull_request_id_idx" ON "public"."pull_request_label"("pull_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_label_pull_request_id_name_key" ON "public"."pull_request_label"("pull_request_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_check_github_check_id_key" ON "public"."pull_request_check"("github_check_id");

-- CreateIndex
CREATE INDEX "pull_request_check_pull_request_id_idx" ON "public"."pull_request_check"("pull_request_id");

-- CreateIndex
CREATE INDEX "pull_request_check_pull_request_id_status_idx" ON "public"."pull_request_check"("pull_request_id", "status");

-- CreateIndex
CREATE INDEX "pull_request_assignee_pull_request_id_idx" ON "public"."pull_request_assignee"("pull_request_id");

-- CreateIndex
CREATE INDEX "pull_request_assignee_github_id_idx" ON "public"."pull_request_assignee"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_assignee_pull_request_id_github_id_key" ON "public"."pull_request_assignee"("pull_request_id", "github_id");

-- CreateIndex
CREATE INDEX "event_pull_request_id_idx" ON "public"."event"("pull_request_id");

-- AddForeignKey
ALTER TABLE "public"."event" ADD CONSTRAINT "event_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pull_request_reviewer" ADD CONSTRAINT "pull_request_reviewer_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pull_request_label" ADD CONSTRAINT "pull_request_label_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pull_request_check" ADD CONSTRAINT "pull_request_check_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pull_request_assignee" ADD CONSTRAINT "pull_request_assignee_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
