-- AlterTable
ALTER TABLE "public"."user" ADD COLUMN     "teams_last_synced_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."user_team" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "team_slug" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'member',

    CONSTRAINT "user_team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_team_user_id_team_id_key" ON "public"."user_team"("user_id", "team_id");

-- AddForeignKey
ALTER TABLE "public"."user_team" ADD CONSTRAINT "user_team_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
