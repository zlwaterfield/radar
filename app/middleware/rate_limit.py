"""
Rate limiting middleware for Radar API.

This module provides rate limiting functionality to prevent abuse.
"""
import time
from collections import defaultdict
from typing import Dict, Tuple
import logging

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware."""
    
    def __init__(self, app):
        super().__init__(app)
        # Store request counts by IP and endpoint
        self.request_counts: Dict[str, Dict[str, Tuple[int, float]]] = defaultdict(dict)
        self.cleanup_interval = 300  # Clean up old entries every 5 minutes
        self.last_cleanup = time.time()
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request."""
        # Check for X-Forwarded-For header (when behind proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Get the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        # Check for X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fall back to direct client IP
        return request.client.host if request.client else "unknown"
    
    def _cleanup_old_entries(self):
        """Remove old entries from request counts."""
        current_time = time.time()
        if current_time - self.last_cleanup < self.cleanup_interval:
            return
        
        # Clean up entries older than 1 minute
        cutoff_time = current_time - 60
        
        for ip in list(self.request_counts.keys()):
            endpoints = list(self.request_counts[ip].keys())
            for endpoint in endpoints:
                count, timestamp = self.request_counts[ip][endpoint]
                if timestamp < cutoff_time:
                    del self.request_counts[ip][endpoint]
            
            # Remove IP if no endpoints left
            if not self.request_counts[ip]:
                del self.request_counts[ip]
        
        self.last_cleanup = current_time
    
    def _is_rate_limited(self, client_ip: str, endpoint: str, limit: int) -> bool:
        """Check if request should be rate limited."""
        current_time = time.time()
        minute_ago = current_time - 60
        
        # Get current count for this IP and endpoint
        if client_ip in self.request_counts and endpoint in self.request_counts[client_ip]:
            count, first_request_time = self.request_counts[client_ip][endpoint]
            
            # If first request was more than a minute ago, reset
            if first_request_time < minute_ago:
                self.request_counts[client_ip][endpoint] = (1, current_time)
                return False
            
            # Check if limit exceeded
            if count >= limit:
                return True
            
            # Increment count
            self.request_counts[client_ip][endpoint] = (count + 1, first_request_time)
        else:
            # First request from this IP to this endpoint
            self.request_counts[client_ip][endpoint] = (1, current_time)
        
        return False
    
    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting."""
        # Periodic cleanup
        self._cleanup_old_entries()
        
        # Get client IP and endpoint
        client_ip = self._get_client_ip(request)
        endpoint = request.url.path
        
        # Skip rate limiting for health check endpoints
        if endpoint in ["/", "/health", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        # Determine rate limit based on endpoint
        if endpoint.startswith("/api/webhooks/"):
            limit = settings.WEBHOOK_RATE_LIMIT_PER_MINUTE
            
            # Also check request size for webhooks
            if request.headers.get("content-length"):
                content_length = int(request.headers.get("content-length", 0))
                if content_length > settings.WEBHOOK_MAX_REQUEST_SIZE:
                    logger.warning(f"Webhook request too large from {client_ip}: {content_length} bytes")
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={"detail": "Request body too large"}
                    )
        else:
            limit = settings.API_RATE_LIMIT_PER_MINUTE
        
        # Check rate limit
        if self._is_rate_limited(client_ip, endpoint, limit):
            logger.warning(f"Rate limit exceeded for {client_ip} on {endpoint}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded. Please try again later."},
                headers={"Retry-After": "60"}
            )
        
        # Process request
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(f"Error processing request: {e}")
            raise