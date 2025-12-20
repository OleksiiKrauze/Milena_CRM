import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

def _env(name: str, default: str | None = None) -> str:
    val = os.getenv(name, default)
    if val is None:
        raise RuntimeError(f"Missing env var: {name}")
    return val

DB_USER = _env("POSTGRES_USER")
DB_PASS = _env("POSTGRES_PASSWORD")
DB_HOST = _env("POSTGRES_HOST", "db")
DB_PORT = _env("POSTGRES_PORT", "5432")
DB_NAME = _env("POSTGRES_DB")

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

Base = declarative_base()

def get_database_url() -> str:
    """Get database URL for Alembic migrations"""
    return DATABASE_URL

def get_db():
    """Dependency for FastAPI to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
