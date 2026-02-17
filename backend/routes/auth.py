"""
Auth routes: register + login.

Design decisions:
- Registration is controlled via REGISTRATION_ENABLED env var (default: disabled).
- Login returns a JWT in { access_token, token_type } format, compatible
  with OAuth2PasswordBearer so Swagger UI "Authorize" button works OOTB.
- Duplicate email returns 409 Conflict (not 400) for semantic correctness.
"""

import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import Token, UserLogin, UserRead, UserRegister
from services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if os.getenv("REGISTRATION_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is disabled",
        )
    email = payload.email.strip()
    password = payload.password.strip()
    display_name = payload.display_name.strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    is_first_user = db.query(func.count(User.id)).scalar() == 0
    user = User(
        email=email,
        hashed_password=hash_password(password),
        display_name=display_name,
        role="admin" if is_first_user else "user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    email = payload.email.strip()
    password = payload.password.strip()
    user = db.query(User).filter(User.email == email).first()
    # Always verify against something to prevent timing-based email enumeration
    dummy_hash = "$2b$12$LJ3m4ys3Lg3Dlw.YBOSKiuIllNNkmMYMUn5mGEB./FDD0rQOkSO.a"
    password_valid = verify_password(password, user.hashed_password if user else dummy_hash)
    if not user or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended",
        )
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user
