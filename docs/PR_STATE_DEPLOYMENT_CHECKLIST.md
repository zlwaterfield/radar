# PR State Management - Deployment Checklist

## Pre-Deployment Verification

### ✅ Code Quality Checks

- [x] All TypeScript compiles without errors (backend)
- [x] All TypeScript compiles without errors (frontend)
- [x] No console errors in development
- [x] Bug fix applied: API authentication issue resolved

### ✅ Feature Completeness

- [x] Backend: Faster digest generation using database queries
- [x] Backend: Enhanced Slack notifications with PR state
- [x] Backend: PR API endpoints (stats, list, detail, sync)
- [x] Frontend: Dashboard page with routing
- [x] Frontend: API service with full TypeScript types
- [x] Frontend: PR stat cards
- [x] Frontend: PullRequestRow component
- [x] Frontend: PullRequestSection component
- [x] Frontend: PR list sections

## Deployment Steps

### 1. Backend Deployment

#### Pre-Deployment
```bash
cd app

# Verify TypeScript compilation
npx tsc --noEmit

# Verify database schema is up to date
npx prisma generate

# Check environment variables
# Ensure all required vars are set in production .env
```

#### Deploy Backend
```bash
# Build
npm run build

# Deploy to your hosting provider
# (Railway, Render, AWS, etc.)
```

#### Post-Deployment
```bash
# Verify health endpoint
curl https://your-api-domain.com/health

# Test PR stats endpoint (requires auth)
curl https://your-api-domain.com/api/pull-requests/stats \
  -H "Cookie: session=YOUR_SESSION_COOKIE"

# Check logs for any errors
```

### 2. Frontend Deployment

#### Pre-Deployment
```bash
cd client

# Verify TypeScript compilation
npx tsc --noEmit

# Update environment variables
# Set NEXT_PUBLIC_API_URL to production backend URL

# Test build locally
npm run build
npm start
```

#### Deploy Frontend
```bash
# Build
npm run build

# Deploy to Vercel, Netlify, or your hosting provider
```

#### Post-Deployment
```bash
# Visit the dashboard
# Navigate to: https://your-frontend-domain.com/dashboard

# Verify:
# - Page loads without errors
# - Stats cards display correctly
# - PR sections load (if PRs exist)
# - Click-through to GitHub works
```

## Verification Tests

### Backend Tests

#### 1. Test Digest Generation Speed
```bash
# Trigger a test digest (if endpoint exists)
# OR monitor logs during scheduled digest run

# Expected: < 1 second generation time
# Expected: No GitHub API calls during digest generation
```

#### 2. Test Slack Notifications
```bash
# Create a test PR in a connected repository
# Verify Slack notification includes:
# - Reviewer status icons
# - Labels
# - CI check status

# Expected: Rich notification with PR state
```

#### 3. Test PR API Endpoints
```bash
# Test stats endpoint
GET /api/pull-requests/stats

# Test list endpoint
GET /api/pull-requests?state=open&limit=10

# Test detail endpoint
GET /api/pull-requests/{id}

# Expected: All return 200 with correct data
```

### Frontend Tests

#### 1. Dashboard Load Test
- [ ] Navigate to `/dashboard`
- [ ] Verify stats cards display with correct numbers
- [ ] Check loading states appear while fetching
- [ ] Confirm no console errors

#### 2. PR List Test
- [ ] Verify "Waiting on Me" section shows PRs (if any)
- [ ] Verify "My Open PRs" section shows PRs (if any)
- [ ] Check PR cards display all information:
  - [ ] Title, number, repository, author
  - [ ] Reviewer status icons
  - [ ] CI check status
  - [ ] Change stats
  - [ ] Labels

#### 3. Interaction Test
- [ ] Click on a PR card
- [ ] Verify GitHub PR opens in new tab
- [ ] Test responsive design on mobile
- [ ] Test dark mode

#### 4. Error Handling Test
- [ ] Test with no GitHub connection
- [ ] Test with no PRs
- [ ] Test API failure scenarios
- [ ] Verify appropriate error messages

## Rollback Plan

If issues occur after deployment:

### Backend Rollback
```bash
# Revert to previous version
git revert <commit-hash>

# Redeploy previous version
npm run build && deploy
```

### Frontend Rollback
```bash
# Revert to previous version
git revert <commit-hash>

# Redeploy previous version
npm run build && deploy
```

### Database Rollback
```bash
# If schema changes were made (none in this deployment)
# Rollback migration:
npx prisma migrate resolve --rolled-back <migration-name>
```

## Monitoring After Deployment

### Key Metrics to Watch

#### Performance Metrics
- [ ] Digest generation time (should be < 1s)
- [ ] Dashboard load time (should be < 500ms)
- [ ] API response times
- [ ] Database query performance

#### Error Metrics
- [ ] API error rate (should be < 1%)
- [ ] Frontend console errors
- [ ] Failed webhook processing
- [ ] Background sync failures

#### User Engagement
- [ ] Dashboard page views
- [ ] Time spent on dashboard
- [ ] Click-through rate to GitHub
- [ ] API request volume

### Logging

Monitor these log patterns:

#### Backend Logs
```bash
# Digest generation
grep "digest" logs/*.log

# PR sync
grep "Syncing PR state" logs/*.log

# API errors
grep "ERROR" logs/*.log | grep "pull-requests"
```

#### Frontend Logs
- Browser console errors
- Network tab for failed API calls
- Performance metrics from monitoring tools

## Troubleshooting

### Common Issues

#### Issue: Dashboard shows "User not connected to GitHub"
**Solution**:
- Verify user has completed GitHub OAuth
- Check database for `githubId` field on user
- Ensure GitHub app is installed on repositories

#### Issue: PR stats show 0 for everything
**Solution**:
- Check if PRs exist in database (`select count(*) from pull_request`)
- Verify webhook integration is working
- Run background sync task manually
- Check PR sync logs for errors

#### Issue: Dashboard loads slowly
**Solution**:
- Check database query performance
- Verify indexes exist on PR tables
- Check API response times
- Consider adding database query caching

#### Issue: Slack notifications missing PR state
**Solution**:
- Verify PRs are being synced to database
- Check `fetchPRState()` function logs
- Verify repository name matches database records
- Check if PR exists before webhook was processed

## Success Criteria

Deployment is successful when:

- ✅ Backend compiles and deploys without errors
- ✅ Frontend builds and deploys without errors
- ✅ Dashboard loads and displays PR stats
- ✅ PR lists display correctly
- ✅ Slack notifications include PR state
- ✅ Digest generation is < 1 second
- ✅ No critical errors in logs
- ✅ API endpoints return correct data
- ✅ User can click through to GitHub PRs

## Post-Deployment Tasks

After successful deployment:

1. **Announce to Users**
   - Send email/Slack message about new dashboard
   - Highlight faster digests
   - Show screenshot of enhanced notifications

2. **Monitor for 24 Hours**
   - Watch error logs
   - Check performance metrics
   - Respond to user feedback

3. **Collect Feedback**
   - Create feedback form
   - Monitor support channels
   - Track feature usage

4. **Plan Next Iteration**
   - Review "Future Work" items
   - Prioritize based on user feedback
   - Create tickets for enhancements

## Contact for Issues

If you encounter issues during deployment:

- Check GitHub Issues: https://github.com/zlwaterfield/radar/issues
- Review Documentation: `/docs/PR_STATE_MANAGEMENT.md`
- Review Implementation Summary: `/docs/PR_STATE_IMPLEMENTATION_SUMMARY.md`

---

**Last Updated**: 2025-10-17
**Version**: 1.0.0
**Status**: Ready for Production Deployment
