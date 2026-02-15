"""
SQLAlchemy models for QuizForge.

Design decisions:
- UUIDs as primary keys: avoids sequential ID enumeration (important for
  a cybersecurity training tool) and simplifies future horizontal scaling.
- Session codes are short random strings (6 chars) for easy QR/verbal sharing.
- Answers store `is_correct` as boolean — supports single-correct for now,
  trivially extensible to multiple-correct later.
- `time_limit` lives on Question, not Quiz, so each question can have its
  own countdown (like Kahoot).
- `order` on Question ensures deterministic sequencing independent of
  creation time.
"""

import secrets
import string
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def _generate_code(length: int = 6) -> str:
    """Generate a cryptographically secure short code for session joining."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# User (admin only — participants are anonymous, tracked in Session)
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: str = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password: str = Column(String(255), nullable=False)
    display_name: str = Column(String(100), nullable=False)
    role: str = Column(String(20), default="user", nullable=False)
    created_at: datetime = Column(DateTime, default=datetime.utcnow)

    quizzes = relationship("Quiz", back_populates="owner", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Quiz
# ---------------------------------------------------------------------------
class Quiz(Base):
    __tablename__ = "quizzes"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: str = Column(String(200), nullable=False)
    description: str = Column(Text, default="")
    owner_id: str = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: datetime = Column(DateTime, default=datetime.utcnow)
    updated_at: datetime = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    owner = relationship("User", back_populates="quizzes")
    questions = relationship(
        "Question",
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="Question.order",
    )


# ---------------------------------------------------------------------------
# Question
# ---------------------------------------------------------------------------
class Question(Base):
    __tablename__ = "questions"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id: str = Column(String(36), ForeignKey("quizzes.id"), nullable=False, index=True)
    text: str = Column(Text, nullable=False)
    image_url: str | None = Column(String, nullable=True)
    order: int = Column(Integer, nullable=False, default=0)
    time_limit: int = Column(Integer, nullable=False, default=30)  # seconds

    quiz = relationship("Quiz", back_populates="questions")
    answers = relationship(
        "Answer",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="Answer.order",
    )


# ---------------------------------------------------------------------------
# Answer (choice)
# ---------------------------------------------------------------------------
class Answer(Base):
    __tablename__ = "answers"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id: str = Column(String(36), ForeignKey("questions.id"), nullable=False, index=True)
    text: str = Column(String(500), nullable=False)
    is_correct: bool = Column(Boolean, nullable=False, default=False)
    order: int = Column(Integer, nullable=False, default=0)

    question = relationship("Question", back_populates="answers")


# ---------------------------------------------------------------------------
# Live Session
# ---------------------------------------------------------------------------
class Session(Base):
    __tablename__ = "sessions"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id: str = Column(String(36), ForeignKey("quizzes.id"), nullable=False)
    owner_id: str = Column(String(36), ForeignKey("users.id"), nullable=False)
    code: str = Column(String(6), unique=True, nullable=False, default=_generate_code, index=True)
    status: str = Column(String(20), nullable=False, default="lobby")
    # status: lobby -> active -> revealing -> finished
    current_question_idx: int = Column(Integer, nullable=False, default=-1)
    created_at: datetime = Column(DateTime, default=datetime.utcnow)

    quiz = relationship("Quiz")
    owner = relationship("User")
    participants = relationship(
        "Participant", back_populates="session", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# Participant (anonymous player in a session)
# ---------------------------------------------------------------------------
class Participant(Base):
    __tablename__ = "participants"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: str = Column(String(36), ForeignKey("sessions.id"), nullable=False, index=True)
    nickname: str = Column(String(50), nullable=False)
    token: str = Column(String(64), nullable=False)  # secure token for WS auth
    score: int = Column(Integer, nullable=False, default=0)
    joined_at: datetime = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="participants")
    responses = relationship(
        "ParticipantResponse", back_populates="participant", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# ParticipantResponse (one answer per participant per question)
# ---------------------------------------------------------------------------
class ParticipantResponse(Base):
    __tablename__ = "participant_responses"
    __table_args__ = (
        UniqueConstraint("participant_id", "question_id", name="uq_participant_question"),
    )

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    participant_id: str = Column(String(36), ForeignKey("participants.id"), nullable=False, index=True)
    question_id: str = Column(String(36), ForeignKey("questions.id"), nullable=False, index=True)
    answer_id: str = Column(String(36), ForeignKey("answers.id"), nullable=True)
    is_correct: bool = Column(Boolean, nullable=False, default=False)
    response_time: float = Column(Float, nullable=True)  # seconds
    points_awarded: int = Column(Integer, nullable=False, default=0)
    answered_at: datetime = Column(DateTime, default=datetime.utcnow)

    participant = relationship("Participant", back_populates="responses")
    question = relationship("Question")
    answer = relationship("Answer")
