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

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


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
    quiz_id: str = Column(String(36), ForeignKey("quizzes.id"), nullable=False)
    text: str = Column(Text, nullable=False)
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
    question_id: str = Column(String(36), ForeignKey("questions.id"), nullable=False)
    text: str = Column(String(500), nullable=False)
    is_correct: bool = Column(Boolean, nullable=False, default=False)
    order: int = Column(Integer, nullable=False, default=0)

    question = relationship("Question", back_populates="answers")
