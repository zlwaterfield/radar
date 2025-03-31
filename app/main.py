"""
Radar - Main Application Entry Point

This module initializes the FastAPI application and includes all routes.
"""
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import auth, github, slack, users, webhooks, settings
from app.core.config import settings as app_settings
from app.core.logging import setup_logging
from app.services.task_service import TaskService

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(github.router, prefix="/api/github", tags=["GitHub"])
app.include_router(slack.router, prefix="/api/slack", tags=["Slack"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])

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
    return JSONResponse(
        status_code=500,
        content={"message": "An unexpected error occurred. Please try again later."},
    )

@app.on_event("startup")
async def startup_event():
    """Startup event handler."""
    logger.info("Starting up Radar API")
    
    # Schedule digest notifications
    task_service = TaskService()
    await task_service.schedule_digest_notifications()
    # await task_service.schedule_stats_notifications()
    
    logger.info("Scheduled background tasks")

@app.on_event("shutdown")
def shutdown_event():
    """Shutdown event handler."""
    logger.info("Shutting down Radar API")
    
    # Shutdown task scheduler
    TaskService().shutdown()

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=app_settings.API_HOST,
        port=app_settings.API_PORT,
        reload=app_settings.DEBUG,
    )
