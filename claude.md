# Radar - GitHub to Slack Integration Platform

## Overview

**Radar** is a Slack application that connects GitHub activity to Slack workspaces, delivering intelligent, configurable notifications about pull requests, issues, reviews, and comments in real-time. Built with a modern TypeScript stack, Radar uses AI-powered filtering, flexible notification profiles, and scheduled digest summaries to keep teams informed without notification fatigue.

## What Does This App Do?

### Core Functionality

1. **Real-Time GitHub Notifications**: Automatically sends Slack notifications when GitHub events occur (PRs opened, reviews submitted, issues created, comments added, etc.)

2. **Smart Notification Routing**: Uses a priority-based notification profile system to intelligently decide who should be notified, when, and where (DM vs channel)

3. **AI-Powered Keyword Matching**: Integrates OpenAI to intelligently match keywords in PR/issue content, enabling semantic filtering beyond simple text matching

4. **Digest Summaries**: Generates scheduled digest summaries of GitHub activity, configurable per user with different schedules, scopes (user vs team), and delivery preferences

5. **Team Management**: Syncs GitHub team memberships and enables team-scoped notifications and digests

6. **Flexible Configuration**: Users can create multiple notification profiles and digest configurations with granular control over repositories, event types, delivery channels, and schedules

7. **Open Source Mode**: Can be run self-hosted with payment/billing disabled, granting all users full pro-level feature access

### System Flow

```
GitHub Webhook → NestJS API → Trigger.dev Background Task → Notification Decision Engine → Slack Message
                      ↓                                              ↓
                Database (Event Storage)              (Profile-based routing with AI)
```

**Detailed Flow:**
1. User configures notification profiles and digest settings via Next.js frontend
2. GitHub sends webhooks to NestJS backend when events occur in tracked repositories
3. Webhook validated, event stored in PostgreSQL database, Trigger.dev task queued
4. Background worker processes event through notification profile system:
   - Checks user's notification profiles (ordered by priority)
   - Evaluates watching reasons (author, reviewer, assignee, mentioned, team involvement)
   - Applies keyword matching with optional AI analysis
   - Determines delivery target (DM or specific channel)
5. Slack message sent to appropriate destination with rich formatting
6. Scheduled digests generated via Trigger.dev cron tasks, summarizing activity

## Tech Stack

### Backend (NestJS - Port 3003)
- **Framework**: NestJS (TypeScript) - modular architecture with dependency injection
- **Authentication**: Better Auth with Google OAuth + email/password
- **Database**: PostgreSQL with Prisma ORM
- **Background Jobs**: Trigger.dev v4 SDK for webhook processing and scheduled digests
- **API**: RESTful API with `/api` prefix, comprehensive validation with class-validator
- **Rate Limiting**: @nestjs/throttler (100 requests/min per IP)

### Frontend (Next.js 14 - Port 3001)
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom components
- **State Management**: React Context for auth and user state
- **UI Components**: Custom component library with consistent patterns
- **Toast Notifications**: Sonner for user feedback

### Integrations
- **Slack API**: @slack/web-api WebClient for sending messages, conversations API for DMs/channels
- **GitHub API**: @octokit/rest for repository/team data, webhooks for real-time events
- **OpenAI**: GPT-4 for semantic keyword matching in notification content
- **PostHog**: Analytics and event tracking
- **Stripe**: Payment processing and entitlements (optional in open-source mode)
- **Resend**: Transactional email service for password resets

## Project Structure

