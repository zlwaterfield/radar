"""
Code analysis utilities for Radar.

This module provides code analysis for GitHub pull requests and commits.
"""
import logging
import re
from typing import Dict, List, Optional, Any, Set, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class ChangeType(str, Enum):
    """Types of code changes."""
    FEATURE = "feature"
    BUGFIX = "bugfix"
    REFACTOR = "refactor"
    DOCUMENTATION = "documentation"
    TEST = "test"
    STYLE = "style"
    DEPENDENCY = "dependency"
    BUILD = "build"
    CI = "ci"
    PERFORMANCE = "performance"
    SECURITY = "security"
    UNKNOWN = "unknown"


class ChangeSize(str, Enum):
    """Sizes of code changes."""
    TINY = "tiny"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    HUGE = "huge"


class CodeAnalyzer:
    """Analyzes code changes in pull requests and commits."""
    
    # File patterns for different types of changes
    FILE_PATTERNS = {
        ChangeType.DOCUMENTATION: [
            r".*\.md$",
            r".*\.rst$",
            r".*\.txt$",
            r"docs/.*",
            r"documentation/.*",
            r"README.*",
            r"LICENSE.*",
            r"CONTRIBUTING.*",
            r"CHANGELOG.*",
            r"AUTHORS.*",
            r"CODEOWNERS.*"
        ],
        ChangeType.TEST: [
            r"tests/.*",
            r"test/.*",
            r".*_test\..*",
            r".*\.spec\..*",
            r".*_spec\..*",
            r".*Test\..*",
            r".*\.test\..*"
        ],
        ChangeType.DEPENDENCY: [
            r"requirements\.txt$",
            r"requirements/.*",
            r"Pipfile$",
            r"Pipfile\.lock$",
            r"poetry\.lock$",
            r"pyproject\.toml$",
            r"setup\.py$",
            r"package\.json$",
            r"package-lock\.json$",
            r"yarn\.lock$",
            r"go\.mod$",
            r"go\.sum$",
            r"Gemfile$",
            r"Gemfile\.lock$",
            r".*\.csproj$",
            r".*\.fsproj$",
            r".*\.vbproj$",
            r".*\.vcxproj$"
        ],
        ChangeType.BUILD: [
            r"Makefile$",
            r"Dockerfile$",
            r"docker-compose\.yml$",
            r"\.dockerignore$",
            r"\.gitignore$",
            r"\.gitattributes$",
            r"\.editorconfig$",
            r"\.eslintrc.*$",
            r"\.prettierrc.*$",
            r"\.stylelintrc.*$",
            r"\.babelrc.*$",
            r"webpack\..*\.js$",
            r"rollup\..*\.js$",
            r"gulpfile\.js$",
            r"gruntfile\.js$"
        ],
        ChangeType.CI: [
            r"\.github/.*",
            r"\.gitlab/.*",
            r"\.circleci/.*",
            r"\.travis\.yml$",
            r"\.appveyor\.yml$",
            r"\.azure-pipelines\.yml$",
            r"\.jenkins.*$",
            r"Jenkinsfile$"
        ]
    }
    
    # Commit message patterns for different types of changes
    COMMIT_PATTERNS = {
        ChangeType.FEATURE: [
            r"^feat(\(.*\))?:",
            r"^feature(\(.*\))?:",
            r"^add(\(.*\))?:",
            r"^implement(\(.*\))?:",
            r"add .* feature",
            r"implement .* feature"
        ],
        ChangeType.BUGFIX: [
            r"^fix(\(.*\))?:",
            r"^bugfix(\(.*\))?:",
            r"^bug(\(.*\))?:",
            r"fix .* bug",
            r"fix .* issue",
            r"fix #\d+"
        ],
        ChangeType.REFACTOR: [
            r"^refactor(\(.*\))?:",
            r"^refactoring(\(.*\))?:",
            r"^restructure(\(.*\))?:",
            r"^cleanup(\(.*\))?:",
            r"^clean(\(.*\))?:",
            r"refactor .*",
            r"restructure .*",
            r"clean up .*"
        ],
        ChangeType.DOCUMENTATION: [
            r"^docs(\(.*\))?:",
            r"^doc(\(.*\))?:",
            r"^documentation(\(.*\))?:",
            r"update .* docs",
            r"update .* documentation",
            r"document .*"
        ],
        ChangeType.TEST: [
            r"^test(\(.*\))?:",
            r"^tests(\(.*\))?:",
            r"add .* test",
            r"update .* test",
            r"fix .* test"
        ],
        ChangeType.STYLE: [
            r"^style(\(.*\))?:",
            r"^format(\(.*\))?:",
            r"^formatting(\(.*\))?:",
            r"format .*",
            r"style .*"
        ],
        ChangeType.DEPENDENCY: [
            r"^deps(\(.*\))?:",
            r"^dependencies(\(.*\))?:",
            r"^dependency(\(.*\))?:",
            r"^pkg(\(.*\))?:",
            r"^package(\(.*\))?:",
            r"update .* dependency",
            r"upgrade .*",
            r"bump .*"
        ],
        ChangeType.BUILD: [
            r"^build(\(.*\))?:",
            r"^chore(\(.*\))?:",
            r"^release(\(.*\))?:",
            r"^version(\(.*\))?:",
            r"^deploy(\(.*\))?:",
            r"^deployment(\(.*\))?:"
        ],
        ChangeType.CI: [
            r"^ci(\(.*\))?:",
            r"^cd(\(.*\))?:",
            r"^pipeline(\(.*\))?:",
            r"^workflow(\(.*\))?:",
            r"^github-actions(\(.*\))?:",
            r"^travis(\(.*\))?:",
            r"^circleci(\(.*\))?:",
            r"^jenkins(\(.*\))?:"
        ],
        ChangeType.PERFORMANCE: [
            r"^perf(\(.*\))?:",
            r"^performance(\(.*\))?:",
            r"^optimize(\(.*\))?:",
            r"^optimization(\(.*\))?:",
            r"improve .* performance",
            r"optimize .*"
        ],
        ChangeType.SECURITY: [
            r"^security(\(.*\))?:",
            r"^sec(\(.*\))?:",
            r"^vuln(\(.*\))?:",
            r"^vulnerability(\(.*\))?:",
            r"fix .* security",
            r"fix .* vulnerability",
            r"security .*"
        ]
    }
    
    @staticmethod
    def analyze_pull_request(
        title: str,
        description: str,
        changed_files: List[Dict[str, Any]],
        commits: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Analyze a pull request.
        
        Args:
            title: PR title
            description: PR description
            changed_files: List of changed files with filename and patch
            commits: Optional list of commits
            
        Returns:
            Analysis results
        """
        # Analyze title and description
        title_type = CodeAnalyzer._detect_change_type_from_text(title)
        description_type = CodeAnalyzer._detect_change_type_from_text(description)
        
        # Analyze files
        file_types = {}
        file_extensions = set()
        total_additions = 0
        total_deletions = 0
        
        for file in changed_files:
            filename = file.get("filename", "")
            file_type = CodeAnalyzer._detect_change_type_from_filename(filename)
            
            # Count file types
            if file_type not in file_types:
                file_types[file_type] = 0
            file_types[file_type] += 1
            
            # Extract file extension
            extension = filename.split(".")[-1] if "." in filename else ""
            if extension:
                file_extensions.add(extension)
            
            # Count additions and deletions
            total_additions += file.get("additions", 0)
            total_deletions += file.get("deletions", 0)
        
        # Analyze commits if available
        commit_types = {}
        if commits:
            for commit in commits:
                message = commit.get("message", "")
                commit_type = CodeAnalyzer._detect_change_type_from_text(message)
                
                if commit_type not in commit_types:
                    commit_types[commit_type] = 0
                commit_types[commit_type] += 1
        
        # Determine primary change type
        primary_type = CodeAnalyzer._determine_primary_change_type(
            title_type, description_type, file_types, commit_types
        )
        
        # Determine change size
        change_size = CodeAnalyzer._determine_change_size(
            len(changed_files), total_additions, total_deletions
        )
        
        # Calculate complexity score (0-100)
        complexity = CodeAnalyzer._calculate_complexity(
            len(changed_files), total_additions, total_deletions,
            len(file_extensions), primary_type
        )
        
        return {
            "primary_type": primary_type,
            "change_size": change_size,
            "complexity": complexity,
            "file_count": len(changed_files),
            "file_types": file_types,
            "file_extensions": list(file_extensions),
            "additions": total_additions,
            "deletions": total_deletions,
            "title_type": title_type,
            "description_type": description_type,
            "commit_types": commit_types
        }
    
    @staticmethod
    def _detect_change_type_from_filename(filename: str) -> ChangeType:
        """
        Detect change type from filename.
        
        Args:
            filename: File name
            
        Returns:
            Change type
        """
        for change_type, patterns in CodeAnalyzer.FILE_PATTERNS.items():
            for pattern in patterns:
                if re.match(pattern, filename, re.IGNORECASE):
                    return change_type
        
        # Default to unknown
        return ChangeType.UNKNOWN
    
    @staticmethod
    def _detect_change_type_from_text(text: str) -> ChangeType:
        """
        Detect change type from text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Change type
        """
        if not text:
            return ChangeType.UNKNOWN
        
        for change_type, patterns in CodeAnalyzer.COMMIT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    return change_type
        
        # Default to unknown
        return ChangeType.UNKNOWN
    
    @staticmethod
    def _determine_primary_change_type(
        title_type: ChangeType,
        description_type: ChangeType,
        file_types: Dict[ChangeType, int],
        commit_types: Dict[ChangeType, int]
    ) -> ChangeType:
        """
        Determine primary change type.
        
        Args:
            title_type: Change type from title
            description_type: Change type from description
            file_types: Change types from files
            commit_types: Change types from commits
            
        Returns:
            Primary change type
        """
        # Prioritize title type if not unknown
        if title_type != ChangeType.UNKNOWN:
            return title_type
        
        # Next, try description type
        if description_type != ChangeType.UNKNOWN:
            return description_type
        
        # Next, use most common file type
        if file_types:
            max_file_type = max(file_types.items(), key=lambda x: x[1])[0]
            if max_file_type != ChangeType.UNKNOWN:
                return max_file_type
        
        # Next, use most common commit type
        if commit_types:
            max_commit_type = max(commit_types.items(), key=lambda x: x[1])[0]
            if max_commit_type != ChangeType.UNKNOWN:
                return max_commit_type
        
        # Default to unknown
        return ChangeType.UNKNOWN
    
    @staticmethod
    def _determine_change_size(file_count: int, additions: int, deletions: int) -> ChangeSize:
        """
        Determine change size.
        
        Args:
            file_count: Number of changed files
            additions: Number of added lines
            deletions: Number of deleted lines
            
        Returns:
            Change size
        """
        total_changes = additions + deletions
        
        if file_count <= 1 and total_changes <= 10:
            return ChangeSize.TINY
        elif file_count <= 3 and total_changes <= 50:
            return ChangeSize.SMALL
        elif file_count <= 10 and total_changes <= 300:
            return ChangeSize.MEDIUM
        elif file_count <= 30 and total_changes <= 1000:
            return ChangeSize.LARGE
        else:
            return ChangeSize.HUGE
    
    @staticmethod
    def _calculate_complexity(
        file_count: int,
        additions: int,
        deletions: int,
        extension_count: int,
        change_type: ChangeType
    ) -> int:
        """
        Calculate complexity score (0-100).
        
        Args:
            file_count: Number of changed files
            additions: Number of added lines
            deletions: Number of deleted lines
            extension_count: Number of different file extensions
            change_type: Primary change type
            
        Returns:
            Complexity score
        """
        # Base complexity from file count (0-40)
        file_complexity = min(40, file_count * 2)
        
        # Complexity from changes (0-30)
        changes = additions + deletions
        change_complexity = min(30, changes / 20)
        
        # Complexity from file diversity (0-20)
        diversity_complexity = min(20, extension_count * 4)
        
        # Adjust based on change type (0-10)
        type_complexity = 0
        if change_type in [ChangeType.FEATURE, ChangeType.REFACTOR]:
            type_complexity = 10
        elif change_type in [ChangeType.BUGFIX, ChangeType.PERFORMANCE, ChangeType.SECURITY]:
            type_complexity = 8
        elif change_type in [ChangeType.DEPENDENCY, ChangeType.BUILD, ChangeType.CI]:
            type_complexity = 5
        elif change_type in [ChangeType.TEST, ChangeType.DOCUMENTATION, ChangeType.STYLE]:
            type_complexity = 2
        
        # Calculate total complexity
        total_complexity = file_complexity + change_complexity + diversity_complexity + type_complexity
        
        # Normalize to 0-100
        return min(100, int(total_complexity))
    
    @staticmethod
    def get_change_type_emoji(change_type: ChangeType) -> str:
        """
        Get emoji representation of change type.
        
        Args:
            change_type: Change type
            
        Returns:
            Emoji string
        """
        if change_type == ChangeType.FEATURE:
            return "✨"
        elif change_type == ChangeType.BUGFIX:
            return "🐛"
        elif change_type == ChangeType.REFACTOR:
            return "♻️"
        elif change_type == ChangeType.DOCUMENTATION:
            return "📝"
        elif change_type == ChangeType.TEST:
            return "🧪"
        elif change_type == ChangeType.STYLE:
            return "💄"
        elif change_type == ChangeType.DEPENDENCY:
            return "📦"
        elif change_type == ChangeType.BUILD:
            return "🔧"
        elif change_type == ChangeType.CI:
            return "🔄"
        elif change_type == ChangeType.PERFORMANCE:
            return "⚡"
        elif change_type == ChangeType.SECURITY:
            return "🔒"
        else:
            return "❓"
    
    @staticmethod
    def get_change_size_emoji(change_size: ChangeSize) -> str:
        """
        Get emoji representation of change size.
        
        Args:
            change_size: Change size
            
        Returns:
            Emoji string
        """
        if change_size == ChangeSize.TINY:
            return "🔹"
        elif change_size == ChangeSize.SMALL:
            return "🔷"
        elif change_size == ChangeSize.MEDIUM:
            return "🟦"
        elif change_size == ChangeSize.LARGE:
            return "🟪"
        elif change_size == ChangeSize.HUGE:
            return "🟥"
        else:
            return ""
