"""
GitHub service for Radar.

This module provides a service for interacting with the GitHub API.
"""
import base64
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union

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
            print("GitHub service init with token:", "*" * (len(token) - 8) + token[-8:] if len(token) > 8 else token)
            print("Token length:", len(token))
            print("Token prefix:", token[:4] if len(token) > 4 else token)
            
            # Check if token has the expected format
            if len(token) > 4:
                prefix = token[:4]
                if prefix != 'ghu_' and prefix != 'gho_' and prefix != 'ghp_':
                    print(f"WARNING: Token has unexpected prefix: {prefix}")
        else:
            print("GitHub service init with no token")
        
        if token:
            try:
                # Enable debug logging for PyGithub
                import logging
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
            
            now = datetime.utcnow()
            payload = {
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(minutes=10)).timestamp()),
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
            print(f"GitHub token validated successfully for user: {user.login}")
            print(f"User ID: {user.id}")
            print(f"User email: {user.email}")
            print(f"User name: {user.name}")
            print(f"User plan: {user.plan}")
            print(f"User created at: {user.created_at}")
            return True
        except GithubException as e:
            error_message = str(e)
            print(f"GitHub token validation failed: {error_message}")
            print(f"Error status: {e.status}")
            print(f"Error data: {e.data}")
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
            # Try a lightweight API call
            user = self.client.get_user()
            return False  # Token is valid
        except GithubException as e:
            if e.status == 401:
                # 401 Unauthorized means the token is invalid or expired
                return True
            # Other errors might not be related to token validity
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
            repos = []
            try:
                user = self.client.get_user()
                print(f"Getting repositories for GitHub user: {user.login}")
                for repo in user.get_repos():
                    repos.append({
                        "id": repo.id,
                        "name": repo.name,
                        "full_name": repo.full_name,
                        "description": repo.description,
                        "html_url": repo.html_url,
                        "private": repo.private,
                        "fork": repo.fork,
                        "owner": {
                            "id": repo.owner.id,
                            "login": repo.owner.login,
                            "avatar_url": repo.owner.avatar_url,
                            "html_url": repo.owner.html_url,
                            "type": repo.owner.type,
                        }
                    })
                return repos
            except GithubException as e:
                print(f"GitHub API error in get_repositories: {e}")
                if e.status == 401:
                    print("Authentication error: Token may be invalid or expired")
                raise
        except Exception as e:
            logger.error(f"GitHub API error: {e}", exc_info=True)
            raise
    
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
            prs = []
            for pr in self.client.get_repo(repo_full_name).get_pulls(state=state):
                prs.append({
                    "id": pr.id,
                    "number": pr.number,
                    "title": pr.title,
                    "body": pr.body,
                    "html_url": pr.html_url,
                    "state": pr.state,
                    "user": {
                        "id": pr.user.id,
                        "login": pr.user.login,
                        "avatar_url": pr.user.avatar_url,
                        "html_url": pr.user.html_url,
                    },
                    "created_at": pr.created_at.isoformat(),
                    "updated_at": pr.updated_at.isoformat(),
                    "closed_at": pr.closed_at.isoformat() if pr.closed_at else None,
                    "merged_at": pr.merged_at.isoformat() if pr.merged_at else None,
                    "merged": pr.merged,
                    "mergeable": pr.mergeable,
                    "draft": pr.draft,
                })
            
            return prs
        except GithubException as e:
            logger.error(f"GitHub API error: {e}", exc_info=True)
            raise
    
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
    
    def create_webhook(self, repo_full_name: str, webhook_url: str, events: List[str] = None, secret: Optional[str] = None) -> Dict[str, Any]:
        """
        Create webhook for a repository.
        
        Args:
            repo_full_name: Repository full name (owner/repo)
            webhook_url: Webhook URL
            events: List of events to trigger the webhook
            secret: Webhook secret
            
        Returns:
            Webhook data
        """
        try:
            if events is None:
                events = ["push", "pull_request", "pull_request_review", "pull_request_review_comment", "issues", "issue_comment"]
            
            config = {
                "url": webhook_url,
                "content_type": "json",
                "insecure_ssl": "0"
            }
            
            if secret:
                config["secret"] = secret
            
            webhook = self.client.get_repo(repo_full_name).create_hook(
                name="web",
                config=config,
                events=events,
                active=True
            )
            
            return {
                "id": webhook.id,
                "url": webhook.url,
                "events": webhook.events,
                "active": webhook.active,
                "config": webhook.config,
            }
        except GithubException as e:
            logger.error(f"GitHub API error: {e}", exc_info=True)
            raise
    
    def delete_webhook(self, repo_full_name: str, webhook_id: int) -> bool:
        """
        Delete webhook for a repository.
        
        Args:
            repo_full_name: Repository full name (owner/repo)
            webhook_id: Webhook ID
            
        Returns:
            True if successful
        """
        try:
            self.client.get_repo(repo_full_name).get_hook(webhook_id).delete()
            return True
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
