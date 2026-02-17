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

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


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
    role: str
    is_active: bool
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
    image_url: str | None = None
    order: int = 0
    time_limit: int = Field(default=30, ge=5, le=300)
    answers: list[AnswerCreate] = Field(min_length=2, max_length=6)

    @field_validator('image_url')
    @classmethod
    def validate_image_url(cls, v):
        if v is not None and not v.startswith('/api/uploads/'):
            raise ValueError('image_url must start with /api/uploads/')
        return v

    @model_validator(mode='after')
    def check_at_least_one_correct(self):
        if not any(a.is_correct for a in self.answers):
            raise ValueError('At least one answer must be correct')
        return self


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    text: str
    image_url: str | None = None
    order: int
    time_limit: int
    answers: list[AnswerRead]


class QuestionUpdate(BaseModel):
    text: str | None = None
    image_url: str | None = None
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


# ---- Session -------------------------------------------------------------

class SessionCreate(BaseModel):
    quiz_id: str


class ParticipantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nickname: str
    score: int
    joined_at: datetime


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quiz_id: str
    owner_id: str
    code: str
    status: str
    current_question_idx: int
    created_at: datetime
    participants: list[ParticipantRead]


class SessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quiz_id: str
    code: str
    status: str
    created_at: datetime
    quiz_title: str = ""
    participant_count: int = 0


class JoinSession(BaseModel):
    code: str = Field(min_length=6, max_length=6)
    nickname: str = Field(min_length=1, max_length=50, pattern=r'^[\w\s\-\.]+$')


class SubmitAnswer(BaseModel):
    answer_id: str
    response_time: float = Field(ge=0)


class ParticipantResponseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    participant_id: str
    question_id: str
    answer_id: str | None
    is_correct: bool
    response_time: float | None
    points_awarded: int


class LeaderboardEntry(BaseModel):
    participant_id: str
    nickname: str
    score: int
    rank: int


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)
    role: str = Field(default="user", pattern="^(admin|user)$")


class PasswordReset(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class StatusUpdate(BaseModel):
    is_active: bool


class AdminQuizRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    owner_email: str
    owner_name: str
    question_count: int
    session_count: int
    created_at: datetime


class AdminSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    status: str
    quiz_title: str
    owner_name: str
    participant_count: int
    created_at: datetime


class AdminDashboard(BaseModel):
    total_users: int
    total_quizzes: int
    total_sessions: int
    active_sessions: int
    recent_users: list[UserRead]
    recent_sessions: list[AdminSessionRead]
