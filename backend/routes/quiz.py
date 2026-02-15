"""
Quiz CRUD routes.

Design decisions:
- All quiz routes require JWT (admin-only resource).
- Ownership check on every mutation: you can only edit/delete your own quizzes.
  This prevents horizontal privilege escalation between admin accounts.
- Nested creation: POST /quizzes accepts questions+answers in one payload.
  This avoids N+1 API calls when building a quiz from the frontend editor.
- Questions/answers can also be managed individually for granular edits.
- Listing returns QuizSummary (no nested questions) for performance on the
  dashboard. Detail endpoint returns full QuizRead with everything nested.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Answer, Question, Quiz, User
from schemas import (
    AnswerCreate,
    AnswerRead,
    AnswerUpdate,
    QuestionCreate,
    QuestionRead,
    QuestionUpdate,
    QuizCreate,
    QuizRead,
    QuizSummary,
    QuizUpdate,
)
from services.auth import get_current_user

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_quiz_or_404(quiz_id: str, db: Session) -> Quiz:
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


def _check_owner(quiz: Quiz, user: User):
    if quiz.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your quiz")


# ---------------------------------------------------------------------------
# Quiz CRUD
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[QuizSummary])
def list_quizzes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.owner_id == current_user.id)
        .order_by(Quiz.updated_at.desc())
        .all()
    )
    results = []
    for q in quizzes:
        summary = QuizSummary.model_validate(q)
        summary.question_count = len(q.questions)
        results.append(summary)
    return results


@router.post("/", response_model=QuizRead, status_code=status.HTTP_201_CREATED)
def create_quiz(
    payload: QuizCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = Quiz(
        title=payload.title,
        description=payload.description,
        owner_id=current_user.id,
    )
    for q_data in payload.questions:
        question = Question(
            text=q_data.text,
            image_url=q_data.image_url,
            order=q_data.order,
            time_limit=q_data.time_limit,
        )
        for a_data in q_data.answers:
            question.answers.append(
                Answer(text=a_data.text, is_correct=a_data.is_correct, order=a_data.order)
            )
        quiz.questions.append(question)

    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


@router.get("/{quiz_id}", response_model=QuizRead)
def get_quiz(
    quiz_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = _get_quiz_or_404(quiz_id, db)
    _check_owner(quiz, current_user)
    return quiz


@router.patch("/{quiz_id}", response_model=QuizRead)
def update_quiz(
    quiz_id: str,
    payload: QuizUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = _get_quiz_or_404(quiz_id, db)
    _check_owner(quiz, current_user)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(quiz, field, value)

    db.commit()
    db.refresh(quiz)
    return quiz


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    quiz_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = _get_quiz_or_404(quiz_id, db)
    _check_owner(quiz, current_user)
    db.delete(quiz)
    db.commit()


# ---------------------------------------------------------------------------
# Question management (within a quiz)
# ---------------------------------------------------------------------------

@router.post("/{quiz_id}/questions", response_model=QuestionRead, status_code=201)
def add_question(
    quiz_id: str,
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = _get_quiz_or_404(quiz_id, db)
    _check_owner(quiz, current_user)

    question = Question(
        quiz_id=quiz.id,
        text=payload.text,
        image_url=payload.image_url,
        order=payload.order,
        time_limit=payload.time_limit,
    )
    for a_data in payload.answers:
        question.answers.append(
            Answer(text=a_data.text, is_correct=a_data.is_correct, order=a_data.order)
        )

    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.patch("/{quiz_id}/questions/{question_id}", response_model=QuestionRead)
def update_question(
    quiz_id: str,
    question_id: str,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = _get_quiz_or_404(quiz_id, db)
    _check_owner(quiz, current_user)

    question = db.query(Question).filter(
        Question.id == question_id, Question.quiz_id == quiz_id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(question, field, value)

    db.commit()
    db.refresh(question)
    return question


@router.delete("/{quiz_id}/questions/{question_id}", status_code=204)
def delete_question(
    quiz_id: str,
    question_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = _get_quiz_or_404(quiz_id, db)
    _check_owner(quiz, current_user)

    question = db.query(Question).filter(
        Question.id == question_id, Question.quiz_id == quiz_id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    db.delete(question)
    db.commit()


# ---------------------------------------------------------------------------
# Answer management (within a question)
# ---------------------------------------------------------------------------

@router.post(
    "/{quiz_id}/questions/{question_id}/answers",
    response_model=AnswerRead,
    status_code=201,
)
def add_answer(
    quiz_id: str,
    question_id: str,
    payload: AnswerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = _get_quiz_or_404(quiz_id, db)
    _check_owner(quiz, current_user)

    question = db.query(Question).filter(
        Question.id == question_id, Question.quiz_id == quiz_id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    answer = Answer(
        question_id=question.id,
        text=payload.text,
        is_correct=payload.is_correct,
        order=payload.order,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return answer


@router.patch(
    "/{quiz_id}/questions/{question_id}/answers/{answer_id}",
    response_model=AnswerRead,
)
def update_answer(
    quiz_id: str,
    question_id: str,
    answer_id: str,
    payload: AnswerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = _get_quiz_or_404(quiz_id, db)
    _check_owner(quiz, current_user)

    answer = db.query(Answer).filter(
        Answer.id == answer_id, Answer.question_id == question_id
    ).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(answer, field, value)

    db.commit()
    db.refresh(answer)
    return answer


@router.delete(
    "/{quiz_id}/questions/{question_id}/answers/{answer_id}",
    status_code=204,
)
def delete_answer(
    quiz_id: str,
    question_id: str,
    answer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = _get_quiz_or_404(quiz_id, db)
    _check_owner(quiz, current_user)

    answer = db.query(Answer).filter(
        Answer.id == answer_id, Answer.question_id == question_id
    ).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    db.delete(answer)
    db.commit()