```
/radar
├── app/                           # NestJS Backend (port 3003)
│   ├── src/
│   │   ├── auth/                  # Better Auth integration, Google OAuth
│   │   │   ├── auth.config.ts    # Better Auth configuration
│   │   │   ├── auth.module.ts    # NestJS module wrapper
│   │   │   └── controllers/      # Auth endpoints
│   │   ├── github/                # GitHub API services
│   │   │   ├── services/
│   │   │   │   ├── github.service.ts        # GitHub API operations
│   │   │   │   └── github-token.service.ts  # Token management & encryption
│   │   │   └── controllers/      # GitHub integration endpoints
│   │   ├── slack/                 # Slack API services
│   │   │   ├── services/
│   │   │   │   └── slack.service.ts         # Slack messaging operations
│   │   │   └── controllers/      # Slack integration endpoints
│   │   ├── webhooks/              # GitHub webhook handlers
│   │   │   ├── controllers/      # Webhook receiver endpoint
│   │   │   ├── services/         # Webhook processing logic
│   │   │   └── guards/           # Webhook signature verification
│   │   ├── notifications/         # Core notification logic
│   │   │   ├── services/
│   │   │   │   ├── notification.service.ts          # Main notification decision engine
│   │   │   │   ├── notification-profile.service.ts  # Profile management CRUD
│   │   │   │   └── llm-analyzer.service.ts          # OpenAI keyword matching
│   │   │   └── controllers/      # Notification profile API endpoints
│   │   ├── digest/                # Digest configuration & services
│   │   │   ├── digest.service.ts          # Digest generation logic
│   │   │   ├── digest-config.service.ts   # Digest config CRUD
│   │   │   ├── digest.controller.ts       # Digest testing endpoint
│   │   │   └── digest-config.controller.ts # Digest config API
│   │   ├── users/                 # User management
│   │   │   ├── services/
│   │   │   │   ├── users.service.ts           # User CRUD operations
│   │   │   │   ├── user-repositories.service.ts # Repository tracking
│   │   │   │   └── user-teams-sync.service.ts   # Team membership sync
│   │   │   └── controllers/      # User, repository, and team endpoints
│   │   ├── stripe/                # Payment & entitlements
│   │   │   ├── services/
│   │   │   │   ├── entitlements.service.ts    # Feature entitlements (open-source aware)
│   │   │   │   └── stripe.service.ts          # Stripe integration
│   │   │   └── controllers/      # Billing and webhook endpoints
│   │   ├── email/                 # Email service
│   │   │   ├── email.service.ts  # Resend integration
│   │   │   ├── email.module.ts   # Email module
│   │   │   └── templates/        # React Email templates
│   │   ├── analytics/             # PostHog integration
│   │   │   ├── analytics.service.ts # Event tracking
│   │   │   └── analytics.module.ts
│   │   ├── database/              # Prisma service wrapper
│   │   │   ├── database.service.ts # Prisma client wrapper
│   │   │   └── database.module.ts
│   │   ├── integrations/          # GitHub integration sync
│   │   │   ├── services/
│   │   │   │   └── github-integration.service.ts # Installation sync
│   │   │   └── controllers/      # Integration management endpoints
│   │   ├── common/                # Shared utilities
│   │   │   ├── filters/          # Exception filters
│   │   │   ├── interceptors/     # Logging & error tracking
│   │   │   ├── guards/           # Auth guards
│   │   │   ├── types/            # TypeScript types
│   │   │   ├── dtos/             # Data transfer objects
│   │   │   ├── constants/        # App-wide constants
│   │   │   └── utils/            # Utility functions
│   │   ├── config/                # Configuration files
│   │   │   ├── app.config.ts     # App settings
│   │   │   ├── github.config.ts  # GitHub settings
│   │   │   ├── slack.config.ts   # Slack settings
│   │   │   └── monitoring.config.ts # Analytics settings
│   │   └── app.module.ts          # Root NestJS module
│   ├── trigger/                   # Trigger.dev v4 tasks
│   │   ├── process-github-event.ts  # Main event processing task
│   │   └── daily-digest.ts          # Scheduled digest generation (every 15 min)
│   ├── prisma/
│   │   ├── schema.prisma          # Complete database schema
│   │   └── migrations/            # Database migrations
│   ├── trigger.config.ts          # Trigger.dev configuration
│   ├── .env.example               # Backend environment template
│   └── package.json               # Backend dependencies
│
├── client/                        # Next.js Frontend (port 3001)
│   ├── src/
│   │   ├── app/                   # App Router pages
│   │   │   ├── auth/             # Auth pages (signin, signup, error, success)
│   │   │   ├── settings/         # Settings pages
│   │   │   │   ├── repositories/ # Repository management
│   │   │   │   ├── notifications/ # Notification profile UI
│   │   │   │   ├── digest/       # Digest configuration UI
│   │   │   │   ├── teams/        # Team management
│   │   │   │   ├── github/       # GitHub integration
│   │   │   │   ├── keywords/     # Keyword management (legacy)
│   │   │   │   └── billing/      # Billing (hidden in open-source mode)
│   │   │   ├── onboarding/       # New user onboarding flow
│   │   │   ├── layout.tsx        # Root layout
│   │   │   └── page.tsx          # Landing/home page
│   │   ├── components/           # Reusable React components
│   │   │   ├── NotificationProfileManager.tsx  # Profile list & management
│   │   │   ├── NotificationProfileForm.tsx     # Profile creation/editing
│   │   │   ├── DigestConfigForm.tsx            # Digest configuration form
│   │   │   ├── RepositoryList.tsx              # Repository management UI
│   │   │   ├── GitHubStarButton.tsx            # GitHub star button
│   │   │   └── ...                             # Other components
│   │   ├── contexts/             # React Context providers
│   │   │   └── AuthContext.tsx   # Auth state management
│   │   ├── lib/                  # Utility libraries
│   │   │   ├── auth-client.ts    # Better Auth React client
│   │   │   └── utils.ts          # Utility functions
│   │   ├── constants/            # Frontend constants
│   │   │   └── notification-preferences.constants.ts # Event type mappings
│   │   └── styles/               # Global styles
│   ├── .env.example              # Frontend environment template
│   └── package.json              # Frontend dependencies
│
├── docs/                         # Documentation
│   ├── SLACK_SETUP.md            # Slack app setup guide (not yet created)
│   ├── GITHUB_SETUP.md           # GitHub app setup guide (not yet created)
│   ├── GOOGLE_OAUTH_SETUP.md     # Google OAuth setup guide
│   ├── EMAIL_SETUP.md            # Email service setup guide
│   ├── OPEN_SOURCE_MODE.md       # Open-source mode documentation
│   ├── PR_STATE_MANAGEMENT.md    # PR state management plan
│   ├── TEAM_NOTIFICATIONS_REFACTOR.md # Team notifications plan
│   ├── STRIPE_IMPLEMENTATION_PLAN.md  # Stripe implementation plan
│   └── REVIEW_BATCHING_PLAN.md   # Review batching plan
│
├── ROADMAP.md                    # Product roadmap
└── README.md                     # Project readme
```

## Key Features Deep Dive

### 1. Notification Profiles (Advanced Configuration)

**What**: Flexible, priority-based notification configurations that control when and how users receive GitHub notifications.

**Why**: Different types of GitHub events require different levels of attention. Direct actions (review requests, assignments) are urgent, while activity updates are informational. Users may want work notifications in a team channel but personal notifications via DM.

**How It Works**:
- Users create multiple profiles (e.g., "Urgent Reviews", "Team PRs", "My Contributions")
- Each profile has:
  - **Priority**: Higher priority profiles evaluated first (integer, higher = first)
  - **Scope**: User-wide (`scopeType: "user"`) or team-specific (`scopeType: "team"` with `scopeValue: teamId`)
  - **Repository Filter**: All repos (`type: "all"`) or selected subset (`type: "selected"` with `repoIds: string[]`)
  - **Event Preferences**: Granular control over PR/issue events (JSON object matching NotificationPreferences type)
  - **Keywords**: Custom keyword list with optional AI matching (`keywords: string[]`, `keywordLLMEnabled: boolean`)
  - **Delivery**: DM (`deliveryType: "dm"`) or specific Slack channel (`deliveryType: "channel"` with `deliveryTarget: channelId`)
- When event occurs, profiles processed in priority order until match found
- First matching profile determines notification behavior and delivery destination

**Decision Flow**:
1. Get user's enabled profiles (ordered by priority DESC)
2. For each profile:
   - Check repository filter (all or selected repos)
   - Check keyword matches (AI or substring)
   - Determine watching reasons (author, reviewer, assigned, mentioned, etc.)
   - Check team scope if applicable
   - Check notification preferences for event type
3. First profile that matches all conditions wins
4. Notification sent to profile's configured delivery target

**Key Files**:
- `app/src/notifications/services/notification-profile.service.ts:1` - Profile CRUD operations
- `app/src/notifications/services/notification.service.ts:1` - Profile-based decision engine
- `app/src/common/types/notification-profile.types.ts:1` - TypeScript types
- `client/src/components/NotificationProfileManager.tsx:1` - Profile management UI
- `client/src/components/NotificationProfileForm.tsx:1` - Profile creation/editing form

### 2. Multiple Digest Configurations

**What**: Users can create multiple scheduled digest summaries with different settings.

**Why**: Different contexts require different digest views. A user might want a personal daily digest of all activity at 9 AM, plus a weekly team digest on Mondays.

**How It Works**:
- Each digest config specifies:
  - **Schedule**: `digestTime` (HH:MM format), `timezone` (IANA timezone), `daysOfWeek` (array of 0-6, 0=Sunday)
  - **Scope**: User (`scopeType: "user"`) or team-specific (`scopeType: "team"` with `scopeValue: teamId`)
  - **Repository Filter**: All or selected repos (same format as notification profiles)
  - **Delivery**: DM or channel (same format as notification profiles)
