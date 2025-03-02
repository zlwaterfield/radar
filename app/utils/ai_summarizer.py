"""
AI-powered summarization utilities for Radar.

This module provides AI-based summarization for GitHub content.
"""
import logging
import re
from typing import Dict, List, Optional, Any, Tuple
import json

logger = logging.getLogger(__name__)


class AISummarizer:
    """Generates AI-powered summaries of GitHub content."""
    
    @staticmethod
    def summarize_pull_request(
        title: str,
        description: str,
        changed_files: List[Dict[str, Any]],
        comments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Generate a summary of a pull request.
        
        Args:
            title: PR title
            description: PR description
            changed_files: List of changed files with filename and patch
            comments: Optional list of comments
            
        Returns:
            Summary data
        """
        # Extract key information
        summary = AISummarizer._extract_summary_from_description(description)
        key_files = AISummarizer._identify_key_files(changed_files)
        key_points = AISummarizer._extract_key_points(description)
        
        # Generate file change summaries
        file_summaries = []
        for file in key_files:
            file_summary = AISummarizer._summarize_file_changes(file)
            if file_summary:
                file_summaries.append(file_summary)
        
        # Extract discussion points from comments
        discussion_points = []
        if comments:
            discussion_points = AISummarizer._extract_discussion_points(comments)
        
        # Generate overall summary
        overall_summary = AISummarizer._generate_overall_summary(
            title, summary, key_points, file_summaries, discussion_points
        )
        
        return {
            "title": title,
            "summary": summary,
            "key_points": key_points,
            "file_summaries": file_summaries,
            "discussion_points": discussion_points,
            "overall_summary": overall_summary
        }
    
    @staticmethod
    def summarize_issue(
        title: str,
        description: str,
        comments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Generate a summary of an issue.
        
        Args:
            title: Issue title
            description: Issue description
            comments: Optional list of comments
            
        Returns:
            Summary data
        """
        # Extract key information
        summary = AISummarizer._extract_summary_from_description(description)
        key_points = AISummarizer._extract_key_points(description)
        
        # Extract discussion points from comments
        discussion_points = []
        if comments:
            discussion_points = AISummarizer._extract_discussion_points(comments)
        
        # Identify issue type
        issue_type = AISummarizer._identify_issue_type(title, description)
        
        # Generate overall summary
        overall_summary = AISummarizer._generate_issue_summary(
            title, summary, key_points, discussion_points, issue_type
        )
        
        return {
            "title": title,
            "summary": summary,
            "key_points": key_points,
            "discussion_points": discussion_points,
            "issue_type": issue_type,
            "overall_summary": overall_summary
        }
    
    @staticmethod
    def _extract_summary_from_description(description: str) -> str:
        """
        Extract a summary from the description.
        
        Args:
            description: Description text
            
        Returns:
            Summary text
        """
        if not description:
            return "No description provided."
        
        # Look for sections that might contain summaries
        summary_sections = [
            (r"#+\s*Summary\s*\n+([^#]+)", 1),
            (r"#+\s*Overview\s*\n+([^#]+)", 1),
            (r"#+\s*Description\s*\n+([^#]+)", 1),
            (r"#+\s*Introduction\s*\n+([^#]+)", 1),
            (r"#+\s*About\s*\n+([^#]+)", 1)
        ]
        
        for pattern, group in summary_sections:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                summary = match.group(group).strip()
                if summary:
                    # Truncate if too long
                    if len(summary) > 500:
                        summary = summary[:497] + "..."
                    return summary
        
        # If no summary section found, use the first paragraph
        paragraphs = description.split("\n\n")
        if paragraphs:
            first_paragraph = paragraphs[0].strip()
            if first_paragraph:
                # Truncate if too long
                if len(first_paragraph) > 500:
                    first_paragraph = first_paragraph[:497] + "..."
                return first_paragraph
        
        # Fallback to truncated description
        if len(description) > 500:
            return description[:497] + "..."
        return description
    
    @staticmethod
    def _identify_key_files(changed_files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Identify key files in a pull request.
        
        Args:
            changed_files: List of changed files
            
        Returns:
            List of key files
        """
        # Sort files by number of changes (additions + deletions)
        sorted_files = sorted(
            changed_files,
            key=lambda f: (f.get("additions", 0) + f.get("deletions", 0)),
            reverse=True
        )
        
        # Take top 5 files or all if less than 5
        return sorted_files[:5]
    
    @staticmethod
    def _extract_key_points(text: str) -> List[str]:
        """
        Extract key points from text.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of key points
        """
        if not text:
            return []
        
        key_points = []
        
        # Look for bullet points
        bullet_pattern = r"[\*\-\+]\s+([^\n]+)"
        bullet_matches = re.findall(bullet_pattern, text)
        if bullet_matches:
            key_points.extend(bullet_matches[:5])  # Limit to 5 bullet points
        
        # Look for numbered points
        numbered_pattern = r"\d+\.\s+([^\n]+)"
        numbered_matches = re.findall(numbered_pattern, text)
        if numbered_matches:
            key_points.extend(numbered_matches[:5])  # Limit to 5 numbered points
        
        # If no bullet or numbered points, try to extract sentences
        if not key_points:
            sentences = re.split(r'(?<=[.!?])\s+', text)
            key_sentences = [s for s in sentences if len(s) > 20 and len(s) < 200][:3]
            key_points.extend(key_sentences)
        
        return key_points
    
    @staticmethod
    def _summarize_file_changes(file: Dict[str, Any]) -> Dict[str, Any]:
        """
        Summarize changes to a file.
        
        Args:
            file: File data
            
        Returns:
            File summary
        """
        filename = file.get("filename", "")
        if not filename:
            return None
        
        additions = file.get("additions", 0)
        deletions = file.get("deletions", 0)
        patch = file.get("patch", "")
        
        # Determine file type
        file_type = "unknown"
        if filename.endswith((".py", ".pyc")):
            file_type = "python"
        elif filename.endswith((".js", ".jsx", ".ts", ".tsx")):
            file_type = "javascript"
        elif filename.endswith((".html", ".htm")):
            file_type = "html"
        elif filename.endswith((".css", ".scss", ".sass", ".less")):
            file_type = "css"
        elif filename.endswith((".md", ".markdown")):
            file_type = "markdown"
        elif filename.endswith((".json", ".yaml", ".yml", ".toml")):
            file_type = "config"
        elif filename.endswith((".sh", ".bash")):
            file_type = "shell"
        elif filename.endswith((".sql")):
            file_type = "sql"
        elif filename.endswith((".go")):
            file_type = "go"
        elif filename.endswith((".java")):
            file_type = "java"
        elif filename.endswith((".rb")):
            file_type = "ruby"
        elif filename.endswith((".php")):
            file_type = "php"
        elif filename.endswith((".c", ".cpp", ".h", ".hpp")):
            file_type = "c++"
        elif filename.endswith((".rs")):
            file_type = "rust"
        
        # Generate change description
        change_description = ""
        if additions > 0 and deletions > 0:
            change_description = f"Modified with {additions} additions and {deletions} deletions"
        elif additions > 0:
            change_description = f"Added {additions} lines"
        elif deletions > 0:
            change_description = f"Removed {deletions} lines"
        else:
            change_description = "Changed without line modifications"
        
        # Extract key changes from patch
        key_changes = []
        if patch:
            # Look for function/method definitions
            function_pattern = r"^\+\s*(def|function|class|interface|impl|struct|enum)\s+(\w+)"
            function_matches = re.findall(function_pattern, patch, re.MULTILINE)
            for match in function_matches[:3]:  # Limit to 3 functions
                key_changes.append(f"{match[0]} {match[1]}")
            
            # Look for import/require statements
            import_pattern = r"^\+\s*(import|from|require|use|include|#include)\s+([^\n]+)"
            import_matches = re.findall(import_pattern, patch, re.MULTILINE)
            for match in import_matches[:3]:  # Limit to 3 imports
                key_changes.append(f"{match[0]} {match[1]}")
        
        return {
            "filename": filename,
            "file_type": file_type,
            "additions": additions,
            "deletions": deletions,
            "change_description": change_description,
            "key_changes": key_changes
        }
    
    @staticmethod
    def _extract_discussion_points(comments: List[Dict[str, Any]]) -> List[str]:
        """
        Extract discussion points from comments.
        
        Args:
            comments: List of comments
            
        Returns:
            List of discussion points
        """
        if not comments:
            return []
        
        discussion_points = []
        
        # Process each comment
        for comment in comments[:10]:  # Limit to 10 comments
            body = comment.get("body", "")
            if not body:
                continue
            
            # Extract first paragraph or sentence
            paragraphs = body.split("\n\n")
            if paragraphs:
                first_paragraph = paragraphs[0].strip()
                if first_paragraph:
                    # Truncate if too long
                    if len(first_paragraph) > 200:
                        first_paragraph = first_paragraph[:197] + "..."
                    discussion_points.append(first_paragraph)
        
        # Limit to 5 discussion points
        return discussion_points[:5]
    
    @staticmethod
    def _generate_overall_summary(
        title: str,
        summary: str,
        key_points: List[str],
        file_summaries: List[Dict[str, Any]],
        discussion_points: List[str]
    ) -> str:
        """
        Generate an overall summary.
        
        Args:
            title: PR title
            summary: PR summary
            key_points: Key points
            file_summaries: File summaries
            discussion_points: Discussion points
            
        Returns:
            Overall summary
        """
        # Start with title
        overall_summary = f"{title}"
        
        # Add summary if available
        if summary and summary != "No description provided.":
            overall_summary += f"\n\n{summary}"
        
        # Add key points if available
        if key_points:
            overall_summary += "\n\nKey points:"
            for point in key_points:
                overall_summary += f"\n- {point}"
        
        # Add file changes if available
        if file_summaries:
            overall_summary += "\n\nKey file changes:"
            for file in file_summaries:
                overall_summary += f"\n- {file['filename']}: {file['change_description']}"
        
        # Add discussion points if available
        if discussion_points:
            overall_summary += "\n\nDiscussion highlights:"
            for point in discussion_points:
                overall_summary += f"\n- {point}"
        
        return overall_summary
    
    @staticmethod
    def _identify_issue_type(title: str, description: str) -> str:
        """
        Identify the type of an issue.
        
        Args:
            title: Issue title
            description: Issue description
            
        Returns:
            Issue type
        """
        combined_text = f"{title} {description}".lower()
        
        # Check for bug/issue
        if re.search(r'\b(bug|issue|problem|error|exception|crash|failure|fix)\b', combined_text):
            return "bug"
        
        # Check for feature request
        if re.search(r'\b(feature|enhancement|improvement|add|implement|support)\b', combined_text):
            return "feature"
        
        # Check for question
        if re.search(r'\b(question|help|how|what|why|when|where|who|which|clarification|explain)\b', combined_text):
            return "question"
        
        # Check for documentation
        if re.search(r'\b(doc|documentation|readme|wiki|guide|tutorial)\b', combined_text):
            return "documentation"
        
        # Default to other
        return "other"
    
    @staticmethod
    def _generate_issue_summary(
        title: str,
        summary: str,
        key_points: List[str],
        discussion_points: List[str],
        issue_type: str
    ) -> str:
        """
        Generate an issue summary.
        
        Args:
            title: Issue title
            summary: Issue summary
            key_points: Key points
            discussion_points: Discussion points
            issue_type: Issue type
            
        Returns:
            Issue summary
        """
        # Start with title and type
        overall_summary = f"{title} ({issue_type})"
        
        # Add summary if available
        if summary and summary != "No description provided.":
            overall_summary += f"\n\n{summary}"
        
        # Add key points if available
        if key_points:
            overall_summary += "\n\nKey points:"
            for point in key_points:
                overall_summary += f"\n- {point}"
        
        # Add discussion points if available
        if discussion_points:
            overall_summary += "\n\nDiscussion highlights:"
            for point in discussion_points:
                overall_summary += f"\n- {point}"
        
        return overall_summary
