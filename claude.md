# Radar - GitHub to Slack Integration Platform

## Overview

**Radar** delivers intelligent GitHub notifications to Slack using AI-powered filtering, priority-based notification profiles, and scheduled digest summaries.

### System Flow

```
GitHub Webhook → NestJS API → Trigger.dev Background Task → Notification Decision Engine → Slack Message
                      ↓                                              ↓
                Database (Event Storage)              (Profile-based routing with AI)
```

## Tech Stack

### Backend (NestJS - Port 3003)
- **Framework**: NestJS (TypeScript)
- **Authentication**: Better Auth with Google OAuth + email/password
- **Database**: PostgreSQL with Prisma ORM
- **Background Jobs**: Trigger.dev v4 SDK
- **Rate Limiting**: @nestjs/throttler (100 requests/min per IP)

### Frontend (Next.js 14 - Port 3001)
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **State Management**: React Context

### Integrations
- **Slack API**: @slack/web-api WebClient
- **GitHub API**: @octokit/rest, webhooks
- **OpenAI**: GPT-4 for semantic keyword matching
- **PostHog**: Analytics
- **Stripe**: Payments (optional in open-source mode)
- **Resend**: Email service

## Project Structure

```
/radar
├── app/                           # NestJS Backend (port 3003)
│   ├── src/
│   │   ├── auth/                  # Better Auth integration
│   │   ├── github/                # GitHub API services
│   │   ├── slack/                 # Slack API services
│   │   ├── webhooks/              # GitHub webhook handlers
│   │   ├── notifications/         # Core notification logic
│   │   │   ├── notification.service.ts          # Main decision engine
│   │   │   ├── notification-profile.service.ts  # Profile management
│   │   │   └── llm-analyzer.service.ts          # OpenAI keyword matching
│   │   ├── digest/                # Digest configuration & services
│   │   ├── users/                 # User management
│   │   ├── stripe/                # Payment & entitlements
│   │   ├── email/                 # Email service
│   │   ├── analytics/             # PostHog integration
│   │   └── common/                # Shared utilities
│   ├── trigger/                   # Trigger.dev v4 tasks
│   │   ├── process-github-event.ts  # Main event processing
│   │   └── daily-digest.ts          # Scheduled digests (every 15 min)
│   └── prisma/
│       └── schema.prisma          # Database schema
│
├── client/                        # Next.js Frontend (port 3001)
│   ├── src/
│   │   ├── app/                   # App Router pages
│   │   │   ├── auth/             # Auth pages
│   │   │   ├── settings/         # Settings pages
│   │   │   │   ├── notifications/ # Notification profile UI
│   │   │   │   ├── digest/       # Digest configuration UI
│   │   │   │   └── teams/        # Team management
│   │   │   └── onboarding/       # Onboarding flow
│   │   ├── components/           # React components
│   │   └── contexts/             # React Context providers
│
└── docs/                         # Documentation
```

## Key Features

### 1. Notification Profiles

Priority-based configurations controlling when and how users receive GitHub notifications.

**Profile Structure**:
- **Priority**: Higher priority evaluated first
- **Scope**: User-wide (`scopeType: "user"`) or team-specific (`scopeType: "team"`)
- **Repository Filter**: All repos or selected subset
- **Event Preferences**: Granular control over PR/issue events
- **Keywords**: Custom keywords with optional AI matching
- **Delivery**: DM or specific Slack channel

**Decision Flow**:
1. Get user's enabled profiles (ordered by priority DESC)
2. For each profile: check repository filter, keywords, watching reasons, team scope, event preferences
3. First matching profile determines notification behavior and delivery target

**Key Files**:
- `app/src/notifications/services/notification-profile.service.ts` - Profile CRUD
- `app/src/notifications/services/notification.service.ts` - Decision engine
- `client/src/components/NotificationProfileForm.tsx` - Profile UI

### 2. Digest Configurations

Multiple scheduled digest summaries with different settings.

**Digest Config**:
- **Schedule**: `digestTime`, `timezone`, `daysOfWeek`
- **Scope**: User or team-specific
- **Repository Filter**: All or selected repos
- **Delivery**: DM or channel