- Trigger.dev cron task runs every 15 minutes (`*/15 * * * *`)
- For each digest config:
  - Check if current time matches `digestTime` in config's `timezone`
  - Check if current day is in `daysOfWeek`
  - Check if digest was already sent today (stored in `UserDigest` table)
  - If all conditions met, generate and send digest
- Digest includes:
  - PRs waiting on user's review
  - PRs approved and ready to merge
  - User's open PRs
  - User's draft PRs
  - Counts and delivery info stored in `UserDigest` table

**Key Files**:
- `app/src/digest/digest-config.service.ts:1` - Digest CRUD operations
- `app/src/digest/digest.service.ts:1` - Digest generation logic
- `app/trigger/daily-digest.ts:1` - Scheduled digest generation task
- `client/src/app/settings/digest/page.tsx:1` - Digest configuration UI

### 3. Team Management & Syncing

**What**: Automatic synchronization of GitHub team memberships for team-scoped features.

**Why**: GitHub teams represent organizational structure. Users should be able to filter notifications and digests based on team involvement without manual configuration.

**How It Works**:
- GitHub `membership` webhook updates team memberships automatically when user added/removed from teams
- Manual sync available via API endpoint: `POST /api/users/teams/sync`
- Team data stored in `UserTeam` table:
  - `teamId` - GitHub team ID
  - `teamSlug` - Team slug (used in mentions like `@org/team-slug`)
  - `teamName` - Human-readable team name
  - `organization` - GitHub organization
  - `permission` - User's permission level (default: "member")
- Used for filtering in:
  - Notification profiles with `scopeType: "team"`
  - Digests with `scopeType: "team"`
  - Watching reasons (`TEAM_REVIEWER`, `TEAM_ASSIGNED`, `TEAM_MENTIONED`)

**Key Files**:
- `app/src/users/services/user-teams-sync.service.ts:1` - Team sync and management
- `app/src/webhooks/services/webhooks.service.ts:1` - Membership webhook handler
- `app/src/common/types/notification-enums.ts:1` - WatchingReason enum

### 4. AI-Powered Keyword Matching

**What**: Optional AI-based semantic keyword matching in notification content using OpenAI.

**Why**: Simple substring matching misses semantic relevance. If a user wants notifications about "authentication", they should also match "login issues" or "OAuth problems".

**How It Works**:
- User enables `keywordLLMEnabled: true` on notification profile
- When processing event, system extracts content:
  - PR: title + body
  - Issue: title + body
  - Comments: comment body
  - Reviews: review body
- If `keywordLLMEnabled`:
  - Content sent to OpenAI GPT-4 with prompt asking to match against keywords
  - AI returns matched keywords with reasoning
  - Match details stored for debugging
- If `keywordLLMEnabled: false`:
  - Simple substring matching (case-insensitive)
- Decision logged in notification `context` field for debugging
- Matched keywords displayed in Slack message

**Key Files**:
- `app/src/notifications/services/llm-analyzer.service.ts:1` - OpenAI integration
- `app/src/notifications/services/notification.service.ts:521` - Content extraction
- `app/src/notifications/services/notification.service.ts:179` - Keyword matching logic
- `app/trigger/process-github-event.ts:454` - Keyword match block in Slack message

### 5. Watching Reasons

**What**: System for determining why a user should receive a notification about a PR/issue.

**Why**: Users care about different events for different reasons. You want all updates on PRs you authored, but only review requests for others' PRs.

**Watching Reasons Enum** (`app/src/common/types/notification-enums.ts:1`):
- `AUTHOR` - User created the PR/issue
- `REVIEWER` - Explicitly requested for review
- `ASSIGNED` - Assigned to the PR/issue
- `MENTIONED` - @mentioned in content (using word boundaries: `\B@username\b`)
- `TEAM_ASSIGNED` - User's team assigned
- `TEAM_MENTIONED` - User's team @mentioned (format: `@org/team-slug`)
- `TEAM_REVIEWER` - User's team requested for review
- `SUBSCRIBED` - GitHub subscription (not currently implemented)
- `MANUAL` - Manually added (not currently implemented)

**How Determination Works** (`app/src/notifications/services/notification.service.ts:329`):
1. Get user data including GitHub teams
2. Extract PR/issue data from payload
3. **Special case**: For `review_requested` events, only notify the specific reviewer/team requested (early return)
4. Check if user is author (`data.user.login === githubUsername`)
5. For PRs:
   - Check if user in `requested_reviewers` array
   - Check if user's teams in `requested_teams` array
   - For issue_comment events on PRs, fetch full PR data to get reviewers
6. Check if user in `assignees` array
7. Check if user's teams in assignees
8. Check for mentions in text content using regex with word boundaries
9. Check for team mentions in text content
10. Return set of all applicable watching reasons

**Preference Matching** (`app/src/notifications/services/notification.service.ts:951`):
- Always notify if mentioned (if `mention_in_pull_request` or `mention_in_issue` enabled)
- Check event-specific preferences based on watching reasons
- Self-action filtering: Don't notify for own actions if `mute_own_activity: true` (default)
- Bot filtering: Don't notify for bot actions if `mute_bot_comments: true`
- Draft PR filtering: Don't notify for draft PRs if `mute_draft_pull_requests: true`

**Key Files**:
- `app/src/notifications/services/notification.service.ts:329` - Watching reasons determination
- `app/src/notifications/services/notification.service.ts:951` - Preference matching
- `app/src/common/types/notification-enums.ts:1` - WatchingReason enum

### 6. Open Source Mode

**What**: Run Radar self-hosted with payment/billing disabled, granting all users full pro-level feature access.

**Why**: Enable community self-hosting without requiring Stripe integration or payment processing.

**How It Works**:
- Set `PAYMENT_ENABLED=false` in backend `.env`
- Set `NEXT_PUBLIC_PAYMENT_ENABLED=false` in frontend `.env.local`
- Backend (`app/src/stripe/services/entitlements.service.ts:1`):
  - On service init, checks `PAYMENT_ENABLED` env var
  - If disabled, logs "Running in open-source mode"
  - `syncEntitlements()` sets unlimited entitlements for all features
  - `hasFeature()` always returns `true`
  - `getFeatureValue()` returns `-1` for limits (unlimited) or `true` for booleans
- Frontend:
  - Billing page hidden from settings sidebar
  - Upgrade banners not shown
  - No feature limit warnings displayed
- All users get equivalent of "Pro" plan:
  - Unlimited repositories
  - Unlimited notification profiles
  - Unlimited digest configurations
  - GitHub team support
  - Keyword matching
  - AI keyword matching

