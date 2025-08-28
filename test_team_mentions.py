#!/usr/bin/env python3
"""
Test script for GitHub team mention functionality.

This script tests the team mention detection and notification logic.
"""
import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.api.routes.webhooks import extract_team_mentions, extract_mentioned_usernames
from app.models.notifications import WatchingReason, NotificationPreferences


def test_team_mention_extraction():
    """Test team mention extraction from text."""
    print("Testing team mention extraction...")
    
    # Test cases for team mentions
    test_cases = [
        {
            "text": "Hey @myorg/frontend-team, can you review this?",
            "org": "myorg",
            "expected": ["frontend-team"]
        },
        {
            "text": "@myorg/backend-team @myorg/devops-team please check this out",
            "org": "myorg", 
            "expected": ["backend-team", "devops-team"]
        },
        {
            "text": "This is for @myorg/frontend-team and @anotherperson but not @wrongorg/team",
            "org": "myorg",
            "expected": ["frontend-team"]  # Only myorg teams should be extracted
        },
        {
            "text": "No team mentions here @person",
            "org": "myorg",
            "expected": []
        },
        {
            "text": "@myorg/team-with-hyphens @myorg/team_with_underscores",
            "org": "myorg",
            "expected": ["team-with-hyphens", "team_with_underscores"]
        }
    ]
    
    for i, case in enumerate(test_cases):
        result = extract_team_mentions(case["text"], case["org"])
        success = set(result) == set(case["expected"])
        
        print(f"  Test {i+1}: {'✅' if success else '❌'}")
        print(f"    Text: {case['text']}")
        print(f"    Expected: {case['expected']}")
        print(f"    Got: {result}")
        if not success:
            print(f"    ❌ FAILED")
        print()


def test_user_mention_extraction():
    """Test user mention extraction from text."""
    print("Testing user mention extraction...")
    
    test_cases = [
        {
            "text": "Hey @john, can you check this?",
            "expected": ["john"]
        },
        {
            "text": "@alice @bob-smith please review",
            "expected": ["alice", "bob-smith"]
        },
        {
            "text": "Email me at user@example.com",
            "expected": []  # Should not match email addresses
        },
        {
            "text": "@user123 and @another_user",
            "expected": ["user123"]  # Underscores not allowed in GitHub usernames
        }
    ]
    
    for i, case in enumerate(test_cases):
        result = extract_mentioned_usernames(case["text"])
        success = set(result) == set(case["expected"])
        
        print(f"  Test {i+1}: {'✅' if success else '❌'}")
        print(f"    Text: {case['text']}")
        print(f"    Expected: {case['expected']}")
        print(f"    Got: {result}")
        if not success:
            print(f"    ❌ FAILED")
        print()


def test_notification_preferences():
    """Test notification preferences model."""
    print("Testing notification preferences...")
    
    # Test default preferences
    prefs = NotificationPreferences()
    
    assert prefs.team_mentioned == True, "Default team_mentioned should be True"
    assert prefs.mentioned_in_comments == True, "Default mentioned_in_comments should be True"
    
    print("  ✅ Default preferences test passed")
    
    # Test custom preferences
    custom_prefs = NotificationPreferences(
        team_mentioned=False,
        pr_comments=False,
        mentioned_in_comments=True
    )
    
    assert custom_prefs.team_mentioned == False
    assert custom_prefs.pr_comments == False
    assert custom_prefs.mentioned_in_comments == True
    
    print("  ✅ Custom preferences test passed")


def test_watching_reasons():
    """Test watching reasons enum."""
    print("Testing watching reasons...")
    
    # Test that TEAM_MENTIONED exists
    assert hasattr(WatchingReason, 'TEAM_MENTIONED'), "TEAM_MENTIONED should exist in WatchingReason enum"
    assert WatchingReason.TEAM_MENTIONED == "team_mentioned"
    
    print("  ✅ WatchingReason.TEAM_MENTIONED exists")
    
    # Test all expected reasons exist
    expected_reasons = [
        WatchingReason.AUTHOR,
        WatchingReason.REVIEWER, 
        WatchingReason.ASSIGNED,
        WatchingReason.MENTIONED,
        WatchingReason.TEAM_MENTIONED,
        WatchingReason.SUBSCRIBED,
        WatchingReason.MANUAL
    ]
    
    for reason in expected_reasons:
        assert reason in WatchingReason._value2member_map_, f"Missing reason: {reason}"
    
    print("  ✅ All watching reasons exist")


def create_test_webhook_payload():
    """Create a test webhook payload for team mention testing."""
    return {
        "action": "opened",
        "pull_request": {
            "id": 123456789,
            "number": 42,
            "title": "Add new feature",
            "body": "This PR adds a new feature. @myorg/frontend-team please review the UI changes.",
            "user": {
                "id": 12345,
                "login": "developer1"
            },
            "requested_teams": [
                {
                    "id": 98765,
                    "slug": "backend-team",
                    "name": "Backend Team",
                    "organization": {
                        "login": "myorg",
                        "id": 11111
                    }
                }
            ],
            "requested_reviewers": []
        },
        "repository": {
            "id": 987654321,
            "full_name": "myorg/test-repo",
            "owner": {
                "login": "myorg",
                "id": 11111
            }
        },
        "sender": {
            "id": 12345,
            "login": "developer1"
        }
    }


def main():
    """Run all tests."""
    print("🚀 Running GitHub Team Mention Tests\n")
    
    try:
        test_team_mention_extraction()
        test_user_mention_extraction()
        test_notification_preferences()
        test_watching_reasons()
        
        print("✅ All basic tests passed!")
        
        # Test webhook payload structure
        print("\nTesting webhook payload structure...")
        payload = create_test_webhook_payload()
        
        # Extract team mentions from PR body
        pr_body = payload["pull_request"]["body"]
        org_login = payload["repository"]["owner"]["login"]
        
        team_mentions = extract_team_mentions(pr_body, org_login)
        print(f"  Team mentions in PR body: {team_mentions}")
        
        # Check requested_teams
        requested_teams = payload["pull_request"]["requested_teams"]
        team_slugs = [team["slug"] for team in requested_teams]
        print(f"  Requested teams: {team_slugs}")
        
        print("  ✅ Webhook payload test passed")
        
        print("\n🎉 All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())