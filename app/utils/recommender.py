"""
Recommendation utilities for Radar.

This module provides personalized recommendations based on user activity.
"""
import logging
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timedelta
import math

logger = logging.getLogger(__name__)


class UserActivityTracker:
    """Tracks user activity for generating recommendations."""
    
    @staticmethod
    async def track_activity(
        user_id: str,
        activity_type: str,
        activity_data: Dict[str, Any]
    ) -> None:
        """
        Track user activity.
        
        Args:
            user_id: User ID
            activity_type: Type of activity
            activity_data: Activity data
        """
        try:
            from app.db.supabase import SupabaseManager
            
            # Create activity record
            activity = {
                "user_id": user_id,
                "activity_type": activity_type,
                "activity_data": activity_data,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Store in database
            await SupabaseManager.store_user_activity(activity)
        except Exception as e:
            logger.error(f"Error tracking user activity: {e}")


class Recommender:
    """Generates personalized recommendations for users."""
    
    @staticmethod
    async def generate_recommendations(user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Generate personalized recommendations for a user.
        
        Args:
            user_id: User ID
            limit: Maximum number of recommendations
            
        Returns:
            List of recommendations
        """
        try:
            from app.db.supabase import SupabaseManager
            
            # Get user settings
            user_settings = await SupabaseManager.get_user_settings(user_id)
            if not user_settings:
                return []
            
            # Get user activity history
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=30)  # Look at last 30 days
            user_activity = await SupabaseManager.get_user_activity(
                user_id, start_date.isoformat(), end_date.isoformat()
            )
            
            # Get repositories the user is watching
            watched_repos = user_settings.get("watched_repositories", [])
            if not watched_repos:
                return []
            
            # Get recent activity in watched repositories
            repo_activity = await SupabaseManager.get_repository_activity(
                watched_repos, start_date.isoformat(), end_date.isoformat()
            )
            
            # Generate recommendations
            recommendations = []
            
            # 1. Recommend repositories with high activity but low user engagement
            repo_recommendations = Recommender._recommend_repositories(
                user_activity, repo_activity, watched_repos
            )
            recommendations.extend(repo_recommendations)
            
            # 2. Recommend pull requests that might need attention
            pr_recommendations = Recommender._recommend_pull_requests(
                user_activity, repo_activity, user_settings
            )
            recommendations.extend(pr_recommendations)
            
            # 3. Recommend issues that might be relevant
            issue_recommendations = Recommender._recommend_issues(
                user_activity, repo_activity, user_settings
            )
            recommendations.extend(issue_recommendations)
            
            # 4. Recommend users to follow
            user_recommendations = Recommender._recommend_users(
                user_activity, repo_activity, user_settings
            )
            recommendations.extend(user_recommendations)
            
            # Sort by relevance score and limit
            recommendations.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
            return recommendations[:limit]
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return []
    
    @staticmethod
    def _recommend_repositories(
        user_activity: List[Dict[str, Any]],
        repo_activity: List[Dict[str, Any]],
        watched_repos: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Recommend repositories with high activity but low user engagement.
        
        Args:
            user_activity: User activity history
            repo_activity: Repository activity
            watched_repos: Repositories the user is watching
            
        Returns:
            Repository recommendations
        """
        # Count activity per repository
        repo_activity_count = {}
        for activity in repo_activity:
            repo = activity.get("repository", "")
            if repo:
                if repo not in repo_activity_count:
                    repo_activity_count[repo] = 0
                repo_activity_count[repo] += 1
        
        # Count user engagement per repository
        user_engagement = {}
        for activity in user_activity:
            repo = activity.get("activity_data", {}).get("repository", "")
            if repo:
                if repo not in user_engagement:
                    user_engagement[repo] = 0
                user_engagement[repo] += 1
        
        # Calculate engagement ratio and find repositories with low engagement
        recommendations = []
        for repo in watched_repos:
            if repo not in repo_activity_count:
                continue
            
            activity_count = repo_activity_count[repo]
            engagement = user_engagement.get(repo, 0)
            
            # Skip repositories with no activity
            if activity_count == 0:
                continue
            
            # Calculate engagement ratio (0-1)
            engagement_ratio = min(1.0, engagement / activity_count)
            
            # Recommend repositories with high activity but low engagement
            if activity_count >= 5 and engagement_ratio < 0.3:
                relevance_score = activity_count * (1.0 - engagement_ratio)
                recommendations.append({
                    "type": "repository",
                    "repository": repo,
                    "reason": f"High activity ({activity_count} events) with low engagement",
                    "relevance_score": relevance_score,
                    "activity_count": activity_count,
                    "engagement_ratio": engagement_ratio
                })
        
        return recommendations
    
    @staticmethod
    def _recommend_pull_requests(
        user_activity: List[Dict[str, Any]],
        repo_activity: List[Dict[str, Any]],
        user_settings: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Recommend pull requests that might need attention.
        
        Args:
            user_activity: User activity history
            repo_activity: Repository activity
            user_settings: User settings
            
        Returns:
            Pull request recommendations
        """
        # Get GitHub username
        github_username = user_settings.get("github_username", "")
        if not github_username:
            return []
        
        # Find pull requests that might need attention
        recommendations = []
        seen_prs = set()
        
        for activity in repo_activity:
            # Only consider pull request activities
            if activity.get("activity_type") != "pull_request":
                continue
            
            pr_data = activity.get("activity_data", {})
            pr_id = pr_data.get("id")
            pr_number = pr_data.get("number")
            pr_title = pr_data.get("title")
            pr_url = pr_data.get("html_url")
            pr_repo = activity.get("repository", "")
            
            # Skip if missing required data
            if not all([pr_id, pr_number, pr_title, pr_url, pr_repo]):
                continue
            
            # Skip if already seen
            pr_key = f"{pr_repo}#{pr_number}"
            if pr_key in seen_prs:
                continue
            seen_prs.add(pr_key)
            
            # Check if user is mentioned
            is_mentioned = False
            if github_username:
                body = pr_data.get("body", "")
                if f"@{github_username}" in body:
                    is_mentioned = True
            
            # Check if user is a reviewer
            is_reviewer = False
            reviewers = pr_data.get("requested_reviewers", [])
            for reviewer in reviewers:
                if reviewer.get("login") == github_username:
                    is_reviewer = True
                    break
            
            # Check if PR is stale
            is_stale = False
            updated_at = pr_data.get("updated_at")
            if updated_at:
                try:
                    updated_date = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
                    days_since_update = (datetime.utcnow() - updated_date).days
                    if days_since_update >= 7:
                        is_stale = True
                except (ValueError, TypeError):
                    pass
            
            # Calculate relevance score
            relevance_score = 0
            reason = []
            
            if is_mentioned:
                relevance_score += 10
                reason.append("You are mentioned")
            
            if is_reviewer:
                relevance_score += 15
                reason.append("You are a requested reviewer")
            
            if is_stale:
                relevance_score += 5
                reason.append("No activity for 7+ days")
            
            # Add recommendation if relevant
            if relevance_score > 0:
                recommendations.append({
                    "type": "pull_request",
                    "repository": pr_repo,
                    "pull_request_number": pr_number,
                    "title": pr_title,
                    "url": pr_url,
                    "reason": ", ".join(reason),
                    "relevance_score": relevance_score,
                    "is_mentioned": is_mentioned,
                    "is_reviewer": is_reviewer,
                    "is_stale": is_stale
                })
        
        return recommendations
    
    @staticmethod
    def _recommend_issues(
        user_activity: List[Dict[str, Any]],
        repo_activity: List[Dict[str, Any]],
        user_settings: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Recommend issues that might be relevant.
        
        Args:
            user_activity: User activity history
            repo_activity: Repository activity
            user_settings: User settings
            
        Returns:
            Issue recommendations
        """
        # Get GitHub username and interests
        github_username = user_settings.get("github_username", "")
        interests = user_settings.get("interests", [])
        
        # Find issues that might be relevant
        recommendations = []
        seen_issues = set()
        
        for activity in repo_activity:
            # Only consider issue activities
            if activity.get("activity_type") != "issue":
                continue
            
            issue_data = activity.get("activity_data", {})
            issue_id = issue_data.get("id")
            issue_number = issue_data.get("number")
            issue_title = issue_data.get("title")
            issue_url = issue_data.get("html_url")
            issue_repo = activity.get("repository", "")
            
            # Skip if missing required data
            if not all([issue_id, issue_number, issue_title, issue_url, issue_repo]):
                continue
            
            # Skip if already seen
            issue_key = f"{issue_repo}#{issue_number}"
            if issue_key in seen_issues:
                continue
            seen_issues.add(issue_key)
            
            # Check if user is mentioned
            is_mentioned = False
            if github_username:
                body = issue_data.get("body", "")
                if f"@{github_username}" in body:
                    is_mentioned = True
            
            # Check if issue matches user interests
            matches_interests = False
            if interests:
                combined_text = f"{issue_title} {issue_data.get('body', '')}".lower()
                for interest in interests:
                    if interest.lower() in combined_text:
                        matches_interests = True
                        break
            
            # Check if issue is recent
            is_recent = False
            created_at = issue_data.get("created_at")
            if created_at:
                try:
                    created_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    days_since_creation = (datetime.utcnow() - created_date).days
                    if days_since_creation <= 3:
                        is_recent = True
                except (ValueError, TypeError):
                    pass
            
            # Calculate relevance score
            relevance_score = 0
            reason = []
            
            if is_mentioned:
                relevance_score += 10
                reason.append("You are mentioned")
            
            if matches_interests:
                relevance_score += 8
                reason.append("Matches your interests")
            
            if is_recent:
                relevance_score += 5
                reason.append("Recently created")
            
            # Add recommendation if relevant
            if relevance_score > 0:
                recommendations.append({
                    "type": "issue",
                    "repository": issue_repo,
                    "issue_number": issue_number,
                    "title": issue_title,
                    "url": issue_url,
                    "reason": ", ".join(reason),
                    "relevance_score": relevance_score,
                    "is_mentioned": is_mentioned,
                    "matches_interests": matches_interests,
                    "is_recent": is_recent
                })
        
        return recommendations
    
    @staticmethod
    def _recommend_users(
        user_activity: List[Dict[str, Any]],
        repo_activity: List[Dict[str, Any]],
        user_settings: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Recommend users to follow.
        
        Args:
            user_activity: User activity history
            repo_activity: Repository activity
            user_settings: User settings
            
        Returns:
            User recommendations
        """
        # Get GitHub username and followed users
        github_username = user_settings.get("github_username", "")
        followed_users = user_settings.get("followed_users", [])
        
        # Skip if user doesn't have a GitHub username
        if not github_username:
            return []
        
        # Count user activity in repositories
        user_repo_activity = {}
        for activity in repo_activity:
            actor = activity.get("activity_data", {}).get("actor", {}).get("login")
            repo = activity.get("repository", "")
            
            if not actor or not repo or actor == github_username or actor in followed_users:
                continue
            
            if actor not in user_repo_activity:
                user_repo_activity[actor] = {}
            
            if repo not in user_repo_activity[actor]:
                user_repo_activity[actor][repo] = 0
            
            user_repo_activity[actor][repo] += 1
        
        # Find users with significant activity
        recommendations = []
        for actor, repos in user_repo_activity.items():
            # Calculate total activity and repository overlap
            total_activity = sum(repos.values())
            repo_count = len(repos)
            
            # Skip users with low activity
            if total_activity < 5 or repo_count < 2:
                continue
            
            # Calculate relevance score based on activity and repository overlap
            relevance_score = total_activity * math.log(repo_count + 1)
            
            # Add recommendation
            recommendations.append({
                "type": "user",
                "github_username": actor,
                "reason": f"Active in {repo_count} repositories you watch",
                "relevance_score": relevance_score,
                "repository_count": repo_count,
                "activity_count": total_activity
            })
        
        return recommendations
