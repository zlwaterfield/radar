# Radar - GitHub to Slack Integration Platform

## Overview

**Radar** is a sophisticated Slack application that connects GitHub activity to team Slack workspaces, delivering intelligent, real-time notifications about pull requests, issues, reviews, and discussions. The system uses advanced AI-powered filtering and flexible notification profiles to ensure teams stay informed without notification fatigue.

## What Does This App Do?

### Core Functionality

1. **Real-Time GitHub Notifications**: Automatically sends Slack notifications when GitHub events occur (PRs opened, reviews submitted, issues created, comments added, etc.)

2. **Smart Notification Routing**: Uses a priority-based notification profile system to intelligently decide who should be notified, when, and where (DM vs channel)

3. **AI-Powered Keyword Matching**: Integrates OpenAI to intelligently match keywords in PR/issue content, enabling semantic filtering beyond simple text matching

4. **Digest Summaries**: Generates scheduled digest summaries of GitHub activity, configurable per user with different schedules, scopes (user vs team), and delivery preferences

5. **Team Management**: Syncs GitHub team memberships and enables team-scoped notifications and digests

6. **Flexible Configuration**: Users can create multiple notification profiles and digest configurations with granular control over repositories, event types, delivery channels, and schedules

### How It Works

```
GitHub Webhook → NestJS API → Trigger.dev Background Task → Notification Decision Engine → Slack Message
                      ↓                                              ↓
                Database (Event Storage)              (Profile-based routing with AI)
```

**Flow:**
1. User configures notification profiles and digest settings via Next.js frontend
2. GitHub sends webhooks to NestJS backend when events occur in tracked repositories
3. Webhook validated, event stored in PostgreSQL database, Trigger.dev task queued
4. Background worker processes event through notification profile system:
   - Checks user's notification profiles (ordered by priority)
   - Evaluates watching reasons (author, reviewer, assignee, mentioned, team involvement)
   - Applies keyword matching with optional LLM analysis
   - Determines delivery target (DM or specific channel)
5. Slack message sent to appropriate destination with rich formatting
6. Scheduled digests generated via Trigger.dev cron tasks, summarizing activity

## Tech Stack

### Backend
- **Framework**: NestJS (TypeScript) - modular architecture with dependency injection
- **Authentication**: Better Auth with GitHub OAuth integration
- **Database**: PostgreSQL with Prisma ORM
- **Background Jobs**: Trigger.dev v4 SDK for webhook processing and scheduled digests
- **API**: RESTful API with `/api` prefix, comprehensive validation with class-validator

### Frontend
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom components
- **State Management**: React Context for auth and user state
- **Port**: 3001 (dev mode)

### Integrations
- **Slack API**: WebClient for sending messages, conversations API for DMs/channels
- **GitHub API**: Octokit REST client for repository/team data
- **GitHub Webhooks**: Signature verification, comprehensive event handling
- **OpenAI**: GPT-4 for semantic keyword matching in notification content
- **PostHog**: Analytics and event tracking

## Project Structure