**Switching Modes**:
- **Open Source → Paid**: Update env vars, restart, users assigned free plan by default
- **Paid → Open Source**: Update env vars, restart, users automatically get full entitlements on next login

**Key Files**:
- `app/src/stripe/services/entitlements.service.ts:1` - Entitlements service (open-source aware)
- `client/src/app/settings/layout.tsx:1` - Settings sidebar (conditionally shows billing)
- `docs/OPEN_SOURCE_MODE.md:1` - Complete open-source mode documentation

## Database Schema

### Core Tables

**User** (`app/prisma/schema.prisma:15`):
- Profile data: `name`, `email`, `image`, `isActive`, `isAdmin`
- Slack integration: `slackId`, `slackTeamId`, `slackBotToken` (encrypted), `slackUserToken` (encrypted), `slackRefreshToken` (encrypted)
- GitHub integration: `githubId`, `githubLogin`, `githubAccessToken` (encrypted), `githubRefreshToken` (encrypted), `githubInstallationId`, `teamsLastSyncedAt`
- Stripe: `stripeCustomerId`
- Relations: repositories, notifications, digestConfigs, notificationProfiles, digests, events, sessions, accounts, teams, subscription, featureEntitlements

**UserRepository** (`app/prisma/schema.prisma:65`):
- Tracks which GitHub repositories each user has enabled for notifications
- Fields: `githubId`, `name`, `fullName`, `description`, `url`, `isPrivate`, `isFork`, `ownerName`, `ownerAvatarUrl`, `ownerUrl`, `organization`, `isActive`, `enabled`
- Unique constraint on `[userId, githubId]`

**Event** (`app/prisma/schema.prisma:96`):
- Stores all received GitHub webhook events with full payload
- Fields: `eventType`, `action`, `repositoryId`, `repositoryName`, `senderId`, `senderLogin`, `processed`, `payload` (JSON)
- Relations: `userId`, `user`, `notifications`

**Notification** (`app/prisma/schema.prisma:125`):
- Records of sent notifications with reason/context for debugging
- Fields: `userId`, `eventId`, `messageType`, `channel`, `messageTs`, `payload` (JSON), `reason`, `context` (JSON)
- Relations: `user`, `event`

**NotificationProfile** (`app/prisma/schema.prisma:187`):
- Flexible notification configurations with priority, scope, repository filters, event preferences, keywords, and delivery settings
- Fields: `name`, `description`, `isEnabled`, `scopeType`, `scopeValue`, `repositoryFilter` (JSON), `deliveryType`, `deliveryTarget`, `notificationPreferences` (JSON), `keywords`, `keywordLLMEnabled`, `priority`
- Relations: `userId`, `user`

**DigestConfig** (`app/prisma/schema.prisma:151`):
- Multiple digest configurations per user with schedule (cron-like), scope, repository filters, and delivery settings
- Fields: `name`, `description`, `isEnabled`, `digestTime`, `timezone`, `daysOfWeek`, `scopeType`, `scopeValue`, `repositoryFilter` (JSON), `deliveryType`, `deliveryTarget`
- Relations: `userId`, `user`, `digestHistory`

**UserDigest** (`app/prisma/schema.prisma:226`):
- History of sent digests with counts and delivery info
- Fields: `userId`, `digestConfigId`, `sentAt`, `messageTs`, `pullRequestCount`, `issueCount`, `deliveryType`, `deliveryTarget`
- Relations: `user`, `digestConfig`

**UserTeam** (`app/prisma/schema.prisma:298`):
- GitHub team memberships synced from webhooks
- Fields: `userId`, `teamId`, `teamSlug`, `teamName`, `organization`, `permission`
- Unique constraint on `[userId, teamId]`
- Relations: `user`

**Subscription** (`app/prisma/schema.prisma:319`):
- Stripe subscription management (optional in open-source mode)
- Fields: `userId`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `planName`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `trialStart`, `trialEnd`, `hasUsedTrial`, `isLegacyPlan`, `legacyPlanName`
- Relations: `user` (one-to-one)

**FeatureEntitlement** (`app/prisma/schema.prisma:355`):
- Feature entitlements (synced from Stripe or set in open-source mode)
- Fields: `userId`, `featureLookupKey`, `featureName`, `value` (JSON string), `stripeEntitlementId`, `isActive`
- Unique constraint on `[userId, featureLookupKey]`
- Relations: `user`

### Better Auth Tables

**Session** (`app/prisma/schema.prisma:251`):
- Better Auth session management
- Fields: `id`, `expiresAt`, `token`, `createdAt`, `updatedAt`, `ipAddress`, `userAgent`, `userId`
- Unique constraint on `token`

**Account** (`app/prisma/schema.prisma:266`):
- Better Auth account management (OAuth providers)
- Fields: `id`, `accountId`, `providerId`, `userId`, `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `password`

**Verification** (`app/prisma/schema.prisma:285`):
- Better Auth verification tokens (email verification, password reset)
- Fields: `id`, `identifier`, `value`, `expiresAt`

## Environment Variables

### Backend (`app/.env.example`)

**Application**:
- `NODE_ENV` - Environment (development/production)
- `APP_NAME` - Application name
- `DEBUG` - Debug mode
- `LOG_LEVEL` - Logging level
- `API_HOST` - API host (default: 0.0.0.0)
- `API_PORT` - API port (default: 3003)
- `CALLBACK_API_HOST` - Public callback URL for webhooks
- `FRONTEND_URL` - Frontend URL (CORS)
- `BACKEND_URL` - Backend URL (for Better Auth redirects)

**Database**:
- `DATABASE_URL` - PostgreSQL connection string

**Security**:
- `SECRET_KEY` - General encryption key
- `BETTER_AUTH_SECRET` - Better Auth encryption key

**Slack**:
- `SLACK_APP_CLIENT_ID` - Slack OAuth client ID
- `SLACK_APP_CLIENT_SECRET` - Slack OAuth client secret
- `SLACK_SIGNING_SECRET` - Slack request signature verification
- `SLACK_BOT_TOKEN` - Slack bot token (if using app-level token)
- `SLACK_APP_TOKEN` - Slack app-level token (for socket mode)

**GitHub**:
- `GITHUB_APP_ID` - GitHub App ID
- `GITHUB_APP_NAME` - GitHub App name
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID (not currently used, legacy)
- `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret (not currently used, legacy)
- `GITHUB_PRIVATE_KEY` - GitHub App private key
- `GITHUB_PRIVATE_KEY_PATH` - Path to private key file
- `GITHUB_WEBHOOK_SECRET` - GitHub webhook signature verification

**Google OAuth**:
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

**Monitoring**:
- `POSTHOG_API_KEY` - PostHog analytics API key

