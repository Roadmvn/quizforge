"""
Session routes: create, join, control, and WebSocket endpoints.

Flow:
1. Admin POST /sessions → creates a session in "lobby" status
2. Participants POST /sessions/join → get participant_id back
3. Both connect via WebSocket (/ws/session/{sid}?role=admin&token=...
   or /ws/session/{sid}?role=participant&pid=...)
4. Admin sends commands: start_game, next_question, reveal_answer, end_game
5. Server processes, updates DB, broadcasts state to all via WebSocket
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session as DBSession, joinedload

from database import get_db
from models import Answer, Participant, ParticipantResponse, Question, Quiz, Session, User
from schemas import (
    JoinSession,
    LeaderboardEntry,
    ParticipantRead,
    SessionCreate,
    SessionRead,
    SessionSummary,
    SubmitAnswer,
)
from services.auth import get_current_user, SECRET_KEY, ALGORITHM
from services.qrcode import generate_qr_base64
from websocket.hub import hub

from jose import JWTError, jwt

router = APIRouter(tags=["sessions"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_session_or_404(session_id: str, db: DBSession) -> Session:
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _build_leaderboard(session: Session, db: DBSession) -> list[dict]:
    participants = (
        db.query(Participant)
        .filter(Participant.session_id == session.id)
        .order_by(Participant.score.desc())
        .all()
    )
    return [
        {"participant_id": p.id, "nickname": p.nickname, "score": p.score, "rank": i + 1}
        for i, p in enumerate(participants)
    ]


def _question_payload(question: Question, reveal: bool = False) -> dict:
    """Build the question dict sent to participants."""
    answers = [
        {
            "id": a.id,
            "text": a.text,
            "order": a.order,
            **({"is_correct": a.is_correct} if reveal else {}),
        }
        for a in sorted(question.answers, key=lambda a: a.order)
    ]
    return {
        "question_id": question.id,
        "text": question.text,
        "order": question.order,
        "time_limit": question.time_limit,
        "answers": answers,
    }


# ---------------------------------------------------------------------------
# REST: Session management (admin, JWT-protected)
# ---------------------------------------------------------------------------

@router.post("/api/sessions", response_model=SessionRead, status_code=201)
def create_session(
    payload: SessionCreate,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = db.query(Quiz).filter(Quiz.id == payload.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your quiz")
    if not quiz.questions:
        raise HTTPException(status_code=400, detail="Quiz has no questions")

    session = Session(quiz_id=quiz.id, owner_id=current_user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/api/sessions", response_model=list[SessionSummary])
def list_sessions(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = (
        db.query(Session)
        .filter(Session.owner_id == current_user.id)
        .order_by(Session.created_at.desc())
        .all()
    )
    results = []
    for s in sessions:
        quiz = db.query(Quiz).filter(Quiz.id == s.quiz_id).first()
        results.append(SessionSummary(
            id=s.id,
            code=s.code,
            status=s.status,
            created_at=s.created_at,
            quiz_title=quiz.title if quiz else "",
            participant_count=len(s.participants),
        ))
    return results


@router.get("/api/sessions/{session_id}", response_model=SessionRead)
def get_session(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(session_id, db)
    if session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    return session


@router.get("/api/sessions/{session_id}/qrcode")
def get_qr_code(
    session_id: str,
    base_url: str = Query(default="http://localhost:5173"),
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(session_id, db)
    if session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    join_url = f"{base_url}/join/{session.code}"
    return {"qr_base64": generate_qr_base64(join_url), "join_url": join_url, "code": session.code}


@router.get("/api/sessions/{session_id}/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(session_id, db)
    if session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    return _build_leaderboard(session, db)


@router.get("/api/sessions/{session_id}/export")
def export_csv(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export session results as CSV."""
    from fastapi.responses import StreamingResponse
    import csv
    import io

    session = _get_session_or_404(session_id, db)
    if session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    quiz = db.query(Quiz).options(
        joinedload(Quiz.questions).joinedload(Question.answers)
    ).filter(Quiz.id == session.quiz_id).first()

    participants = (
        db.query(Participant)
        .filter(Participant.session_id == session.id)
        .order_by(Participant.score.desc())
        .all()
    )

    buf = io.StringIO()
    writer = csv.writer(buf)

    # Header
    header = ["Rank", "Nickname", "Total Score"]
    questions = sorted(quiz.questions, key=lambda q: q.order)
    for q in questions:
        header.extend([f"Q{q.order + 1}: Answer", f"Q{q.order + 1}: Correct?", f"Q{q.order + 1}: Time(s)", f"Q{q.order + 1}: Points"])
    writer.writerow(header)

    for rank, p in enumerate(participants, 1):
        row = [rank, p.nickname, p.score]
        for q in questions:
            resp = (
                db.query(ParticipantResponse)
                .filter(
                    ParticipantResponse.participant_id == p.id,
                    ParticipantResponse.question_id == q.id,
                )
                .first()
            )
            if resp:
                answer_text = ""
                if resp.answer_id:
                    ans = db.query(Answer).filter(Answer.id == resp.answer_id).first()
                    answer_text = ans.text if ans else ""
                row.extend([answer_text, resp.is_correct, resp.response_time or "", resp.points_awarded])
            else:
                row.extend(["No answer", False, "", 0])
        writer.writerow(row)

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=session_{session.code}.csv"},
    )


