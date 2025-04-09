"""
GitHub service for Radar.

This module provides a service for interacting with the GitHub API.
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

import jwt
import requests
from github import Github
from github.GithubException import GithubException

from app.core.config import settings

logger = logging.getLogger(__name__)


class GitHubService:
    """Service for interacting with the GitHub API."""

    def __init__(self, token: Optional[str] = None, app_installation_id: Optional[int] = None):
        """
        Initialize the GitHub service.
        
        Args:
            token: GitHub access token
            app_installation_id: GitHub App installation ID
        """
        self.token = token
        self.app_installation_id = app_installation_id
        
        # Debug token format
        if token:
            # Check if token has the expected format
            if len(token) > 4:
                prefix = token[:4]
                if prefix != 'ghu_' and prefix != 'gho_' and prefix != 'ghp_':
                    print(f"WARNING: Token has unexpected prefix: {prefix}")
        else:
            print("GitHub service init with no token")
        
        if token:
            try:
                logging.getLogger('github').setLevel(logging.DEBUG)
                self.client = Github(token)
                # Test the connection with a lightweight call
                self.validate_token()
            except Exception as e:
                print(f"GitHub initialization error: {e}")
                # Still create the client, but log the error
                self.client = Github(token)
        elif app_installation_id:
            # Use GitHub App installation token
            self.client = self._get_app_client(app_installation_id)
        else:
            # Use GitHub App
            self.client = self._get_app_client()
    
    def _get_app_client(self, installation_id: Optional[int] = None) -> Github:
        """
        Get GitHub client for GitHub App.
        
        Args:
            installation_id: GitHub App installation ID
            
        Returns:
            GitHub client
        """
        try:
            # Read private key
            with open(settings.GITHUB_PRIVATE_KEY_PATH, "r") as key_file:
                private_key = key_file.read()
            
            # Create JWT
            import jwt
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import serialization
            
            now = int(datetime.now().timestamp())
            payload = {
                "iat": now - 30, # 30 seconds before current time
                "exp": now + 600,  # 10 minutes expiration
                "iss": settings.GITHUB_APP_ID
            }
            
            private_key_bytes = private_key.encode()
            private_key_obj = serialization.load_pem_private_key(
                private_key_bytes,
                password=None,
                backend=default_backend()
            )
            
            jwt_token = jwt.encode(
                payload,
                private_key_obj,
                algorithm="RS256"
            )
            
            if isinstance(jwt_token, bytes):
                jwt_token = jwt_token.decode("utf-8")
            
            # If installation ID is provided, get installation token
            if installation_id:
                # Get installation token
                headers = {
                    "Authorization": f"Bearer {jwt_token}",
                    "Accept": "application/vnd.github.v3+json"
                }
                
                # Use requests instead of httpx for synchronous HTTP requests
                response = requests.post(
                    f"https://api.github.com/app/installations/{installation_id}/access_tokens",
                    headers=headers
                )
                
                if response.status_code != 201:
                    logger.error(f"GitHub API error: {response.text}")
                    raise Exception(f"GitHub API error: {response.text}")
                
                installation_token = response.json()["token"]
                return Github(installation_token)
            
            # Return app client
            return Github(jwt=jwt_token)
            
        except Exception as e:
            logger.error(f"Error getting GitHub app client: {e}", exc_info=True)
            raise
    
    def validate_token(self) -> bool:
        """
        Validate GitHub token.
        
        Returns:
            True if token is valid
        """
        try:
            user = self.client.get_user()
            print(f"User data: {user}")
            return True
        except GithubException as e:
            if e.status == 401:
                print("Authentication error: Token may be invalid or expired")
            elif e.status == 403:
                print("Permission error: Token may not have required scopes")
            return False
        except Exception as e:
            print(f"Unexpected error validating token: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def needs_token_refresh(self) -> bool:
        """
        Check if the GitHub token needs to be refreshed.
        
        Returns:
            True if token needs to be refreshed
        """
        try:
            self.client.get_user()
            return False
        except GithubException as e:
            if e.status == 401:
                print("Token needs refresh: 401 Unauthorized")
                return True
            return False
    
    def get_user(self) -> Dict[str, Any]:
        """
        Get authenticated user.
        
        Returns:
            User data
        """
        try:
            user = self.client.get_user()
            
            return {
                "id": user.id,
                "login": user.login,
                "name": user.name,
                "email": user.email,
                "avatar_url": user.avatar_url,
                "html_url": user.html_url,
            }
        except GithubException as e:
            logger.error(f"GitHub API error: {e}", exc_info=True)
            raise
    
    def get_repositories(self) -> List[Dict[str, Any]]:
        """
        Get repositories for the authenticated user.
        
        Returns:
            List of repositories
        """
        try:
            # Get repositories
            repos = []
            
            # Get user repositories (including private ones)
            for repo in self.client.get_user().get_repos():
                repo_data = {
                    "id": repo.id,
                    "name": repo.name,
                    "full_name": repo.full_name,
                    "description": repo.description,
                    "html_url": repo.html_url,
                    "private": repo.private,
                    "fork": repo.fork,
                    "owner": {
                        "login": repo.owner.login,
                        "avatar_url": repo.owner.avatar_url,
                        "html_url": repo.owner.html_url
                    }
                }
                repos.append(repo_data)
            
            return repos
        except Exception as e:
            logger.error(f"Error getting repositories: {e}")
            return []
    
    def get_repository(self, repo_full_name: str) -> Dict[str, Any]:
        """
        Get repository.
        
        Args:
            repo_full_name: Repository full name (owner/repo)
            
        Returns:
            Repository data
        """
        try:
            repo = self.client.get_repo(repo_full_name)
            
            return {
                "id": repo.id,
                "name": repo.name,
                "full_name": repo.full_name,
                "html_url": repo.html_url,
                "description": repo.description,
                "private": repo.private,
                "owner": {
                    "id": repo.owner.id,
                    "login": repo.owner.login,
                    "avatar_url": repo.owner.avatar_url,
                    "html_url": repo.owner.html_url,
                },
                "created_at": repo.created_at.isoformat(),
                "updated_at": repo.updated_at.isoformat(),
                "pushed_at": repo.pushed_at.isoformat() if repo.pushed_at else None,
                "language": repo.language,
                "default_branch": repo.default_branch,
            }
        except GithubException as e:
            logger.error(f"GitHub API error: {e}", exc_info=True)
            raise
    
    def get_pull_requests(self, repo_full_name: str, state: str = "all") -> List[Dict[str, Any]]:
        """
        Get pull requests for a repository.
        
        Args:
            repo_full_name: Repository full name (owner/repo)
            state: Pull request state (open, closed, all)
            
        Returns:
            List of pull requests
        """
        try:
            # Get repository
            repo = self.client.get_repo(repo_full_name)
            
            # Get pull requests
            pull_requests = []
            for pr in repo.get_pulls(state=state):
                pull_requests.append({
                    "id": pr.id,
                    "number": pr.number,
                    "title": pr.title,
                    "state": pr.state,
                    "html_url": pr.html_url,
                    "created_at": pr.created_at.isoformat(),
                    "updated_at": pr.updated_at.isoformat(),
                    "closed_at": pr.closed_at.isoformat() if pr.closed_at else None,
                    "merged_at": pr.merged_at.isoformat() if pr.merged_at else None,
                    "user": {
                        "id": pr.user.id,
                        "login": pr.user.login,
                        "avatar_url": pr.user.avatar_url,
                        "html_url": pr.user.html_url
                    },
                    "body": pr.body,
                    "draft": pr.draft,
                    "merged": pr.merged,
                    "mergeable": pr.mergeable,
                    "mergeable_state": pr.mergeable_state,
                    "comments": pr.comments,
                    "review_comments": pr.review_comments,
                    "commits": pr.commits,
                    "additions": pr.additions,
                    "deletions": pr.deletions,
                    "changed_files": pr.changed_files
                })
            
            return pull_requests
        except Exception as e:
            logger.error(f"Error getting pull requests for {repo_full_name}: {e}")
            return []
    
    def get_pull_request(self, repo_full_name: str, pr_number: int) -> Optional[Dict[str, Any]]:
        """
        Get a specific pull request by repository and PR number.
        
        Args:
            repo_full_name: Repository full name (owner/repo)
            pr_number: Pull request number
            
        Returns:
            Pull request data or None if not found
        """
        try:
            # Get repository
            repo = self.client.get_repo(repo_full_name)
            
            # Get pull request
            pr = repo.get_pull(pr_number)
            
            # Get requested reviewers
            requested_reviewers = []
            for reviewer in pr.get_review_requests()[0]:  # Returns (users, teams)
                requested_reviewers.append({
                    "id": reviewer.id,
                    "login": reviewer.login,
                    "avatar_url": reviewer.avatar_url,
                    "html_url": reviewer.html_url
                })
            
            # Get assignees
            assignees = []
            for assignee in pr.assignees:
                assignees.append({
                    "id": assignee.id,
                    "login": assignee.login,
                    "avatar_url": assignee.avatar_url,
                    "html_url": assignee.html_url
                })
            
            return {
                "id": pr.id,
                "number": pr.number,
                "title": pr.title,
                "state": pr.state,
                "html_url": pr.html_url,
                "created_at": pr.created_at.isoformat(),
                "updated_at": pr.updated_at.isoformat(),
                "closed_at": pr.closed_at.isoformat() if pr.closed_at else None,
                "merged_at": pr.merged_at.isoformat() if pr.merged_at else None,
                "user": {
                    "id": pr.user.id,
                    "login": pr.user.login,
                    "avatar_url": pr.user.avatar_url,
                    "html_url": pr.user.html_url
                },
                "body": pr.body,
                "draft": pr.draft,
                "merged": pr.merged,
                "mergeable": pr.mergeable,
                "mergeable_state": pr.mergeable_state,
                "comments": pr.comments,
                "review_comments": pr.review_comments,
                "commits": pr.commits,
                "additions": pr.additions,
                "deletions": pr.deletions,
                "changed_files": pr.changed_files,
                "requested_reviewers": requested_reviewers,
                "assignees": assignees
            }
        except Exception as e:
            logger.error(f"Error getting pull request {pr_number} for {repo_full_name}: {e}")
            return None
    
    def get_issues(self, repo_full_name: str, state: str = "all") -> List[Dict[str, Any]]:
        """
        Get issues for a repository.
        
        Args:
            repo_full_name: Repository full name (owner/repo)
            state: Issue state (open, closed, all)
            
        Returns:
            List of issues
        """
        try:
            issues = []
            for issue in self.client.get_repo(repo_full_name).get_issues(state=state):
                # Skip pull requests
                if issue.pull_request:
                    continue
                
                issues.append({
                    "id": issue.id,
                    "number": issue.number,
                    "title": issue.title,
                    "body": issue.body,
                    "html_url": issue.html_url,
                    "state": issue.state,
                    "user": {
                        "id": issue.user.id,
                        "login": issue.user.login,
                        "avatar_url": issue.user.avatar_url,
                        "html_url": issue.user.html_url,
                    },
                    "created_at": issue.created_at.isoformat(),
                    "updated_at": issue.updated_at.isoformat(),
                    "closed_at": issue.closed_at.isoformat() if issue.closed_at else None,
                })
            
            return issues
        except GithubException as e:
            logger.error(f"GitHub API error: {e}", exc_info=True)
            raise
    
    def test_token(self) -> bool:
        """
        Test GitHub token with a simple API call.
        
        Returns:
            True if token is valid
        """
        try:
            # Try a simple API call that doesn't require any specific permissions
            rate_limit = self.client.get_rate_limit()
            print(f"GitHub API rate limit: {rate_limit.core.limit}")
            print(f"GitHub API rate limit remaining: {rate_limit.core.remaining}")
            print(f"GitHub API rate limit reset: {rate_limit.core.reset}")
            return True
        except GithubException as e:
            print(f"GitHub API error testing token: {e}")
            print(f"Error status: {e.status}")
            print(f"Error data: {e.data}")
            return False
        except Exception as e:
            print(f"Unexpected error testing token: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def try_token_formats(self, token: str) -> bool:
        """
        Try different token formats.
        
        Args:
            token: GitHub access token
            
        Returns:
            True if token is valid in any format
        """
        try:
            # Try token as is
            self.client = Github(token)
            if self.validate_token():
                return True
            
            # Try token with 'ghu_' prefix
            self.client = Github('ghu_' + token)
            if self.validate_token():
                return True
            
            # Try token with 'gho_' prefix
            self.client = Github('gho_' + token)
            if self.validate_token():
                return True
            
            # Try token with 'ghp_' prefix
            self.client = Github('ghp_' + token)
            if self.validate_token():
                return True
            
            return False
        except Exception as e:
            print(f"Unexpected error trying token formats: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    @staticmethod
    def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
        """
        Verify webhook signature.
        
        Args:
            payload: Webhook payload
            signature: Webhook signature
            secret: Webhook secret
            
        Returns:
            True if signature is valid
        """
        import hmac
        import hashlib
        
        if not signature or not signature.startswith("sha1="):
            return False
        
        signature = signature.replace("sha1=", "")
        
        mac = hmac.new(secret.encode(), msg=payload, digestmod=hashlib.sha1)
        expected_signature = mac.hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)

    def get_app_installations(self, github_login: str) -> List[Dict[str, Any]]:
        """
        Get GitHub App installations for a user.
        
        Args:
            github_login: GitHub username
            
        Returns:
            List of installations
        """
        try:
            # Create JWT for GitHub App
            with open(settings.GITHUB_PRIVATE_KEY_PATH, "r") as key_file:
                private_key = key_file.read()
            
            # Create JWT payload with integer timestamps
            now = int(datetime.now().timestamp())
            payload = {
                "iat": now - 30, # 30 seconds before current time
                "exp": now + 600,  # 10 minutes expiration
                "iss": settings.GITHUB_APP_ID
            }
            print(f"JWT payload: {payload}")
            
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import serialization
            
            private_key_bytes = private_key.encode()
            private_key_obj = serialization.load_pem_private_key(
                private_key_bytes,
                password=None,
                backend=default_backend()
            )
            
            jwt_token = jwt.encode(
                payload,
                private_key_obj,
                algorithm="RS256"
            )
            
            if isinstance(jwt_token, bytes):
                jwt_token = jwt_token.decode("utf-8")
            
            # Get installations for the app
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
            
            # First get all installations for the GitHub App
            response = requests.get(
                "https://api.github.com/app/installations",
                headers=headers
            )
            
            if response.status_code != 200:
                logger.error(f"GitHub API error getting installations: {response.text}")
                return []
            
            all_installations = response.json()
            
            # Get user's organizations using their personal access token
            if self.token:
                user_orgs = []
                try:
                    user_orgs_response = requests.get(
                        "https://api.github.com/user/orgs",
                        headers={"Authorization": f"token {self.token}"}
                    )
                    if user_orgs_response.status_code == 200:
                        user_orgs = [org["login"] for org in user_orgs_response.json()]
                except Exception as e:
                    logger.error(f"Error getting user organizations: {e}")
            
                # Filter installations to include those for the user and their organizations
                user_installations = []
                for installation in all_installations:
                    account = installation.get("account", {})
                    account_login = account.get("login", "")
                    
                    # Include if it's the user's personal installation or an org they belong to
                    if account_login == github_login or account_login in user_orgs:
                        user_installations.append(installation)
                
                return user_installations
            else:
                # If no token is available, just return all installations
                # This is less accurate but better than nothing
                return all_installations
        except Exception as e:
            logger.error(f"Error getting app installations: {e}")
            return []
    
    def get_installation_repositories(self, installation_id: int) -> List[Dict[str, Any]]:
        """
        Get repositories that a GitHub App installation has access to.
        
        Args:
            installation_id: GitHub App installation ID
            
        Returns:
            List of repositories
        """
        try:
            # Create JWT for GitHub App
            with open(settings.GITHUB_PRIVATE_KEY_PATH, "r") as key_file:
                private_key = key_file.read()
            
            # Create JWT payload with integer timestamps
            now = int(datetime.now().timestamp())
            payload = {
                "iat": now - 30, # 30 seconds before current time
                "exp": now + 600,  # 10 minutes expiration
                "iss": settings.GITHUB_APP_ID
            }
            
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import serialization
            
            private_key_bytes = private_key.encode()
            private_key_obj = serialization.load_pem_private_key(
                private_key_bytes,
                password=None,
                backend=default_backend()
            )
            
            jwt_token = jwt.encode(
                payload,
                private_key_obj,
                algorithm="RS256"
            )
            
            if isinstance(jwt_token, bytes):
                jwt_token = jwt_token.decode("utf-8")
            
            # Get installation token
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
            
            response = requests.post(
                f"https://api.github.com/app/installations/{installation_id}/access_tokens",
                headers=headers
            )
            
            if response.status_code != 201:
                logger.error(f"GitHub API error getting installation token: {response.text}")
                return []
            
            installation_token = response.json()["token"]
            
            # Use the installation token to get repositories
            headers = {
                "Authorization": f"Bearer {installation_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
            
            response = requests.get(
                "https://api.github.com/installation/repositories",
                headers=headers
            )
            
            if response.status_code != 200:
                logger.error(f"GitHub API error getting installation repositories: {response.text}")
                return []
            
            repositories = response.json().get("repositories", [])
            
            repos = []
            for repo in repositories:
                repo_data = {
                    "id": repo["id"],
                    "name": repo["name"],
                    "full_name": repo["full_name"],
                    "description": repo.get("description", ""),
                    "html_url": repo["html_url"],
                    "private": repo["private"],
                    "fork": repo.get("fork", False),
                    "owner": {
                        "login": repo["owner"]["login"],
                        "avatar_url": repo["owner"]["avatar_url"],
                        "html_url": repo["owner"]["html_url"]
                    }
                }
                repos.append(repo_data)
            
            return repos
        except Exception as e:
            logger.error(f"Error getting installation repositories: {e}")
            return []
