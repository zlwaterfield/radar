# PR Review Batching Implementation Plan

## Problem Statement
When a PR review is submitted with multiple inline comments, GitHub sends separate webhooks for each:
- 1 `pull_request_review` webhook (the review submission)
- N `pull_request_review_comment` webhooks (one per inline comment)

This results in multiple Slack notifications when it should be a single grouped notification.

## Solution: Time-Based Debouncing

Implement a batching mechanism that groups related review events within a time window and sends a single combined notification.

---

## Implementation Steps

### 1. Database Schema Changes

**Create new table: `review_batch`**
```prisma
model ReviewBatch {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Batch identification
  reviewId       String   @map("review_id")          // GitHub review ID
  pullRequestId  String   @map("pull_request_id")    // PR number
  repositoryId   String   @map("repository_id")      // Repo ID
  reviewerLogin  String   @map("reviewer_login")     // Who submitted review

  // Batching metadata
  batchKey       String   @unique @map("batch_key")  // Composite key for deduplication
  processAfter   DateTime @map("process_after")      // When to process this batch
  processed      Boolean  @default(false)

  // Stored events (JSON array)
  events         Json     @default("[]")             // Array of webhook events

  @@map("review_batch")
  @@index([processAfter, processed])
  @@index([batchKey])
}
```

**Migration**: `add_review_batching`

---

### 2. Create ReviewBatchingService

**File**: `app/src/webhooks/services/review-batching.service.ts`

**Key Methods:**
- `addEventToBatch(reviewId, prNumber, repoId, reviewerLogin, event)`
  - Store event in batch
  - Set/extend processAfter timestamp (15 seconds from now)

- `getBatchesReadyForProcessing()`
  - Query batches where `processAfter <= now` AND `processed = false`

- `processBatch(batchId)`
  - Get all events in batch
  - Group and organize events
  - Mark as processed
  - Return combined event data

- `cleanupOldBatches()`
  - Delete processed batches older than 24 hours
  - Delete abandoned batches older than 1 hour

**Configuration:**
- `REVIEW_BATCH_WINDOW_MS`: 15000 (15 seconds)
- `REVIEW_BATCH_CLEANUP_HOURS`: 24

---

### 3. Modify Webhook Processing Flow

**File**: `app/src/webhooks/services/webhooks.service.ts`

**Changes to `processGitHubWebhook`:**

```typescript
// For pull_request_review and pull_request_review_comment events:
if (eventType === 'pull_request_review' || eventType === 'pull_request_review_comment') {
  const reviewId = payload.review?.id;
  const prNumber = payload.pull_request?.number;
  const repoId = payload.repository?.id;
  const reviewerLogin = payload.review?.user?.login || payload.comment?.user?.login;

  // Add to batch instead of processing immediately
  await reviewBatchingService.addEventToBatch(
    reviewId,
    prNumber,
    repoId,
    reviewerLogin,
    { eventType, payload }
  );

  return {
    processed: false, // Don't queue for immediate processing
    reason: 'batched_for_review'
  };
}
```

---

### 4. Create Batch Processing Task

**File**: `app/trigger/process-review-batches.ts`

**Scheduled Task** (runs every minute):
```typescript
export const processReviewBatches = schedules.task({
  id: "process-review-batches",
  cron: "* * * * *", // Every minute
  run: async () => {
    const batches = await reviewBatchingService.getBatchesReadyForProcessing();

    for (const batch of batches) {
      const combinedEvent = await reviewBatchingService.processBatch(batch.id);

      // Queue the combined event for notification processing
      await triggerQueueService.queueGitHubEvent(combinedEvent);
    }

    // Cleanup old batches
    await reviewBatchingService.cleanupOldBatches();
  }
});
```

---

### 5. Update Event Processing Logic

**File**: `app/trigger/process-github-event.ts`

**Modify notification message creation:**

```typescript
// Detect if this is a batched review event
if (payload._isBatchedReview) {
  return createBatchedReviewSlackMessage(data, notificationDecision);
}
```

**New function: `createBatchedReviewSlackMessage`:**
- Show review status (approved/changes_requested/commented)
- Show review body if present
- List all inline comments grouped together
- Single "View PR" button

