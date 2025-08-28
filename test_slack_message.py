#!/usr/bin/env python3
"""
CLI script for testing Slack messages with the Radar testing API.

This script allows you to quickly send test Slack messages without having to
construct HTTP requests manually. It supports all message types available
in the testing API.

Usage:
    python test_slack_message.py --token YOUR_TOKEN --channel CHANNEL --type pull_request
    python test_slack_message.py --token YOUR_TOKEN --channel CHANNEL --type issue --issue-title "Bug fix needed"
    python test_slack_message.py --help
"""
import argparse
import asyncio
import sys
import json
from typing import Optional

import httpx

# Default API base URL (adjust if running on different host/port)
DEFAULT_API_URL = "http://localhost:8000/api/testing"

async def send_test_message(
    api_url: str,
    slack_token: str,
    channel: str,
    message_type: str,
    **kwargs
) -> dict:
    """
    Send a test message to the Radar testing API.
    
    Args:
        api_url: Base URL of the testing API
        slack_token: Slack access token
        channel: Slack channel ID or name
        message_type: Type of message to send
        **kwargs: Additional message parameters
        
    Returns:
        API response dictionary
    """
    payload = {
        "slack_access_token": slack_token,
        "channel": channel,
        "message_type": message_type,
        **kwargs
    }
    
    # Remove None values
    payload = {k: v for k, v in payload.items() if v is not None}
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{api_url}/send-test-message",
            json=payload,
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()

async def get_message_types(api_url: str) -> dict:
    """
    Get supported message types from the API.
    
    Args:
        api_url: Base URL of the testing API
        
    Returns:
        API response with supported message types
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{api_url}/message-types")
        response.raise_for_status()
        return response.json()

def print_message_types():
    """Print information about supported message types."""
    print("Supported message types:")
    print()
    print("  pull_request        - Pull request notifications (opened, closed, merged, etc.)")
    print("  pull_request_review - Pull request review notifications") 
    print("  pull_request_comment - Pull request comment notifications")
    print("  issue               - Issue notifications (opened, closed, etc.)")
    print("  issue_comment       - Issue comment notifications")
    print("  digest              - Daily/weekly digest of GitHub activity")
    print("  stats               - GitHub activity statistics")
    print()
    print("Use --help to see all available parameters.")

def create_parser():
    """Create the argument parser."""
    parser = argparse.ArgumentParser(
        description="Test Slack messages with the Radar testing API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Send a pull request notification
  python test_slack_message.py --token xoxb-... --channel "#general" --type pull_request --pr-number 123 --pr-title "Fix bug"

  # Send a review notification
  python test_slack_message.py --token xoxb-... --channel "#general" --type pull_request_review --pr-number 123 --review-state approved

  # Send an issue notification
  python test_slack_message.py --token xoxb-... --channel "#general" --type issue --issue-number 456 --issue-title "New feature request"

  # Send a digest
  python test_slack_message.py --token xoxb-... --channel "#general" --type digest

  # List supported message types
  python test_slack_message.py --list-types
        """
    )
    
    parser.add_argument(
        "--api-url",
        default=DEFAULT_API_URL,
        help=f"API base URL (default: {DEFAULT_API_URL})"
    )
    
    parser.add_argument(
        "--token",
        required=False,
        help="Slack access token (required unless using --list-types)"
    )
    
    parser.add_argument(
        "--channel",
        help="Slack channel ID or name (e.g., '#general', 'C1234567890')"
    )
    
    parser.add_argument(
        "--type",
        choices=["pull_request", "pull_request_review", "pull_request_comment", 
                "issue", "issue_comment", "digest", "stats"],
        help="Type of message to send"
    )
    
    parser.add_argument(
        "--list-types",
        action="store_true",
        help="List supported message types and exit"
    )
    
    # Pull request parameters
    pr_group = parser.add_argument_group("Pull Request parameters")
    pr_group.add_argument("--pr-number", type=int, help="Pull request number")
    pr_group.add_argument("--pr-title", help="Pull request title")
    pr_group.add_argument("--pr-url", help="Pull request URL")
    pr_group.add_argument(
        "--pr-action", 
        choices=["opened", "closed", "merged", "reopened", "assigned", "unassigned", "review_requested", "review_request_removed", "edited"],
        help="Pull request action"
    )
    
    # Review parameters
    review_group = parser.add_argument_group("Review parameters")
    review_group.add_argument(
        "--review-state",
        choices=["approved", "changes_requested", "commented", "dismissed"],
        help="Review state"
    )
    review_group.add_argument("--review-comment", help="Review comment text")
    
    # Issue parameters
    issue_group = parser.add_argument_group("Issue parameters")
    issue_group.add_argument("--issue-number", type=int, help="Issue number")
    issue_group.add_argument("--issue-title", help="Issue title")
    issue_group.add_argument("--issue-url", help="Issue URL")
    issue_group.add_argument(
        "--issue-action",
        choices=["opened", "closed", "reopened", "assigned", "unassigned", "edited"],
        help="Issue action"
    )
    
    # Comment parameters
    comment_group = parser.add_argument_group("Comment parameters")
    comment_group.add_argument("--comment", help="Comment text")
    
    # Common parameters
    common_group = parser.add_argument_group("Common parameters")
    common_group.add_argument("--repository", help="Repository name (default: 'test/repo')")
    common_group.add_argument("--user", help="GitHub username (default: 'testuser')")
    common_group.add_argument("--date", help="Date for digest/stats messages (YYYY-MM-DD)")
    
    return parser

