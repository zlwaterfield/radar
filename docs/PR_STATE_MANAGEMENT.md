# PR State Management: Graphite-Style Implementation Plan

## Overview

Transform Radar from an event-driven notification system into a comprehensive PR management platform with rich state tracking, similar to Graphite.dev. This enables a powerful dashboard, smarter notifications, faster digests, and a dynamic Slack home page.

---

## Current State Analysis

### What We Have Now
- **Events stored**: GitHub webhooks received and stored in `Event` table with full payload
- **Notifications sent**: Real-time Slack messages based on notification profiles
- **Digests generated**: Scheduled summaries that fetch data on-demand from GitHub API
- **No persistent PR state**: PRs are not stored; all data fetched fresh from GitHub each time

### Problems with Current Approach
1. **Slow digest generation**: Every digest queries GitHub API for 100+ PRs per repository
2. **Limited filtering**: Cannot filter by CI status, specific reviewers, or labels without API calls
3. **No dashboard**: Cannot display PR state without hitting GitHub API
4. **API rate limits**: Heavy users risk hitting GitHub's 5000 req/hour limit
5. **No historical tracking**: Cannot analyze PR lifecycle, review patterns, or trends
6. **Incomplete notification context**: Slack messages lack CI status, full reviewer state

---

## Proposed Architecture

### Database Schema Changes

#### 1. `PullRequest` Table (Core PR State)

```prisma
model PullRequest {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // GitHub identifiers
  githubId       String @unique @map("github_id")
  number         Int
  repositoryId   String @map("repository_id")
  repositoryName String @map("repository_name")

  // Core PR data
  title       String
  body        String? @db.Text
  url         String
  state       String  // "open", "closed"
  isDraft     Boolean @default(false) @map("is_draft")
  isMerged    Boolean @default(false) @map("is_merged")

  // Timestamps
  openedAt  DateTime  @map("opened_at")
  closedAt  DateTime? @map("closed_at")
  mergedAt  DateTime? @map("merged_at")

  // Author information
  authorGithubId  String @map("author_github_id")
  authorLogin     String @map("author_login")
  authorAvatarUrl String @map("author_avatar_url")

  // Branch information
  baseBranch String @map("base_branch")
  headBranch String @map("head_branch")

  // Statistics
  additions    Int @default(0)
  deletions    Int @default(0)
  changedFiles Int @default(0) @map("changed_files")

  // Sync tracking
  lastSyncedAt DateTime @default(now()) @map("last_synced_at")

  // Relations
  reviewers PullRequestReviewer[]
  labels    PullRequestLabel[]
  checks    PullRequestCheck[]
  assignees PullRequestAssignee[]
  events    Event[]

  @@unique([repositoryId, number])
  @@index([repositoryId, state])
  @@index([authorGithubId])
  @@index([state, updatedAt])
  @@map("pull_request")
}
```

#### 2. `PullRequestReviewer` Table

```prisma
model PullRequestReviewer {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  pullRequestId String      @map("pull_request_id")
  pullRequest   PullRequest @relation(fields: [pullRequestId], references: [id], onDelete: Cascade)

  // Reviewer identity
  githubId  String @map("github_id")
  login     String
  avatarUrl String @map("avatar_url")

  // Review state
  reviewState String    @map("review_state") // "pending", "approved", "changes_requested", "commented", "dismissed"
  reviewedAt  DateTime? @map("reviewed_at")
  reviewUrl   String?   @map("review_url")

  // Team review support
  isTeamReview Boolean @default(false) @map("is_team_review")
  teamSlug     String? @map("team_slug")

  @@unique([pullRequestId, githubId])
  @@index([pullRequestId])
  @@index([githubId])
  @@map("pull_request_reviewer")
}
```

#### 3. `PullRequestLabel` Table

```prisma
model PullRequestLabel {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")

  pullRequestId String      @map("pull_request_id")
  pullRequest   PullRequest @relation(fields: [pullRequestId], references: [id], onDelete: Cascade)

  name        String
  color       String  // Hex color (e.g., "ff0000")
  description String?

  @@unique([pullRequestId, name])
  @@index([pullRequestId])
  @@map("pull_request_label")
}
```

#### 4. `PullRequestCheck` Table (CI/CD Status)

```prisma
model PullRequestCheck {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  pullRequestId String      @map("pull_request_id")
  pullRequest   PullRequest @relation(fields: [pullRequestId], references: [id], onDelete: Cascade)

  // Check run details
  githubCheckId String  @unique @map("github_check_id")
  name          String
  status        String  // "queued", "in_progress", "completed"
  conclusion    String? // "success", "failure", "neutral", "cancelled", "skipped", "timed_out", "action_required"
  detailsUrl    String? @map("details_url")

  // Timestamps
  startedAt   DateTime? @map("started_at")
  completedAt DateTime? @map("completed_at")

  @@index([pullRequestId])
  @@index([pullRequestId, status])
  @@map("pull_request_check")
}
```