---

### 6. Update Message Formatting

**File**: `app/trigger/process-github-event.ts`

**Add new function:**
```typescript
function createBatchedReviewSlackMessage(data: any, notificationDecision?: any) {
  const { payload } = data;
  const reviewState = payload.review?.state;
  const comments = payload.review_comments || [];

  // Header with review status
  // Review body (if exists)
  // Comments section with all inline comments
  // Single "View PR" button
}
```

---

### 7. Batch Key Generation

**Format:** `review_{reviewId}_{prNumber}_{repoId}_{reviewerLogin}`

**Purpose:**
- Ensures uniqueness per review
- Prevents duplicate batches
- Groups related events correctly

---

### 8. Error Handling & Edge Cases

**Scenarios to handle:**

1. **Review with no comments**:
   - Process immediately after debounce window
   - Send as single review notification

2. **Comments arrive before review**:
   - Create batch with first comment
   - Add review when it arrives
   - Process after debounce window

3. **Webhook delivery failures**:
   - Abandoned batches cleaned up after 1 hour
   - Each event stored independently

4. **Multiple reviews on same PR**:
   - Different reviewIds = different batches
   - No conflict

5. **Batch processing failures**:
   - Log error
   - Mark batch as processed to prevent retry loops
   - Consider dead letter queue for failed batches

---

### 9. Testing Strategy

**Unit Tests:**
- ReviewBatchingService methods
- Batch key generation
- Event grouping logic

**Integration Tests:**
- Webhook → Batch → Process flow
- Multiple events batching correctly
- Single event (no batching needed)
- Cleanup job

**Manual Testing:**
- Submit review with 5 inline comments
- Verify single Slack message with all comments
- Test timing edge cases

---

### 10. Monitoring & Observability

**Metrics to track:**
- Batch creation rate
- Average events per batch
- Processing delay (time from first event to notification)
- Failed batch processing count
- Cleanup job statistics

**Logs to add:**
- "Review batch created: {batchKey}"
- "Added event to batch: {batchKey}, total events: {count}"
- "Processing batch: {batchKey}, events: {count}"
- "Batch processed successfully: {batchKey}"

---

## Rollout Plan

### Phase 1: Infrastructure
- [ ] Add database migration for `review_batch` table
- [ ] Create ReviewBatchingService
- [ ] Add unit tests

### Phase 2: Integration
- [ ] Modify webhook handler to use batching for reviews
- [ ] Create batch processing scheduled task
- [ ] Add integration tests

### Phase 3: Message Formatting
- [ ] Create batched review message formatter
- [ ] Update event processing to detect batched events
- [ ] Test message formatting

### Phase 4: Deployment & Monitoring
- [ ] Deploy to staging
- [ ] Monitor batch metrics
- [ ] Deploy to production
- [ ] Set up alerts for batch processing failures

---

## Configuration

**Environment Variables:**
```env
REVIEW_BATCH_WINDOW_MS=15000        # 15 seconds debounce
REVIEW_BATCH_CLEANUP_HOURS=24       # Cleanup after 24 hours
REVIEW_BATCH_ABANDONED_HOURS=1      # Cleanup abandoned after 1 hour
```

**Tuning Recommendations:**
- Start with 15 second window
- Monitor average comment count per review
- Adjust window if needed (too short = split notifications, too long = delayed)

---

## Success Criteria

✅ Single Slack notification for review with multiple comments
✅ All review comments visible in one message
✅ Review status clearly indicated (approved/changes requested/commented)
✅ No more than 15-20 second delay from review submission to notification
✅ No duplicate notifications for same review
✅ Graceful handling of single-event reviews

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Debounce window too short | Split notifications | Make configurable, start with 15s |
| Batch gets stuck | No notification sent | Cleanup job removes abandoned batches |
| High memory usage | Service degradation | Limit events per batch, aggressive cleanup |
| Webhook order issues | Missing events | Store all events, process in order by timestamp |
| Processing failures | Lost notifications | Add retry logic, dead letter queue |

---

## Future Enhancements

- Redis-based batching for better performance
- User-configurable debounce window
- Smart batching based on review comment patterns
- Batch analytics dashboard
