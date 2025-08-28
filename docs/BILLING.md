# Billing System Documentation

Radar includes an optional billing system that allows you to offer subscription plans while maintaining full functionality for self-hosted installations.

## Overview

The billing system provides:

- **Freemium Model**: Free plan with basic features
- **Paid Plans**: Pro and Enterprise with advanced features  
- **Stripe Integration**: Secure payment processing
- **Usage Tracking**: Monitor user consumption
- **Feature Gates**: Automatic enforcement of plan limits
- **Self-Hosting Support**: No billing required for self-hosted installations

## Subscription Plans

### Free Plan
- 3 repositories
- 100 notifications/month
- Basic notifications
- No AI features

### Pro Plan ($9/month)  
- 25 repositories
- Unlimited notifications
- AI-powered keyword matching
- Daily digest notifications

### Enterprise Plan ($29/month)
- Unlimited repositories
- Unlimited notifications  
- All AI features
- Priority support
- Team collaboration features

## Configuration

### Environment Variables

Add these to your `.env` file to enable billing:

```bash
# Enable billing system
ENABLE_BILLING=true

# Stripe configuration
STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_SECRET_KEY=sk_live_your_key  
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Self-hosted default plan
DEFAULT_SELF_HOSTED_PLAN=enterprise
```

### Database Migration

Run the billing database migration:

```bash
# Apply the billing tables migration
psql -d your_database -f database/migrations/001_add_billing_tables.sql
```

### Stripe Setup

1. Create a Stripe account and get your API keys
2. Create products and prices in Stripe dashboard
3. Update the subscription plans table with Stripe price IDs
4. Configure webhook endpoint: `https://yourdomain.com/api/billing/webhook`

## Self-Hosting

For self-hosted installations:

1. Leave `ENABLE_BILLING=false` (default)
2. Users automatically get the plan specified in `DEFAULT_SELF_HOSTED_PLAN`
3. All features are available without restrictions
4. No Stripe configuration needed

## Feature Gates

The system automatically enforces limits based on subscription plans:

### Repository Limits
- Checked when adding new repositories
- Returns 403 error when limit exceeded
- Suggests plan upgrade in error message

### Notification Limits  
- Checked before sending each notification
- Soft limit - logs warning but doesn't fail
- Tracks monthly usage

### AI Features
- Checked before OpenAI API calls
- Falls back to basic keyword matching for free users
- Tracks AI request usage

## API Endpoints

### Billing Configuration
```
GET /api/billing/config
```
Returns billing configuration including enabled status.

### Subscription Management
```
GET /api/billing/subscription    # Get user's current subscription
GET /api/billing/usage          # Get usage statistics  
GET /api/billing/plans          # List available plans
POST /api/billing/checkout      # Create Stripe checkout session
POST /api/billing/portal        # Create customer portal session
```

### Feature Entitlements
```
GET /api/billing/entitlements/repositories    # Check repo limits
GET /api/billing/entitlements/ai-features     # Check AI access
GET /api/billing/entitlements/digest          # Check digest access
```

## Usage Tracking

The system tracks:
- `repositories_tracked`: Number of active repositories
- `notifications_sent`: Monthly notification count
- `ai_requests`: OpenAI API calls
- `digest_notifications`: Digest messages sent

## Frontend Integration

The billing page (`/settings/billing`) provides:

- Current subscription status
- Usage statistics with visual progress bars
- Plan comparison and upgrade options
- Stripe checkout integration
- Self-hosting status display

## Webhooks

Stripe webhooks handle subscription lifecycle events:

- `customer.subscription.created`
- `customer.subscription.updated`  
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Configure webhook URL: `https://yourdomain.com/api/billing/webhook`

## Development

### Testing

1. Use Stripe test mode with test API keys
2. Test webhook events using Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:8000/api/billing/webhook
   ```

### Adding New Features

1. Define feature in `PlanFeatures` model
2. Add entitlement check in `EntitlementService`
3. Add feature gate where needed
4. Update frontend plan display
5. Add to migration script

## Security Considerations

- Webhook signatures are verified
- User tokens required for billing endpoints
- Sensitive data excluded from API responses
- Database RLS policies applied
- Encryption for stored tokens

## Troubleshooting

### Common Issues

1. **Billing not enabled**: Check `ENABLE_BILLING` environment variable
2. **Stripe errors**: Verify API keys and webhook secret
3. **Database errors**: Ensure billing migration is applied
4. **Permission denied**: Check user authentication tokens

### Logs

Monitor these log messages:
- `"Stripe error"`: Payment processing issues
- `"notification_limit_reached"`: User hit monthly limit  
- `"User does not have AI features enabled"`: Feature gate blocked access