async def main():
    """Main function."""
    parser = create_parser()
    args = parser.parse_args()
    
    if args.list_types:
        print_message_types()
        return
    
    if not args.token:
        print("Error: --token is required", file=sys.stderr)
        parser.print_help()
        sys.exit(1)
    
    if not args.channel:
        print("Error: --channel is required", file=sys.stderr)
        parser.print_help()
        sys.exit(1)
        
    if not args.type:
        print("Error: --type is required", file=sys.stderr)
        parser.print_help()
        sys.exit(1)
    
    # Build the message parameters
    message_params = {}
    
    # Add pull request parameters
    if args.pr_number:
        message_params["pr_number"] = args.pr_number
    if args.pr_title:
        message_params["pr_title"] = args.pr_title
    if args.pr_url:
        message_params["pr_url"] = args.pr_url
    if args.pr_action:
        message_params["pr_action"] = args.pr_action
    
    # Add review parameters
    if args.review_state:
        message_params["review_state"] = args.review_state
    if args.review_comment:
        message_params["review_comment"] = args.review_comment
    
    # Add issue parameters
    if args.issue_number:
        message_params["issue_number"] = args.issue_number
    if args.issue_title:
        message_params["issue_title"] = args.issue_title
    if args.issue_url:
        message_params["issue_url"] = args.issue_url
    if args.issue_action:
        message_params["issue_action"] = args.issue_action
    
    # Add comment parameters
    if args.comment:
        message_params["comment"] = args.comment
    
    # Add common parameters
    if args.repository:
        message_params["repository"] = args.repository
    if args.user:
        message_params["user"] = args.user
    if args.date:
        message_params["date"] = args.date
    
    try:
        print(f"Sending {args.type} message to {args.channel}...")
        response = await send_test_message(
            api_url=args.api_url,
            slack_token=args.token,
            channel=args.channel,
            message_type=args.type,
            **message_params
        )
        
        if response.get("success"):
            print("✅ Message sent successfully!")
            if response.get("message_ts"):
                print(f"   Message timestamp: {response['message_ts']}")
            if response.get("channel"):
                print(f"   Channel: {response['channel']}")
        else:
            print("❌ Failed to send message")
            if response.get("error"):
                print(f"   Error: {response['error']}")
                
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP {e.response.status_code} error: {e.response.url}", file=sys.stderr)
        try:
            error_detail = e.response.json()
            if isinstance(error_detail, dict):
                if "detail" in error_detail:
                    print(f"   Detail: {error_detail['detail']}", file=sys.stderr)
                elif "error" in error_detail:
                    print(f"   Error: {error_detail['error']}", file=sys.stderr)
                else:
                    print(f"   Response: {error_detail}", file=sys.stderr)
            else:
                print(f"   Response: {error_detail}", file=sys.stderr)
        except Exception:
            print(f"   Raw response: {e.response.text}", file=sys.stderr)
        sys.exit(1)
    except httpx.HTTPError as e:
        print(f"❌ Network error: {e}", file=sys.stderr)
        print("   Make sure the Radar API server is running at the specified URL", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())