# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MilenaCRM is a FastAPI-based CRM application with PostgreSQL database, containerized using Docker. The project uses Python 3.12 with SQLAlchemy for ORM and psycopg2 for PostgreSQL connectivity.

## Architecture

The application follows a simple two-tier architecture:

- **Backend Service**: FastAPI application running on port 8000
  - Located in `backend/app/`
  - Entry point: `backend/app/main.py`
  - Database configuration: `backend/app/db.py`
- **Database Service**: PostgreSQL 16 running on port 5432

Database connection is managed through SQLAlchemy with connection pooling (`pool_pre_ping=True`). Environment variables are loaded from `.env` file and validated at startup through the `_env()` helper function in `db.py`.

## Development Commands

### Running the Application

```bash
# Start all services (backend + database)
docker-compose up

# Start in detached mode
docker-compose up -d

# Rebuild and start
docker-compose up --build
```

The backend service runs with hot-reload enabled via `--reload` flag.

### Accessing Services

- Backend API: http://localhost:8000
- PostgreSQL: localhost:5432
- Health check endpoint: http://localhost:8000/health
- Database connectivity check: http://localhost:8000/db-check

### Docker Management

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v

# View logs
docker-compose logs -f backend
```

### Debugging

Use `compose.debug.yaml` for debugging with debugpy on port 5678:

```bash
docker-compose -f compose.debug.yaml up
```

## Environment Configuration

All environment variables are defined in `.env`:
- `POSTGRES_DB`: Database name
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_HOST`: Database host (default: "db")
- `POSTGRES_PORT`: Database port (default: "5432")
- `APP_PORT`: Application port (default: 8000)

The `db.py` module will raise `RuntimeError` if required environment variables are missing.

## Docker Setup Notes

There are two Docker configurations in this project:

1. **Production setup** (`docker-compose.yml`): Uses the `backend/` subdirectory with its own Dockerfile and requirements.txt. The backend mounts `./backend/app` for hot-reload development.

2. **Alternative setup** (`compose.yaml`, `Dockerfile`): Root-level configuration that appears to be VS Code Docker extension generated. This uses gunicorn with uvicorn workers and references `backend.app\main:app`.

The primary development workflow uses `docker-compose.yml` from the backend subdirectory.

## Key Implementation Details

- FastAPI app instance is named `app` with title "Missing CRM API" version 0.1.0
- SQLAlchemy engine is created with `pool_pre_ping=True` for connection health checks
- Database URL format: `postgresql+psycopg2://user:pass@host:port/dbname`
- SessionLocal factory is configured with `autocommit=False, autoflush=False`
