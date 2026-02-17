from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Participant, Question, Quiz, Session as SessionModel, User
from schemas import (
    AdminDashboard,
    AdminQuizRead,
    AdminSessionRead,
    AdminUserCreate,
    PasswordReset,
    StatusUpdate,
    UserRead,
)
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
    email = payload.email.strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        email=email,
        hashed_password=hash_password(payload.password.strip()),
        display_name=payload.display_name.strip(),
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


@router.get("/dashboard", response_model=AdminDashboard)
def admin_dashboard(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    total_users = db.query(func.count(User.id)).scalar()
    total_quizzes = db.query(func.count(Quiz.id)).scalar()
    total_sessions = db.query(func.count(SessionModel.id)).scalar()
    active_sessions = db.query(func.count(SessionModel.id)).filter(
        SessionModel.status.in_(["lobby", "active", "revealing"])
    ).scalar()

    recent_users = db.query(User).order_by(User.created_at.desc()).limit(5).all()

    recent_sessions_raw = (
        db.query(SessionModel)
        .order_by(SessionModel.created_at.desc())
        .limit(5)
        .all()
    )
    recent_sessions = []
    for s in recent_sessions_raw:
        quiz = db.query(Quiz).filter(Quiz.id == s.quiz_id).first()
        owner = db.query(User).filter(User.id == s.owner_id).first()
        p_count = db.query(func.count(Participant.id)).filter(Participant.session_id == s.id).scalar()
        recent_sessions.append(AdminSessionRead(
            id=s.id,
            code=s.code,
            status=s.status,
            quiz_title=quiz.title if quiz else "",
            owner_name=owner.display_name if owner else "",
            participant_count=p_count,
            created_at=s.created_at,
        ))

    return AdminDashboard(
        total_users=total_users,
        total_quizzes=total_quizzes,
        total_sessions=total_sessions,
        active_sessions=active_sessions,
        recent_users=recent_users,
        recent_sessions=recent_sessions,
    )


@router.get("/quizzes", response_model=list[AdminQuizRead])
def list_all_quizzes(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    quizzes = db.query(Quiz).order_by(Quiz.created_at.desc()).all()
    result = []
    for q in quizzes:
        owner = db.query(User).filter(User.id == q.owner_id).first()
        q_count = db.query(func.count(Question.id)).filter(Question.quiz_id == q.id).scalar()
        s_count = db.query(func.count(SessionModel.id)).filter(SessionModel.quiz_id == q.id).scalar()
        result.append(AdminQuizRead(
            id=q.id,
            title=q.title,
            description=q.description,
            owner_email=owner.email if owner else "",
            owner_name=owner.display_name if owner else "",
            question_count=q_count,
            session_count=s_count,
            created_at=q.created_at,
        ))
    return result


@router.get("/sessions", response_model=list[AdminSessionRead])
def list_all_sessions(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    sessions = db.query(SessionModel).order_by(SessionModel.created_at.desc()).all()
    result = []
    for s in sessions:
        quiz = db.query(Quiz).filter(Quiz.id == s.quiz_id).first()
        owner = db.query(User).filter(User.id == s.owner_id).first()
        p_count = db.query(func.count(Participant.id)).filter(Participant.session_id == s.id).scalar()
        result.append(AdminSessionRead(
            id=s.id,
            code=s.code,
            status=s.status,
            quiz_title=quiz.title if quiz else "",
            owner_name=owner.display_name if owner else "",
            participant_count=p_count,
            created_at=s.created_at,
        ))
    return result


@router.patch("/users/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def reset_user_password(
    user_id: str,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.hashed_password = hash_password(payload.password)
    db.commit()


@router.patch("/users/{user_id}/status", response_model=UserRead)
def update_user_status(
    user_id: str,
    payload: StatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own status",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user
