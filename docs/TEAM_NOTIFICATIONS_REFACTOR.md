# Team Notifications Refactor

## Overview
Refactor the team-based notifications system to remove the global team enable/disable feature and instead allow users to select teams within notification profiles and digest configurations.

## Current State
- **UserTeam** table has an `enabled` field that globally enables/disables team notifications
- Users can toggle teams on/off via API endpoints
- **NotificationProfile** and **DigestConfig** support `scopeType` and `scopeValue` but team scope is not implemented
- Digest service has a TODO for team scope implementation (digest.service.ts:388)

## Goals
1. Remove `UserTeam.enabled` field and related endpoints
2. Allow users to select teams in notification profiles (user's PRs OR specific team's PRs)
3. Allow users to select teams in digest configs (user's PRs OR specific team's PRs)
4. Implement team scope logic in digest and notification services

## Design Decisions

### Database Structure (No Changes)
Keep existing `scopeType` and `scopeValue` structure:
- `scopeType: 'user'`, `scopeValue: null` → User's own PRs
- `scopeType: 'team'`, `scopeValue: 'teamId'` → Single team's PRs

Users create multiple profiles/digests if they want multiple teams covered.

### Team Scope Definition
When a profile/digest is scoped to a team, include PRs where ANY team member is:
- The PR author
- A requested reviewer
- An assignee

## Implementation Plan

### Phase 1: Database & Schema Changes
- [x] Create tracking document
- [x] Remove `enabled` field from UserTeam model in schema.prisma
- [x] Generate and run Prisma migration

### Phase 2: Backend API Cleanup
- [x] Remove `PATCH /users/me/teams/:teamId/toggle` endpoint
- [x] Remove `PATCH /users/me/teams/toggle-all` endpoint
- [x] Remove `GET /users/me/teams/enabled` endpoint
- [x] Remove `toggleTeamNotifications()` method from user-teams.service
- [x] Remove `getEnabledTeams()` and `getEnabledTeamsPaginated()` methods
- [x] Update `getTeamStats()` to remove enabled count
- [x] Remove `enabled` field from controller response mapping

### Phase 3: Team Member Fetching
- [x] Add `getTeamMembers(teamSlug: string, org: string, accessToken: string)` to GitHubService
- [x] Add `getTeamMemberLogins(teamId: string, userId: string)` helper to digest service
- [ ] Add caching layer for team members (optional - can be done later for performance)

### Phase 4: Digest Logic Implementation
- [x] Update `isPRInScope()` in digest.service.ts to handle team scope
- [x] Add `isPRInTeamScope(pr, teamMemberLogins)` helper method
- [x] Integrate team member fetching into `generateDigestForConfig()`
- [x] Pass teamMemberLogins to `processRepositoryForDigest()`
- [ ] Test digest generation with team scope

### Phase 5: Notification Profile Logic
- [x] Update notification matching to handle team scope
- [x] Add team member filtering to notification service (`checkTeamScope` method)
- [x] Add `isTeamInvolvedInEvent` helper to check if team members are in event
- [ ] Test notification routing with team scope

### Phase 6: Frontend Changes
- [x] Update notification profile form UI to select teams
- [x] Update digest config form UI to select teams
- [x] Remove team toggle UI components
- [x] Add validation to ensure team is selected when team scope is chosen

### Phase 7: Testing & Documentation
- [ ] End-to-end testing with team-scoped digests
- [ ] End-to-end testing with team-scoped notifications
- [ ] Update API documentation
- [ ] Update user documentation

## Progress

### Completed Tasks
- ✅ **Phase 1: Database & Schema Changes** (Complete)
  - Removed `enabled` field from UserTeam model
  - Generated and applied database migration

- ✅ **Phase 2: Backend API Cleanup** (Complete)
  - Removed 3 deprecated endpoints for team toggling
  - Removed deprecated service methods
  - Updated response mappings

- ✅ **Phase 3: Team Member Fetching** (Complete)
  - Added `getTeamMembers()` to GitHubService
  - Added helper methods to digest and notification services

- ✅ **Phase 4: Digest Logic Implementation** (Complete)
  - Implemented team scope in `isPRInScope()` method
  - Added `isPRInTeamScope()` helper
  - Integrated team member fetching into digest generation

- ✅ **Phase 5: Notification Profile Logic** (Complete)
  - Updated `checkProfileScope()` to handle team scope
  - Added `checkTeamScope()` for team-based filtering
  - Added `isTeamInvolvedInEvent()` helper

- ✅ **Phase 6: Frontend Changes** (Complete)
  - Added team scope selector to NotificationProfileForm with radio buttons and team dropdown
  - Added team scope selector to DigestConfigModal with radio buttons and team dropdown
  - Removed `enabled` field from Team interface in teams settings page
  - Removed `toggleTeam()` and `toggleAllTeams()` functions from teams settings page
  - Removed "Enable all/Disable all" bulk actions UI
  - Updated TeamTable component to show Permission column instead of Status toggle
  - Added validation to prevent saving team-scoped profiles/digests without selecting a team

### Remaining
- **Phase 7: Testing & Documentation**
  - Test digest generation with team scope
  - Test notification routing with team scope
  - End-to-end testing
  - Update API documentation

### Blocked
None

## Summary

**Backend and Frontend implementation complete!** Users can now:
1. Create digest configs scoped to a specific team via the UI
2. Create notification profiles scoped to a specific team via the UI
3. PRs/notifications are included if ANY team member is involved (author, reviewer, assignee)
4. Team settings page now shows team information without the enabled/disabled toggle

**Changes made:**
- **Backend**: Team scope logic fully implemented in digest and notification services
- **Frontend**: Team selection UI added to both digest and notification profile forms
- **UI Cleanup**: Removed all team enable/disable toggle functionality

**Next steps:**
- Testing to verify team scope functionality works correctly end-to-end
- Update API documentation if needed

## Notes
- Keep validation logic in notification-profile.service.ts that validates team membership
- No DTO changes needed since structure stays the same
- Team member lists should be cached to avoid excessive GitHub API calls
- Consider rate limiting implications when fetching team members

## References

### Backend Files
- Prisma schema: `app/prisma/schema.prisma`
- UserTeam controller: `app/src/users/controllers/user-teams.controller.ts`
- UserTeam service: `app/src/users/services/user-teams.service.ts`
- Digest service: `app/src/digest/digest.service.ts`
- Notification profile service: `app/src/notifications/services/notification-profile.service.ts`
- GitHub service: `app/src/github/services/github.service.ts`

### Frontend Files
- Digest settings page: `client/src/app/settings/digest/page.tsx`
- DigestConfigModal component: `client/src/components/DigestConfigModal.tsx`
- NotificationProfileForm component: `client/src/components/NotificationProfileForm.tsx`
- Teams settings page: `client/src/app/settings/teams/page.tsx`
- TeamTable component: `client/src/components/TeamTable.tsx`
