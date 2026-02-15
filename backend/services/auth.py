"""
JWT authentication service.

Design decisions:
- PyJWT for JWT: lightweight, well-maintained, supports HS256.
- HS256 (symmetric): sufficient for a single-service app. Switch to RS256
  if you ever need token verification by a separate service.
- bcrypt used directly (not via passlib) for password hashing: avoids
  passlib/bcrypt version incompatibilities, fewer dependencies.
- Token expiry: 24h — training sessions are typically half-day to full-day;
  avoids annoying re-logins mid-session.
- The secret key MUST be overridden via environment variable in production.
"""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import PyJWTError
from sqlalchemy.orm import Session

from database import get_db
from models import User

SECRET_KEY = os.getenv("QUIZFORGE_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("QUIZFORGE_SECRET_KEY environment variable is required")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 2

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: extracts + validates JWT, returns User or 401."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except PyJWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """FastAPI dependency: ensures the current user has the admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
