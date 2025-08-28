"""
GitHub Team Synchronization Service for Radar.

This service synchronizes GitHub team data with the local database.
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

from app.services.github_service import GitHubService
from app.db.supabase import SupabaseManager
from app.services.monitoring_service import MonitoringService

logger = logging.getLogger(__name__)


class TeamSyncService:
    """Service for syncing GitHub teams with the database."""
    
    @staticmethod
    async def sync_user_teams(user_id: str, github_token: str) -> bool:
        """
        Sync teams for a specific user.
        
        Args:
            user_id: User ID
            github_token: User's GitHub access token
            
        Returns:
            True if sync was successful
        """
        try:
            # Get user info
            user = await SupabaseManager.get_user(user_id)
            if not user or not user.get("github_login"):
                logger.warning(f"User {user_id} has no GitHub login")
                return False
            
            github_login = user["github_login"]
            github_service = GitHubService(token=github_token)
            
            # Get user's organizations
            try:
                user_data = github_service.get_user()
                orgs_response = github_service.client.get_user().get_orgs()
                orgs = [org.login for org in orgs_response]
            except Exception as e:
                logger.error(f"Error getting user organizations for {github_login}: {e}")
                return False
            
            synced_teams = 0
            synced_memberships = 0
            
            # Sync teams for each organization
            for org_login in orgs:
                try:
                    # Get teams user belongs to in this org
                    user_teams = github_service.get_user_teams_in_org(org_login, github_login)
                    
                    for team_data in user_teams:
                        # Create/update team in database
                        team_record = await SupabaseManager.create_or_update_team({
                            "id": team_data["id"],
                            "slug": team_data["slug"],
                            "name": team_data["name"],
                            "description": team_data.get("description"),
                            "organization": {
                                "login": org_login,
                                "id": "unknown"  # We'd need to fetch this separately
                            }
                        })
                        
                        if team_record:
                            synced_teams += 1
                            
                            # Create/update membership
                            membership_record = await SupabaseManager.create_or_update_team_membership(
                                user_id=user_id,
                                team_id=team_record["id"],
                                github_team_id=str(team_data["id"]),
                                role=team_data.get("role", "member")
                            )
                            
                            if membership_record:
                                synced_memberships += 1
                
                except Exception as e:
                    logger.error(f"Error syncing teams for {github_login} in org {org_login}: {e}")
                    continue
            
            logger.info(f"Synced {synced_teams} teams and {synced_memberships} memberships for user {user_id}")
            
            # Track sync metrics
            MonitoringService.track_event(
                "team_sync_completed",
                properties={
                    "user_id": user_id,
                    "teams_synced": synced_teams,
                    "memberships_synced": synced_memberships,
                    "organizations_checked": len(orgs)
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error syncing teams for user {user_id}: {e}")
            MonitoringService.track_event(
                "team_sync_failed",
                properties={
                    "user_id": user_id,
                    "error": str(e)
                }
            )
            return False
    
    @staticmethod
    async def sync_organization_teams(org_login: str, github_token: str) -> bool:
        """
        Sync all teams for an organization.
        
        Args:
            org_login: Organization login
            github_token: GitHub access token with org permissions
            
        Returns:
            True if sync was successful
        """
        try:
            github_service = GitHubService(token=github_token)
            
            # Get all teams in the organization
            teams = github_service.get_organization_teams(org_login)
            
            synced_teams = 0
            synced_members = 0
            
            for team_data in teams:
                try:
                    # Create/update team in database
                    team_record = await SupabaseManager.create_or_update_team(team_data)
                    
                    if team_record:
                        synced_teams += 1
                        
                        # Get and sync team members
                        members = github_service.get_team_members(org_login, team_data["slug"])
                        
                        for member_data in members:
                            # Try to find user in our database by GitHub login
                            user = await SupabaseManager.get_user_by_github_login(member_data["login"])
                            
                            if user:
                                # Create/update membership
                                membership_record = await SupabaseManager.create_or_update_team_membership(
                                    user_id=user["id"],
                                    team_id=team_record["id"],
                                    github_team_id=str(team_data["id"]),
                                    role=member_data.get("role", "member")
                                )
                                
                                if membership_record:
                                    synced_members += 1
                
                except Exception as e:
                    logger.error(f"Error syncing team {team_data.get('slug', 'unknown')}: {e}")
                    continue
            
            logger.info(f"Synced {synced_teams} teams and {synced_members} memberships for org {org_login}")
            
            # Track sync metrics
            MonitoringService.track_event(
                "organization_team_sync_completed",
                properties={
                    "organization": org_login,
                    "teams_synced": synced_teams,
                    "members_synced": synced_members
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error syncing teams for organization {org_login}: {e}")
            MonitoringService.track_event(
                "organization_team_sync_failed",
                properties={
                    "organization": org_login,
                    "error": str(e)
                }
            )
            return False
    
    @staticmethod
    async def sync_all_active_users() -> int:
        """
        Sync teams for all active users with GitHub tokens.
        
        Returns:
            Number of users successfully synced
        """
        try:
            # Get all active users with GitHub tokens
            users = await SupabaseManager.get_active_users_with_github()
            
            synced_count = 0
            
            for user in users:
                try:
                    if user.get("github_access_token"):
                        success = await TeamSyncService.sync_user_teams(
                            user["id"], 
                            user["github_access_token"]
                        )
                        if success:
                            synced_count += 1
                except Exception as e:
                    logger.error(f"Error syncing teams for user {user['id']}: {e}")
                    continue
            
            logger.info(f"Team sync completed for {synced_count} out of {len(users)} users")
            
            # Track overall sync metrics
            MonitoringService.track_event(
                "bulk_team_sync_completed",
                properties={
                    "total_users": len(users),
                    "successful_syncs": synced_count,
                    "failed_syncs": len(users) - synced_count
                }
            )
            
            return synced_count
            
        except Exception as e:
            logger.error(f"Error in bulk team sync: {e}")
            MonitoringService.track_event(
                "bulk_team_sync_failed",
                properties={"error": str(e)}
            )
            return 0
    
    @staticmethod
    def should_sync_user_teams(user_id: str) -> bool:
        """
        Check if user's teams should be synced (e.g., based on last sync time).
        
        Args:
            user_id: User ID
            
        Returns:
            True if teams should be synced
        """
        # For now, implement basic time-based sync
        # In production, you might want to store last_synced_at in user record
        return True  # Always sync for now