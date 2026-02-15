"""
QuizForge — FastAPI entry point.

Design decisions:
- CORS origins controlled via ALLOWED_ORIGINS env var (comma-separated).
- Tables created via `Base.metadata.create_all()` at startup: simple and
  sufficient for SQLite. For Postgres in prod, switch to Alembic migrations.
- All routes mounted under /api/* to cleanly separate from the React SPA
  which Nginx will serve at /.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models import Base
from routes.auth import router as auth_router
from routes.quiz import router as quiz_router
from routes.session import router as session_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("data", exist_ok=True)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="QuizForge API",
    version="0.1.0",
    description="Live quiz platform for cybersecurity training",
    lifespan=lifespan,
)

allowed_origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8080").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(quiz_router)
app.include_router(session_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/network-info")
def network_info():
    lan_ip = os.environ.get("HOST_LAN_IP", "127.0.0.1")
    return {"lan_ip": lan_ip}