#### 5. `PullRequestAssignee` Table

```prisma
model PullRequestAssignee {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")

  pullRequestId String      @map("pull_request_id")
  pullRequest   PullRequest @relation(fields: [pullRequestId], references: [id], onDelete: Cascade)

  githubId  String @map("github_id")
  login     String
  avatarUrl String @map("avatar_url")

  @@unique([pullRequestId, githubId])
  @@index([pullRequestId])
  @@index([githubId])
  @@map("pull_request_assignee")
}
```

#### 6. Update `Event` Table

```prisma
model Event {
  // ... existing fields ...

  // NEW: Link events to PRs
  pullRequestId String?      @map("pull_request_id")
  pullRequest   PullRequest? @relation(fields: [pullRequestId], references: [id], onDelete: SetNull)

  @@index([pullRequestId])
}
```

---

## Implementation Phases

### Phase 1: Database Schema & PR State Storage

**Files to Create:**
- `app/prisma/migrations/XXXXXX_add_pr_state_tables.sql`
- `app/src/pull-requests/pull-requests.module.ts`
- `app/src/pull-requests/services/pull-request.service.ts`
- `app/src/pull-requests/services/pull-request-sync.service.ts`

**Tasks:**
1. Create Prisma migration for all PR-related tables
2. Generate Prisma client with new models
3. Create `PullRequestService` for CRUD operations
4. Create `PullRequestSyncService` for GitHub sync logic

---

### Phase 2: Webhook Processing & PR Sync

#### 2.1 Update Webhook Handler

**File:** `app/src/webhooks/services/webhooks.service.ts`

**Changes:**
```typescript
async processGitHubWebhook(eventType: string, payload: GitHubWebhookPayload) {
  // ... existing logic ...

  // NEW: Sync PR state when PR events occur
  if (this.isPullRequestEvent(eventType)) {
    await this.pullRequestSyncService.syncFromWebhook(payload);
  }
}

private isPullRequestEvent(eventType: string): boolean {
  return [
    'pull_request',
    'pull_request_review',
    'pull_request_review_comment'
  ].includes(eventType);
}
```

#### 2.2 Handle Additional Webhook Events

**New Events to Support:**

| Webhook Event | Action | Database Update |
|---------------|--------|-----------------|
| `pull_request.labeled` | PR label added | Insert `PullRequestLabel` |
| `pull_request.unlabeled` | PR label removed | Delete `PullRequestLabel` |
| `pull_request.synchronize` | PR updated with new commits | Update stats (additions, deletions, files) |
| `pull_request.assigned` | User assigned to PR | Insert `PullRequestAssignee` |
| `pull_request.unassigned` | User unassigned | Delete `PullRequestAssignee` |
| `check_run.created/completed` | CI check started/finished | Upsert `PullRequestCheck` |
| `check_suite.completed` | CI suite finished | Update multiple `PullRequestCheck` |
| `pull_request_review.submitted` | Review submitted | Upsert `PullRequestReviewer` with state |
| `pull_request_review.dismissed` | Review dismissed | Update `PullRequestReviewer` state |

#### 2.3 Background Sync Task

**File:** `app/trigger/sync-pr-state.ts`

```typescript
import { task, schedules } from "@trigger.dev/sdk";

export const syncPullRequestState = schedules.task({
  id: "sync-pull-request-state",
  // Run every 30 minutes
  cron: "*/30 * * * *",
  run: async () => {
    // Sync state for all open PRs in active repositories
    // 1. Get all open PRs that haven't been synced in 30+ minutes
    // 2. Fetch latest state from GitHub API
    // 3. Update reviewers, checks, labels
    // 4. Handle rate limiting gracefully
  }
});
```