```
/radar
├── app/                           # NestJS Backend (port 3000)
│   ├── src/
│   │   ├── auth/                  # Better Auth integration, GitHub OAuth
│   │   ├── github/                # GitHub API services (repos, teams, tokens)
│   │   ├── slack/                 # Slack API services (messaging, channels)
│   │   ├── webhooks/              # GitHub webhook handlers & validation
│   │   ├── notifications/         # Core notification logic
│   │   │   ├── services/
│   │   │   │   ├── notification.service.ts          # Main notification decision engine
│   │   │   │   ├── notification-profile.service.ts  # Profile management CRUD
│   │   │   │   └── llm-analyzer.service.ts          # OpenAI keyword matching
│   │   │   └── controllers/       # REST API endpoints
│   │   ├── digest/                # Digest configuration & services
│   │   ├── users/                 # User management, settings, teams
│   │   ├── analytics/             # PostHog integration
│   │   ├── database/              # Prisma service wrapper
│   │   ├── integrations/          # GitHub integration sync services
│   │   └── common/                # Shared filters, interceptors, guards
│   ├── trigger/                   # Trigger.dev v4 tasks
│   │   ├── process-github-event.ts  # Main event processing task
│   │   └── daily-digest.ts          # Scheduled digest generation
│   └── prisma/
│       └── schema.prisma          # Complete database schema
│
├── client/                        # Next.js Frontend (port 3001)
│   ├── src/
│   │   ├── app/                   # App Router pages
│   │   │   ├── auth/             # Auth callback handling
│   │   │   ├── settings/         # User settings pages
│   │   │   │   ├── repositories/ # Repo management
│   │   │   │   ├── notifications/ # Notification profile UI
│   │   │   │   ├── digest/       # Digest configuration UI
│   │   │   │   └── teams/        # Team management
│   │   │   └── onboarding/       # New user onboarding flow
│   │   ├── components/           # Reusable React components
│   │   │   ├── NotificationProfileManager.tsx
│   │   │   ├── NotificationProfileForm.tsx
│   │   │   └── DigestConfigForm.tsx
│   │   ├── contexts/             # React Context providers
│   │   └── constants/            # UI constants and configuration
│
├── docs/                         # Setup documentation
│   ├── slack_setup.md
│   └── github_setup.md
│
└── claude-rules/                 # Development guidelines
    └── trigger-rules.md          # Trigger.dev v4 patterns
```

## Key Features Explained

### 1. Notification Profiles (Advanced)

**What**: Flexible, priority-based notification configurations that control when and how users receive GitHub notifications.

**Why**: Different types of GitHub events require different levels of attention. Direct actions (review requests, assignments) are urgent, while activity updates are informational. Users may want work notifications in a team channel but personal notifications via DM.

**How It Works**:
- Users create multiple profiles (e.g., "Urgent Reviews", "Team PRs", "My Contributions")
- Each profile has:
  - **Priority**: Higher priority profiles evaluated first
  - **Scope**: User-wide or team-specific filtering
  - **Repository Filter**: All repos or selected subset
  - **Event Preferences**: Granular control over PR/issue events
  - **Keywords**: Custom keyword list with optional LLM matching
  - **Delivery**: DM or specific Slack channel
- When event occurs, profiles processed in priority order until match found
- First matching profile determines notification behavior

**Key Files**:
- `app/src/notifications/services/notification-profile.service.ts:1` - Profile CRUD operations
- `app/src/notifications/services/notification.service.ts:1` - Profile-based decision engine
- `client/src/components/NotificationProfileManager.tsx:1` - Profile management UI
- `client/src/components/NotificationProfileForm.tsx:1` - Profile creation/editing form

### 2. Multiple Digest Configurations

**What**: Users can create multiple scheduled digest summaries with different settings.

**Why**: Different contexts require different digest views. A user might want a personal daily digest of all activity at 9 AM, plus a weekly team digest on Mondays.

**How It Works**:
- Each digest config specifies:
  - **Schedule**: Time, timezone, days of week
  - **Scope**: User or team-specific activity
  - **Repository Filter**: All or selected repos
  - **Delivery**: DM or channel
- Trigger.dev cron task runs every 15 minutes, checks for due digests
- Generates summary of PRs/issues created or updated since last digest
- Sends formatted Slack message to configured destination

**Key Files**:
- `app/src/digest/digest-config.service.ts:1` - Digest CRUD operations
- `app/trigger/daily-digest.ts:1` - Scheduled digest generation task
- `client/src/app/settings/digest/page.tsx:1` - Digest configuration UI

### 3. Team Management & Syncing

**What**: Automatic synchronization of GitHub team memberships for team-scoped features.

**Why**: GitHub teams represent organizational structure. Users should be able to filter notifications and digests based on team involvement without manual configuration.

