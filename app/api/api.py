"""
API router for Radar.

This module includes all API routes.
"""
from fastapi import APIRouter

from app.api.routes import auth, webhooks, settings, testing, billing

api_router = APIRouter()

# Include all route modules
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(testing.router, prefix="/testing", tags=["testing"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
