from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Quiz, Session as SessionModel, User
from schemas import AdminUserCreate, UserRead
from services.auth import get_current_admin, hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


class RoleUpdate(BaseModel):
    role: str


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(user)
    db.commit()


@router.post("/users", response_model=UserRead, status_code=201)
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        display_name=payload.display_name,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/role", response_model=UserRead)
def update_user_role(
    user_id: str,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if payload.role not in ("admin", "user"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'admin' or 'user'",
        )
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role == "admin" and payload.role == "user":
        admin_count = db.query(func.count(User.id)).filter(User.role == "admin").scalar()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last admin",
            )
    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@router.get("/stats")
def admin_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    return {
        "total_users": db.query(func.count(User.id)).scalar(),
        "total_quizzes": db.query(func.count(Quiz.id)).scalar(),
        "total_sessions": db.query(func.count(SessionModel.id)).scalar(),
    }
