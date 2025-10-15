# Stripe Subscription Management Implementation Plan

**Created:** 2025-10-15
**Updated:** 2025-10-15
**Status:** In Progress
**Approach:** Lightweight, maintainable, self-managed entitlements

---

## Overview

This plan integrates Stripe subscription management into Radar using a simplified approach that stores all entitlements in our own database. Stripe handles payments and subscriptions, while our code manages all feature limits and access control. This provides maximum flexibility and avoids the complexity of Stripe's Entitlements API (which doesn't support quota-based features).

---

## Tech Stack & Architecture

### Core Components

1. **Stripe Checkout**
   - Pre-built hosted checkout pages
   - PCI compliance handled by Stripe
   - Immediate subscription activation

2. **Stripe Customer Portal**
   - Self-service subscription management
   - Payment method updates
   - Invoice history
   - Plan changes
   - Zero custom UI required

3. **Stripe Webhooks**
   - Subscription lifecycle events
   - Automatic sync to database
   - Signature verification for security

4. **Custom Entitlements Service**
   - All feature limits stored in database
   - Fast local checks (no Stripe API calls)
   - Complete control over entitlement logic
   - Supports complex values (unlimited = -1)

---

## Subscription Plans

### Plan Structure

| Plan | Price | Features | Repository Limit | Profile Limit | Digest Limit | Keyword Matching | GitHub Team Support | AI Keyword Matching |
|------|-------|----------|------------------|---------------|--------------|------------------|---------------------|---------------------|
| **Free** | $0/mo | Basic notifications, limited repositories | 2 repos | 1 profile | 1 digest | No | No | No |
| **Basic** | $10/mo or $100/year | More repositories and profiles with keyword matching | 5 repos | 3 profiles | 3 digests | Yes (substring) | No | No |
| **Pro** | $25/mo or $250/year | Unlimited everything + advanced features | Unlimited | Unlimited | Unlimited | Yes (substring + AI) | Yes | Yes |

**Annual Plan Benefits:**
- Save 2 months when paying annually (16% discount)
- Basic: $100/year (vs $120/year monthly)
- Pro: $250/year (vs $300/year monthly)

### Legacy Plan Support

- Users on deprecated plans can continue using them
- Legacy plans marked as `archived: true` in Stripe
- Archived plans hidden from new signups but remain functional
- Display "Legacy Plan" badge in UI for grandfathered users

---

## Feature Entitlements

### Entitlement Definitions (Stored in Code)

All feature limits are defined and managed in `entitlements.service.ts`:

**Free Plan:**
- `repository_limit`: 2
- `notification_profiles`: 1
- `digest_configs`: 1
- `keyword_matching`: false
- `github_team_support`: false
- `ai_keyword_matching`: false

**Basic Plan:**
- `repository_limit`: 5
- `notification_profiles`: 3
- `digest_configs`: 3
- `keyword_matching`: true (substring/exact match only)
- `github_team_support`: false
- `ai_keyword_matching`: false

**Pro Plan:**
- `repository_limit`: -1 (unlimited)
- `notification_profiles`: -1 (unlimited)
- `digest_configs`: -1 (unlimited)
- `keyword_matching`: true (substring + AI-powered)
- `github_team_support`: true
- `ai_keyword_matching`: true

---

## Database Schema

### Tables

```prisma
model Subscription {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  userId String @unique @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Stripe data
  stripeCustomerId     String   @unique @map("stripe_customer_id")
  stripeSubscriptionId String?  @unique @map("stripe_subscription_id")
  stripePriceId        String?  @map("stripe_price_id")

  // Plan information
  planName             String   @default("free") @map("plan_name") // "free", "basic", "pro"
  status               String   @default("active") // "active", "canceled", "past_due", "trialing"

  // Billing periods
  currentPeriodStart   DateTime? @map("current_period_start")
  currentPeriodEnd     DateTime? @map("current_period_end")
  cancelAtPeriodEnd    Boolean  @default(false) @map("cancel_at_period_end")

  // Trial tracking
  trialStart           DateTime? @map("trial_start")
  trialEnd             DateTime? @map("trial_end")
  hasUsedTrial         Boolean  @default(false) @map("has_used_trial")

  // Legacy plan support
  isLegacyPlan         Boolean  @default(false) @map("is_legacy_plan")
  legacyPlanName       String?  @map("legacy_plan_name")

  @@map("subscription")
}

model FeatureEntitlement {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  userId String @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Feature details
  featureLookupKey String @map("feature_lookup_key") // e.g., "repository_limit"
  featureName      String @map("feature_name")       // e.g., "Repository Limit"
  value            String                             // JSON string: "3", "-1", "true", "false"
  isActive         Boolean @default(true) @map("is_active")

  @@unique([userId, featureLookupKey])
  @@map("feature_entitlement")
}
```

### User Table Updates

