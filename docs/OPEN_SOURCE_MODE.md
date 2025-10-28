# Open Source Mode

Radar can be run in **open-source mode**, which disables the payment/billing system and grants all users full pro-level feature access. This is ideal for self-hosted deployments where you don't want to charge users.

## Enabling Open Source Mode

### Backend Configuration

Set the `PAYMENT_DISABLED` environment variable to `true` in your backend `.env` file:

```bash
# app/.env
PAYMENT_DISABLED=true
```

When this is set to `true`:
- All users automatically receive unlimited entitlements
- Stripe integration is bypassed for entitlements
- Users get:
  - Unlimited repositories
  - Unlimited notification profiles
  - Unlimited digest configurations
  - GitHub team support
  - Keyword matching
  - AI keyword matching
  - All other pro features

### Frontend Configuration

Set the `NEXT_PUBLIC_PAYMENT_DISABLED` environment variable to `true` in your frontend `.env` file:

```bash
# client/.env
NEXT_PUBLIC_PAYMENT_DISABLED=true
```

When this is set to `true`:
- The billing page is hidden from the settings sidebar
- Upgrade banners are hidden throughout the UI
- All limit-related warnings are suppressed

## Features in Open Source Mode

### Unlimited Access

All users get the equivalent of a "Pro" plan:

| Feature | Open Source Mode | Free Plan | Pro Plan |
|---------|------------------|-----------|----------|
| Repositories | ∞ Unlimited | 2 | ∞ Unlimited |
| Notification Profiles | ∞ Unlimited | 1 | ∞ Unlimited |
| Digest Configurations | ∞ Unlimited | 1 | ∞ Unlimited |
| GitHub Team Support | ✅ Yes | ❌ No | ✅ Yes |
| Keyword Matching | ✅ Yes | ❌ No | ✅ Yes |
| AI Keyword Matching | ✅ Yes | ❌ No | ✅ Yes |

### UI Behavior

When payment is disabled:
- Settings sidebar does not show the "Billing" link
- No upgrade banners appear when users reach limits
- No upgrade CTAs in the application
- Clean, self-hosted experience

## Implementation Details

### Backend (NestJS)

The `EntitlementsService` (`app/src/stripe/services/entitlements.service.ts`) checks the `PAYMENT_DISABLED` environment variable:

```typescript
// On service initialization
this.paymentDisabled = this.configService.get<string>('PAYMENT_DISABLED', 'false') === 'true';

// When syncing entitlements
if (this.paymentDisabled) {
  return this.setOpenSourceEntitlements(userId);
}

// When checking features
if (this.paymentDisabled) {
  return true; // Grant all features
}

// When getting feature values
if (this.paymentDisabled) {
  if (featureLookupKey.includes('limit')) {
    return -1; // unlimited
  }
  return true;
}
```

### Frontend (Next.js)

Components check `process.env.NEXT_PUBLIC_PAYMENT_DISABLED`:

```typescript
const paymentEnabled = process.env.NEXT_PUBLIC_PAYMENT_DISABLED !== 'true';

// Hide billing UI
{paymentEnabled && (
  <Link href="/settings/billing">Billing</Link>
)}

// Hide upgrade banners
if (!paymentEnabled) {
  return null;
}
```

## Migration Guide

### Switching from Paid to Open Source

1. Stop your application
2. Update environment variables:
   ```bash
   # Backend
   PAYMENT_DISABLED=true

   # Frontend
   NEXT_PUBLIC_PAYMENT_DISABLED=true
   ```
3. Restart your application
4. Existing users will automatically receive full entitlements on their next login

### Switching from Open Source to Paid

1. Stop your application
2. Update environment variables:
   ```bash
   # Backend
   # Remove or comment out PAYMENT_DISABLED
   # PAYMENT_DISABLED=true
   STRIPE_SECRET_KEY=sk_live_your_key
   # ... other Stripe config

   # Frontend
   # Remove or comment out NEXT_PUBLIC_PAYMENT_DISABLED
   # NEXT_PUBLIC_PAYMENT_DISABLED=true
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
   # ... other Stripe config
   ```
3. Restart your application
4. Users will be assigned to the free plan by default
5. They can upgrade through the billing page

## Stripe Configuration

When running in open-source mode, you can skip Stripe configuration entirely:

```bash
# These are NOT required in open-source mode
# STRIPE_SECRET_KEY=
# STRIPE_PUBLISHABLE_KEY=
# STRIPE_WEBHOOK_SECRET=
# STRIPE_BASIC_MONTHLY_PRICE_ID=
# STRIPE_BASIC_ANNUAL_PRICE_ID=
# STRIPE_PRO_MONTHLY_PRICE_ID=
# STRIPE_PRO_ANNUAL_PRICE_ID=
```

However, the Stripe module will still load. If you want to completely remove Stripe:
1. Remove `StripeModule` from `app/src/app.module.ts`
2. Remove Stripe-related environment variables
3. This is **not recommended** as it makes switching back to paid mode more difficult

## Logging

When open-source mode is enabled, you'll see this log message on backend startup:

```
[EntitlementsService] Running in open-source mode: Payment system disabled, full features granted to all users
```

## User Experience

### For Self-Hosted Users

Users running Radar in open-source mode get:
- Full feature access without payment
- No billing/upgrade prompts
- Clean, focused interface
- All pro features included

### For SaaS Deployments

Keep `PAYMENT_DISABLED` unset or commented out to:
- Enable the billing system
- Show upgrade prompts
- Enforce feature limits based on subscription plans
- Monetize your Radar deployment

## Best Practices

1. **Choose Your Mode Early**: Decide if you're running SaaS or self-hosted before deploying to production
2. **Document for Users**: If self-hosted, mention open-source mode in your deployment docs
3. **Test Both Modes**: Ensure your deployment works in both modes during development
4. **Environment Variables**: Use `.env.example` files to document the correct settings
5. **Database Migrations**: Entitlements are stored in the database—switching modes will update them automatically

## Troubleshooting

### Users Still See Limits

**Problem**: After disabling payments, users still see upgrade banners.

**Solution**:
1. Verify `PAYMENT_DISABLED=true` in backend `.env`
2. Verify `NEXT_PUBLIC_PAYMENT_DISABLED=true` in frontend `.env`
3. Restart both backend and frontend
4. Clear browser localStorage (banners may be dismissed)
5. Check backend logs for the open-source mode message

### Billing Page Still Visible

**Problem**: The billing link appears in the sidebar.

**Solution**:
1. Verify `NEXT_PUBLIC_PAYMENT_DISABLED=true` in frontend `.env`
2. Rebuild the frontend: `npm run build` or restart dev server
3. Clear browser cache

### Features Still Limited

**Problem**: Users report hitting feature limits.

**Solution**:
1. Check `PAYMENT_DISABLED` in backend environment
2. Verify the EntitlementsService logs show "open-source mode"
3. Test the entitlements API: `GET /api/users/me/entitlements`
4. Manually sync entitlements via API or database

## Related Files

- Backend entitlements: `app/src/stripe/services/entitlements.service.ts`
- Frontend layout: `client/src/app/settings/layout.tsx`
- Upgrade banner: `client/src/components/UpgradeBanner.tsx`
- Environment examples: `app/.env.example`, `client/.env.example`

---

**Last Updated**: 2025-10-15