# ---------------------------------------------------------------------------
# REST: Participant join (no auth)
# ---------------------------------------------------------------------------

@router.post("/api/sessions/join", response_model=ParticipantRead, status_code=201)
def join_session(payload: JoinSession, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.code == payload.code.upper()).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "lobby":
        raise HTTPException(status_code=400, detail="Session is not accepting new participants")

    # Check duplicate nickname
    existing = (
        db.query(Participant)
        .filter(Participant.session_id == session.id, Participant.nickname == payload.nickname)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Nickname already taken in this session")

    participant = Participant(session_id=session.id, nickname=payload.nickname)
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


# ---------------------------------------------------------------------------
# REST: Participant info (no auth, by session code)
# ---------------------------------------------------------------------------

@router.get("/api/sessions/by-code/{code}")
def get_session_by_code(code: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.code == code.upper()).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    quiz = db.query(Quiz).filter(Quiz.id == session.quiz_id).first()
    return {
        "session_id": session.id,
        "code": session.code,
        "status": session.status,
        "quiz_title": quiz.title if quiz else "",
        "current_question_idx": session.current_question_idx,
        "participant_count": len(session.participants),
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/session/{session_id}")
async def ws_session(
    websocket: WebSocket,
    session_id: str,
    role: str = Query(...),
    token: str = Query(default=None),
    pid: str = Query(default=None),
):
    """
    WebSocket entry point.
    - Admin: role=admin&token=JWT
    - Participant: role=participant&pid=participant_id
    """
    db: DBSession = next(get_db())

    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            await websocket.close(code=4004)
            return

        # Authenticate
        if role == "admin":
            if not token:
                await websocket.close(code=4001)
                return
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user_id = payload.get("sub")
            except JWTError:
                await websocket.close(code=4001)
                return
            if session.owner_id != user_id:
                await websocket.close(code=4003)
                return
            conn = await hub.connect(session_id, websocket, "admin")

        elif role == "participant":
            if not pid:
                await websocket.close(code=4001)
                return
            participant = db.query(Participant).filter(
                Participant.id == pid, Participant.session_id == session_id
            ).first()
            if not participant:
                await websocket.close(code=4004)
                return
            conn = await hub.connect(
                session_id, websocket, "participant",
                participant_id=pid, nickname=participant.nickname,
            )
            # Notify admin of new connection
            await hub.send_to_admin(session_id, {
                "type": "participant_connected",
                "participant_id": pid,
                "nickname": participant.nickname,
                "online_count": hub.get_participant_count(session_id),
            })
        else:
            await websocket.close(code=4001)
            return

        # Message loop
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if role == "admin":
                await _handle_admin_message(session_id, msg_type, data, db)
            elif role == "participant":
                await _handle_participant_message(session_id, pid, msg_type, data, db)

    except WebSocketDisconnect:
        hub.disconnect(session_id, conn)
        if role == "participant" and pid:
            await hub.send_to_admin(session_id, {
                "type": "participant_disconnected",
                "participant_id": pid,
                "online_count": hub.get_participant_count(session_id),
            })
    except Exception:
        hub.disconnect(session_id, conn)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Admin message handlers
# ---------------------------------------------------------------------------

async def _handle_admin_message(
    session_id: str, msg_type: str, data: dict, db: DBSession
):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        return

    quiz = db.query(Quiz).options(
        joinedload(Quiz.questions).joinedload(Question.answers)
    ).filter(Quiz.id == session.quiz_id).first()
    questions = sorted(quiz.questions, key=lambda q: q.order)

    if msg_type == "start_game":
        if session.status != "lobby":
            return
        session.status = "active"
        session.current_question_idx = 0
        db.commit()

        question = questions[0]
        await hub.broadcast(session_id, {
            "type": "game_started",
            "total_questions": len(questions),
        })
        await hub.broadcast(session_id, {
            "type": "new_question",
            "question_idx": 0,
            "total_questions": len(questions),
            **_question_payload(question, reveal=False),
        })

    elif msg_type == "next_question":
        if session.status != "active":
            return
        next_idx = session.current_question_idx + 1
        if next_idx >= len(questions):
            return
        session.current_question_idx = next_idx
        session.status = "active"
        db.commit()

        question = questions[next_idx]
        await hub.broadcast(session_id, {
            "type": "new_question",
            "question_idx": next_idx,
            "total_questions": len(questions),
            **_question_payload(question, reveal=False),
        })

    elif msg_type == "reveal_answer":
        if session.status not in ("active", "revealing"):
            return
        session.status = "revealing"
        db.commit()

        idx = session.current_question_idx
        question = questions[idx]

        # Gather stats
        total_responses = (
            db.query(ParticipantResponse)
            .filter(ParticipantResponse.question_id == question.id)
            .join(Participant)
            .filter(Participant.session_id == session.id)
            .count()
        )
        correct_count = (
            db.query(ParticipantResponse)
            .filter(
                ParticipantResponse.question_id == question.id,
                ParticipantResponse.is_correct == True,
            )
            .join(Participant)
            .filter(Participant.session_id == session.id)
            .count()
        )

        await hub.broadcast(session_id, {
            "type": "answer_revealed",
            "question_idx": idx,
            **_question_payload(question, reveal=True),
            "stats": {
                "total_responses": total_responses,
                "correct_count": correct_count,
            },
            "leaderboard": _build_leaderboard(session, db),
        })

    elif msg_type == "end_game":
        session.status = "finished"
        db.commit()
        await hub.broadcast(session_id, {
            "type": "game_ended",
            "leaderboard": _build_leaderboard(session, db),
        })


# ---------------------------------------------------------------------------
# Participant message handlers
# ---------------------------------------------------------------------------

async def _handle_participant_message(
    session_id: str, participant_id: str, msg_type: str, data: dict, db: DBSession
):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        return

    if msg_type == "submit_answer":
        if session.status != "active":
            return

        answer_id = data.get("answer_id")
        response_time = data.get("response_time", 0)

        quiz = db.query(Quiz).options(
            joinedload(Quiz.questions).joinedload(Question.answers)
        ).filter(Quiz.id == session.quiz_id).first()
        questions = sorted(quiz.questions, key=lambda q: q.order)

        if session.current_question_idx < 0 or session.current_question_idx >= len(questions):
            return

        question = questions[session.current_question_idx]

        # Check if already answered
        existing = (
            db.query(ParticipantResponse)
            .filter(
                ParticipantResponse.participant_id == participant_id,
                ParticipantResponse.question_id == question.id,
            )
            .first()
        )
        if existing:
            await hub.send_to_one(session_id, participant_id, {
                "type": "error",
                "message": "Already answered this question",
            })
            return

        # Validate answer belongs to this question
        answer = db.query(Answer).filter(
            Answer.id == answer_id, Answer.question_id == question.id
        ).first()
        if not answer:
            await hub.send_to_one(session_id, participant_id, {
                "type": "error",
                "message": "Invalid answer",
            })
            return

        # Calculate points: base 1000, bonus for speed
        is_correct = answer.is_correct
        points = 0
        if is_correct:
            time_limit = question.time_limit
            time_ratio = max(0, 1 - (response_time / time_limit))
            points = int(500 + 500 * time_ratio)  # 500-1000 points

        response = ParticipantResponse(
            participant_id=participant_id,
            question_id=question.id,
            answer_id=answer_id,
            is_correct=is_correct,
            response_time=response_time,
            points_awarded=points,
        )
        db.add(response)

        # Update participant score
        participant = db.query(Participant).filter(Participant.id == participant_id).first()
        participant.score += points
        db.commit()

        # Confirm to participant
        await hub.send_to_one(session_id, participant_id, {
            "type": "answer_submitted",
            "is_correct": is_correct,
            "points_awarded": points,
            "total_score": participant.score,
        })

        # Notify admin of new answer
        total_participants = len(session.participants)
        answered_count = (
            db.query(ParticipantResponse)
            .filter(ParticipantResponse.question_id == question.id)
            .join(Participant)
            .filter(Participant.session_id == session.id)
            .count()
        )
        await hub.send_to_admin(session_id, {
            "type": "answer_received",
            "answered_count": answered_count,
            "total_participants": total_participants,
            "participant_id": participant_id,
        })