**How It Works**:
- GitHub `membership` webhook updates team memberships automatically
- Manual sync available via API endpoint
- Team data stored in `UserTeam` table with team slug, name, organization
- Used for filtering in notification profiles and digests (scopeType: "team")

**Key Files**:
- `app/src/users/services/user-teams.service.ts:1` - Team sync and management
- `app/src/webhooks/services/webhooks.service.ts:1` - Membership webhook handler

### 4. AI-Powered Keyword Matching

**What**: Optional LLM-based semantic keyword matching in notification content.

**Why**: Simple substring matching misses semantic relevance. If a user wants notifications about "authentication", they should also match "login issues" or "OAuth problems".

**How It Works**:
- User enables `keywordLLMEnabled` on notification profile
- When processing event, system sends PR/issue title+body to OpenAI
- AI determines if content semantically matches any profile keywords
- Returns matched keywords with confidence scores
- Decision logged in notification context for debugging

**Key Files**:
- `app/src/notifications/services/llm-analyzer.service.ts:1` - OpenAI integration
- `app/src/notifications/services/notification.service.ts:1` - Keyword matching logic

### 5. Watching Reasons

**What**: System for determining why a user should receive a notification about a PR/issue.

**Why**: Users care about different events for different reasons. You want all updates on PRs you authored, but only review requests for others' PRs.

**Reasons**:
- `AUTHOR` - User created the PR/issue
- `REVIEWER` - Explicitly requested for review
- `ASSIGNED` - Assigned to the PR/issue
- `MENTIONED` - @mentioned in content
- `TEAM_ASSIGNED` - User's team assigned
- `TEAM_MENTIONED` - User's team @mentioned
- `TEAM_REVIEWER` - User's team requested for review
- `SUBSCRIBED` - GitHub subscription
- `MANUAL` - Manually added

**Key Files**:
- `app/src/notifications/services/notification.service.ts:1` - Watching reasons evaluation
- `app/src/notifications/watching-reasons.spec.ts:1` - Comprehensive test coverage

## Database Schema (Key Tables)

### User
Core user table with GitHub and Slack OAuth tokens (encrypted), profile data, and integration status.

### NotificationProfile
Flexible notification configurations with priority, scope, repository filters, event preferences, keywords, and delivery settings.

### DigestConfig
Multiple digest configurations per user with schedule (cron-like), scope, repository filters, and delivery settings.

### UserRepository
Tracks which GitHub repositories each user has enabled for notifications.

### UserTeam
GitHub team memberships synced from webhooks, used for team-scoped features.

### Event
Stores all received GitHub webhook events with full payload, processing status, and metadata.

### Notification
Records of sent notifications with reason/context for debugging, linked to events.

### UserDigest
History of sent digests with counts and delivery info, linked to digest configs.

## Environment Variables

### Backend (app/.env)
- `DATABASE_URL` - PostgreSQL connection string
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - GitHub OAuth app
- `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` - Slack app credentials
- `TRIGGER_SECRET_KEY` - Trigger.dev API key
- `OPENAI_API_KEY` - OpenAI for keyword matching
- `POSTHOG_API_KEY` - Analytics tracking
- `BETTER_AUTH_SECRET` - Auth encryption key
- `GITHUB_WEBHOOK_SECRET` - Webhook signature verification

