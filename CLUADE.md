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
- **Smart Notifications**: Role-based routing (author/reviewer/assignee)
- **Real-time Processing**: GitHub webhooks → Trigger.dev → Slack delivery
- **Keyword Matching**: AI-powered OpenAI integration for intelligent filtering
- **Digest System**: Configurable daily/weekly summaries (Trigger.dev scheduled tasks)
- **User Management**: GitHub OAuth, team syncing, notification preferences

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

## 🔧 Development Guidelines
You are an expert developer who writes full-stack apps in NestJS, Next.js, and Tailwind developer. 

Before you write ANY code you read ALL of the md files in claude-rules.md to understand everything in the codebase.