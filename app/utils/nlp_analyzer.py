"""
Natural Language Processing utilities for Radar.

This module provides NLP-based analysis for GitHub content including
issues, pull requests, comments, and commit messages.
"""
import re
import logging
from typing import Dict, List, Optional, Set, Tuple, Any
import json

logger = logging.getLogger(__name__)

# Common patterns to detect in text
PATTERNS = {
    "urgent": r"\b(urgent|asap|emergency|critical|blocker|p0|p1)\b",
    "security": r"\b(security|vulnerability|exploit|breach|cve|hack|attack|threat)\b",
    "bug": r"\b(bug|fix|issue|defect|problem|error|exception|crash|failure)\b",
    "feature": r"\b(feature|enhancement|improvement|add|implement|support)\b",
    "question": r"\b(question|help|clarification|explain|how to|what is)\b",
    "review_request": r"\b(review|feedback|thoughts|opinion|take a look)\b",
    "breaking_change": r"\b(breaking change|backwards incompatible|migration required)\b",
    "dependency": r"\b(dependency|upgrade|update|bump|version)\b",
    "documentation": r"\b(docs|documentation|readme|wiki|guide|tutorial)\b",
    "performance": r"\b(performance|speed|optimize|slow|fast|latency|memory|cpu|resource)\b",
    "test": r"\b(test|spec|unittest|integration test|e2e|coverage)\b",
    "refactor": r"\b(refactor|clean|restructure|rewrite|reorganize)\b",
    "deadline": r"\b(deadline|due|by|before|tomorrow|today|asap)\b",
    "praise": r"\b(great job|well done|awesome|excellent|thank you|thanks|kudos)\b",
    "blocked": r"\b(blocked|waiting|depends on|dependency|blocker)\b",
    "mention": r"@[\w-]+",
}

# Priority levels for different content types
PRIORITY_LEVELS = {
    "urgent": 5,
    "security": 5,
    "bug": 4,
    "breaking_change": 4,
    "blocked": 4,
    "deadline": 4,
    "question": 3,
    "review_request": 3,
    "feature": 2,
    "dependency": 2,
    "performance": 2,
    "test": 1,
    "refactor": 1,
    "documentation": 1,
    "praise": 1,
    "mention": 3,
}