```prisma
model User {
  // ... existing fields ...

  // Stripe integration
  stripeCustomerId String? @unique @map("stripe_customer_id")

  // Relations
  subscription         Subscription?
  featureEntitlements  FeatureEntitlement[]
}
```

---

## Implementation Status

### ✅ Completed

#### Backend
- [x] Install Stripe dependencies
- [x] Create Stripe service (checkout, portal, sync)
- [x] Create Entitlements service (all limits in code)
- [x] Database schema with Subscription and FeatureEntitlement tables
- [x] Webhook controller with signature verification
- [x] Billing API endpoints (subscription, checkout, portal, entitlements)
- [x] EntitlementGuard for server-side feature gating
- [x] Applied entitlement checks to notification profiles
- [x] Updated trigger tasks to include EntitlementsService

#### Frontend
- [x] Billing page with pricing table (monthly/annual toggle)
- [x] useEntitlements hook for client-side checks
- [x] Billing link in settings sidebar
- [x] Upgrade prompts in repositories page
- [x] Upgrade prompts in digest configs page
- [x] Upgrade prompts in notification profiles component

#### Build & Testing
- [x] Backend builds successfully
- [x] Frontend builds successfully
- [x] Environment variables documented

### 🔄 In Progress

- [ ] Run database migration (waiting for DB access)
- [ ] Setup Stripe Dashboard (products and prices only)
- [ ] Configure webhook endpoint in Stripe
- [ ] End-to-end testing

---

## Stripe Dashboard Setup Guide

### Step 1: Create Products & Prices

**You only need to create 2 products in Stripe. Do NOT create Features in Stripe.**

#### 1. Basic Plan Product

1. Go to **Product Catalog** → **Products**
2. Click **+ Add product**
3. Fill in:
   - **Name**: `Radar Basic`
   - **Description**: `More repositories and notification profiles`
4. Add **Monthly Price**:
   - Click **Add price**
   - Price: `$10.00`
   - Billing period: `Monthly`
   - **Copy the Price ID** (starts with `price_...`)
   - Save to `.env` as `STRIPE_BASIC_MONTHLY_PRICE_ID`
5. Add **Annual Price**:
   - Click **Add another price**
   - Price: `$100.00`
   - Billing period: `Yearly`
   - **Copy the Price ID**
   - Save to `.env` as `STRIPE_BASIC_ANNUAL_PRICE_ID`

#### 2. Pro Plan Product

1. Click **+ Add product** again
2. Fill in:
   - **Name**: `Radar Pro`
   - **Description**: `Unlimited everything with advanced features`
3. Add **Monthly Price**:
   - Price: `$25.00`
   - Billing period: `Monthly`
   - **Copy the Price ID**
   - Save to `.env` as `STRIPE_PRO_MONTHLY_PRICE_ID`
4. Add **Annual Price**:
   - Price: `$250.00`
   - Billing period: `Yearly`
   - **Copy the Price ID**
   - Save to `.env` as `STRIPE_PRO_ANNUAL_PRICE_ID`

### Step 2: Configure Customer Portal

1. Go to **Settings** → **Billing** → **Customer Portal**
2. Enable:
   - ✅ Invoice history
   - ✅ Payment method updates
   - ✅ Subscription cancellation
   - ✅ Plan switching (upgrades only recommended)
3. **Branding** (optional):
   - Upload Radar logo
   - Set brand colors
4. Click **Save**

### Step 3: Create Webhook Endpoint

1. Go to **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. Fill in:
   - **Endpoint URL**: `https://yourdomain.com/api/webhooks/stripe`
   - **Events to send**: Select these events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
4. Click **Add endpoint**
5. **Copy the Webhook Secret** (starts with `whsec_...`)
6. Save to `.env` as `STRIPE_WEBHOOK_SECRET`

### Step 4: Update Environment Variables

Add all the copied values to both:

**`app/.env`:**
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASIC_MONTHLY_PRICE_ID=price_...
STRIPE_BASIC_ANNUAL_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
```

**`client/.env.local`:**
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=price_...
```

---

## Environment Variables

### Backend (`app/.env`)
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASIC_MONTHLY_PRICE_ID=price_...
STRIPE_BASIC_ANNUAL_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3001
```

### Frontend (`client/.env.local`)
```bash
# Stripe Publishable Key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Price IDs for checkout
NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=price_...
```

---

## How Entitlements Work

### Plan → Entitlements Flow

1. **User subscribes** via Stripe Checkout
2. **Webhook received** (`checkout.session.completed`)
3. **Subscription synced** to database with plan name (basic/pro)
4. **Entitlements created** in database based on plan:
   ```typescript
   // From entitlements.service.ts:47-80
   private getPlanEntitlements(planName: string) {
     if (planName === 'free') {
       return [
         { featureLookupKey: 'repository_limit', value: '2' },
         { featureLookupKey: 'notification_profiles', value: '1' },
         { featureLookupKey: 'digest_configs', value: '1' },
         { featureLookupKey: 'github_team_support', value: 'false' },
         { featureLookupKey: 'ai_keyword_matching', value: 'false' },
       ];
     }
     // ... basic and pro plans
   }
   ```

### Checking Entitlements

**Server-side (NestJS):**
```typescript
// Check if user can create more profiles
const limitCheck = await this.entitlementsService.checkLimit(
  userId,
  'notification_profiles',
  currentCount,
);