**Sync Strategy:**
- Only sync **open** PRs (closed PRs are frozen)
- Prioritize PRs updated recently (GitHub's `updated_at`)
- Batch sync in groups of 50 PRs per repository
- Respect rate limits: pause if approaching 1000 requests remaining

---

### Phase 3: API Endpoints for PR Data

#### 3.1 Create PullRequestsController

**File:** `app/src/pull-requests/controllers/pull-requests.controller.ts`

**Endpoints:**

```typescript
@Controller('api/pull-requests')
export class PullRequestsController {

  // List PRs with filtering
  @Get()
  async listPullRequests(
    @CurrentUser() user: User,
    @Query() query: ListPullRequestsDto
  ): Promise<PullRequestListResponse> {
    // Query params:
    // - state: "open" | "closed" | "all"
    // - repository: repositoryId (filter by repo)
    // - assignedToMe: boolean
    // - authorMe: boolean
    // - reviewRequested: boolean (user is requested reviewer)
    // - hasLabel: string (filter by label name)
    // - ciStatus: "passing" | "failing" | "pending"
    // - sort: "updated" | "created" | "reviews"
    // - limit: number (default 50)
    // - offset: number (pagination)
  }

  // Get single PR with full details
  @Get(':id')
  async getPullRequest(
    @CurrentUser() user: User,
    @Param('id') id: string
  ): Promise<PullRequestDetailResponse> {
    // Returns PR with:
    // - All reviewers with status
    // - All labels
    // - All checks (grouped by status)
    // - All assignees
    // - Related events (timeline)
  }

  // Get dashboard stats
  @Get('stats')
  async getPullRequestStats(
    @CurrentUser() user: User
  ): Promise<PullRequestStatsResponse> {
    // Returns counts for:
    // - Waiting on me (review requested from me)
    // - Approved & ready to merge (I approved + all checks pass)
    // - My open PRs
    // - My draft PRs
    // - Assigned to me
  }

  // Force sync PR from GitHub
  @Post(':id/sync')
  async syncPullRequest(
    @CurrentUser() user: User,
    @Param('id') id: string
  ): Promise<PullRequestDetailResponse> {
    // Manually trigger sync from GitHub API
    // Useful for refreshing stale data
  }
}
```

#### 3.2 Response DTOs

**File:** `app/src/pull-requests/dtos/pull-request.dto.ts`

```typescript
export interface PullRequestListItemDto {
  id: string;
  githubId: string;
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  repositoryName: string;

  author: {
    login: string;
    avatarUrl: string;
  };

  reviewers: Array<{
    login: string;
    avatarUrl: string;
    reviewState: string; // "pending", "approved", etc.
  }>;

  labels: Array<{
    name: string;
    color: string;
  }>;

  checks: {
    passing: number;
    failing: number;
    pending: number;
    total: number;
  };

  stats: {
    additions: number;
    deletions: number;
    changedFiles: number;
  };

  updatedAt: string;
  createdAt: string;
}

export interface PullRequestStatsResponse {
  waitingOnMe: number;
  approvedReadyToMerge: number;
  myOpenPRs: number;
  myDraftPRs: number;
  assignedToMe: number;
}
```

---

### Phase 4: Frontend Dashboard (Graphite-Style)

#### 4.1 Dashboard Page

**File:** `client/src/app/dashboard/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                   [Refresh] [⚙️]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📊 Quick Stats:                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Waiting on│ │Ready to  │ │My Open   │ │My Drafts │      │
│  │Me: 5     │ │Merge: 3  │ │PRs: 12   │ │: 2       │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                               │
│  🔍 Filters: [All Repos ▾] [Open ▾] [All Labels ▾]         │
│             Sort by: [Recently Updated ▾]                    │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  🚨 Waiting on Me (5)                                        │
├─────────────────────────────────────────────────────────────┤
│  feat: Add user authentication                               │
│  zlwaterfield/radar #123 · joshsny 1h ago                   │
│  [👤][👤][👤] ✅ 12/12 checks  🟢 +320 / -45  [bug][feat]  │
├─────────────────────────────────────────────────────────────┤
│  fix: Resolve webhook processing bug                         │
│  zlwaterfield/radar #122 · contributor 2h ago                │
│  [👤][👤] ⏳ 8/12 checks  🟢 +50 / -20  [bug]              │
├─────────────────────────────────────────────────────────────┤
│  ✅ Approved & Ready to Merge (3)                            │
├─────────────────────────────────────────────────────────────┤
│  ... (similar PR rows)                                       │
│                                                               │
│  📝 My Open PRs (12)                                         │
├─────────────────────────────────────────────────────────────┤
│  ... (similar PR rows)                                       │
└─────────────────────────────────────────────────────────────┘
```

**Component Structure:**
```typescript
// client/src/app/dashboard/page.tsx
export default function DashboardPage() {
  const { data: stats } = useQuery(['pr-stats'], fetchPRStats);
  const { data: prs } = useQuery(['prs', filters], () => fetchPRs(filters));

  return (
    <div>
      <DashboardHeader stats={stats} />
      <FilterBar filters={filters} onChange={setFilters} />

      <PullRequestSection
        title="🚨 Waiting on Me"
        prs={prs.waitingOnMe}
        emptyMessage="No PRs waiting on your review"
      />

      <PullRequestSection
        title="✅ Approved & Ready to Merge"
        prs={prs.approvedReadyToMerge}
      />

      <PullRequestSection
        title="📝 My Open PRs"
        prs={prs.myOpenPRs}
      />

      <PullRequestSection
        title="✏️ My Draft PRs"
        prs={prs.myDraftPRs}
      />
    </div>
  );
}
```

#### 4.2 PR Row Component

**File:** `client/src/components/PullRequestRow.tsx`

**Visual Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ feat: Add user authentication                                │
│ zlwaterfield/radar #123 · joshsny · 1 hour ago              │
│                                                               │
│ Reviewers: [👤✅] [👤⏳] [👤❌]    (avatars with status)    │
│                                                               │
│ CI: ✅ 12/12 passing    Changes: 🟩 +320 / 🟥 -45           │
│                                                               │
│ Labels: [🔴 bug] [🟢 feature] [🟡 needs-review]             │
└─────────────────────────────────────────────────────────────┘
```

**Component Props:**
```typescript
interface PullRequestRowProps {
  pr: PullRequestListItemDto;
  onClick?: () => void;
}

export function PullRequestRow({ pr, onClick }: PullRequestRowProps) {
  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
      {/* Title */}
      <h3 className="font-semibold text-lg">{pr.title}</h3>

      {/* Meta */}
      <div className="text-sm text-gray-600">
        {pr.repositoryName} #{pr.number} · {pr.author.login} · {formatRelative(pr.updatedAt)}
      </div>

      {/* Reviewers */}
      <ReviewerAvatars reviewers={pr.reviewers} />

      {/* Checks & Stats */}
      <div className="flex gap-4 mt-2">
        <CheckStatus checks={pr.checks} />
        <ChangeStats stats={pr.stats} />
      </div>

      {/* Labels */}
      <LabelBadges labels={pr.labels} />
    </div>
  );
}
```

**Reviewer Avatar States:**
- ⏳ Pending review (gray avatar, no badge)
- ✅ Approved (green checkmark badge)
- ❌ Changes requested (red X badge)
- 💬 Commented (blue comment badge)
- 🚫 Dismissed (gray strikethrough)

**CI Status Indicators:**
- ✅ All passing (green checkmark + "12/12 passing")
- ❌ Some failing (red X + "8/12 passing, 4 failing")
- ⏳ In progress (yellow spinner + "8/12 completed")
- ⚠️ Action required (yellow warning + "Needs approval")

---

### Phase 5: Enhanced Notifications

#### 5.1 Rich Slack Notifications

**Current Notification:**
```
🆕 joshsny opened a PR in zlwaterfield/radar

