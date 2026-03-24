"""
Leaderboard routes — cross-session rankings by theme and quiz.

Shows each player's best single-session score, grouped by nickname.
Excluded nicknames appear at the bottom without a rank.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session as DbSession

from database import get_db
from models import ExcludedNickname, Participant, Quiz, Session
from schemas import (
    QuizSummaryForLeaderboard,
    ThemeLeaderboardEntry,
)

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


def _get_excluded_nicknames(db: DbSession) -> set[str]:
    """Return the set of excluded nicknames (lowercased for comparison)."""
    rows = db.query(ExcludedNickname.nickname).all()
    return {r[0].lower() for r in rows}


def _build_leaderboard(
    db: DbSession,
    theme: str | None = None,
    quiz_id: str | None = None,
) -> list[ThemeLeaderboardEntry]:
    """Build a leaderboard showing each player's best single-session score.

    Filters:
    - theme: only sessions linked to quizzes with that theme
    - quiz_id: only sessions of that specific quiz

    Excluded nicknames are placed at the bottom with rank=0.
    """
    excluded = _get_excluded_nicknames(db)

    query = (
        db.query(
            Participant.nickname.label("username"),
            func.max(Participant.score).label("best_score"),
            func.count(Session.id.distinct()).label("sessions_count"),
        )
        .join(Session, Participant.session_id == Session.id)
        .join(Quiz, Session.quiz_id == Quiz.id)
        .filter(Session.status == "finished")
    )

    if quiz_id is not None:
        query = query.filter(Quiz.id == quiz_id)
    elif theme is not None:
        query = query.filter(Quiz.theme == theme)

    rows = (
        query
        .group_by(Participant.nickname)
        .order_by(func.max(Participant.score).desc())
        .all()
    )

    ranked: list[ThemeLeaderboardEntry] = []
    excluded_entries: list[ThemeLeaderboardEntry] = []
    rank = 1

    for row in rows:
        is_excluded = row.username.lower() in excluded
        entry = ThemeLeaderboardEntry(
            username=row.username,
            best_score=row.best_score,
            sessions_count=row.sessions_count,
            rank=0 if is_excluded else rank,
            excluded=is_excluded,
        )
        if is_excluded:
            excluded_entries.append(entry)
        else:
            ranked.append(entry)
            rank += 1

    return ranked + excluded_entries


@router.get("/themes", response_model=list[str])
def list_themes(db: DbSession = Depends(get_db)):
    """Return all distinct non-null themes that have at least one finished session."""
    rows = (
        db.query(Quiz.theme)
        .join(Session, Session.quiz_id == Quiz.id)
        .filter(Session.status == "finished", Quiz.theme.isnot(None), Quiz.theme != "")
        .distinct()
        .order_by(Quiz.theme)
        .all()
    )
    return [r[0] for r in rows]


@router.get("/quizzes", response_model=list[QuizSummaryForLeaderboard])
def list_quizzes(
    theme: str | None = Query(None),
    db: DbSession = Depends(get_db),
):
    """List quizzes that have at least one finished session, optionally filtered by theme."""
    query = (
        db.query(
            Quiz.id.label("quiz_id"),
            Quiz.title.label("quiz_title"),
            Quiz.theme,
            func.count(Session.id.distinct()).label("session_count"),
            func.count(Participant.id).label("participant_count"),
        )
        .join(Session, Session.quiz_id == Quiz.id)
        .outerjoin(Participant, Participant.session_id == Session.id)
        .filter(Session.status == "finished")
    )

    if theme is not None:
        query = query.filter(Quiz.theme == theme)

    rows = (
        query
        .group_by(Quiz.id)
        .order_by(Quiz.title)
        .all()
    )

    return [
        QuizSummaryForLeaderboard(
            quiz_id=row.quiz_id,
            quiz_title=row.quiz_title,
            theme=row.theme,
            session_count=row.session_count,
            participant_count=row.participant_count,
        )
        for row in rows
    ]


@router.get("/quiz/{quiz_id}", response_model=list[ThemeLeaderboardEntry])
def quiz_leaderboard(quiz_id: str, db: DbSession = Depends(get_db)):
    """Leaderboard for a specific quiz (all sessions combined)."""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return _build_leaderboard(db, quiz_id=quiz_id)


@router.get("/", response_model=list[ThemeLeaderboardEntry])
def global_leaderboard(db: DbSession = Depends(get_db)):
    """Global leaderboard across all themes."""
    return _build_leaderboard(db)


@router.get("/{theme}", response_model=list[ThemeLeaderboardEntry])
def theme_leaderboard(theme: str, db: DbSession = Depends(get_db)):
    """Leaderboard for a specific quiz theme."""
    return _build_leaderboard(db, theme=theme)
