"""
OpenAI Analyzer Service for Radar.

This service provides AI-powered analysis of GitHub content to match user-defined keywords
using OpenAI's API for fast and accurate matching.
"""
import logging
import os
import re
from typing import Dict, List, Any, Optional, Tuple
import json

import httpx
from pydantic import BaseModel

from app.db.supabase import SupabaseManager
from app.models.notifications import NotificationPreferences

logger = logging.getLogger(__name__)

# OpenAI API configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-3.5-turbo-instruct"  # Fast and cost-effective model

class KeywordMatchRequest(BaseModel):
    """Request model for keyword matching."""
    content: str
    keywords: List[str]

class KeywordMatchResponse(BaseModel):
    """Response model for keyword matching."""
    matched_keywords: List[str]
    match_details: Dict[str, Any] = {}

class OpenAIAnalyzerService:
    """Service for OpenAI-powered content analysis."""
    
    @classmethod
    async def match_keywords_with_openai(cls, content: str, keywords: List[str]) -> Tuple[List[str], Dict[str, Any]]:
        """
        Match keywords using OpenAI's API.
        
        Args:
            content: Content to analyze
            keywords: List of keywords to match
            
        Returns:
            Tuple of (matched_keywords, match_details)
        """
        if not OPENAI_API_KEY:
            logger.warning("OpenAI API key not set, using fallback method")
            return cls.fallback_keyword_match(content, keywords)
            
        if not keywords:
            return [], {}
            
        try:
            # Prepare the prompt for OpenAI
            prompt = f"""
            I have a piece of content and a list of keywords. Please determine if any of the keywords 
            are present or closely related to the content. Return ONLY the matched keywords.
            
            Content: {content}
            
            Keywords: {', '.join(keywords)}
            
            Return your response as a JSON object with the following format:
            {{
                "matched_keywords": ["keyword1", "keyword2"],
                "match_details": {{
                    "keyword1": "Exact match found",
                    "keyword2": "Related to content because..."
                }}
            }}
            
            If no keywords match, return an empty list for matched_keywords.
            """
            
            # Make API request to OpenAI
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}"
            }
            
            payload = {
                "model": OPENAI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,  # Low temperature for more deterministic results
                "max_tokens": 300
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    OPENAI_API_URL,
                    headers=headers,
                    json=payload,
                    timeout=10.0  # 10 second timeout
                )
                
                response.raise_for_status()
                response_data = response.json()
                
                # Extract the response content
                content = response_data["choices"][0]["message"]["content"]
                
                # Parse the JSON response
                try:
                    result = json.loads(content)
                    matched_keywords = result.get("matched_keywords", [])
                    match_details = result.get("match_details", {})
                    
                    return matched_keywords, match_details
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse OpenAI response: {content}")
                    return cls.fallback_keyword_match(content, keywords)
                    
        except Exception as e:
            logger.error(f"Error using OpenAI for keyword matching: {e}")
            return cls.fallback_keyword_match(content, keywords)
    
    @staticmethod
    def fallback_keyword_match(content: str, keywords: List[str]) -> Tuple[List[str], Dict[str, Any]]:
        """
        Simple keyword matching as fallback.
        
        Args:
            content: Text to search in
            keywords: Keywords to search for
            
        Returns:
            Tuple of (matched_keywords, match_details)
        """
        content = content.lower()
        matched_keywords = []
        match_details = {}
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            
            # Exact match
            if keyword_lower in content:
                matched_keywords.append(keyword)
                match_details[keyword] = "Exact match found"
                continue
                
            # Word boundary match
            if re.search(r'\b' + re.escape(keyword_lower) + r'\b', content):
                matched_keywords.append(keyword)
                match_details[keyword] = "Word boundary match found"
                continue
        
        return matched_keywords, match_details
    
    @classmethod
    async def analyze_content(cls, content: str, user_id: str) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Analyze content against user's keywords.
        
        Args:
            content: Content to analyze
            user_id: User ID
            
        Returns:
            Tuple of (should_notify, matched_keywords, match_details)
        """
        try:
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user_id)
            if not settings:
                return False, [], {}
                
            # Get notification preferences
            preferences_data = settings.get("notification_preferences", {})
            preferences = NotificationPreferences(**preferences_data)
            
            # Check if keyword notifications are enabled
            if not preferences.keyword_notifications_enabled:
                return False, [], {}
                
            # Check if user has keywords
            if not preferences.keywords:
                return False, [], {}
                
            # Match keywords using OpenAI
            matched_keywords, match_details = await cls.match_keywords_with_openai(content, preferences.keywords)
            
            # Determine if notification should be sent
            should_notify = len(matched_keywords) > 0
            
            return should_notify, matched_keywords, match_details
        except Exception as e:
            logger.error(f"Error analyzing content: {e}")
            return False, [], {}