feat: Add user authentication

View PR

PostHog/posthog
```

**Enhanced Notification (with PR state):**
```
🆕 joshsny opened a PR in zlwaterfield/radar

feat: Add user authentication

👥 Reviewers: @zlwaterfield, @contributor, team-backend
🏷️ Labels: feature, auth, high-priority
🔧 CI: ⏳ 2/8 checks running
📊 Changes: 🟩 +320 / 🟥 -45 across 12 files

This PR introduces OAuth2 authentication with GitHub...

[View in Radar Dashboard] [View on GitHub]

zlwaterfield/radar
```

**Notification Updates (when PR changes):**
```
✅ All checks passed for PR #123

feat: Add user authentication

🎉 CI is now passing! Ready for merge.
✅ 8/8 checks passing

[View in Radar Dashboard]
```

```
👀 zlwaterfield approved PR #123

feat: Add user authentication

✅ Approved
💬 "LGTM! Great work on the error handling."

📊 Review Status: 2/3 approved
Waiting on: @contributor

[View in Radar Dashboard]
```

#### 5.2 Notification with Keywords & Profile

**Example:** User has keyword "authentication" in profile "Security Changes"

```
🎯 Keyword Match: authentication
From profile: "Security Changes"
───────────────────────────
🆕 joshsny opened a PR in zlwaterfield/radar

feat: Add user authentication

👥 Reviewers: @zlwaterfield, @contributor
🏷️ Labels: feature, auth, security
🔧 CI: ⏳ 2/8 checks running

This PR introduces OAuth2 authentication...

[View in Radar Dashboard] [View on GitHub]
```

#### 5.3 Update Notification Service

**File:** `app/src/notifications/services/notification.service.ts`

**Changes:**
```typescript
async createSlackMessage(event: Event, pr: PullRequest) {
  const blocks = [
    this.createHeaderBlock(event, pr),
    this.createPRTitleBlock(pr),
    this.createReviewersBlock(pr.reviewers),
    this.createLabelsBlock(pr.labels),
    this.createChecksBlock(pr.checks),
    this.createStatsBlock(pr),
    this.createBodyPreviewBlock(pr.body),
    this.createActionsBlock(pr),
  ];

  return { blocks };
}

private createReviewersBlock(reviewers: PullRequestReviewer[]) {
  const reviewerText = reviewers.map(r => {
    const statusIcon = this.getReviewerIcon(r.reviewState);
    return `${statusIcon} @${r.login}`;
  }).join(', ');

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `👥 *Reviewers:* ${reviewerText}`
    }
  };
}

