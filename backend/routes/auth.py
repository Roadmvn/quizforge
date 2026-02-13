"""
Auth routes: register + login.

Design decisions:
- Registration is open (no invite code) — for internal corporate use the
  Nginx reverse proxy restricts access to the company network.
- Login returns a JWT in { access_token, token_type } format, compatible
  with OAuth2PasswordBearer so Swagger UI "Authorize" button works OOTB.
- Duplicate email returns 409 Conflict (not 400) for semantic correctness.
"""

from fastapi import APIRouter, Depends, HTTPException, status
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
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        display_name=payload.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    # Always verify against something to prevent timing-based email enumeration
    dummy_hash = "$2b$12$LJ3m4ys3Lg3Dlw.YBOSKiuIllNNkmMYMUn5mGEB./FDD0rQOkSO.a"
    password_valid = verify_password(payload.password, user.hashed_password if user else dummy_hash)
    if not user or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user
