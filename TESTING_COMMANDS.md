# Complete Test Command Reference

This document provides a comprehensive list of all test commands for every supported GitHub action and message type in Radar.

## 🎯 Quick Test Commands

Replace `TOKEN` with your Slack token and `#general` with your desired channel.

### **Pull Request Actions**

#### PR Opened
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action opened --pr-number 123 --pr-title "Add user authentication feature" --repository "myorg/myapp" --user "developer"
```

#### PR Closed (Not Merged)
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action closed --pr-number 124 --pr-title "Fix login validation bug" --repository "myorg/myapp" --user "developer"
```

#### PR Merged
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action merged --pr-number 125 --pr-title "Update API documentation" --repository "myorg/myapp" --user "developer"
```

#### PR Reopened
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action reopened --pr-number 126 --pr-title "Add unit tests for auth module" --repository "myorg/myapp" --user "developer"
```

#### PR Assigned
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action assigned --pr-number 127 --pr-title "Refactor database queries" --repository "myorg/myapp" --user "developer"
```

#### PR Unassigned
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action unassigned --pr-number 128 --pr-title "Update dependencies" --repository "myorg/myapp" --user "developer"
```

#### Review Requested
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action review_requested --pr-number 129 --pr-title "Implement rate limiting" --repository "myorg/myapp" --user "developer"
```

#### Review Request Removed
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action review_request_removed --pr-number 130 --pr-title "Fix memory leak in scheduler" --repository "myorg/myapp" --user "developer"
```

#### PR Edited
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action edited --pr-number 131 --pr-title "Updated: Add caching layer to API" --repository "myorg/myapp" --user "developer"
```

### **Pull Request Reviews**

#### Review Approved
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request_review --pr-number 123 --pr-title "Add user authentication" --review-state approved --review-comment "LGTM! Great implementation and thorough tests." --repository "myorg/myapp" --user "reviewer"
```

#### Changes Requested
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request_review --pr-number 124 --pr-title "Fix login validation" --review-state changes_requested --review-comment "Please address the security vulnerabilities in the password validation logic." --repository "myorg/myapp" --user "reviewer"
```

#### Review Comment (No Decision)
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request_review --pr-number 125 --pr-title "Update documentation" --review-state commented --review-comment "Consider adding more examples in the API documentation section." --repository "myorg/myapp" --user "reviewer"
```

#### Review Dismissed
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request_review --pr-number 126 --pr-title "Add unit tests" --review-state dismissed --review-comment "Review no longer relevant after recent changes." --repository "myorg/myapp" --user "reviewer"
```

### **Pull Request Comments**

#### General PR Comment
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request_comment --pr-number 123 --pr-title "Add authentication" --comment "Have you tested this with different browsers? Safari might have issues with the new auth flow." --repository "myorg/myapp" --user "commenter"
```

#### Technical Discussion
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request_comment --pr-number 124 --pr-title "Refactor API" --comment "This approach looks good, but we might want to consider using a factory pattern here for better testability." --repository "myorg/myapp" --user "architect"
```

### **Issue Actions**

#### Issue Opened
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type issue --issue-action opened --issue-number 456 --issue-title "Bug: Login fails on mobile Safari" --repository "myorg/myapp" --user "reporter"
```

#### Issue Closed
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type issue --issue-action closed --issue-number 457 --issue-title "Feature request: Dark mode support" --repository "myorg/myapp" --user "maintainer"
```

#### Issue Reopened
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type issue --issue-action reopened --issue-number 458 --issue-title "Performance issues with large datasets" --repository "myorg/myapp" --user "reporter"
```

#### Issue Assigned
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type issue --issue-action assigned --issue-number 459 --issue-title "High priority: Data corruption in exports" --repository "myorg/myapp" --user "maintainer"
```

#### Issue Unassigned
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type issue --issue-action unassigned --issue-number 460 --issue-title "Enhancement: Add keyboard shortcuts" --repository "myorg/myapp" --user "maintainer"
```