if (!limitCheck.allowed) {
  throw new ForbiddenException(
    `Profile limit reached (${limitCheck.limit}). Upgrade your plan.`
  );
}
```

**Client-side (React):**
```typescript
const { canAddMore, getFeatureValue } = useEntitlements();

const profileLimit = getFeatureValue('notification_profiles') as number;
const canAdd = canAddMore('notification_profiles', profiles.length);

{!canAdd && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
    <p>You've reached your profile limit ({profileLimit}).
      <Link href="/settings/billing">Upgrade your plan</Link>
    </p>
  </div>
)}
```

---

## Testing Checklist

### Subscription Flow
- [ ] Free user can view billing page
- [ ] Free user can subscribe to Basic plan
- [ ] Free user can subscribe to Pro plan
- [ ] Checkout redirects to Stripe hosted page
- [ ] Successful payment redirects back with success message
- [ ] Subscription syncs to database
- [ ] Entitlements created in database
- [ ] Payment is charged immediately

### Feature Gating
- [ ] Free user blocked from creating 2nd profile
- [ ] Free user blocked from enabling 3rd repository
- [ ] Free user blocked from creating 2nd digest config
- [ ] Basic user can create up to 3 profiles
- [ ] Basic user can enable up to 5 repositories
- [ ] Basic user can create up to 3 digest configs
- [ ] Pro user has unlimited profiles, repos, and digests
- [ ] Upgrade prompt shows when limit reached
- [ ] API returns 403 when limit exceeded

### Subscription Management
- [ ] User can access Stripe portal from billing page
- [ ] User can update payment method in portal
- [ ] User can cancel subscription in portal
- [ ] Canceled subscription shows "Cancels on [date]"
- [ ] Canceled subscription reverts to free at period end
- [ ] User can reactivate before period end

### Webhooks
- [ ] Webhook signature verification works
- [ ] `checkout.session.completed` creates subscription
- [ ] `customer.subscription.updated` syncs changes
- [ ] `customer.subscription.deleted` reverts to free
- [ ] `invoice.payment_failed` logged correctly

---

## Production Deployment

### Pre-Deploy Checklist

1. **Database Migration**
   ```bash
   cd app
   npx prisma migrate deploy
   ```

2. **Create Free Subscriptions for Existing Users**
   ```bash
   npx ts-node scripts/migrate-users-to-free.ts
   ```

3. **Environment Variables**
   - [ ] Production Stripe keys set
   - [ ] Webhook secret configured
   - [ ] All 4 price IDs configured
   - [ ] Frontend URL correct

4. **Stripe Configuration**
   - [ ] Live products created
   - [ ] Live prices created
   - [ ] Customer portal configured
   - [ ] Webhook endpoint created and verified

### Post-Deploy Monitoring

- Monitor webhook deliveries in Stripe Dashboard
- Check for failed subscription syncs
- Watch for 403 errors on feature limits
- Review entitlement creation in database

---

## Key Differences from Original Plan

### What Changed

1. **Removed Stripe Entitlements API**
   - Stripe's API doesn't support quota values (e.g., "5 repositories")
   - Would require storing values separately anyway
   - Simpler to manage everything in our database

2. **Removed Better Auth Stripe Plugin**
   - Built custom lightweight services instead
   - More control and flexibility
   - Easier to debug and maintain

3. **No Features in Stripe Dashboard**
   - Features would just be documentation
   - No actual functionality in Stripe
   - Cleaner to document in code comments

### What Stayed the Same

- ✅ Stripe Checkout for payments
- ✅ Stripe Customer Portal for self-service
- ✅ Stripe Webhooks for sync
- ✅ Products and Prices in Stripe
- ✅ Same subscription plans and pricing
- ✅ Same entitlement logic
- ✅ Immediate billing (no trial period)

---

## Support Resources

### Stripe Documentation
- [Subscriptions Overview](https://docs.stripe.com/billing/subscriptions/overview)
- [Customer Portal](https://docs.stripe.com/customer-management)
- [Webhooks](https://docs.stripe.com/webhooks)
- [Testing](https://docs.stripe.com/testing)

### Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

---

## Success Criteria

- [x] Backend builds successfully
- [x] Frontend builds successfully
- [ ] Database migration runs without errors
- [ ] Checkout flow works end-to-end
- [ ] Subscriptions sync from webhooks
- [ ] Entitlements enforce limits correctly
- [ ] Upgrade prompts show when limits reached
- [ ] Customer Portal works for self-service

---

**End of Implementation Plan**