private createChecksBlock(checks: PullRequestCheck[]) {
  const passing = checks.filter(c => c.conclusion === 'success').length;
  const failing = checks.filter(c => c.conclusion === 'failure').length;
  const pending = checks.filter(c => c.status !== 'completed').length;

  let icon = '✅';
  let text = `${passing}/${checks.length} passing`;

  if (failing > 0) {
    icon = '❌';
    text = `${passing}/${checks.length} passing, ${failing} failing`;
  } else if (pending > 0) {
    icon = '⏳';
    text = `${passing}/${checks.length} completed`;
  }

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `🔧 *CI:* ${icon} ${text}`
    }
  };
}
```

---

### Phase 6: Enhanced Digests

#### 6.1 Faster Digest Generation

**Current Digest Query:**
- Fetches last 100 PRs from GitHub API for each repository
- ~500ms per repository
- Total time: 5-10 seconds for 10 repositories

**New Digest Query:**
- Query `PullRequest` table with filters
- ~50ms total for all repositories
- **100x faster**

**File:** `app/src/digest/digest.service.ts`

**Before:**
```typescript
async generateDigest(user: User) {
  const repos = await this.getEnabledRepositories(user.id);

  for (const repo of repos) {
    // Slow: GitHub API call
    const prs = await this.githubService.listPullRequests(repo.fullName);
    // ... process PRs
  }
}
```

**After:**
```typescript
async generateDigest(user: User, config: DigestConfig) {
  // Fast: Database query
  const prs = await this.pullRequestService.getUserPullRequests(user.id, {
    repositoryIds: this.getRepoIdsFromConfig(config),
    state: 'open',
    includeReviewers: true,
    includeChecks: true,
    includeLabels: true,
  });

  // Categorize in-memory
  const digest = this.categorizePRs(prs, user);
  return digest;
}
```

#### 6.2 Rich Digest Content

**Current Digest:**
```
📊 Daily Digest - September 15, 2024

