"""
Pydantic schemas — strict input/output contracts.

Design decisions:
- Separate Create/Update/Read schemas per entity: Create has no id,
  Update has all-optional fields, Read includes id + timestamps.
- Nested writes: QuizCreate embeds QuestionCreate which embeds AnswerCreate,
  so an entire quiz can be created in a single POST (better UX for the admin).
- Read schemas use `model_config = ConfigDict(from_attributes=True)` to
  hydrate directly from SQLAlchemy model instances.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---- Auth ----------------------------------------------------------------

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    created_at: datetime


# ---- Answer --------------------------------------------------------------

class AnswerCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    is_correct: bool = False
    order: int = 0


class AnswerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    text: str
    is_correct: bool
    order: int


class AnswerUpdate(BaseModel):
    text: str | None = None
    is_correct: bool | None = None
    order: int | None = None


# ---- Question ------------------------------------------------------------

class QuestionCreate(BaseModel):
    text: str = Field(min_length=1)
    order: int = 0
    time_limit: int = Field(default=30, ge=5, le=300)
    answers: list[AnswerCreate] = Field(min_length=2, max_length=6)


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    text: str
    order: int
    time_limit: int
    answers: list[AnswerRead]


class QuestionUpdate(BaseModel):
    text: str | None = None
    order: int | None = None
    time_limit: int | None = Field(default=None, ge=5, le=300)


# ---- Quiz ----------------------------------------------------------------

class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    questions: list[QuestionCreate] = []


class QuizRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    owner_id: str
    created_at: datetime
    updated_at: datetime
    questions: list[QuestionRead]


class QuizSummary(BaseModel):
    """Lightweight version for dashboard listing (no nested questions)."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    created_at: datetime
    updated_at: datetime
    question_count: int = 0


class QuizUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
