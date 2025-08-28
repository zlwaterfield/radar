#!/usr/bin/env python3
"""
Standalone test script for team mention detection logic.
"""
import re
from typing import List


def extract_team_mentions(text: str, org_login: str) -> List[str]:
    """
    Extract GitHub team mentions in text using @org/team-name syntax.
    
    Args:
        text: Text to search for team mentions
        org_login: GitHub organization login
        
    Returns:
        List of mentioned team slugs (without @org/ prefix)
    """
    if not text or not org_login:
        return []
    
    # Find all @organization/team-name mentions
    # GitHub team names can contain letters, numbers, hyphens, and underscores
    # They cannot start with a hyphen or underscore
    org_escaped = re.escape(org_login)
    pattern = rf'@{org_escaped}/([a-zA-Z0-9][a-zA-Z0-9\-_]*)'
    mentions = re.findall(pattern, text)
    return list(set(mentions))  # Remove duplicates


def extract_mentioned_usernames(text: str) -> List[str]:
    """
    Extract GitHub usernames mentioned in text using @username syntax.
    
    Args:
        text: Text to search for mentions
        
    Returns:
        List of mentioned usernames (without @)
    """
    if not text:
        return []
    
    # Find all @username mentions, but exclude @org/team mentions
    # GitHub usernames can contain letters, numbers, and hyphens
    # They cannot start with a hyphen and are case insensitive
    # Use negative lookahead to exclude org/team format
    mentions = re.findall(r'(?:^|[^a-zA-Z0-9.])@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)(?![a-zA-Z0-9\-_]*\/)', text)
    return list(set(mentions))  # Remove duplicates


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
    
    all_passed = True
    
    for i, case in enumerate(test_cases):
        result = extract_team_mentions(case["text"], case["org"])
        success = set(result) == set(case["expected"])
        
        print(f"  Test {i+1}: {'✅' if success else '❌'}")
        print(f"    Text: {case['text']}")
        print(f"    Expected: {case['expected']}")
        print(f"    Got: {result}")
        if not success:
            print(f"    ❌ FAILED")
            all_passed = False
        print()
    
    return all_passed


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
            "text": "@user123 and @another-user but not @-invalid",
            "expected": ["user123", "another-user"]  # Hyphens allowed, can't start with hyphen
        }
    ]
    
    all_passed = True
    
    for i, case in enumerate(test_cases):
        result = extract_mentioned_usernames(case["text"])
        success = set(result) == set(case["expected"])
        
        print(f"  Test {i+1}: {'✅' if success else '❌'}")
        print(f"    Text: {case['text']}")
        print(f"    Expected: {case['expected']}")
        print(f"    Got: {result}")
        if not success:
            print(f"    ❌ FAILED")
            all_passed = False
        print()
    
    return all_passed


def test_real_world_examples():
    """Test with real-world examples."""
    print("Testing real-world examples...")
    
    examples = [
        {
            "name": "PR description",
            "text": """## Summary
This PR adds authentication to the API.

## Review
@myorg/backend-team please review the auth logic
@myorg/security-team please check for security issues
            
cc @john-doe for visibility""",
            "org": "myorg",
            "expected_teams": ["backend-team", "security-team"],
            "expected_users": ["john-doe"]
        },
        {
            "name": "Issue comment",
            "text": "@myorg/frontend-team can you help debug this CSS issue? Also tagging @designer for input.",
            "org": "myorg", 
            "expected_teams": ["frontend-team"],
            "expected_users": ["designer"]
        }
    ]
    
    all_passed = True
    
    for example in examples:
        print(f"  Example: {example['name']}")
        
        # Test team mentions
        team_result = extract_team_mentions(example["text"], example["org"])
        team_success = set(team_result) == set(example["expected_teams"])
        
        print(f"    Teams: {'✅' if team_success else '❌'}")
        print(f"      Expected: {example['expected_teams']}")
        print(f"      Got: {team_result}")
        
        # Test user mentions
        user_result = extract_mentioned_usernames(example["text"])
        user_success = set(user_result) == set(example["expected_users"])
        
        print(f"    Users: {'✅' if user_success else '❌'}")
        print(f"      Expected: {example['expected_users']}")
        print(f"      Got: {user_result}")
        
        if not (team_success and user_success):
            all_passed = False
        
        print()
    
    return all_passed


def main():
    """Run all tests."""
    print("🚀 Running GitHub Team Mention Tests (Standalone)\n")
    
    try:
        results = []
        results.append(test_team_mention_extraction())
        results.append(test_user_mention_extraction())
        results.append(test_real_world_examples())
        
        if all(results):
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            return 1
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())