Trigger.dev cron runs every 15 minutes, checks time/day matches, generates digest if conditions met.

**Key Files**:
- `app/src/digest/digest.service.ts` - Digest generation
- `app/trigger/daily-digest.ts` - Scheduled task

### 3. Watching Reasons

Determines why a user should receive a notification.

**Enum** (`app/src/common/types/notification-enums.ts`):
- `AUTHOR` - User created the PR/issue
- `REVIEWER` - Explicitly requested for review
- `ASSIGNED` - Assigned to PR/issue
- `MENTIONED` - @mentioned in content
- `TEAM_ASSIGNED` - User's team assigned
- `TEAM_MENTIONED` - User's team @mentioned
- `TEAM_REVIEWER` - User's team requested for review

**Key Files**:
- `app/src/notifications/services/notification.service.ts:329` - Determination logic
- `app/src/notifications/services/notification.service.ts:951` - Preference matching

### 4. Open Source Mode

Run self-hosted with billing disabled, granting all users full pro-level access.

**Setup**:
- Set `PAYMENT_ENABLED=false` in backend `.env`
- Set `NEXT_PUBLIC_PAYMENT_ENABLED=false` in frontend `.env.local`
- Entitlements service automatically grants unlimited features

**Key Files**:
- `app/src/stripe/services/entitlements.service.ts` - Entitlements (open-source aware)

## Database Schema

### Core Tables

**User**: Profile, Slack integration, GitHub integration, Stripe
**UserRepository**: Tracked GitHub repositories
**Event**: GitHub webhook events with full payload
**Notification**: Sent notifications with reason/context
**NotificationProfile**: Notification configurations
**DigestConfig**: Digest configurations
**UserDigest**: Digest history
**UserTeam**: GitHub team memberships
**Subscription**: Stripe subscriptions (optional)
**FeatureEntitlement**: Feature entitlements

## Environment Variables

### Backend (`app/.env.example`)

**Application**: `NODE_ENV`, `API_PORT`, `CALLBACK_API_HOST`, `FRONTEND_URL`, `BACKEND_URL`
**Database**: `DATABASE_URL`
**Security**: `SECRET_KEY`, `BETTER_AUTH_SECRET`
**Slack**: `SLACK_APP_CLIENT_ID`, `SLACK_APP_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
**GitHub**: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
**Google**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
**Monitoring**: `POSTHOG_API_KEY`
**Trigger.dev**: `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY`
**OpenAI**: `OPENAI_API_KEY`
**Resend**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
**Stripe (Optional)**: `PAYMENT_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

### Frontend (`client/.env.example`)

**Application**: `NEXT_PUBLIC_API_URL`
**PostHog**: `NEXT_PUBLIC_POSTHOG_KEY`
**Stripe (Optional)**: `NEXT_PUBLIC_PAYMENT_ENABLED`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Development Workflow

### Starting the App

```bash
# Backend
cd app && npm install && npx prisma generate && npx prisma migrate dev && npm run start:dev

# Frontend
cd client && npm install && npm run dev

# Trigger.dev
cd app && npx trigger.dev@latest dev
```

### Common Commands

```bash
# Database
npx prisma generate        # Generate Prisma client
npx prisma migrate dev     # Create and apply migration
npx prisma studio          # GUI for database

# Testing
npm test                   # Run tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
```

## Architecture Patterns

### Service Layer Pattern
- **Controllers** handle HTTP, delegate to services
- **Services** contain business logic, use Prisma for data access
- Services injected via NestJS dependency injection

### Background Job Pattern (Trigger.dev v4)

**CRITICAL**: Use Trigger.dev v4 SDK. **NEVER** use v2 API (`client.defineJob()`).

**V4 Task Pattern**:
```typescript
import { task } from "@trigger.dev/sdk";

export const myTask = task({
  id: "my-task",
  run: async (payload) => {
    // Task logic
    return { success: true };
  },
});
```

**Service Initialization in Tasks**:
- Services must be manually instantiated (no DI container)
- ConfigService manually initialized with config objects
- Prisma client disconnected in `finally` block

