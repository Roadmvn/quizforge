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
import socket
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import inspect, text

from database import engine
from models import Base, User
from services.auth import get_current_user
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.quiz import router as quiz_router
from routes.session import router as session_router
from routes.upload import router as upload_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("data", exist_ok=True)
    os.makedirs("data/uploads", exist_ok=True)
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        columns = [c["name"] for c in inspect(engine).get_columns("users")]
        if "is_active" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            conn.commit()
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
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(quiz_router)
app.include_router(session_router)
app.include_router(upload_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/network-info")
def network_info(current_user: User = Depends(get_current_user)):
    lan_ip = os.environ.get("HOST_LAN_IP")
    if not lan_ip or lan_ip == "127.0.0.1":
        try:
            lan_ip = socket.gethostbyname("host.docker.internal")
        except Exception:
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                    s.connect(("8.8.8.8", 80))
                    lan_ip = s.getsockname()[0]
            except Exception:
                lan_ip = "127.0.0.1"
    return {"lan_ip": lan_ip}
