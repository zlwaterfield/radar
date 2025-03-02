"""
Sentiment analysis utilities for Radar.

This module provides sentiment analysis for GitHub content.
"""
import logging
import re
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class SentimentType(str, Enum):
    """Sentiment types for analysis."""
    VERY_POSITIVE = "very_positive"
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    VERY_NEGATIVE = "very_negative"


class SentimentAnalyzer:
    """Analyzes sentiment in text content."""
    
    # Sentiment word lists
    POSITIVE_WORDS = {
        "good", "great", "excellent", "awesome", "amazing", "nice", "wonderful",
        "fantastic", "terrific", "outstanding", "superb", "brilliant", "perfect",
        "thank", "thanks", "appreciate", "helpful", "love", "like", "happy",
        "glad", "pleased", "impressive", "well done", "kudos", "congrats",
        "congratulations", "beautiful", "elegant", "clean", "clever", "smart",
        "efficient", "effective", "fast", "quick", "speedy", "responsive",
        "robust", "stable", "reliable", "solid", "secure", "safe", "correct",
        "right", "proper", "appropriate", "suitable", "adequate", "sufficient",
        "satisfactory", "satisfying", "pleasing", "delightful", "joy", "excited",
        "exciting", "thrilled", "thrilling", "impressive", "impressed", "approve",
        "approved", "approval", "agree", "agreed", "agreement", "accept", "accepted",
        "acceptance", "support", "supported", "supporting", "endorse", "endorsed",
        "endorsement", "recommend", "recommended", "recommendation", "praise",
        "praised", "praising", "compliment", "complimented", "complimenting",
        "admire", "admired", "admiring", "admiration", "respect", "respected",
        "respecting", "respectful", "value", "valued", "valuing", "valuable",
        "worth", "worthy", "worthwhile", "merit", "merited", "meriting",
        "meritorious", "deserve", "deserved", "deserving", "earn", "earned",
        "earning", "win", "won", "winning", "succeed", "succeeded", "succeeding",
        "success", "successful", "accomplish", "accomplished", "accomplishing",
        "accomplishment", "achieve", "achieved", "achieving", "achievement",
        "attain", "attained", "attaining", "attainment", "reach", "reached",
        "reaching", "realize", "realized", "realizing", "realization", "fulfill",
        "fulfilled", "fulfilling", "fulfillment", "satisfy", "satisfied",
        "satisfying", "satisfaction", "please", "pleased", "pleasing", "pleasure",
        "enjoy", "enjoyed", "enjoying", "enjoyment", "delight", "delighted",
        "delighting", "delightful", "happy", "happier", "happiest", "happiness",
        "glad", "gladder", "gladdest", "gladness", "joy", "joyful", "joyous",
        "joyousness", "jubilant", "jubilation", "celebrate", "celebrated",
        "celebrating", "celebration", "cheer", "cheered", "cheering", "cheerful",
        "lgtm", "ship it", "shipit", "+1", "👍", "❤️", "🎉", "🚀", "💯"
    }
    
    NEGATIVE_WORDS = {
        "bad", "poor", "terrible", "awful", "horrible", "dreadful", "abysmal",
        "unacceptable", "inadequate", "insufficient", "unsatisfactory", "disappointing",
        "disappointed", "disappointment", "disappoint", "fail", "failed", "failing",
        "failure", "error", "errors", "erroneous", "mistake", "mistakes", "mistaken",
        "wrong", "incorrect", "inaccurate", "invalid", "improper", "inappropriate",
        "unsuitable", "unsatisfactory", "unpleasant", "unhappy", "sad", "upset",
        "angry", "annoyed", "annoying", "irritated", "irritating", "frustrating",
        "frustrated", "frustration", "confusing", "confused", "confusion", "complex",
        "complicated", "difficult", "hard", "tough", "challenging", "problem",
        "problematic", "issue", "concern", "concerned", "concerning", "worry",
        "worried", "worrying", "trouble", "troubled", "troubling", "troublesome",
        "bother", "bothered", "bothering", "bothersome", "annoy", "annoyed",
        "annoying", "annoyance", "irritate", "irritated", "irritating", "irritation",
        "frustrate", "frustrated", "frustrating", "frustration", "disappoint",
        "disappointed", "disappointing", "disappointment", "dissatisfy", "dissatisfied",
        "dissatisfying", "dissatisfaction", "displease", "displeased", "displeasing",
        "displeasure", "dislike", "disliked", "disliking", "hate", "hated", "hating",
        "hatred", "detest", "detested", "detesting", "detestation", "despise",
        "despised", "despising", "loathe", "loathed", "loathing", "abhor", "abhorred",
        "abhorring", "abhorrence", "resent", "resented", "resenting", "resentment",
        "reject", "rejected", "rejecting", "rejection", "refuse", "refused",
        "refusing", "refusal", "deny", "denied", "denying", "denial", "oppose",
        "opposed", "opposing", "opposition", "object", "objected", "objecting",
        "objection", "protest", "protested", "protesting", "protestation",
        "criticize", "criticized", "criticizing", "criticism", "complain",
        "complained", "complaining", "complaint", "condemn", "condemned",
        "condemning", "condemnation", "denounce", "denounced", "denouncing",
        "denunciation", "blame", "blamed", "blaming", "fault", "faulty", "flaw",
        "flawed", "flawing", "defect", "defective", "deficiency", "deficient",
        "shortage", "short", "lacking", "lack", "lacked", "missing", "miss",
        "missed", "absent", "absence", "inadequate", "inadequacy", "insufficient",
        "insufficiency", "unsatisfactory", "fail", "failed", "failing", "failure",
        "bug", "buggy", "regression", "crash", "crashed", "crashing", "hang",
        "hangs", "hanging", "freeze", "freezes", "freezing", "slow", "slower",
        "slowest", "sluggish", "lag", "lags", "lagging", "delay", "delayed",
        "delaying", "late", "later", "latest", "tardy", "block", "blocked",
        "blocking", "blockage", "obstruct", "obstructed", "obstructing",
        "obstruction", "prevent", "prevented", "preventing", "prevention",
        "hinder", "hindered", "hindering", "hindrance", "impede", "impeded",
        "impeding", "impediment", "interfere", "interfered", "interfering",
        "interference", "interrupt", "interrupted", "interrupting", "interruption",
        "break", "broke", "broken", "breaking", "damage", "damaged", "damaging",
        "corrupt", "corrupted", "corrupting", "corruption", "destroy", "destroyed",
        "destroying", "destruction", "ruin", "ruined", "ruining", "wreck", "wrecked",
        "wrecking", "mess", "messed", "messing", "botch", "botched", "botching",
        "bungle", "bungled", "bungling", "mishandle", "mishandled", "mishandling",
        "mismanage", "mismanaged", "mismanaging", "mismanagement", "-1", "👎", "💩"
    }
    
    VERY_POSITIVE_PHRASES = {
        "excellent work", "great job", "well done", "amazing work", "outstanding job",
        "fantastic work", "brilliant job", "superb work", "exceptional job",
        "impressive work", "remarkable job", "wonderful work", "terrific job",
        "stellar work", "phenomenal job", "magnificent work", "splendid job",
        "marvelous work", "extraordinary job", "incredible work", "awesome job",
        "excellent job", "great work", "good job", "nice work", "good work",
        "thank you so much", "thanks a lot", "many thanks", "really appreciate",
        "greatly appreciate", "highly recommend", "strongly recommend",
        "fully support", "completely agree", "totally agree", "absolutely love",
        "really love", "love this", "love it", "love the", "perfect solution",
        "perfect implementation", "perfect approach", "perfect fix", "perfect code",
        "perfect work", "perfect job", "perfect pr", "perfect pull request",
        "lgtm", "ship it", "shipit", "approved", "approved!", "looks good to me",
        "looks perfect", "looks excellent", "looks great", "looks awesome",
        "looks amazing", "looks fantastic", "looks brilliant", "looks superb",
        "looks outstanding", "looks impressive", "looks remarkable", "looks wonderful",
        "looks terrific", "looks stellar", "looks phenomenal", "looks magnificent",
        "looks splendid", "looks marvelous", "looks extraordinary", "looks incredible"
    }
    
    VERY_NEGATIVE_PHRASES = {
        "terrible work", "awful job", "horrible work", "dreadful job", "abysmal work",
        "unacceptable job", "poor work", "bad job", "disappointing work",
        "unsatisfactory job", "inadequate work", "insufficient job", "subpar work",
        "mediocre job", "inferior work", "deficient job", "flawed work",
        "problematic job", "troublesome work", "concerning job", "worrying work",
        "alarming job", "distressing work", "disturbing job", "upsetting work",
        "annoying job", "irritating work", "frustrating job", "infuriating work",
        "exasperating job", "maddening work", "absolutely not", "definitely not",
        "certainly not", "no way", "not at all", "strongly disagree",
        "completely disagree", "totally disagree", "absolutely disagree",
        "fundamentally disagree", "vehemently disagree", "firmly disagree",
        "strongly oppose", "completely oppose", "totally oppose", "absolutely oppose",
        "fundamentally oppose", "vehemently oppose", "firmly oppose",
        "strongly object", "completely object", "totally object", "absolutely object",
        "fundamentally object", "vehemently object", "firmly object",
        "strongly reject", "completely reject", "totally reject", "absolutely reject",
        "fundamentally reject", "vehemently reject", "firmly reject",
        "strongly condemn", "completely condemn", "totally condemn",
        "absolutely condemn", "fundamentally condemn", "vehemently condemn",
        "firmly condemn", "strongly criticize", "completely criticize",
        "totally criticize", "absolutely criticize", "fundamentally criticize",
        "vehemently criticize", "firmly criticize", "strongly disapprove",
        "completely disapprove", "totally disapprove", "absolutely disapprove",
        "fundamentally disapprove", "vehemently disapprove", "firmly disapprove",
        "major issues", "serious problems", "critical bugs", "severe defects",
        "fatal errors", "showstopper bugs", "blocker issues", "p0 bug", "p1 bug",
        "urgent fix needed", "immediate attention required", "fix asap",
        "needs immediate fix", "must be fixed", "cannot be merged", "cannot approve",
        "cannot accept", "cannot merge", "do not merge", "don't merge", "don't approve",
        "don't accept", "rejected", "rejected!", "changes requested", "request changes"
    }
    
    @staticmethod
    def analyze_sentiment(text: str) -> Dict[str, Any]:
        """
        Analyze sentiment in text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Sentiment analysis results
        """
        if not text:
            return {
                "sentiment": SentimentType.NEUTRAL,
                "score": 0.0,
                "positive_words": [],
                "negative_words": [],
                "positive_phrases": [],
                "negative_phrases": []
            }
        
        # Convert text to lowercase for case-insensitive matching
        text_lower = text.lower()
        
        # Find positive and negative words
        positive_words = []
        for word in SentimentAnalyzer.POSITIVE_WORDS:
            if re.search(r'\b' + re.escape(word) + r'\b', text_lower):
                positive_words.append(word)
        
        negative_words = []
        for word in SentimentAnalyzer.NEGATIVE_WORDS:
            if re.search(r'\b' + re.escape(word) + r'\b', text_lower):
                negative_words.append(word)
        
        # Find very positive and very negative phrases
        positive_phrases = []
        for phrase in SentimentAnalyzer.VERY_POSITIVE_PHRASES:
            if phrase in text_lower:
                positive_phrases.append(phrase)
        
        negative_phrases = []
        for phrase in SentimentAnalyzer.VERY_NEGATIVE_PHRASES:
            if phrase in text_lower:
                negative_phrases.append(phrase)
        
        # Calculate sentiment score
        positive_count = len(positive_words) + (len(positive_phrases) * 2)
        negative_count = len(negative_words) + (len(negative_phrases) * 2)
        
        # Normalize score to range [-1.0, 1.0]
        total_count = positive_count + negative_count
        if total_count == 0:
            score = 0.0
        else:
            score = (positive_count - negative_count) / total_count
        
        # Determine sentiment type based on score
        sentiment = SentimentType.NEUTRAL
        if score >= 0.6:
            sentiment = SentimentType.VERY_POSITIVE
        elif score >= 0.2:
            sentiment = SentimentType.POSITIVE
        elif score <= -0.6:
            sentiment = SentimentType.VERY_NEGATIVE
        elif score <= -0.2:
            sentiment = SentimentType.NEGATIVE
        
        return {
            "sentiment": sentiment,
            "score": score,
            "positive_words": positive_words,
            "negative_words": negative_words,
            "positive_phrases": positive_phrases,
            "negative_phrases": negative_phrases
        }
    
    @staticmethod
    def get_sentiment_emoji(sentiment: SentimentType) -> str:
        """
        Get emoji representation of sentiment.
        
        Args:
            sentiment: Sentiment type
            
        Returns:
            Emoji string
        """
        if sentiment == SentimentType.VERY_POSITIVE:
            return "😍"
        elif sentiment == SentimentType.POSITIVE:
            return "😊"
        elif sentiment == SentimentType.NEUTRAL:
            return "😐"
        elif sentiment == SentimentType.NEGATIVE:
            return "😕"
        elif sentiment == SentimentType.VERY_NEGATIVE:
            return "😡"
        else:
            return ""
    
    @staticmethod
    def get_sentiment_color(sentiment: SentimentType) -> str:
        """
        Get color representation of sentiment.
        
        Args:
            sentiment: Sentiment type
            
        Returns:
            Hex color code
        """
        if sentiment == SentimentType.VERY_POSITIVE:
            return "#2EB67D"  # Green
        elif sentiment == SentimentType.POSITIVE:
            return "#36C5F0"  # Blue
        elif sentiment == SentimentType.NEUTRAL:
            return "#ECB22E"  # Yellow
        elif sentiment == SentimentType.NEGATIVE:
            return "#E01E5A"  # Red
        elif sentiment == SentimentType.VERY_NEGATIVE:
            return "#8E0000"  # Dark Red
        else:
            return "#000000"  # Black