**Trigger.dev**:
- `TRIGGER_PROJECT_REF` - Trigger.dev project reference
- `TRIGGER_SECRET_KEY` - Trigger.dev API key

**OpenAI**:
- `OPENAI_API_KEY` - OpenAI API key for keyword matching

**Resend (Email)**:
- `RESEND_API_KEY` - Resend API key
- `RESEND_FROM_EMAIL` - From email address

**Stripe (Optional)**:
- `PAYMENT_ENABLED` - Enable/disable payment system (set to `false` for open-source mode)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `STRIPE_BASIC_MONTHLY_PRICE_ID` - Basic monthly plan price ID
- `STRIPE_BASIC_ANNUAL_PRICE_ID` - Basic annual plan price ID
- `STRIPE_PRO_MONTHLY_PRICE_ID` - Pro monthly plan price ID
- `STRIPE_PRO_ANNUAL_PRICE_ID` - Pro annual plan price ID

### Frontend (`client/.env.example`)

**Application**:
- `API_URL` - Backend API URL (http://localhost:3003)
- `NEXT_PUBLIC_API_URL` - Public backend API URL

**PostHog**:
- `NEXT_PUBLIC_POSTHOG_KEY` - PostHog public API key
- `NEXT_PUBLIC_POSTHOG_SURVEY_ID` - PostHog survey ID

**Stripe (Optional)**:
- `NEXT_PUBLIC_PAYMENT_ENABLED` - Show/hide billing UI (set to `false` for open-source mode)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID` - Basic monthly plan price ID
- `NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID` - Basic annual plan price ID
- `NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID` - Pro monthly plan price ID
- `NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID` - Pro annual plan price ID

## Development Workflow

### Starting the App

```bash
# Backend (terminal 1)
cd app
npm install
npx prisma generate          # Generate Prisma client
npx prisma migrate dev        # Run migrations
npm run start:dev            # NestJS API on port 3003

# Frontend (terminal 2)
cd client
npm install
npm run dev                  # Next.js on port 3001

# Trigger.dev (terminal 3)
cd app
npx trigger.dev@latest dev   # Background task worker
```

### Local Webhook Testing

Use ngrok or similar to expose localhost:3003 for GitHub webhooks:

```bash
ngrok http 3003
# Configure webhook URL: https://abc123.ngrok.io/api/webhooks/github
# Set CALLBACK_API_HOST to the ngrok URL in .env
```

### Common Commands

```bash
# Database
cd app
npx prisma generate        # Generate Prisma client after schema changes
npx prisma migrate dev     # Create and apply migration
npx prisma studio          # GUI for database
npx prisma db seed         # Run seed script (if configured)

# Testing
cd app
npm test                   # Run Jest tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report

# Linting
cd app && npm run lint     # Backend linting
cd client && npm run lint  # Frontend linting

# Building
cd app && npm run build    # Build backend
cd client && npm run build # Build frontend
```

## Architecture Patterns

### Service Layer Pattern

- **Controllers** handle HTTP requests, validate input, and delegate to services
- **Services** contain business logic, use repositories/Prisma for data access
- **Services** are injected via NestJS dependency injection
- Services are stateless and reusable across modules

**Example**:
```typescript
// Controller
@Controller('api/notification-profiles')
export class NotificationProfileController {
  constructor(private readonly service: NotificationProfileService) {}

  @Get()
  async list(@GetUser() user: User) {
    return this.service.getNotificationProfiles(user.id);
  }
}

// Service
@Injectable()
export class NotificationProfileService {
  constructor(private readonly db: DatabaseService) {}

  async getNotificationProfiles(userId: string) {
    return this.db.notificationProfile.findMany({
      where: { userId, isEnabled: true },
      orderBy: { priority: 'desc' },
    });
  }
}
```

### Repository Pattern (Prisma)

- Prisma as ORM, wrapped in `DatabaseService` (`app/src/database/database.service.ts:1`)
- Database service injected into feature services
- Migrations version-controlled in `app/prisma/migrations/`
- Prisma Client generated from schema, provides type-safe database access

### Background Job Pattern (Trigger.dev v4)

**CRITICAL**: Radar uses Trigger.dev v4 SDK. **NEVER** use v2 API (`client.defineJob()`) as it will break the application.

**V4 Task Pattern**:
```typescript
import { task } from "@trigger.dev/sdk";

export const myTask = task({
  id: "my-task",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: MyPayload) => {
    // Task logic here
    return { success: true };
  },
});
```

**Key Files**:
- `app/trigger/process-github-event.ts:44` - Event processing task
- `app/trigger/daily-digest.ts:46` - Scheduled digest task
- `app/trigger.config.ts:1` - Trigger.dev configuration

**Task Execution Flow**:
1. NestJS controller receives webhook or user action
2. Event stored in database
3. Task queued with `tasks.trigger()` (imported from trigger files)
4. HTTP response returned immediately (don't block)
5. Trigger.dev worker picks up task
6. Task executes asynchronously with retry logic
7. Task result stored/processed

**Service Initialization in Tasks**:
- Tasks run in separate process from NestJS app
- Services must be manually instantiated (no DI container)
- ConfigService must be manually initialized with config objects
- Prisma client must be instantiated and disconnected in `finally` block

**Example** (`app/trigger/process-github-event.ts:16`):
```typescript
const prisma = new PrismaClient();
const configService = new ConfigService();
const analyticsService = new AnalyticsService(configService);
const databaseService = new DatabaseService();
const githubTokenService = new GitHubTokenService(configService, databaseService);
// ... initialize other services

export const processGitHubEvent = task({
  id: "process-github-event",
  run: async (payload) => {
    try {
      // Use services here
    } finally {
      await prisma.$disconnect();
    }
  },
});
```

### Event-Driven Architecture

- GitHub webhooks are source of truth for events
- Events stored in `Event` table with full payload
- Events processed asynchronously via Trigger.dev
- Notification decisions logged for auditability (`reason`, `context` fields)
- PostHog events track webhook reception and notification decisions

### Error Handling

**Global Exception Filter** (`app/src/common/filters/all-exceptions.filter.ts:1`):
- Catches all unhandled exceptions
- Logs error with context
- Returns standardized error response

**Error Tracking Interceptor** (`app/src/common/interceptors/error-tracking.interceptor.ts:1`):
- Intercepts requests and tracks errors in PostHog
- Attaches user context to errors

**Logging Interceptor** (`app/src/common/interceptors/logging.interceptor.ts:1`):
- Logs request/response for all API calls
- Includes timing information

**Service-Level Error Handling**:
- Services catch and log errors
- Services return appropriate error responses
- Analytics events sent for critical errors
- Retry logic in Trigger.dev tasks

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/sign-in/email` - Email/password sign-in
- `POST /api/auth/sign-up/email` - Email/password sign-up
- `GET /api/auth/session` - Get current session
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/callback/google` - Google OAuth callback
- `POST /api/auth/forget-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Users (`/api/users`)
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update current user
- `GET /api/users/me/entitlements` - Get user's feature entitlements
- `POST /api/users/me/entitlements/sync` - Sync entitlements from Stripe (or set open-source entitlements)

