"""
Database configuration.

Design decisions:
- SQLite for Sprint 1: zero-config, single-file, perfect for a training
  tool deployed on a single machine. Switching to PostgreSQL later only
  requires changing DATABASE_URL.
- `check_same_thread=False` is required for SQLite with FastAPI's async
  workers (multiple threads share the connection).
- Session factory via generator + `yield` integrates cleanly with
  FastAPI's Depends() DI system.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = "sqlite:///./quizforge.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite-specific
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Session:
    """FastAPI dependency that yields a DB session and closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
