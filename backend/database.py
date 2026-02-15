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

import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/quizforge.db")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Session:
    """FastAPI dependency that yields a DB session and closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
