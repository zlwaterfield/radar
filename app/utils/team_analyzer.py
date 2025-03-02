"""
Team analysis utilities for Radar.

This module provides team-based analysis for GitHub repositories.
"""
import logging
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime, timedelta
import re

logger = logging.getLogger(__name__)


class TeamAnalyzer:
    """Analyzes team activity and ownership in GitHub repositories."""
    
    @staticmethod
    async def analyze_team_ownership(
        organization: str,
        repository: str,
        codeowners_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze team ownership based on CODEOWNERS file.
        
        Args:
            organization: GitHub organization name
            repository: GitHub repository name
            codeowners_content: Optional content of CODEOWNERS file
            
        Returns:
            Team ownership analysis
        """
        from app.services.github_service import GitHubService
        
        # Get CODEOWNERS content if not provided
        if not codeowners_content:
            try:
                github_service = GitHubService()
                codeowners_content = await github_service.get_file_content(
                    organization, repository, "CODEOWNERS"
                )
            except Exception:
                # Try alternative locations
                try:
                    codeowners_content = await github_service.get_file_content(
                        organization, repository, ".github/CODEOWNERS"
                    )
                except Exception:
                    try:
                        codeowners_content = await github_service.get_file_content(
                            organization, repository, "docs/CODEOWNERS"
                        )
                    except Exception:
                        logger.warning(f"CODEOWNERS file not found in {organization}/{repository}")
                        codeowners_content = ""
        
        # Parse CODEOWNERS content
        team_ownership = TeamAnalyzer._parse_codeowners(codeowners_content)
        
        # Get repository structure
        try:
            github_service = GitHubService()
            repo_structure = await github_service.get_repository_structure(
                organization, repository
            )
        except Exception as e:
            logger.error(f"Error getting repository structure: {e}")
            repo_structure = []
        
        # Match files to teams
        file_ownership = TeamAnalyzer._match_files_to_teams(repo_structure, team_ownership)
        
        # Calculate ownership statistics
        ownership_stats = TeamAnalyzer._calculate_ownership_stats(file_ownership)
        
        return {
            "organization": organization,
            "repository": repository,
            "team_ownership": team_ownership,
            "file_ownership": file_ownership,
            "ownership_stats": ownership_stats
        }
    
    @staticmethod
    def _parse_codeowners(content: str) -> Dict[str, List[str]]:
        """
        Parse CODEOWNERS file content.
        
        Args:
            content: CODEOWNERS file content
            
        Returns:
            Dictionary mapping file patterns to teams
        """
        if not content:
            return {}
        
        team_ownership = {}
        
        # Process each line
        for line in content.split("\n"):
            # Skip comments and empty lines
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            
            # Split into pattern and owners
            parts = line.split()
            if len(parts) < 2:
                continue
            
            pattern = parts[0]
            owners = []
            
            for owner in parts[1:]:
                # Skip comments
                if owner.startswith("#"):
                    break
                
                # Add owner (team or user)
                owners.append(owner)
            
            if owners:
                team_ownership[pattern] = owners
        
        return team_ownership
    
    @staticmethod
    def _match_files_to_teams(
        repo_structure: List[Dict[str, Any]],
        team_ownership: Dict[str, List[str]]
    ) -> Dict[str, List[str]]:
        """
        Match repository files to teams based on CODEOWNERS patterns.
        
        Args:
            repo_structure: Repository file structure
            team_ownership: Team ownership patterns
            
        Returns:
            Dictionary mapping files to teams
        """
        file_ownership = {}
        
        # Process each file
        for file_info in repo_structure:
            file_path = file_info.get("path", "")
            if not file_path:
                continue
            
            # Find matching patterns
            matching_owners = []
            for pattern, owners in team_ownership.items():
                # Convert glob pattern to regex
                regex_pattern = TeamAnalyzer._glob_to_regex(pattern)
                if re.match(regex_pattern, file_path):
                    matching_owners.extend(owners)
            
            # Store unique owners
            if matching_owners:
                file_ownership[file_path] = list(set(matching_owners))
        
        return file_ownership
    
    @staticmethod
    def _glob_to_regex(pattern: str) -> str:
        """
        Convert glob pattern to regex.
        
        Args:
            pattern: Glob pattern
            
        Returns:
            Regex pattern
        """
        # Escape special characters
        regex = re.escape(pattern)
        
        # Convert glob wildcards to regex
        regex = regex.replace(r'\*\*', '.*')  # ** matches any path
        regex = regex.replace(r'\*', '[^/]*')  # * matches any character except /
        regex = regex.replace(r'\?', '.')      # ? matches a single character
        
        # Handle directory matching
        if regex.endswith('/'):
            regex += '.*'
        
        # Anchor pattern
        regex = '^' + regex + '$'
        
        return regex
    
    @staticmethod
    def _calculate_ownership_stats(file_ownership: Dict[str, List[str]]) -> Dict[str, Any]:
        """
        Calculate ownership statistics.
        
        Args:
            file_ownership: File ownership mapping
            
        Returns:
            Ownership statistics
        """
        # Count files per team
        team_file_count = {}
        total_files = len(file_ownership)
        
        for file_path, owners in file_ownership.items():
            for owner in owners:
                if owner not in team_file_count:
                    team_file_count[owner] = 0
                team_file_count[owner] += 1
        
        # Calculate percentages
        team_percentages = {}
        for team, count in team_file_count.items():
            percentage = (count / total_files) * 100 if total_files > 0 else 0
            team_percentages[team] = round(percentage, 2)
        
        # Count files with multiple owners
        multi_owned_files = sum(1 for owners in file_ownership.values() if len(owners) > 1)
        multi_owned_percentage = (multi_owned_files / total_files) * 100 if total_files > 0 else 0
        
        # Count files with no owners
        no_owner_files = sum(1 for owners in file_ownership.values() if len(owners) == 0)
        no_owner_percentage = (no_owner_files / total_files) * 100 if total_files > 0 else 0
        
        return {
            "total_files": total_files,
            "team_file_count": team_file_count,
            "team_percentages": team_percentages,
            "multi_owned_files": multi_owned_files,
            "multi_owned_percentage": round(multi_owned_percentage, 2),
            "no_owner_files": no_owner_files,
            "no_owner_percentage": round(no_owner_percentage, 2)
        }
    
    @staticmethod
    async def analyze_team_activity(
        organization: str,
        repository: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Analyze team activity in a repository.
        
        Args:
            organization: GitHub organization name
            repository: GitHub repository name
            days: Number of days to analyze
            
        Returns:
            Team activity analysis
        """
        from app.services.github_service import GitHubService
        
        # Get team ownership
        ownership_analysis = await TeamAnalyzer.analyze_team_ownership(
            organization, repository
        )
        
        # Get repository events
        try:
            github_service = GitHubService()
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            events = await github_service.get_repository_events(
                organization, repository, start_date, end_date
            )
        except Exception as e:
            logger.error(f"Error getting repository events: {e}")
            events = []
        
        # Get team members
        team_members = await TeamAnalyzer._get_team_members(organization)
        
        # Analyze events by team
        team_activity = TeamAnalyzer._analyze_events_by_team(
            events, team_members, ownership_analysis["file_ownership"]
        )
        
        return {
            "organization": organization,
            "repository": repository,
            "period_days": days,
            "team_activity": team_activity,
            "event_count": len(events),
            "ownership_analysis": ownership_analysis
        }
    
    @staticmethod
    async def _get_team_members(organization: str) -> Dict[str, List[str]]:
        """
        Get team members for an organization.
        
        Args:
            organization: GitHub organization name
            
        Returns:
            Dictionary mapping team names to member usernames
        """
        from app.services.github_service import GitHubService
        
        try:
            github_service = GitHubService()
            teams = await github_service.get_organization_teams(organization)
            
            team_members = {}
            for team in teams:
                team_name = team.get("name")
                if not team_name:
                    continue
                
                members = await github_service.get_team_members(
                    organization, team.get("id")
                )
                
                team_members[team_name] = [
                    member.get("login") for member in members if member.get("login")
                ]
            
            return team_members
        except Exception as e:
            logger.error(f"Error getting team members: {e}")
            return {}
    
    @staticmethod
    def _analyze_events_by_team(
        events: List[Dict[str, Any]],
        team_members: Dict[str, List[str]],
        file_ownership: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Analyze events by team.
        
        Args:
            events: Repository events
            team_members: Team members
            file_ownership: File ownership mapping
            
        Returns:
            Team activity analysis
        """
        # Initialize team activity counters
        team_activity = {
            team: {
                "commit_count": 0,
                "pr_count": 0,
                "review_count": 0,
                "issue_count": 0,
                "comment_count": 0,
                "total_activity": 0,
                "members_active": set(),
                "files_modified": set()
            }
            for team in team_members.keys()
        }
        
        # Add "unknown" team for users not in any team
        team_activity["unknown"] = {
            "commit_count": 0,
            "pr_count": 0,
            "review_count": 0,
            "issue_count": 0,
            "comment_count": 0,
            "total_activity": 0,
            "members_active": set(),
            "files_modified": set()
        }
        
        # Process each event
        for event in events:
            event_type = event.get("type")
            actor = event.get("actor", {}).get("login")
            
            if not event_type or not actor:
                continue
            
            # Find teams for the actor
            actor_teams = []
            for team, members in team_members.items():
                if actor in members:
                    actor_teams.append(team)
            
            # Use "unknown" team if not in any team
            if not actor_teams:
                actor_teams = ["unknown"]
            
            # Update team activity based on event type
            for team in actor_teams:
                # Track active member
                team_activity[team]["members_active"].add(actor)
                
                # Update activity counts
                if event_type == "PushEvent":
                    team_activity[team]["commit_count"] += 1
                    
                    # Track modified files
                    commits = event.get("payload", {}).get("commits", [])
                    for commit in commits:
                        modified_files = commit.get("modified", [])
                        added_files = commit.get("added", [])
                        removed_files = commit.get("removed", [])
                        
                        all_files = modified_files + added_files + removed_files
                        team_activity[team]["files_modified"].update(all_files)
                
                elif event_type == "PullRequestEvent":
                    team_activity[team]["pr_count"] += 1
                
                elif event_type == "PullRequestReviewEvent":
                    team_activity[team]["review_count"] += 1
                
                elif event_type == "IssuesEvent":
                    team_activity[team]["issue_count"] += 1
                
                elif event_type in ["IssueCommentEvent", "PullRequestReviewCommentEvent", "CommitCommentEvent"]:
                    team_activity[team]["comment_count"] += 1
                
                # Update total activity
                team_activity[team]["total_activity"] += 1
        
        # Convert sets to lists for JSON serialization
        for team in team_activity:
            team_activity[team]["members_active"] = list(team_activity[team]["members_active"])
            team_activity[team]["files_modified"] = list(team_activity[team]["files_modified"])
        
        return team_activity
    
    @staticmethod
    async def generate_team_report(
        organization: str,
        repository: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive team report.
        
        Args:
            organization: GitHub organization name
            repository: GitHub repository name
            days: Number of days to analyze
            
        Returns:
            Team report
        """
        # Get team activity analysis
        activity_analysis = await TeamAnalyzer.analyze_team_activity(
            organization, repository, days
        )
        
        # Calculate additional metrics
        team_metrics = {}
        for team, activity in activity_analysis["team_activity"].items():
            # Skip teams with no activity
            if activity["total_activity"] == 0:
                continue
            
            # Calculate activity per member
            member_count = len(activity["members_active"])
            activity_per_member = activity["total_activity"] / member_count if member_count > 0 else 0
            
            # Calculate review ratio (reviews / PRs)
            review_ratio = activity["review_count"] / activity["pr_count"] if activity["pr_count"] > 0 else 0
            
            # Store metrics
            team_metrics[team] = {
                "member_count": member_count,
                "activity_per_member": round(activity_per_member, 2),
                "review_ratio": round(review_ratio, 2),
                "files_modified_count": len(activity["files_modified"])
            }
        
        # Generate insights
        insights = TeamAnalyzer._generate_team_insights(
            activity_analysis["team_activity"],
            team_metrics,
            activity_analysis["ownership_analysis"]["team_percentages"]
        )
        
        return {
            "organization": organization,
            "repository": repository,
            "period_days": days,
            "event_count": activity_analysis["event_count"],
            "team_activity": activity_analysis["team_activity"],
            "team_metrics": team_metrics,
            "ownership_analysis": activity_analysis["ownership_analysis"],
            "insights": insights,
            "generated_at": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def _generate_team_insights(
        team_activity: Dict[str, Any],
        team_metrics: Dict[str, Any],
        team_percentages: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        """
        Generate insights from team analysis.
        
        Args:
            team_activity: Team activity data
            team_metrics: Team metrics
            team_percentages: Team ownership percentages
            
        Returns:
            List of insights
        """
        insights = []
        
        # Find most active team
        most_active_team = max(
            team_activity.items(),
            key=lambda x: x[1]["total_activity"],
            default=(None, None)
        )[0]
        
        if most_active_team:
            insights.append({
                "type": "most_active_team",
                "team": most_active_team,
                "activity": team_activity[most_active_team]["total_activity"],
                "message": f"{most_active_team} is the most active team with {team_activity[most_active_team]['total_activity']} activities."
            })
        
        # Find team with highest activity per member
        highest_activity_per_member = max(
            team_metrics.items(),
            key=lambda x: x[1]["activity_per_member"],
            default=(None, None)
        )[0]
        
        if highest_activity_per_member:
            insights.append({
                "type": "highest_activity_per_member",
                "team": highest_activity_per_member,
                "activity_per_member": team_metrics[highest_activity_per_member]["activity_per_member"],
                "message": f"{highest_activity_per_member} has the highest activity per member with {team_metrics[highest_activity_per_member]['activity_per_member']} activities per member."
            })
        
        # Find team with highest review ratio
        highest_review_ratio = max(
            team_metrics.items(),
            key=lambda x: x[1]["review_ratio"],
            default=(None, None)
        )[0]
        
        if highest_review_ratio:
            insights.append({
                "type": "highest_review_ratio",
                "team": highest_review_ratio,
                "review_ratio": team_metrics[highest_review_ratio]["review_ratio"],
                "message": f"{highest_review_ratio} has the highest review ratio with {team_metrics[highest_review_ratio]['review_ratio']} reviews per PR."
            })
        
        # Find team with highest code ownership
        highest_ownership = max(
            team_percentages.items(),
            key=lambda x: x[1],
            default=(None, None)
        )[0]
        
        if highest_ownership:
            insights.append({
                "type": "highest_ownership",
                "team": highest_ownership,
                "ownership_percentage": team_percentages[highest_ownership],
                "message": f"{highest_ownership} owns {team_percentages[highest_ownership]}% of the codebase."
            })
        
        # Find teams with low activity but high ownership
        for team, percentage in team_percentages.items():
            if percentage > 20 and team in team_activity:
                activity = team_activity[team]["total_activity"]
                if activity < 10:
                    insights.append({
                        "type": "low_activity_high_ownership",
                        "team": team,
                        "ownership_percentage": percentage,
                        "activity": activity,
                        "message": f"{team} owns {percentage}% of the codebase but has only {activity} activities."
                    })
        
        # Find teams with high activity but low ownership
        for team, activity_data in team_activity.items():
            activity = activity_data["total_activity"]
            if activity > 50 and team in team_percentages:
                percentage = team_percentages[team]
                if percentage < 10:
                    insights.append({
                        "type": "high_activity_low_ownership",
                        "team": team,
                        "ownership_percentage": percentage,
                        "activity": activity,
                        "message": f"{team} has {activity} activities but owns only {percentage}% of the codebase."
                    })
        
        return insights
