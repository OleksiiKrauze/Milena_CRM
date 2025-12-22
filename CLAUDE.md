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
- `OPENAI_API_KEY`: OpenAI API key for case autofill functionality (get from https://platform.openai.com/api-keys)

The `db.py` module will raise `RuntimeError` if required environment variables are missing.

**For production**, make sure to also set `OPENAI_API_KEY` in `.env.production` on the server.

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

## Database Migrations

The project uses **Alembic** for database schema management. All database changes must be tracked through migrations to prevent schema mismatch between code and production database.

### Important Alembic Files

- `backend/alembic.ini` - Alembic configuration file
- `backend/alembic/env.py` - Migration environment setup (imports all models)
- `backend/alembic/versions/` - Migration scripts directory

### Creating a New Migration

When you modify SQLAlchemy models (add/remove columns, tables, etc.), create a migration:

```bash
# Generate migration automatically from model changes
cd backend
docker-compose exec backend alembic revision --autogenerate -m "Description of changes"

# Or create empty migration for manual edits
docker-compose exec backend alembic revision -m "Description of changes"
```

**CRITICAL**: Always review auto-generated migrations before applying! Alembic may not detect all changes correctly.

### Applying Migrations

**Local Development:**
```bash
# Apply all pending migrations
docker-compose exec backend alembic upgrade head

# Rollback one migration
docker-compose exec backend alembic downgrade -1

# Check current migration version
docker-compose exec backend alembic current
```

**Production:**
```bash
# ALWAYS apply migrations after deploying code changes that modify models
cd ~/MilenaCRM
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head

# Check migration status
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic current
```

### Migration Workflow

1. **Modify models** in `backend/app/models/`
2. **Generate migration**: `docker-compose exec backend alembic revision --autogenerate -m "Add field X to table Y"`
3. **Review migration** in `backend/alembic/versions/`
4. **Test locally**: `docker-compose exec backend alembic upgrade head`
5. **Commit migration**: `git add backend/alembic/versions/` and commit
6. **Deploy to production**:
   ```bash
   git pull origin main
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build backend
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head
   ```

### Common Migration Issues

**Issue: Column already exists error**
- **Cause**: Migration trying to add column that exists in database
- **Fix**: Edit migration to check if column exists before adding, or manually apply the needed changes to database

**Issue: Alembic can't detect model changes**
- **Cause**: Model not imported in `alembic/env.py`
- **Fix**: Add import for new model in `backend/alembic/env.py`

**Issue: Production migration fails**
- **Cause**: Database schema was manually modified without migration
- **Fix**: Create migration that syncs schema, or stamp database with current version if schemas match

## Production Deployment

The application is deployed on AWS EC2 (eu-central-1) at **https://crm.przmilena.click**

For detailed production deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Production Architecture

- **Nginx**: HTTPS termination, reverse proxy, serves frontend static files and uploaded images
- **Backend**: FastAPI container (internal port 8000, no hot-reload)
- **PostgreSQL**: Database container (internal port 5432)
- **Let's Encrypt**: SSL certificates (auto-renewal via cron)
- **Cron Jobs**: Daily database backups (02:00) and SSL renewal (03:00)

### Critical Production Configurations

**1. Environment Files**
- `.env.production` - Backend production secrets (NEVER commit to Git!)
- `frontend/.env.production` - Must contain `VITE_API_URL=/api` for correct API routing

**2. Docker Compose**
Always use the `--env-file` flag to ensure correct environment variables:
```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

**3. Shared Volumes**
The `uploads_data` volume MUST be mounted to both backend AND nginx:
```yaml
backend:
  volumes:
    - uploads_data:/app/uploads
nginx:
  volumes:
    - uploads_data:/app/uploads:ro  # Critical for serving uploaded images!
```

**4. Image URLs**
Backend returns relative paths `/uploads/file.png`. Frontend MUST use these directly without prepending any domain:
```typescript
// CORRECT:
<img src={photoUrl} />  // photoUrl is already "/uploads/file.png"

// WRONG:
<img src={`http://localhost:8000${photoUrl}`} />
```

### Deployment Workflow

**After making code changes:**

1. **Local**: Commit and push changes to Git
   ```bash
   git add .
   git commit -m "Changes description"
   git push origin main
   ```

2. **Server**: Pull changes and update
   ```bash
   ssh ubuntu@server
   cd ~/MilenaCRM
   git pull origin main

   # ALWAYS rebuild frontend after pulling changes!
   cd frontend
   npm ci
   npm run build
   cd ..

   # Rebuild and restart containers
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production down
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build --no-cache
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

**If only frontend changed:**
```bash
cd ~/MilenaCRM/frontend
npm run build
cd ..
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart nginx
```

### Common Production Issues

**Issue: Images not loading (Mixed Content error)**
- **Cause**: Frontend built without `frontend/.env.production` or hardcoded `localhost:8000` in code
- **Fix**: Ensure `frontend/.env.production` exists with `VITE_API_URL=/api`, rebuild frontend

**Issue: Backend can't connect to database**
- **Cause**: Using wrong environment file or `.env.production` has leading spaces
- **Fix**: Always use `--env-file .env.production` flag, check file has no leading spaces

**Issue: Nginx returns 404 for uploaded images**
- **Cause**: Nginx doesn't have access to `uploads_data` volume
- **Fix**: Verify nginx volumes in `docker-compose.prod.yml` includes `uploads_data:/app/uploads:ro`

For complete troubleshooting guide, see [DEPLOYMENT.md](DEPLOYMENT.md).
