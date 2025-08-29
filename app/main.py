"""
Radar - Main Application Entry Point

This module initializes the FastAPI application and includes all routes.
"""
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import auth, github, slack, users, webhooks, settings, testing
from app.core.config import settings as app_settings
from app.core.logging import setup_logging
# from app.services.task_service import TaskService
from app.services.monitoring_service import MonitoringService

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=app_settings.APP_NAME,
    description="A Slack application that connects to GitHub and tracks activity to notify users about Pull Requests, reviews, comments, and changes.",
    version="0.1.0",
)

# Add CORS middleware
# In production, replace with specific origins from settings
allowed_origins = ["*"] if app_settings.DEBUG else [
    app_settings.FRONTEND_URL,
    "https://app.radarnotifications.com",  # Add your production domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(github.router, prefix="/api/github", tags=["GitHub"])
app.include_router(slack.router, prefix="/api/slack", tags=["Slack"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(testing.router, prefix="/api/testing", tags=["Testing"])

@app.get("/", tags=["Health"])
async def root():
    """Root endpoint to check if the API is running."""
    return {"message": "Welcome to Radar API", "status": "healthy"}

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for all unhandled exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    # Track unhandled errors
    MonitoringService.track_error(
        error=exc,
        context={
            "request_url": str(request.url),
            "request_method": request.method,
            "handler": "global_exception_handler"
        }
    )
    
    return JSONResponse(
        status_code=500,
        content={"message": "An unexpected error occurred. Please try again later."},
    )

def validate_environment():
    """Validate required environment variables on startup."""
    required_vars = [
        "SLACK_APP_CLIENT_ID",
        "SLACK_APP_CLIENT_SECRET", 
        "SLACK_SIGNING_SECRET",
        "GITHUB_APP_ID",
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
        "GITHUB_WEBHOOK_SECRET",
        "SUPABASE_URL",
        "SUPABASE_KEY",
        "SECRET_KEY"
    ]
    
    missing_vars = []
    for var in required_vars:
        if not getattr(app_settings, var, None):
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    # Validate GitHub private key is available
    if not app_settings.GITHUB_PRIVATE_KEY and not app_settings.GITHUB_PRIVATE_KEY_PATH:
        raise RuntimeError("Either GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH must be set")
    
    if app_settings.GITHUB_PRIVATE_KEY_PATH:
        from pathlib import Path
        if not Path(app_settings.GITHUB_PRIVATE_KEY_PATH).exists():
            logger.error(f"GitHub private key file not found: {app_settings.GITHUB_PRIVATE_KEY_PATH}")
            raise RuntimeError(f"GitHub private key file not found: {app_settings.GITHUB_PRIVATE_KEY_PATH}")
    
    logger.info("Environment validation passed")


@app.on_event("startup")
async def startup_event():
    """Startup event handler."""
    logger.info("Starting up Radar API")
    
    # Validate environment variables
    try:
        validate_environment()
    except RuntimeError as e:
        logger.error(f"Environment validation failed: {e}")
    
    # #Schedule digest notifications
    # task_service = TaskService()
    # await task_service.schedule_digest_notifications()
    # logger.info("Scheduled background tasks")

@app.on_event("shutdown")
def shutdown_event():
    """Shutdown event handler."""
    logger.info("Shutting down Radar API")
    
    # Shutdown task scheduler
    # TaskService().shutdown()
    

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=app_settings.API_HOST,
        port=app_settings.API_PORT,
        reload=app_settings.DEBUG,
    )
