# RADAR - GitHub to Slack Integration Platform

## 📋 TLDR
**Radar** is a Slack application that connects GitHub activity to team Slack workspaces, delivering intelligent, real-time notifications about PRs, issues, reviews, and discussions. Built with a NestJS backend, Next.js frontend, and powered by Trigger.dev for background job processing.

## 🏗️ Architecture Overview

### Tech Stack
- **Backend**: NestJS (TypeScript) with Better Auth authentication
- **Frontend**: Next.js 14 with Tailwind CSS (port 3001)
- **Database**: Prisma ORM with PostgreSQL
- **Background Jobs**: Trigger.dev v4 SDK for webhook processing and digests
- **Integrations**: Slack API, GitHub API & Webhooks, OpenAI (keyword matching)
- **Monitoring**: PostHog analytics

### Project Structure
```
/app/                    # NestJS Backend (main API server)
├── src/
│   ├── auth/           # Better Auth integration
│   ├── github/         # GitHub API services
│   ├── slack/          # Slack API services
│   ├── webhooks/       # GitHub webhook handlers
│   ├── notifications/  # LLM-powered notification logic
│   ├── digest/         # Daily/weekly digest services
│   ├── users/          # User management & settings
│   └── trigger/        # Background job tests
├── trigger/            # Trigger.dev v4 tasks
└── prisma/             # Database schema & migrations

/client/                # Next.js Frontend (user dashboard)
├── src/app/            # App router pages
├── components/         # Reusable React components
└── contexts/           # Auth & state management

/claude-rules/          # Development guidelines
└── trigger-rules.md    # Trigger.dev v4 patterns & best practices
```

### Key Features
- **Smart Notifications**: Role-based routing (author/reviewer/assignee) with flexible notification profiles
- **Real-time Processing**: GitHub webhooks → Trigger.dev → Slack delivery
- **Keyword Matching**: AI-powered OpenAI integration for intelligent filtering
- **Multiple Digest System**: Configurable digest configurations per user with different schedules, scopes, and delivery options
- **Notification Profiles**: Flexible notification configurations with priority-based processing and keyword matching
- **Team Management**: GitHub team syncing with team-scoped notifications and digests
- **User Management**: GitHub OAuth, repository management, and granular settings control

### Development Commands
```bash
# Backend (NestJS)
cd app/
npm run start:dev    # Development server
npm run test         # Run tests
npm run lint         # ESLint
npm run build        # Production build

# Frontend (Next.js)
cd client/
npm run dev          # Development server (port 3001)
npm run build        # Production build
```

### Important Notes
- **Trigger.dev v4**: Always use `@trigger.dev/sdk` with `task()` function, NEVER `client.defineJob`
- **Authentication**: Uses Better Auth with GitHub OAuth integration
- **API Prefix**: All backend routes prefixed with `/api`
- **Webhook Security**: GitHub webhook signature verification implemented
- **Testing**: Jest for unit tests, comprehensive test coverage for critical flows

## 📊 New Features & Architecture

### Multiple Digest Configurations
Users can now create multiple digest configurations with:
- **Custom Schedules**: Different times and timezones for each digest
- **Scoped Content**: User-wide or team-specific activity filtering
- **Delivery Options**: Direct messages or specific Slack channels
- **Repository Filtering**: All repositories or selected subset per digest
- **Individual Control**: Enable/disable each configuration independently

**Database Schema:**
- `DigestConfig` table: Stores multiple digest configurations per user
- `UserDigest` table: Enhanced with `digestConfigId` for tracking which config generated each digest
- `UserTeam` table: GitHub team memberships for team-scoped digests

**Key Files:**
- `app/src/digest/digest-config.service.ts`: CRUD operations for digest configurations
- `app/src/digest/digest-config.controller.ts`: REST API endpoints
- `app/trigger/daily-digest.ts`: Updated to process multiple configs per user
- `client/src/app/settings/digest/page.tsx`: Complete UI rebuild with multi-config support

### Flexible Notification Profiles
Advanced notification system with:
- **Priority-Based Processing**: Higher priority profiles processed first
- **Keyword Matching**: Per-profile keyword lists with LLM integration toggle
- **Granular Preferences**: Individual event type toggles per profile
- **Scope Control**: User or team-based notification filtering
- **Delivery Flexibility**: DM or channel delivery per profile

**Database Schema:**
- `NotificationProfile` table: Flexible notification configurations
- Enhanced notification preferences with profile-based routing

**Key Files:**
- `app/src/notifications/services/notification-profile.service.ts`: Profile management
- `app/src/notifications/controllers/notification-profile.controller.ts`: REST API
- `client/src/components/NotificationProfileManager.tsx`: UI for profile management

### Team Management System
GitHub team integration with:
- **Automatic Syncing**: GitHub team memberships synced to `UserTeam` table
- **Team-Scoped Notifications**: Filter notifications based on team membership
- **Team-Scoped Digests**: Create digests for specific team activity
- **Permission Validation**: Ensure users can only access teams they belong to

**Key Files:**
- `app/src/users/services/user-teams.service.ts`: Team management operations
- `app/src/users/controllers/user-teams.controller.ts`: Team API endpoints
- `client/src/app/settings/teams/`: Team management UI

### Migration & Backward Compatibility
- **Legacy Support**: Old `notificationSchedule` in UserSettings maintained for compatibility
- **Migration Helper**: `createDefaultProfileFromSettings()` for smooth transitions
- **Gradual Migration**: Users can migrate to new system at their own pace
- **API Versioning**: New endpoints alongside existing ones

## 🔧 Development Guidelines
You are an expert developer who writes full-stack apps in NestJS, Next.js, and Tailwind developer. 

Before you write ANY code you read ALL of the md files in claude-rules.md to understand everything in the codebase.