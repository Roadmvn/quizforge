"""
QuizForge — FastAPI entry point.

Design decisions:
- CORS wide open in dev (origins=["*"]). Will be locked down in prod via
  Nginx + environment config.
- Tables created via `Base.metadata.create_all()` at startup: simple and
  sufficient for SQLite. For Postgres in prod, switch to Alembic migrations.
- All routes mounted under /api/* to cleanly separate from the React SPA
  which Nginx will serve at /.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models import Base
from routes.auth import router as auth_router
from routes.quiz import router as quiz_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="QuizForge API",
    version="0.1.0",
    description="Live quiz platform for cybersecurity training",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(quiz_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