#### Issue Edited
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type issue --issue-action edited --issue-number 461 --issue-title "Updated: Memory leak in background processing" --repository "myorg/myapp" --user "reporter"
```

### **Issue Comments**

#### Bug Report Comment
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type issue_comment --issue-number 456 --issue-title "Login fails on mobile" --comment "I can reproduce this bug on iPhone 12 with iOS 15. It seems to be related to the cookie handling." --repository "myorg/myapp" --user "tester"
```

#### Solution Suggestion
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type issue_comment --issue-number 457 --issue-title "Performance issues" --comment "I'd be happy to work on this! I think we could optimize the database queries using indexing." --repository "myorg/myapp" --user "contributor"
```

### **Digest Messages**

#### Daily Digest
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type digest --date "2024-01-15"
```

#### Weekly Digest (use different date)
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type digest --date "2024-01-21"
```

### **Statistics Messages**

#### Current Stats
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type stats --date "2024-01-15"
```

#### Historical Stats
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type stats --date "2024-01-01"
```

## 🚀 Batch Testing Script

Save this as `test_all_messages.sh` for quick testing:

```bash
#!/bin/bash

TOKEN="$1"
CHANNEL="$2"

if [ -z "$TOKEN" ] || [ -z "$CHANNEL" ]; then
    echo "Usage: ./test_all_messages.sh YOUR_TOKEN '#channel'"
    exit 1
fi

echo "Testing all message types with token ending in ...${TOKEN: -4}"

# Test PR actions
echo "🔄 Testing Pull Request actions..."
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type pull_request --pr-action opened --pr-number 100
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type pull_request --pr-action merged --pr-number 101
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type pull_request --pr-action review_requested --pr-number 102

# Test reviews
echo "✅ Testing Pull Request reviews..."
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type pull_request_review --pr-number 100 --review-state approved
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type pull_request_review --pr-number 101 --review-state changes_requested

# Test comments
echo "💬 Testing Comments..."
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type pull_request_comment --pr-number 100 --comment "Test comment"
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type issue_comment --issue-number 200 --comment "Test issue comment"

# Test issues
echo "🐛 Testing Issues..."
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type issue --issue-action opened --issue-number 200
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type issue --issue-action closed --issue-number 201

# Test digest and stats
echo "📊 Testing Digest and Stats..."
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type digest
python test_slack_message.py --token "$TOKEN" --channel "$CHANNEL" --type stats

echo "✅ All tests completed!"
```

Make it executable: `chmod +x test_all_messages.sh`

Run it: `./test_all_messages.sh xoxb-YOUR-TOKEN '#test-channel'`

## 📋 Complete Action Reference

| Message Type | Supported Actions |
|--------------|------------------|
| **pull_request** | `opened`, `closed`, `merged`, `reopened`, `assigned`, `unassigned`, `review_requested`, `review_request_removed`, `edited` |
| **pull_request_review** | `approved`, `changes_requested`, `commented`, `dismissed` |
| **pull_request_comment** | N/A (comments don't have actions) |
| **issue** | `opened`, `closed`, `reopened`, `assigned`, `unassigned`, `edited` |
| **issue_comment** | N/A (comments don't have actions) |
| **digest** | N/A (generated summaries) |
| **stats** | N/A (generated statistics) |

## 🔧 Advanced Usage

### Custom Repository and User
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action opened --repository "facebook/react" --user "gaearon" --pr-number 12345 --pr-title "Add concurrent features"
```

### Custom URLs
```bash
python test_slack_message.py --token TOKEN --channel "#general" --type pull_request --pr-action opened --pr-url "https://github.com/microsoft/vscode/pull/12345" --pr-number 12345 --pr-title "Improve syntax highlighting"
```

### Testing Private Channels
```bash
# Use channel ID instead of name for private channels
python test_slack_message.py --token TOKEN --channel "C1234567890" --type pull_request --pr-action opened
```

This reference covers all supported actions and provides realistic examples for comprehensive testing!