**Example** (`app/trigger/process-github-event.ts:16`):
```typescript
const prisma = new PrismaClient();
const configService = new ConfigService();
const analyticsService = new AnalyticsService(configService);

export const processGitHubEvent = task({
  id: "process-github-event",
  run: async (payload) => {
    try {
      // Use services
    } finally {
      await prisma.$disconnect();
    }
  },
});
```

## API Endpoints

### Core Endpoints
- **Auth**: `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/session`, `/api/auth/callback/google`
- **Users**: `/api/users/me`, `/api/users/me/entitlements`
- **Repositories**: `/api/users/repositories`, `/api/users/repositories/sync`
- **Teams**: `/api/users/teams`, `/api/users/teams/sync`
- **Notification Profiles**: `/api/notification-profiles` (CRUD)
- **Digest Configs**: `/api/digest-configs` (CRUD)
- **Webhooks**: `/api/webhooks/github` (signature verified)
- **Billing**: `/api/billing/*` (hidden in open-source mode)

## Notification Event Types

### GitHub Events Handled
- **pull_request**: `opened`, `closed`, `reopened`, `review_requested`, `assigned`, `ready_for_review`
- **pull_request_review**: `submitted`, `dismissed`
- **pull_request_review_comment**: `created`
- **issues**: `opened`, `closed`, `reopened`, `assigned`
- **issue_comment**: `created`
- **Special**: `membership` (syncs teams), `installation` (syncs installation)

### Notification Preferences
- `pull_request_opened`, `pull_request_closed`, `pull_request_merged`, `pull_request_reopened`
- `pull_request_review_requested`, `pull_request_assigned`, `pull_request_commented`, `pull_request_reviewed`
- `issue_opened`, `issue_closed`, `issue_reopened`, `issue_assigned`, `issue_commented`
- `mention_in_pull_request`, `mention_in_issue`
- `mute_own_activity`, `mute_bot_comments`, `mute_draft_pull_requests`

## Security

### Authentication & Authorization
- Better Auth handles session security and CSRF protection
- OAuth tokens encrypted at rest using `SECRET_KEY`
- Auth guards protect endpoints

### Webhook Security
- GitHub webhook signature verification (HMAC SHA-256)
- Stripe webhook signature verification
- Guards enforce signature validation

## Code Style & Conventions

### Naming Conventions
- **Files**: kebab-case (`notification-profile.service.ts`)
- **Classes**: PascalCase (`NotificationProfileService`)
- **Functions**: camelCase (`getNotificationProfiles`)
- **Constants**: UPPER_SNAKE_CASE (`EVENT_COLORS`)
- **Database columns**: snake_case (`user_id`)
- **API endpoints**: kebab-case (`/notification-profiles`)

### TypeScript
- Use strict mode
- Prefer `interface` over `type` for object shapes
- Avoid `any`, use `unknown` or proper types
- Use optional chaining (`?.`) and nullish coalescing (`??`)

## Common Development Tasks

### Adding a New GitHub Event Type

1. Add event handling to `app/trigger/process-github-event.ts:100`
2. Map to notification trigger in `app/src/notifications/services/notification.service.ts:612`
3. Add event preference to `NotificationPreferences` type
4. Add UI constants to `client/src/constants/notification-preferences.constants.ts`
5. Update preference matching logic
6. Add Slack message formatter

### Debugging Notifications

1. Check `Notification` table `reason` and `context` fields
2. Review Trigger.dev logs
3. Check PostHog events
4. Use test webhook in GitHub
5. Enable debug logging: `LOG_LEVEL=debug`

## Important Notes

### Trigger.dev v4 ONLY
- **ALWAYS** use `@trigger.dev/sdk` with `task()` function
- **NEVER** use `client.defineJob()` (v2 API)
- Use `tasks.trigger()` to queue tasks

### Webhook Security
- GitHub webhook signature verification required (HMAC SHA-256)
- Guards enforce signature validation

### Database Migrations
- Always use: `npx prisma migrate dev`
- Never manually edit database schema
- Production: `npx prisma migrate deploy`

---

**Last Updated**: 2025-01-16