### Repositories (`/api/users/repositories`)
- `GET /api/users/repositories` - List user's tracked repositories
- `POST /api/users/repositories/sync` - Sync from GitHub
- `PATCH /api/users/repositories/:id` - Enable/disable repository

### Teams (`/api/users/teams`)
- `GET /api/users/teams` - List user's GitHub teams
- `POST /api/users/teams/sync` - Sync teams from GitHub

### Notification Profiles (`/api/notification-profiles`)
- `GET /api/notification-profiles` - List user's profiles
- `POST /api/notification-profiles` - Create profile
- `GET /api/notification-profiles/:id` - Get profile by ID
- `PATCH /api/notification-profiles/:id` - Update profile
- `DELETE /api/notification-profiles/:id` - Delete profile

### Digest Configs (`/api/digest-configs`)
- `GET /api/digest-configs` - List user's digest configs
- `POST /api/digest-configs` - Create config
- `GET /api/digest-configs/:id` - Get config by ID
- `PATCH /api/digest-configs/:id` - Update config
- `DELETE /api/digest-configs/:id` - Delete config

### Digest Testing (`/api/digest`)
- `POST /api/digest/test/:configId` - Test digest config (sends immediately)

### Slack Integration (`/api/slack`)
- `GET /api/slack/channels` - List user's Slack channels

### GitHub Integration (`/api/github`)
- `GET /api/github/repositories` - List accessible GitHub repositories
- `POST /api/github/installation/sync` - Sync GitHub App installation

### Webhooks (`/api/webhooks`)
- `POST /api/webhooks/github` - GitHub webhook receiver (signature verified)

### Billing (`/api/billing`, hidden in open-source mode)
- `POST /api/billing/create-checkout-session` - Create Stripe checkout session
- `POST /api/billing/create-portal-session` - Create Stripe billing portal session
- `GET /api/billing/subscription` - Get subscription status

### Stripe Webhooks (`/api/stripe-webhooks`)
- `POST /api/stripe-webhooks` - Stripe webhook receiver (signature verified)

### Entitlements Admin (`/api/admin/entitlements`, admin only)
- `POST /api/admin/entitlements/backfill` - Backfill entitlements for all users

## Notification Event Types

### Pull Request Events (`pull_request`)
- `opened` - PR opened
- `closed` - PR closed (check `payload.pull_request.merged` to determine if merged)
- `reopened` - PR reopened
- `review_requested` - Review requested (individual or team)
- `review_request_removed` - Review request removed
- `assigned` - User assigned to PR
- `unassigned` - User unassigned from PR
- `ready_for_review` - PR marked ready for review (draft → ready)

### Pull Request Review Events (`pull_request_review`)
- `submitted` - Review submitted (check `payload.review.state` for approved/changes_requested/commented)
- `dismissed` - Review dismissed

### Pull Request Review Comment Events (`pull_request_review_comment`)
- `created` - Review comment created (line-level comment)

### Issue Events (`issues`)
- `opened` - Issue opened
- `closed` - Issue closed
- `reopened` - Issue reopened
- `assigned` - User assigned to issue
- `unassigned` - User unassigned from issue

### Issue Comment Events (`issue_comment`)
- `created` - Comment created (on issue or PR)

### Special Events (No Slack Notification)
- `membership` - Team membership changed (added/removed) - syncs team memberships
- `installation` - GitHub App installed - syncs installation ID
- `installation_repositories` - Repositories added/removed from installation

**Notification Preferences Mapping** (`app/src/common/constants/notification-preferences.constants.ts:1`):
- `pull_request_opened` → PR opened
- `pull_request_closed` → PR closed (not merged)
- `pull_request_merged` → PR merged
- `pull_request_reopened` → PR reopened
- `pull_request_review_requested` → Review requested
- `pull_request_assigned` → PR assigned
- `pull_request_commented` → PR comment or review comment
- `pull_request_reviewed` → PR review submitted
- `issue_opened` → Issue opened
- `issue_closed` → Issue closed
- `issue_reopened` → Issue reopened
- `issue_assigned` → Issue assigned
- `issue_commented` → Issue comment
- `mention_in_pull_request` → @mentioned in PR
- `mention_in_issue` → @mentioned in issue
- `mute_own_activity` → Don't notify for own actions
- `mute_bot_comments` → Don't notify for bot comments
- `mute_draft_pull_requests` → Don't notify for draft PR activity

## Security Considerations

### Authentication & Authorization
- Better Auth handles session security and CSRF protection
- OAuth tokens encrypted at rest (GitHub, Slack, Google) using `SECRET_KEY`
- Sessions stored in database with expiry
- Auth guards protect endpoints requiring authentication
- Admin guard protects admin-only endpoints

### Webhook Security
- GitHub webhook signature verification (HMAC SHA-256) via guard (`app/src/webhooks/guards/webhook-signature.guard.ts:1`)
- Stripe webhook signature verification (Stripe SDK)
- Only process webhooks with valid signatures

### Rate Limiting
- @nestjs/throttler configured for 100 requests/min per IP (`app/src/app.module.ts:46`)
- Applies to all API endpoints

### Database Security
- Prisma parameterized queries prevent SQL injection
- Sensitive fields encrypted (tokens, keys)
- Connection pooling for performance and security

### GitHub App Permissions
- Principle of least privilege
- Only request necessary permissions
- Repository permissions: Read access to code, issues, pull requests, metadata
- Organization permissions: Read access to members and teams

### Environment Variables
- Sensitive values in `.env` files (not committed)
- `.env.example` templates for documentation
- Production: Use secrets management (AWS Secrets Manager, HashiCorp Vault)

## Performance Optimizations

### Backend
- Trigger.dev handles high webhook volume without blocking API
- Database indexes on frequently queried fields (`userId`, `githubId`, `repositoryId`, `priority`)
- Prisma connection pooling for concurrent task processing
- Lazy loading of related entities where appropriate
- Caching of GitHub API responses (not yet implemented, see ROADMAP)

### Frontend
- Next.js App Router for automatic code splitting
- React Context for state management (minimal re-renders)
- Lazy loading of heavy components
- Optimized images with Next.js Image component