🚨 Waiting on You (3 PRs)
• feat: Add authentication (#123) - joshsny
• fix: Resolve bug (#122) - contributor

✅ Approved & Ready to Merge (2 PRs)
• chore: Update dependencies (#120) - joshsny

📝 Your Open PRs (5 PRs)
• refactor: Clean up code (#119) - zlwaterfield

View All PRs on GitHub
```

**Enhanced Digest:**
```
📊 Daily Digest - September 15, 2024
For: All Repositories

🚨 Waiting on Your Review (3 PRs)

feat: Add user authentication (#123)
by joshsny · zlwaterfield/radar
👥 2/3 reviewers approved  ✅ All checks passing
🏷️ feature, auth  🟩 +320 / 🟥 -45
https://github.com/zlwaterfield/radar/pull/123

fix: Resolve webhook bug (#122)
by contributor · zlwaterfield/radar
👥 0/2 reviewers  ⏳ 8/12 checks running
🏷️ bug  🟩 +50 / 🟥 -20
https://github.com/zlwaterfield/radar/pull/122

───────────────────────────────

✅ Approved & Ready to Merge (2 PRs)

chore: Update dependencies (#120)
by joshsny · zlwaterfield/radar
👥 All approved  ✅ All checks passing
Ready to merge! 🎉

───────────────────────────────

📝 Your Open PRs (5 PRs)

refactor: Clean up notification service (#119)
by zlwaterfield · zlwaterfield/radar
👥 1/2 approved  ⏳ 4/8 checks running
🏷️ refactor, tech-debt

───────────────────────────────

[View Dashboard in Radar] [View on GitHub]
```

#### 6.3 Digest Filtering by Labels/CI

**New Digest Config Options:**

```typescript
interface DigestConfig {
  // ... existing fields ...

  // NEW: Advanced filtering
  labelFilter?: {
    type: 'include' | 'exclude';
    labels: string[]; // e.g., ["bug", "feature"]
  };

  ciStatusFilter?: 'all' | 'passing' | 'failing' | 'pending';

  reviewStatusFilter?: 'all' | 'approved' | 'changes_requested' | 'pending';
}
```

**Example Use Cases:**
- "Show only PRs with 'high-priority' label"
- "Show only PRs with failing CI"
- "Show only PRs pending approval"
- "Exclude PRs labeled 'wip' or 'draft'"

**Frontend UI:**
```
Digest Configuration: "Daily Team Summary"

Filters (optional):
┌─────────────────────────────────────────┐
│ Labels:                                 │
│ ○ All labels                            │
│ ● Include only: [bug] [feature] [+]    │
│ ○ Exclude: [ ] [ ]                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ CI Status:                              │
│ ● All statuses                          │
│ ○ Only passing                          │
│ ○ Only failing                          │
│ ○ Only pending                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Review Status:                          │
│ ● All PRs                               │
│ ○ Only approved                         │
│ ○ Only pending review                   │
│ ○ Only changes requested                │
└─────────────────────────────────────────┘
```

---

### Phase 7: Slack Home Page

#### 7.1 Home Page Overview

The Slack home page provides a dynamic, always-updated view of the user's PR dashboard directly in Slack.

**Visual Layout:**
```
┌─────────────────────────────────────────────┐
│  Radar - Your PR Dashboard                  │
├─────────────────────────────────────────────┤
│                                              │
│  📊 Quick Stats                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ 5    │ │ 3    │ │ 12   │ │ 2    │      │
│  │Waiting│ │Ready │ │My PRs│ │Drafts│      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│                                              │
│  [🔄 Refresh] [⚙️ Settings] [📊 Dashboard]  │
│                                              │
├─────────────────────────────────────────────┤
│  🚨 Waiting on Your Review (5)              │
├─────────────────────────────────────────────┤
│                                              │
│  feat: Add user authentication #123         │
│  zlwaterfield/radar · joshsny · 1h          │
│  ✅ 12/12 checks  👥 2/3 approved           │
│  [View PR] [Approve] [Request Changes]      │
│                                              │
│  ─────────────────────────────────────      │
│                                              │
│  fix: Webhook processing bug #122           │
│  zlwaterfield/radar · contributor · 2h      │
│  ⏳ 8/12 checks  👥 0/2 approved            │
│  [View PR] [Approve] [Request Changes]      │
│                                              │
├─────────────────────────────────────────────┤
│  ✅ Approved & Ready to Merge (3)           │
├─────────────────────────────────────────────┤
│                                              │
│  chore: Update dependencies #120            │
│  zlwaterfield/radar · joshsny · 3h          │
│  ✅ All checks passing  👥 All approved     │
│  [Merge PR] [View PR]                       │
│                                              │
├─────────────────────────────────────────────┤
│  📝 Your Open PRs (12)                      │
│                     [View All]               │
├─────────────────────────────────────────────┤
│                                              │
│  refactor: Clean up code #119               │
│  zlwaterfield/radar · 5h                    │
│  ⏳ 4/8 checks  👥 1/2 approved             │
│  [View PR]                                   │
│                                              │
└─────────────────────────────────────────────┘
```

#### 7.2 Home Page Implementation

**File:** `app/src/slack/services/slack-home.service.ts`

**Slack API Events:**
- `app_home_opened` - User opens the Slack app home tab
- `block_actions` - User clicks a button (Refresh, View PR, Approve, etc.)

**Home View Update:**
```typescript
@Injectable()
export class SlackHomeService {
  async updateHomeView(userId: string, slackUserId: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId }
    });

    // Fetch PR stats and data
    const stats = await this.pullRequestService.getPullRequestStats(userId);
    const waitingOnMe = await this.pullRequestService.getUserPullRequests(userId, {
      reviewRequested: true,
      state: 'open',
      limit: 5,
    });

    const readyToMerge = await this.pullRequestService.getUserPullRequests(userId, {
      approvedByMe: true,
      checksPass: true,
      state: 'open',
      limit: 3,
    });

    const myOpenPRs = await this.pullRequestService.getUserPullRequests(userId, {
      authorMe: true,
      state: 'open',
      isDraft: false,
      limit: 5,
    });

    // Build Slack home view
    const blocks = [
      this.createHeaderBlock(),
      this.createStatsBlock(stats),
      this.createActionsBlock(),
      this.createDivider(),

      this.createSectionHeader('🚨 Waiting on Your Review', stats.waitingOnMe),
      ...this.createPRBlocks(waitingOnMe, 'review'),

      this.createDivider(),
      this.createSectionHeader('✅ Approved & Ready to Merge', stats.approvedReadyToMerge),
      ...this.createPRBlocks(readyToMerge, 'merge'),

      this.createDivider(),
      this.createSectionHeader('📝 Your Open PRs', stats.myOpenPRs),
      ...this.createPRBlocks(myOpenPRs, 'view'),
    ];

    // Publish view to Slack
    await this.slackClient.views.publish({
      user_id: slackUserId,
      view: {
        type: 'home',
        blocks,
      }
    });
  }

  private createPRBlock(pr: PullRequest, actionType: 'review' | 'merge' | 'view') {
    const checksText = this.formatChecks(pr.checks);
    const reviewText = this.formatReviewers(pr.reviewers);

    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${pr.title}* #${pr.number}\n` +
              `${pr.repositoryName} · ${pr.authorLogin} · ${formatRelative(pr.updatedAt)}\n` +
              `${checksText}  ${reviewText}`
      },
      accessory: {
        type: 'actions',
        elements: this.createActionButtons(pr, actionType)
      }
    };
  }

  private createActionButtons(pr: PullRequest, type: 'review' | 'merge' | 'view') {
    if (type === 'review') {
      return [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View PR' },
          url: pr.url,
          action_id: 'view_pr'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve' },
          style: 'primary',
          action_id: 'approve_pr',
          value: pr.id
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Request Changes' },
          style: 'danger',
          action_id: 'request_changes',
          value: pr.id
        }
      ];
    } else if (type === 'merge') {
      return [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Merge PR' },
          style: 'primary',
          action_id: 'merge_pr',
          value: pr.id
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View PR' },
          url: pr.url,
          action_id: 'view_pr'
        }
      ];
    } else {
      return [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View PR' },
          url: pr.url,
          action_id: 'view_pr'
        }
      ];
    }
  }
}
```

#### 7.3 Interactive Actions

**Quick Actions from Home Page:**

1. **Approve PR** - Opens modal to add review comment, then approves via GitHub API
   ```
   ┌────────────────────────────────┐
   │ Approve PR #123                │
   ├────────────────────────────────┤
   │ Comment (optional):            │
   │ ┌────────────────────────────┐ │
   │ │ LGTM! Great work.          │ │
   │ └────────────────────────────┘ │
   │                                │
   │ [Cancel] [Approve & Comment]   │
   └────────────────────────────────┘
   ```

2. **Request Changes** - Opens modal for review feedback
   ```
   ┌────────────────────────────────┐
   │ Request Changes on PR #123     │
   ├────────────────────────────────┤
   │ Feedback (required):           │
   │ ┌────────────────────────────┐ │
   │ │ Please add error handling  │ │
   │ │ for the OAuth flow.        │ │
   │ └────────────────────────────┘ │
   │                                │
   │ [Cancel] [Submit Review]       │
   └────────────────────────────────┘
   ```

3. **Merge PR** - Confirms merge (if authorized)
   ```
   ┌────────────────────────────────┐
   │ Merge PR #123?                 │
   ├────────────────────────────────┤
   │ chore: Update dependencies     │
   │                                │
   │ ✅ All checks passing          │
   │ ✅ All reviewers approved      │
   │                                │
   │ Merge method:                  │
   │ ○ Merge commit                 │
   │ ● Squash and merge            │
   │ ○ Rebase and merge            │
   │                                │
   │ [Cancel] [Merge PR]            │
   └────────────────────────────────┘
   ```

4. **Refresh** - Manually refreshes home view (syncs from database)

5. **View Dashboard** - Opens web dashboard in browser

#### 7.4 Real-Time Updates

**Home Page Auto-Refresh Strategy:**
- Refresh when user opens home tab (`app_home_opened` event)
- Refresh after PR state changes (webhook received)
- Refresh when user clicks "Refresh" button
- **No polling** - event-driven updates only

**Webhook → Home Update Flow:**
```
GitHub Webhook (PR approved)
    ↓
