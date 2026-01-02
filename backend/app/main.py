from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.db import engine, Base
from app.core.logging_config import setup_logging, get_logger
from app.middleware.logging_middleware import RequestLoggingMiddleware
from app.middleware.error_handler import (
    http_exception_handler,
    validation_exception_handler,
    integrity_error_handler,
    database_error_handler,
    general_exception_handler
)
import os
from app.routers import auth
from app.routers import cases
from app.routers import roles
from app.routers import directions
from app.routers import users
from app.routers import searches
from app.routers import flyers
from app.routers import flyer_templates
from app.routers import orientations
from app.routers import distributions
from app.routers import field_searches
from app.routers import map_grids
from app.routers import institutions_calls
from app.routers import events
from app.routers import dashboard
from app.routers import management
from app.routers import upload
from app.routers import settings
from app.routers import forum_import
import app.models  # Import all models to register them with Base
from pathlib import Path

# Setup logging
log_level = os.getenv("LOG_LEVEL", "INFO")
setup_logging(log_level)
logger = get_logger(__name__)

app = FastAPI(
    title="Missing Persons CRM API",
    version="1.0.0",
    description="""
    CRM system for managing missing persons search operations.

    ## Features

    * **Authentication**: JWT-based authentication with role-based access control
    * **Cases Management**: Create and manage missing persons cases
    * **Search Operations**: Track search activities and status
    * **Field Searches**: Organize field search operations with participants and grid mapping
    * **Flyers & Distributions**: Create and distribute missing persons flyers
    * **Institutions**: Track calls to hospitals, police, shelters, and other institutions
    * **Dashboard**: Get aggregated statistics and insights
    * **Users & Roles**: Manage team members, roles, and directions

    ## Authentication

    Most endpoints require authentication. Use the `/auth/login` endpoint to obtain a JWT token,
    then include it in the `Authorization` header as `Bearer <token>`.
    """,
    contact={
        "name": "Missing Persons CRM",
        "email": "support@example.com",
    },
    license_info={
        "name": "Private",
    },
)

# Configure CORS
allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add request logging middleware
app.add_middleware(RequestLoggingMiddleware)

# Register exception handlers
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(OperationalError, database_error_handler)
app.add_exception_handler(Exception, general_exception_handler)


# Create all tables on startup
@app.on_event("startup")
def on_startup():
    """Create database tables and initialize application"""
    logger.info("Starting Missing Persons CRM API")
    logger.info(f"Log level: {log_level}")
    logger.info(f"CORS origins: {allowed_origins}")

    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {str(e)}", exc_info=True)
        raise


@app.on_event("shutdown")
def on_shutdown():
    """Cleanup on application shutdown"""
    logger.info("Shutting down Missing Persons CRM API")


# Include routers
app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(roles.router)
app.include_router(directions.router)
app.include_router(users.router)
app.include_router(searches.router)
app.include_router(flyers.router)
app.include_router(flyer_templates.router)
app.include_router(orientations.router)
app.include_router(distributions.router)
app.include_router(field_searches.router)
app.include_router(map_grids.router)
app.include_router(institutions_calls.router)
app.include_router(events.router)
app.include_router(dashboard.router)
app.include_router(management.router)
app.include_router(upload.router)
app.include_router(settings.router)
app.include_router(forum_import.router)

# Mount uploads directory for static file serving
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-check")
def db_check():
    # простой тест: можем ли выполнить запрос к Postgres
    with engine.connect() as conn:
        val = conn.execute(text("SELECT 1")).scalar_one()
    return {"db": "ok", "select_1": val}
