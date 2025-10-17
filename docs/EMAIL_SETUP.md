# Email Setup Guide - Resend Integration

This guide explains how to configure and use the Resend email service integration in Radar for sending transactional emails like password resets.

## Overview

Radar uses [Resend](https://resend.com) as the email delivery service, integrated with [React Email](https://react.email) for building beautiful, responsive email templates using React components.

## Features

- **Password Reset Emails**: Automated password reset emails with secure token links
- **React Email Templates**: Beautiful, responsive templates built with React components
- **Type-Safe**: Full TypeScript support for email service and templates
- **Production-Ready**: Graceful fallback when email service is not configured

## Setup Instructions

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up for an account
2. Verify your email address
3. Add and verify your sending domain (required for production)

### 2. Get Your API Key

1. Navigate to the [API Keys](https://resend.com/api-keys) page in your Resend dashboard
2. Click "Create API Key"
3. Give it a name (e.g., "Radar Production" or "Radar Development")
4. Copy the API key (starts with `re_`)

### 3. Configure Environment Variables

Add the following to your `app/.env` file:

```bash
# Resend Configuration (Email Service)
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**Important Notes:**
- `RESEND_API_KEY`: Your Resend API key from step 2
- `RESEND_FROM_EMAIL`: Must use a verified domain in production
  - Development: You can use `onboarding@resend.dev` for testing
  - Production: Use your own verified domain (e.g., `noreply@radar.app`)

### 4. Domain Verification (Production Only)

For production use, you must verify your domain:

1. Go to [Domains](https://resend.com/domains) in Resend dashboard
2. Click "Add Domain"
3. Enter your domain (e.g., `radar.app`)
4. Add the provided DNS records to your domain registrar
5. Wait for verification (usually a few minutes)

Once verified, you can send from any email address on that domain (e.g., `noreply@radar.app`, `support@radar.app`).

## Usage

### Password Reset Flow

The complete password reset flow includes both frontend and backend:

**Frontend Pages:**
1. **Forgot Password** (`/auth/forgot-password`):
   - User enters their email address
   - Calls `authClient.forgetPassword()` from Better Auth
   - Shows success message with instructions

2. **Reset Password** (`/auth/reset-password`):
   - User lands here from email link (with token in URL)
   - Enters new password (must be 8+ characters)
   - Confirms password matches
   - Calls `authClient.resetPassword()` with token
   - Redirects to sign in on success

3. **Sign In** (`/auth/signin`):
   - Updated with "Forgot your password?" link

**Backend Integration:**
1. **User Requests Reset**: Better Auth generates secure reset token
2. **Email Sent**: Our `EmailService` sends password reset email via Resend
3. **User Clicks Link**: Email contains link to `/auth/reset-password?token=...`
4. **Password Updated**: Better Auth validates token and updates password

### Email Service API

The `EmailService` is available throughout the application via dependency injection:

```typescript
import { EmailService } from '@/email/email.service';

@Injectable()
export class YourService {
  constructor(private readonly emailService: EmailService) {}

  async sendPasswordReset(email: string, resetUrl: string) {
    await this.emailService.sendPasswordResetEmail({
      to: email,
      resetUrl: resetUrl,
      expirationTime: '1 hour', // optional, defaults to '1 hour'
    });
  }
}
```

### Check Email Configuration

You can check if email is properly configured:

```typescript
if (this.emailService.isConfigured()) {
  // Email service is ready
} else {
  // Email service not configured (missing API key)
}
```

## Email Templates

### Password Reset Template

Located at: `app/src/email/templates/password-reset.tsx`

**Features:**
- Clean, professional design
- Mobile-responsive
- Button and fallback link
- Clear expiration time
- Security notice for users who didn't request reset

**Template Props:**

```typescript
interface PasswordResetEmailProps {
  userEmail: string;        // Recipient's email
  resetUrl: string;         // Password reset link
  expirationTime?: string;  // Optional, defaults to '1 hour'
}
```

### Creating New Templates

To create a new email template:

1. Create a new file in `app/src/email/templates/`:

```tsx
// app/src/email/templates/welcome.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface WelcomeEmailProps {
  userName: string;
}

export const WelcomeEmail = ({ userName }: WelcomeEmailProps) => {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>Welcome to Radar, {userName}!</Heading>
          <Text>We're excited to have you on board.</Text>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;
```

2. Add a method to `EmailService`:

```typescript
// app/src/email/email.service.ts
import WelcomeEmail from './templates/welcome';

async sendWelcomeEmail(to: string, userName: string): Promise<void> {
  const emailHtml = await render(WelcomeEmail({ userName }));

  await this.resend.emails.send({
    from: this.fromEmail,
    to: [to],
    subject: 'Welcome to Radar!',
    html: emailHtml,
  });
}
```

## Development Testing

### Using Resend Test Mode

For development, you can use the test API key:

1. Create a test API key in Resend dashboard
2. Use `onboarding@resend.dev` as the from email
3. Emails will be sent but marked as test messages

### Viewing Sent Emails

All sent emails appear in your [Resend dashboard](https://resend.com/emails) where you can:
- View email content
- Check delivery status
- See open/click rates
- Debug any issues

## Configuration Options

### Better Auth Integration

The password reset email is configured in `app/src/auth/auth.config.ts`:

```typescript
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url, token }, request) => {
    await emailService.sendPasswordResetEmail({
      to: user.email,
      resetUrl: url,
      expirationTime: '1 hour',
    });
  },
  resetPasswordTokenExpiresIn: 3600, // 1 hour in seconds
}
```

### Email Service Configuration

The `EmailService` reads configuration from environment variables:

- `RESEND_API_KEY`: Required for email functionality
- `RESEND_FROM_EMAIL`: Defaults to `noreply@radar.app` if not set

## Troubleshooting

### Email Not Sending

**Check 1: API Key**
```bash
# Verify API key is set
echo $RESEND_API_KEY
```

**Check 2: From Email Domain**
- Development: Use `onboarding@resend.dev`
- Production: Verify your domain in Resend dashboard

**Check 3: Application Logs**
```bash
# Look for email service logs
npm run start:dev
# Watch for: "Sending password reset email to..."
```

### Email Service Not Configured Warning

If you see this warning:
```
RESEND_API_KEY not found in environment variables. Email functionality will be disabled.
```

**Solution**: Add `RESEND_API_KEY` to your `.env` file and restart the application.

### Domain Not Verified Error

**Error**: `Domain not verified`

**Solution**:
1. Go to Resend dashboard > Domains
2. Verify your domain with DNS records
3. Wait for verification to complete
4. Or use `onboarding@resend.dev` for testing

## Rate Limits

Resend rate limits (as of 2025):

- **Free Plan**: 100 emails/day, 3,000 emails/month
- **Paid Plans**: Higher limits based on plan

For production use with higher volume, consider upgrading your Resend plan.

## Security Best Practices

1. **Never commit API keys**: Always use `.env` files (already in `.gitignore`)
2. **Use environment-specific keys**: Different keys for dev/staging/production
3. **Rotate keys regularly**: Generate new API keys periodically
4. **Monitor usage**: Check Resend dashboard for suspicious activity
5. **Verify recipients**: Ensure email addresses are validated before sending

## Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [React Email Documentation](https://react.email/docs)
- [React Email Components](https://react.email/docs/components)
- [Better Auth Email Configuration](https://www.better-auth.com/docs/authentication/email-password)

## Architecture

```
Better Auth Password Reset Request
          ↓
    auth.config.ts (sendResetPassword callback)
          ↓
    EmailService.sendPasswordResetEmail()
          ↓
    React Email Template Rendering
          ↓
    Resend API (email delivery)
          ↓
    User's Inbox
```

## File Structure

### Backend

```
app/src/email/
├── email.module.ts              # NestJS module
├── email.service.ts             # Email service with Resend integration
└── templates/
    └── password-reset.tsx       # Password reset email template

app/src/auth/
└── auth.config.ts               # Better Auth config with email integration
```

### Frontend

```
client/src/app/auth/
├── forgot-password/
│   └── page.tsx                 # Password reset request page
├── reset-password/
│   └── page.tsx                 # New password entry page
└── signin/
    └── page.tsx                 # Login page with "Forgot password?" link
```

## Next Steps

Once email is configured, you can:

1. **Add more templates**: Welcome emails, notifications, etc.
2. **Customize styling**: Update template styles to match your brand
3. **Add analytics**: Track email opens and clicks
4. **Implement webhooks**: Handle bounce/spam reports from Resend

---

**Questions?** Check the Resend dashboard or review the email service logs for debugging information.