Webhook Handler updates PullRequest table
    ↓
Trigger Slack home update for relevant users
    ↓
Home view refreshed with new state
```

---

## Data Migration & Backfill

### Phase 8: Backfill Existing PRs

#### 8.1 Backfill Strategy

**Goal:** Populate `PullRequest` table with existing PRs from GitHub

**Approach:**
1. For each user with enabled repositories
2. Fetch last 30 days of PRs (or max 100 PRs per repo)
3. Create `PullRequest` records with full state
4. Link to existing `Event` records where possible

#### 8.2 Admin Backfill Endpoint

**File:** `app/src/admin/controllers/admin.controller.ts`

```typescript
@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {

  @Post('backfill-prs')
  async backfillPullRequests(
    @Body() dto: BackfillPRsDto
  ): Promise<BackfillResult> {
    // Optional: userId to backfill specific user
    // Otherwise backfill all users

    const users = dto.userId
      ? [await this.usersService.findById(dto.userId)]
      : await this.usersService.findAllActive();

    let totalPRs = 0;
    let totalRepos = 0;

    for (const user of users) {
      const repos = await this.getEnabledRepositories(user.id);

      for (const repo of repos) {
        const prs = await this.githubService.listPullRequests(repo.fullName, {
          state: 'all',
          since: thirtyDaysAgo(),
          per_page: 100
        });

        for (const pr of prs) {
          await this.pullRequestSyncService.syncPullRequest(pr);
          totalPRs++;
        }

        totalRepos++;
      }
    }

    return {
      success: true,
      totalUsers: users.length,
      totalRepos,
      totalPRs
    };
  }
}
```

#### 8.3 Gradual Rollout

**Phase 1: Opt-in Beta**
- Enable PR state for specific beta users
- Monitor performance and data accuracy
- Collect feedback on dashboard UX

**Phase 2: Backfill for All**
- Run backfill script for all active users
- May take 1-2 hours depending on user count
- Monitor GitHub API rate limits

**Phase 3: Enable Dashboard**
- Release dashboard to all users
- Enable Slack home page
- Switch digest to use database queries

---

## Performance Considerations

### Database Indexes

Critical indexes for query performance:

```sql
-- Pull requests by repository and state
CREATE INDEX idx_pr_repo_state ON pull_request(repository_id, state, updated_at DESC);