### Database
- Indexes on foreign keys and commonly filtered fields
- Composite indexes on frequently combined filters
- JSONB columns for flexible data storage (notifications, preferences)

### Trigger.dev
- Scheduled tasks run every 15 minutes (configurable)
- Tasks have retry logic with exponential backoff
- Tasks timeout after max duration (configurable per task)
- Parallel task execution for independent operations

## Testing

### Unit Tests
- Jest test framework (`app/package.json:16`)
- Test files co-located with source (e.g., `notification.service.spec.ts`)
- Focus on critical business logic:
  - Notification decision engine
  - Watching reasons determination
  - Keyword matching
  - Profile matching

**Key Test Files**:
- `app/src/notifications/watching-reasons.spec.ts:1` - Watching reasons logic (not yet created based on existing CLAUDE.md reference, but tests exist)
- `app/src/webhooks/webhook-flow-simulation.spec.ts:1` - Webhook flow simulation (not yet created based on existing CLAUDE.md reference)
- `app/src/trigger/process-github-event.spec.ts:1` - Event processing tests
- `app/src/trigger/slack-message-formatting.spec.ts:1` - Slack message formatting tests
- `app/src/trigger/notification-settings-logic.spec.ts:1` - Notification settings logic tests

### Integration Tests
- E2E tests with Supertest (`app/test/jest-e2e.json`)
- Test API endpoints end-to-end
- Use test database for isolation

### Running Tests
```bash
cd app
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # E2E tests
```

## Common Development Tasks

### Adding a New GitHub Event Type

1. **Add event handling** to `app/trigger/process-github-event.ts:100` in `processEventNotifications()`:
   ```typescript
   const eventTypeMap = {
     'pull_request': 'pull_request' as const,
     'new_event': 'new_event' as const, // Add here
   };
   ```

2. **Map to notification trigger** in `app/src/notifications/services/notification.service.ts:612` in `getTriggerFromEvent()`:
   ```typescript
   case 'new_event':
     if (action === 'some_action') return NotificationTrigger.SOME_TRIGGER;
     break;
   ```

3. **Add event preference** to `NotificationPreferences` type in `app/src/common/types/user.types.ts:1`

4. **Add UI constants** to `client/src/constants/notification-preferences.constants.ts:1`

5. **Update preference matching** in `app/src/notifications/services/notification.service.ts:898` in `getEventPreference()`

6. **Add Slack message formatter** to `app/trigger/process-github-event.ts:434` in `createSlackMessage()`

### Creating a New Notification Profile Feature

1. **Update schema**: Add field to `NotificationProfile` model in `app/prisma/schema.prisma:187`
2. **Create migration**: Run `npx prisma migrate dev`
3. **Update types**: Add field to `NotificationProfileWithMeta` type in `app/src/common/types/notification-profile.types.ts:1`
4. **Update service**: Add handling in `app/src/notifications/services/notification-profile.service.ts:1`
5. **Update decision engine**: Add logic in `app/src/notifications/services/notification.service.ts:144` in `checkProfileMatch()`
6. **Update DTOs**: Add validation in `app/src/common/dtos/notification-profile.dto.ts:1`
7. **Update frontend form**: Add input in `client/src/components/NotificationProfileForm.tsx:1`

### Debugging Notifications

1. **Check notification record** in database:
   - `Notification` table has `reason` and `context` fields
   - `context` includes profile info, watching reasons, matched keywords
2. **Review Trigger.dev logs** in dashboard or dev CLI output
3. **Check PostHog events** for webhook tracking and notification decisions
4. **Use test webhook** in GitHub repo settings to replay events
5. **Enable debug logging**: Set `LOG_LEVEL=debug` in `.env`

### Adding a New Service

1. **Create service file**: `app/src/feature/feature.service.ts`
   ```typescript
   import { Injectable, Logger } from '@nestjs/common';
   import { DatabaseService } from '../database/database.service';

   @Injectable()
   export class FeatureService {
     private readonly logger = new Logger(FeatureService.name);

     constructor(private readonly db: DatabaseService) {}

     async doSomething() {
       // Implementation
     }
   }
   ```

2. **Create module**: `app/src/feature/feature.module.ts`
   ```typescript
   import { Module } from '@nestjs/common';
   import { FeatureService } from './feature.service';
   import { FeatureController } from './feature.controller';
   import { DatabaseModule } from '../database/database.module';

   @Module({
     imports: [DatabaseModule],
     controllers: [FeatureController],
     providers: [FeatureService],
     exports: [FeatureService],
   })
   export class FeatureModule {}
   ```

3. **Import in app module**: Add to `app/src/app.module.ts:1` imports array

### Creating a Frontend Page

1. **Create page file**: `client/src/app/feature/page.tsx`
   ```typescript
   'use client';

   import { useEffect, useState } from 'react';

   export default function FeaturePage() {
     return (
       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         <h1 className="text-3xl font-bold mb-6">Feature</h1>
         {/* Content */}
       </div>
     );
   }
   ```

2. **Add navigation** (if needed): Update `client/src/app/settings/layout.tsx:1` or relevant layout

3. **Create API client** (if needed): Add functions to fetch data from backend

## Code Style & Conventions

### TypeScript
- Use strict mode (`strict: true` in `tsconfig.json`)
- Prefer `interface` over `type` for object shapes
- Use `const` for immutable values, `let` for mutable
- Avoid `any`, use `unknown` or proper types
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### NestJS
- Use decorators for dependency injection (`@Injectable()`, `@Controller()`, etc.)
- Organize by feature/domain (not by layer)
- Services are stateless
- Controllers handle HTTP, services handle business logic
- Use DTOs for validation (`class-validator`)
- Use guards for authentication/authorization
- Use interceptors for cross-cutting concerns (logging, error tracking)
- Use filters for error handling

### React/Next.js
- Use functional components with hooks
- Use `'use client'` directive for client components
- Prefer server components when possible (default in App Router)
- Use TypeScript for all components
- Extract reusable logic into custom hooks
- Keep components small and focused
- Use Tailwind utility classes for styling

### Naming Conventions
- **Files**: kebab-case (`notification-profile.service.ts`)
- **Classes**: PascalCase (`NotificationProfileService`)
- **Interfaces**: PascalCase, no "I" prefix (`User`, not `IUser`)
- **Functions**: camelCase (`getNotificationProfiles`)
- **Variables**: camelCase (`userId`, `notificationProfile`)
- **Constants**: UPPER_SNAKE_CASE (`EVENT_COLORS`, `MAX_RETRIES`)
- **Database columns**: snake_case (`user_id`, `notification_preferences`)
- **API endpoints**: kebab-case (`/notification-profiles`, `/digest-configs`)
- **Environment variables**: UPPER_SNAKE_CASE (`DATABASE_URL`, `GITHUB_CLIENT_ID`)

