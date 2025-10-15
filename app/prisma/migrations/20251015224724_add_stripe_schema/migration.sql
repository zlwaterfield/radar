/*
  Warnings:

  - A unique constraint covering the columns `[stripe_customer_id]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."user" ADD COLUMN     "stripe_customer_id" TEXT;

-- CreateTable
CREATE TABLE "public"."subscription" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "plan_name" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "trial_start" TIMESTAMP(3),
    "trial_end" TIMESTAMP(3),
    "has_used_trial" BOOLEAN NOT NULL DEFAULT false,
    "is_legacy_plan" BOOLEAN NOT NULL DEFAULT false,
    "legacy_plan_name" TEXT,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_entitlement" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature_lookup_key" TEXT NOT NULL,
    "feature_name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "stripe_entitlement_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "feature_entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_user_id_key" ON "public"."subscription"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_stripe_customer_id_key" ON "public"."subscription"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_stripe_subscription_id_key" ON "public"."subscription"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_entitlement_stripe_entitlement_id_key" ON "public"."feature_entitlement"("stripe_entitlement_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_entitlement_user_id_feature_lookup_key_key" ON "public"."feature_entitlement"("user_id", "feature_lookup_key");

-- CreateIndex
CREATE UNIQUE INDEX "user_stripe_customer_id_key" ON "public"."user"("stripe_customer_id");

-- AddForeignKey
ALTER TABLE "public"."subscription" ADD CONSTRAINT "subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_entitlement" ADD CONSTRAINT "feature_entitlement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
