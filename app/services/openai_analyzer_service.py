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
from difflib import SequenceMatcher

import httpx
from pydantic import BaseModel

from app.db.supabase import SupabaseManager
from app.core.config import settings

logger = logging.getLogger(__name__)

# OpenAI API configuration
OPENAI_API_KEY = settings.OPENAI_API_KEY
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-5-nano"  # Valid OpenAI model for chat completions

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
        logger.debug(f"Matching keywords with OpenAI - Content length: {len(content)}, Keywords: {keywords}")
        
        if not OPENAI_API_KEY:
            logger.warning("OpenAI API key not set, using fallback method")
            return cls.fallback_keyword_match(content, keywords)
            
        if not keywords:
            logger.debug("No keywords provided, returning empty results")
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
            
            logger.debug(f"OpenAI request: content length {len(content)}, keywords: {keywords}")
            
            # Make API request to OpenAI
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}"
            }
            
            payload = {
                "model": OPENAI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
            }
            
            logger.debug(f"OpenAI payload model: {payload['model']}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    OPENAI_API_URL,
                    headers=headers,
                    json=payload,
                    timeout=10.0  # 10 second timeout
                )
                
                if response.status_code != 200:
                    logger.error(f"OPENAI API ERROR: Status {response.status_code}, Response: {response.text}")
                    return cls.fallback_keyword_match(content, keywords)
                
                response_data = response.json()
                
                # Extract the response content
                content = response_data["choices"][0]["message"]["content"]
                
                logger.debug(f"OpenAI response received: {len(content)} characters")
                
                # Parse the JSON response
                try:
                    result = json.loads(content)
                    matched_keywords = result.get("matched_keywords", [])
                    match_details = result.get("match_details", {})
                    
                    logger.info(f"OpenAI keyword matching results - Matched: {matched_keywords}, Details: {match_details}")
                    
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
        logger.debug(f"Using fallback keyword matching - Content length: {len(content)}, Keywords: {keywords}")
        
        content_lower = content.lower()
        matched_keywords = []
        match_details = {}
        
        logger.debug(f"Content (lowercased): {content_lower[:200]}{'...' if len(content_lower) > 200 else ''}")
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            logger.debug(f"Checking keyword: '{keyword}' (lowercased: '{keyword_lower}')")
            
            # Exact match
            if keyword_lower in content_lower:
                matched_keywords.append(keyword)
                match_details[keyword] = "Exact match found"
                logger.debug(f"✓ Exact match found for '{keyword}'")
                continue
                
            # Word boundary match
            word_boundary_pattern = r'\b' + re.escape(keyword_lower) + r'\b'
            if re.search(word_boundary_pattern, content_lower):
                matched_keywords.append(keyword)
                match_details[keyword] = "Word boundary match found"
                logger.debug(f"✓ Word boundary match found for '{keyword}' with pattern: {word_boundary_pattern}")
                continue
            
            logger.debug(f"✗ No match found for '{keyword}'")
        
        logger.info(f"Fallback keyword matching results - Matched: {matched_keywords}, Details: {match_details}")
        return matched_keywords, match_details
    
    @staticmethod
    def similarity_keyword_match(content: str, keywords: List[str], threshold: float = 0.7) -> Tuple[List[str], Dict[str, Any]]:
        """
        Keyword matching using string similarity with configurable threshold.
        
        Args:
            content: Text to search in
            keywords: Keywords to search for
            threshold: Similarity threshold (0.0 to 1.0)
            
        Returns:
            Tuple of (matched_keywords, match_details)
        """
        logger.debug(f"Using similarity keyword matching - Content length: {len(content)}, Keywords: {keywords}, Threshold: {threshold}")
        
        content_lower = content.lower()
        matched_keywords = []
        match_details = {}
        
        # Split content into words for similarity comparison
        content_words = re.findall(r'\b\w+\b', content_lower)
        logger.debug(f"Content words: {content_words[:20]}{'...' if len(content_words) > 20 else ''} (total: {len(content_words)})")
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            logger.debug(f"Checking keyword: '{keyword}' (lowercased: '{keyword_lower}') with threshold: {threshold}")
            
            # First check for exact matches (threshold doesn't apply)
            if keyword_lower in content_lower:
                matched_keywords.append(keyword)
                match_details[keyword] = "Exact match found"
                logger.debug(f"✓ Exact match found for '{keyword}'")
                continue
            
            # Check similarity against each word in content
            best_similarity = 0.0
            best_match_word = ""
            
            for word in content_words:
                similarity = SequenceMatcher(None, keyword_lower, word).ratio()
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match_word = word
                
                logger.debug(f"  Similarity between '{keyword_lower}' and '{word}': {similarity:.3f}")
            
            logger.debug(f"Best similarity for '{keyword}': {best_similarity:.3f} with word '{best_match_word}' (threshold: {threshold})")
            
            # Check if similarity meets threshold
            if best_similarity >= threshold:
                matched_keywords.append(keyword)
                match_details[keyword] = f"Similarity match found (similarity: {best_similarity:.3f}, word: '{best_match_word}')"
                logger.debug(f"✓ Similarity match found for '{keyword}' - {best_similarity:.3f} >= {threshold}")
            else:
                logger.debug(f"✗ No match found for '{keyword}' - best similarity {best_similarity:.3f} < threshold {threshold}")
        
        logger.info(f"Similarity keyword matching results - Matched: {matched_keywords}, Details: {match_details}, Threshold: {threshold}")
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
            logger.debug(f"Analyzing content for user {user_id} - Content length: {len(content)}")
            
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user_id)
            if not settings:
                logger.debug(f"No settings found for user {user_id}")
                return False, [], {}
                
            # Get keyword notification preferences (correct column)
            keyword_prefs = settings.get("keyword_notification_preferences", {})
            
            # Extract keyword settings
            keyword_notifications_enabled = keyword_prefs.get("enabled", False)
            keywords = keyword_prefs.get("keywords", [])
            threshold = keyword_prefs.get("threshold", 0.7)  # Default threshold
            
            logger.info(f"Keyword check for user {user_id}: enabled={keyword_notifications_enabled}, keywords={len(keywords)}, threshold={threshold}")
            
            # Check if keyword notifications are enabled
            if not keyword_notifications_enabled:
                logger.debug(f"Keyword notifications disabled for user {user_id}")
                return False, [], {}
                
            # Check if user has keywords
            if not keywords:
                logger.debug(f"No keywords configured for user {user_id}")
                return False, [], {}
                
            # Choose matching strategy based on threshold and OpenAI availability
            if threshold < 1.0 and threshold > 0.0:
                # Use semantic AI matching for nuanced similarity (low thresholds)
                logger.debug(f"Using OpenAI/semantic matching due to low threshold: {threshold}")
                matched_keywords, match_details = await cls.match_keywords_with_openai(content, keywords)
            else:
                # Use exact/string matching for high precision (threshold >= 1.0)
                logger.debug(f"Using exact/string matching due to high threshold: {threshold}")
                matched_keywords, match_details = cls.similarity_keyword_match(
                    content, keywords, threshold
                )
            
            # Determine if notification should be sent
            should_notify = len(matched_keywords) > 0
            
            logger.info(f"Content analysis complete for user {user_id} - Should notify: {should_notify}, "
                       f"Matched keywords: {matched_keywords}, Threshold used: {threshold}")
            
            return should_notify, matched_keywords, match_details
        except Exception as e:
            logger.error(f"Error analyzing content: {e}")
            return False, [], {}