### Frontend (client/.env.local)
- `NEXT_PUBLIC_API_URL` - Backend API URL (http://localhost:3000)
- `BETTER_AUTH_SECRET` - Must match backend
- `BETTER_AUTH_URL` - Auth callback URL

## Development Workflow

### Starting the App

```bash
# Backend (terminal 1)
cd app
npm run start:dev          # NestJS API on port 3000

# Frontend (terminal 2)
cd client
npm run dev               # Next.js on port 3001

# Trigger.dev (terminal 3)
cd app
npx trigger.dev@latest dev  # Background task worker
```

### Local Webhook Testing

Use ngrok or similar to expose localhost:3000 for GitHub webhooks:

```bash
ngrok http 3000
# Configure webhook URL: https://abc123.ngrok.io/api/webhooks/github
```

### Common Commands

```bash
# Database
cd app
npx prisma generate        # Generate Prisma client after schema changes
npx prisma migrate dev     # Create and apply migration
npx prisma studio          # GUI for database

# Testing
cd app
npm test                   # Run Jest tests
npm run test:watch         # Watch mode

# Linting
cd app && npm run lint     # Backend linting
cd client && npm run lint  # Frontend linting
```

## Key API Endpoints

### Authentication
- `POST /api/auth/sign-in` - GitHub OAuth initiation
- `GET /api/auth/callback/github` - OAuth callback handler
- `GET /api/auth/session` - Get current session

### Repositories
- `GET /api/repositories` - List user's tracked repositories
- `POST /api/repositories/sync` - Sync from GitHub
- `PATCH /api/repositories/:id` - Enable/disable repository

### Notification Profiles
- `GET /api/notification-profiles` - List user's profiles
- `POST /api/notification-profiles` - Create profile
- `PATCH /api/notification-profiles/:id` - Update profile
- `DELETE /api/notification-profiles/:id` - Delete profile

### Digest Configs
- `GET /api/digest-configs` - List user's digest configs
- `POST /api/digest-configs` - Create config
- `PATCH /api/digest-configs/:id` - Update config
- `DELETE /api/digest-configs/:id` - Delete config

### Teams
- `GET /api/users/teams` - List user's GitHub teams
- `POST /api/users/teams/sync` - Sync teams from GitHub

### Webhooks
- `POST /api/webhooks/github` - GitHub webhook receiver (signature verified)

## Notification Event Types

### Pull Request Events
- `pull_request` (opened, closed, reopened, ready_for_review, review_requested, assigned)
- `pull_request_review` (approved, changes_requested, commented)
- `pull_request_review_comment` (created)

### Issue Events
- `issues` (opened, closed, reopened, assigned)
- `issue_comment` (created) - handles both issue and PR comments

### Special Events (No Slack Notification)
- `membership` (added, removed) - syncs team memberships
- `installation` (created) - syncs installation ID

**See GITHUB_EVENTS.md for complete event mapping and user settings.**

## Important Notes for Developers

### Trigger.dev v4 ONLY
- **ALWAYS** use `@trigger.dev/sdk` with `task()` function
- **NEVER** use `client.defineJob()` (v2 API - breaks application)
- See `claude-rules/trigger-rules.md:1` for patterns and best practices

### Better Auth Integration
- Uses NestJS module wrapper: `@thallesp/nestjs-better-auth`
- GitHub OAuth provider configured with required scopes
- Session tokens stored in database, encrypted credentials in User table

### Webhook Security
- GitHub webhook signature verification required (HMAC SHA-256)
- See `app/src/webhooks/guards/webhook-signature.guard.ts:1`

### Error Handling
- Global exception filter: `app/src/common/filters/all-exceptions.filter.ts:1`
- Error tracking interceptor: `app/src/common/interceptors/error-tracking.interceptor.ts:1`
- PostHog analytics on errors and key events

### Testing
- Comprehensive test coverage for notification logic
- Webhook flow simulation tests: `app/src/webhooks/webhook-flow-simulation.spec.ts:1`
- Watching reasons tests: `app/src/notifications/watching-reasons.spec.ts:1`

## Common Development Tasks

### Adding a New GitHub Event Type

1. Add event handling to `app/trigger/process-github-event.ts:98` in `processEventNotifications()`
2. Map to notification preference in `app/src/notifications/services/notification.service.ts:1`
3. Add UI constants to `client/src/constants/notification-preferences.constants.ts:1`
4. Update `GITHUB_EVENTS.md` documentation

### Creating a New Notification Profile Feature

1. Update `NotificationProfile` schema in `app/prisma/schema.prisma:180`
2. Run migration: `npx prisma migrate dev`
3. Update service: `app/src/notifications/services/notification-profile.service.ts:1`
4. Update decision engine: `app/src/notifications/services/notification.service.ts:1`
5. Update frontend form: `client/src/components/NotificationProfileForm.tsx:1`

### Debugging Notifications

1. Check notification record in database (includes `reason` and `context` fields)
2. Review Trigger.dev logs in dashboard or dev CLI output
3. Check PostHog events for webhook tracking
4. Use test webhook in GitHub repo settings to replay events

## Architecture Patterns

### Service Layer Pattern
- Controllers handle HTTP, delegate to services
- Services contain business logic, use repositories/Prisma
- Services injected via NestJS dependency injection

### Repository Pattern
- Prisma as ORM, wrapped in DatabaseService
- Database service injected into feature services
- Migrations version-controlled in `app/prisma/migrations/`

### Background Job Pattern
- Long-running tasks (webhook processing, digests) use Trigger.dev
- Queue task with `tasks.trigger()`, don't block HTTP response
- Retry logic configured per task (max attempts, backoff)

### Event-Driven Architecture
- GitHub webhooks are source of truth for events
- Events stored in database, processed asynchronously
- Notification decisions logged for auditability

## Security Considerations

- OAuth tokens encrypted at rest (GitHub, Slack)
- Webhook signature verification prevents unauthorized events
- Rate limiting via NestJS Throttler (100 req/min per IP)
- Better Auth handles session security and CSRF
- GitHub App permissions follow principle of least privilege

## Performance Optimizations

- Trigger.dev handles high webhook volume without blocking API
- Database indexes on frequently queried fields (userId, githubId, repositoryId)
- Prisma connection pooling for concurrent task processing
- Slack message batching for digest delivery
- Cron tasks scheduled to avoid peak times

## Monitoring & Analytics

### PostHog Events
- `webhook_received` - GitHub webhook ingestion
- `notification_sent` - Slack message delivered
- `notification_skipped` - Decision not to notify (with reason)
- `digest_generated` - Scheduled digest sent
- `user_action` - User settings changes
- `config_created` - Profile/digest config changes

### Logging
- Structured logging with NestJS Logger
- Request/response logging via LoggingInterceptor
- Error tracking via ErrorTrackingInterceptor
- Trigger.dev task execution logs

## Deployment

### Production Considerations
- Set `NODE_ENV=production`
- Use managed PostgreSQL (connection pooling required)
- Configure Trigger.dev production environment
- Set proper CORS origins for frontend
- Enable Better Auth production mode
- Use secrets management (AWS Secrets Manager, Vault)
- Set up monitoring/alerting (Sentry, Datadog)

### Docker Support
- Dockerfiles provided for backend and frontend
- Docker Compose for local development
- Production: Use Kubernetes or container platform

## Roadmap

See `ROADMAP.md:1` for planned features and improvements.

## Resources

- [Trigger.dev v4 Docs](https://trigger.dev/docs)
- [Better Auth Docs](https://betterauth.io)
- [Slack API Docs](https://api.slack.com)
- [GitHub Webhooks Docs](https://docs.github.com/webhooks)
- [Prisma Docs](https://prisma.io/docs)
- [NestJS Docs](https://nestjs.com)
- [Next.js Docs](https://nextjs.org/docs)

## Getting Help

- Check existing documentation in `docs/` directory
- Review test files for usage examples
- Examine existing similar features in codebase
- GitHub Issues for bug reports and feature requests
- Read `claude-rules/` for development patterns

---

**Last Updated**: 2025-10-12

This file describes the Radar application architecture, key features, and development patterns to help Claude Code and other developers understand and work with the codebase effectively.