-- Pull requests by author
CREATE INDEX idx_pr_author ON pull_request(author_github_id, state);

-- Reviewers by GitHub ID (for "waiting on me" queries)
CREATE INDEX idx_reviewer_github ON pull_request_reviewer(github_id, review_state);

-- Checks by PR (for CI status)
CREATE INDEX idx_checks_pr ON pull_request_check(pull_request_id, status, conclusion);
```

### Query Optimization

**"Waiting on Me" Query:**
```sql
SELECT pr.*
FROM pull_request pr
JOIN pull_request_reviewer prr ON pr.id = prr.pull_request_id
WHERE prr.github_id = $1
  AND prr.review_state = 'pending'
  AND pr.state = 'open'
ORDER BY pr.updated_at DESC
LIMIT 50;
```

**Expected Performance:**
- < 50ms for users with 100+ PRs
- < 10ms with proper indexes

### GitHub API Rate Limiting

**Current Usage (no PR state):**
- Digest: ~10 API calls per repository
- Total: 100 calls per digest for 10 repos
- Max digests per hour: 50 (5000 / 100)

**With PR State:**
- Digest: 0 API calls (database only)
- Sync task: ~1 API call per open PR per 30 minutes
- Max open PRs trackable: 2500+ (plenty of headroom)

---

## Implementation Timeline

### Week 1: Foundation
- [ ] Create database schema and migration
- [ ] Implement `PullRequestService` and `PullRequestSyncService`
- [ ] Update webhook handler to sync PR state
- [ ] Write unit tests for sync logic

### Week 2: API & Backfill
- [ ] Create `PullRequestsController` with all endpoints
- [ ] Implement backfill admin endpoint
- [ ] Test backfill with 1-2 beta users
- [ ] Background sync task (Trigger.dev)

### Week 3: Frontend Dashboard
- [ ] Create dashboard page layout
- [ ] Build `PullRequestRow` component
- [ ] Implement filtering and sorting
- [ ] Add real-time updates (optional)

### Week 4: Enhanced Features
- [ ] Update notification messages with PR state
- [ ] Update digest to use database queries
- [ ] Add digest filtering (labels, CI, review status)
- [ ] Implement Slack home page

### Week 5: Testing & Rollout
- [ ] End-to-end testing with beta users
- [ ] Performance testing (large repos, many PRs)
- [ ] Full backfill for all users
- [ ] Launch dashboard and home page

---

## Success Metrics

### Performance Goals
- **Dashboard load time**: < 500ms
- **Digest generation**: < 1 second (down from 5-10s)
- **Webhook processing**: < 200ms per event
- **Background sync**: < 2 API calls per PR per hour

### User Experience Goals
- **Dashboard engagement**: 50%+ of users visit daily
- **Notification relevance**: 20% reduction in "muted" PRs
- **Digest open rate**: Increase from current baseline
- **Time to action**: Users act on PRs 30% faster

### Technical Goals
- **GitHub API usage**: 50% reduction in API calls
- **Database query performance**: 95th percentile < 100ms
- **Uptime**: 99.9% for dashboard and home page
- **Data freshness**: < 5 minutes lag for PR state

---

## Future Enhancements

### Phase 9+: Advanced Features

1. **PR Analytics**
   - Track review time, merge time, comment count
   - Identify bottlenecks (slow reviews, flaky CI)
   - Team metrics dashboard

2. **Smart Notifications**
   - "PR has been idle for 3 days" reminder
   - "All reviewers approved, ready to merge" alert
   - "CI just started failing" urgent notification

3. **PR Dependencies**
   - Track stacked PRs (PR depends on another PR)
   - Visualize PR dependency graph
   - Auto-merge when dependencies merge

4. **Custom Views**
   - User-defined dashboard sections
   - Saved filters (e.g., "High-priority bugs")
   - Shared team views

5. **GitHub Actions Integration**
   - Trigger deployments from Slack
   - Run custom workflows
   - View action logs in dashboard

---

## Conclusion

This PR state management system transforms Radar from a simple notification tool into a comprehensive PR management platform. By storing PR state locally, we unlock:

- **Faster experience**: Dashboard and digests load 100x faster
- **Richer data**: Full context on reviewers, CI, labels, checks
- **Better UX**: Graphite-style dashboard, interactive Slack home page
- **Smarter features**: Advanced filtering, analytics, custom views

The phased implementation allows for gradual rollout, testing, and refinement while maintaining the existing notification and digest functionality.
