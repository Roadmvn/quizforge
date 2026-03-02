"""
Leaderboard routes — cross-session rankings by theme.

Shows each player's best single-session score, grouped by nickname.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session as DbSession

from database import get_db
from models import Participant, Quiz, Session
from schemas import (
    SessionLeaderboardEntry,
    SessionSummaryForLeaderboard,
    ThemeLeaderboardEntry,
)

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


def _build_theme_leaderboard(
    db: DbSession,
    theme: str | None = None,
) -> list[ThemeLeaderboardEntry]:
    """Build a leaderboard showing each player's best single-session score.

    If *theme* is provided, only sessions linked to quizzes with that theme
    are included.  Otherwise all finished sessions count.
    """
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

    if theme is not None:
        query = query.filter(Quiz.theme == theme)

    rows = (
        query
        .group_by(Participant.nickname)
        .order_by(func.max(Participant.score).desc())
        .all()
    )

    return [
        ThemeLeaderboardEntry(
            username=row.username,
            best_score=row.best_score,
            sessions_count=row.sessions_count,
            rank=idx + 1,
        )
        for idx, row in enumerate(rows)
    ]


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


@router.get("/sessions", response_model=list[SessionSummaryForLeaderboard])
def list_sessions(
    theme: str | None = Query(None),
    db: DbSession = Depends(get_db),
):
    """List finished sessions, optionally filtered by theme."""
    query = (
        db.query(
            Session.id.label("session_id"),
            Quiz.title.label("quiz_title"),
            Quiz.theme,
            Session.created_at.label("started_at"),
            func.count(Participant.id).label("participant_count"),
        )
        .join(Quiz, Session.quiz_id == Quiz.id)
        .outerjoin(Participant, Participant.session_id == Session.id)
        .filter(Session.status == "finished")
    )

    if theme is not None:
        query = query.filter(Quiz.theme == theme)

    rows = (
        query
        .group_by(Session.id)
        .order_by(Session.created_at.desc())
        .all()
    )

    return [
        SessionSummaryForLeaderboard(
            session_id=row.session_id,
            quiz_title=row.quiz_title,
            theme=row.theme,
            started_at=row.started_at,
            participant_count=row.participant_count,
        )
        for row in rows
    ]


@router.get("/session/{session_id}", response_model=list[SessionLeaderboardEntry])
def session_leaderboard(session_id: str, db: DbSession = Depends(get_db)):
    """Ranking of players for a single session."""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    rows = (
        db.query(Participant.nickname, Participant.score)
        .filter(Participant.session_id == session_id)
        .order_by(Participant.score.desc())
        .all()
    )

    return [
        SessionLeaderboardEntry(rank=idx + 1, username=row.nickname, score=row.score)
        for idx, row in enumerate(rows)
    ]


@router.get("/", response_model=list[ThemeLeaderboardEntry])
def global_leaderboard(db: DbSession = Depends(get_db)):
    """Global leaderboard across all themes."""
    return _build_theme_leaderboard(db)


@router.get("/{theme}", response_model=list[ThemeLeaderboardEntry])
def theme_leaderboard(theme: str, db: DbSession = Depends(get_db)):
    """Leaderboard for a specific quiz theme."""
    return _build_theme_leaderboard(db, theme=theme)