### Error Handling
- Use try-catch in async functions
- Log errors with context (userId, eventId, etc.)
- Return meaningful error messages
- Use NestJS exception filters for HTTP errors
- Track critical errors in PostHog

### Logging
- Use NestJS Logger (`Logger.log()`, `Logger.error()`, etc.)
- Include context in logs (userId, eventId, operation)
- Log at appropriate levels (debug, log, warn, error)
- Use structured logging for production

## Monitoring & Analytics

### PostHog Events
- `webhook_received` - GitHub webhook ingestion
- `notification_sent` - Slack message delivered
- `notification_skipped` - Decision not to notify (with reason)
- `notification_decision` - Notification decision made (with profile info)
- `digest_generated` - Scheduled digest sent
- `user_action` - User settings changes
- `config_created` - Profile/digest config changes
- `error_occurred` - Critical errors

### Logging
- Structured logging with NestJS Logger
- Request/response logging via LoggingInterceptor
- Error tracking via ErrorTrackingInterceptor
- Trigger.dev task execution logs (viewable in Trigger.dev dashboard)

### Error Tracking
- PostHog integration for error events
- Error context includes user info, operation, category
- Critical errors logged with full stack trace

## Deployment

### Production Considerations

**Environment**:
- Set `NODE_ENV=production`
- Use managed PostgreSQL with connection pooling
- Configure Trigger.dev production environment
- Set proper CORS origins for frontend (`FRONTEND_URL`)
- Enable Better Auth production mode
- Use secrets management (AWS Secrets Manager, Vault, Doppler)

**Database**:
- Run migrations: `npx prisma migrate deploy`
- Set up backups and replication
- Configure connection pooling (pgBouncer recommended)

**Monitoring**:
- Set up monitoring/alerting (Sentry, Datadog, New Relic)
- Configure log aggregation (CloudWatch, Loggly, Papertrail)
- Monitor Trigger.dev task execution
- Track PostHog events for analytics

**Scaling**:
- Horizontal scaling: Run multiple NestJS instances behind load balancer
- Trigger.dev workers scale automatically
- Database read replicas for heavy read workloads
- Redis for caching (not yet implemented, see ROADMAP)

**Security**:
- Use HTTPS for all endpoints
- Configure CSP headers
- Enable rate limiting
- Use secure cookies (`secure: true`, `httpOnly: true`, `sameSite: 'strict'`)
- Rotate secrets regularly

### Docker Support
- Dockerfiles provided for backend and frontend (not yet created based on existing structure)
- Docker Compose for local development (not yet created)
- Production: Use Kubernetes, ECS, or other container platform

### Open Source Mode
- Set `PAYMENT_ENABLED=false` and `NEXT_PUBLIC_PAYMENT_ENABLED=false`
- Skip Stripe configuration entirely
- All users get full feature access
- See `docs/OPEN_SOURCE_MODE.md:1` for complete guide

## Important Notes for Developers

### Trigger.dev v4 ONLY
- **ALWAYS** use `@trigger.dev/sdk` with `task()` function
- **NEVER** use `client.defineJob()` (v2 API - breaks application)
- Tasks export `task()` directly, imported where needed
- Use `tasks.trigger()` to queue tasks (not `client.sendEvent()`)

**Correct V4 Pattern**:
```typescript
// Define task
export const myTask = task({
  id: "my-task",
  run: async (payload) => { /* ... */ },
});

// Trigger task (in controller or service)
import { tasks } from "@trigger.dev/sdk/v3";
await tasks.trigger("my-task", payload);
```

### Better Auth Integration
- Uses NestJS module wrapper: `@thallesp/nestjs-better-auth`
- Configuration in `app/src/auth/auth.config.ts:1`
- Google OAuth provider configured
- Email/password with reset functionality
- Session tokens stored in database
- Encrypted credentials in User table

### Webhook Security
- GitHub webhook signature verification required (HMAC SHA-256)
- Stripe webhook signature verification required
- Guards enforce signature validation
- See `app/src/webhooks/guards/webhook-signature.guard.ts:1`

### Database Migrations
- Always use Prisma migrations: `npx prisma migrate dev`
- Never manually edit database schema
- Migration files version-controlled in `app/prisma/migrations/`
- Run migrations in production: `npx prisma migrate deploy`

### Token Management
- GitHub tokens encrypted at rest using `SECRET_KEY`
- Slack tokens encrypted at rest
- Token refresh handled automatically by `GitHubTokenService`
- Token validity checked before API calls

### Service Initialization in Trigger.dev Tasks
- Services must be manually instantiated (no NestJS DI container)
- ConfigService requires manual initialization with config objects
- Prisma client must be disconnected in `finally` block
- See `app/trigger/process-github-event.ts:16` and `app/trigger/daily-digest.ts:20` for examples

## Roadmap

See `ROADMAP.md:1` for complete roadmap.

**Next**:
- Assets + prep for Slack marketplace
- Resend + password reset emails ✅ (completed)
- Google OAuth ✅ (completed)
- Better dark mode
- Website updates
- Slack / GitHub user connecting to @ in notifications
- Default digest and notification profile for easier onboarding
- Default entitlements

**Later**:
- Email verifications
- Utilizing labels/tags for filtering
- Look into duplicate notifications from PR comments
- GitHub Discussions support
- Better Slack homepage
- Settings to filter digest by PR status
- Better digest logic to find PRs (looking back more than just 100 PRs)
- Storing PRs so we have better state on them for notifications
- Better support for users who have one GitHub account but use multiple workspaces
- More clarity on connecting GitHub app (someone else on your team might have already done it)
- More sources than just GitHub
- User/team stats
- Team support (already partially implemented)

## Resources

- [Trigger.dev v4 Docs](https://trigger.dev/docs)
- [Better Auth Docs](https://betterauth.io)
- [Slack API Docs](https://api.slack.com)
- [GitHub Webhooks Docs](https://docs.github.com/webhooks)
- [Prisma Docs](https://prisma.io/docs)
- [NestJS Docs](https://nestjs.com)
- [Next.js Docs](https://nextjs.org/docs)
- [Resend Docs](https://resend.com/docs)
- [PostHog Docs](https://posthog.com/docs)
- [Stripe Docs](https://stripe.com/docs)

## Getting Help

- Check existing documentation in `docs/` directory
- Review test files for usage examples
- Examine existing similar features in codebase
- GitHub Issues for bug reports and feature requests
- Read existing code comments for implementation details

---

**Last Updated**: 2025-01-16

This file describes the Radar application architecture, key features, and development patterns to help Claude Code and other developers understand and work with the codebase effectively.