class ContentAnalyzer:
    """Analyzes GitHub content using NLP techniques."""
    
    @staticmethod
    def analyze_text(text: str, custom_patterns: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Analyze text content for patterns and sentiment.
        
        Args:
            text: The text to analyze
            custom_patterns: Optional custom regex patterns to look for
            
        Returns:
            Analysis results including detected patterns, mentions, and priority
        """
        if not text:
            return {
                "patterns": [],
                "mentions": [],
                "priority": 0,
                "summary": "No content to analyze"
            }
        
        # Combine default and custom patterns
        patterns = PATTERNS.copy()
        if custom_patterns:
            patterns.update(custom_patterns)
        
        # Detect patterns
        detected_patterns = []
        for pattern_name, regex in patterns.items():
            if re.search(regex, text, re.IGNORECASE):
                detected_patterns.append(pattern_name)
        
        # Extract mentions
        mentions = re.findall(r"@([\w-]+)", text)
        
        # Calculate priority
        priority = 0
        for pattern in detected_patterns:
            if pattern in PRIORITY_LEVELS:
                priority = max(priority, PRIORITY_LEVELS[pattern])
        
        # Generate summary
        summary = ContentAnalyzer._generate_summary(text, detected_patterns, mentions, priority)
        
        return {
            "patterns": detected_patterns,
            "mentions": mentions,
            "priority": priority,
            "summary": summary
        }
    
    @staticmethod
    def _generate_summary(text: str, patterns: List[str], mentions: List[str], priority: int) -> str:
        """
        Generate a summary of the analysis.
        
        Args:
            text: The original text
            patterns: Detected patterns
            mentions: Detected mentions
            priority: Calculated priority
            
        Returns:
            A summary string
        """
        # Truncate text if too long
        summary_text = text[:150] + "..." if len(text) > 150 else text
        
        # Create summary based on patterns
        if "urgent" in patterns or "security" in patterns:
            return f"URGENT: {summary_text}"
        elif "bug" in patterns:
            return f"BUG: {summary_text}"
        elif "question" in patterns:
            return f"QUESTION: {summary_text}"
        elif "feature" in patterns:
            return f"FEATURE: {summary_text}"
        elif "review_request" in patterns:
            return f"REVIEW REQUEST: {summary_text}"
        else:
            return summary_text
    
    @staticmethod
    def should_notify(analysis: Dict[str, Any], user_preferences: Dict[str, Any]) -> bool:
        """
        Determine if a notification should be sent based on analysis and user preferences.
        
        Args:
            analysis: Content analysis results
            user_preferences: User notification preferences
            
        Returns:
            True if notification should be sent, False otherwise
        """
        # Check if user wants notifications for this priority level
        min_priority = user_preferences.get("min_priority", 0)
        if analysis["priority"] < min_priority:
            return False
        
        # Check if user wants notifications for these patterns
        for pattern in analysis["patterns"]:
            preference_key = f"notify_on_{pattern}"
            if user_preferences.get(preference_key, True):
                return True
        
        # Check if user is mentioned
        if user_preferences.get("notify_on_mention", True) and analysis["mentions"]:
            user_github_username = user_preferences.get("github_username", "")
            if user_github_username in analysis["mentions"]:
                return True
        
        return False


class KeywordWatcher:
    """Watches for specific keywords in GitHub content."""
    
    def __init__(self, keywords: Optional[List[str]] = None, regex_patterns: Optional[List[str]] = None):
        """
        Initialize the keyword watcher.
        
        Args:
            keywords: List of keywords to watch for
            regex_patterns: List of regex patterns to watch for
        """
        self.keywords = set(keywords) if keywords else set()
        self.regex_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in regex_patterns] if regex_patterns else []
    
    def add_keyword(self, keyword: str) -> None:
        """Add a keyword to watch for."""
        self.keywords.add(keyword.lower())
    
    def add_regex(self, pattern: str) -> None:
        """Add a regex pattern to watch for."""
        try:
            self.regex_patterns.append(re.compile(pattern, re.IGNORECASE))
        except re.error as e:
            logger.error(f"Invalid regex pattern '{pattern}': {e}")
    
    def matches(self, text: str) -> List[str]:
        """
        Check if text matches any keywords or patterns.
        
        Args:
            text: Text to check
            
        Returns:
            List of matched keywords or patterns
        """
        if not text:
            return []
        
        matches = []
        
        # Check keywords
        text_lower = text.lower()
        for keyword in self.keywords:
            if keyword in text_lower:
                matches.append(keyword)
        
        # Check regex patterns
        for i, pattern in enumerate(self.regex_patterns):
            if pattern.search(text):
                matches.append(f"pattern_{i}")
        
        return matches


class TeamMentionDetector:
    """Detects mentions of teams or groups in GitHub content."""
    
    def __init__(self, team_aliases: Optional[Dict[str, List[str]]] = None):
        """
        Initialize the team mention detector.
        
        Args:
            team_aliases: Dictionary mapping team names to lists of aliases
        """
        self.team_aliases = team_aliases or {}
    
    def add_team(self, team_name: str, aliases: List[str]) -> None:
        """
        Add a team with aliases.
        
        Args:
            team_name: Name of the team
            aliases: List of aliases for the team
        """
        self.team_aliases[team_name] = aliases
    
    def detect_mentions(self, text: str) -> Dict[str, List[str]]:
        """
        Detect team mentions in text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary mapping team names to lists of detected aliases
        """
        if not text:
            return {}
        
        mentions = {}
        text_lower = text.lower()
        
        for team_name, aliases in self.team_aliases.items():
            detected_aliases = []
            for alias in aliases:
                if alias.lower() in text_lower:
                    detected_aliases.append(alias)
            
            if detected_aliases:
                mentions[team_name] = detected_aliases
        
        return mentions
