"""
Session routes: create, join, control, and WebSocket endpoints.

Flow:
1. Admin POST /sessions -> creates a session in "lobby" status
2. Participants POST /sessions/join -> get participant_id + token back
3. Both connect via WebSocket (/ws/session/{sid}), then send auth as first message
4. Admin sends commands: start_game, next_question, reveal_answer, end_game
5. Server processes, updates DB, broadcasts state to all via WebSocket

Review fixes applied:
- Per-operation DB sessions in WebSocket (no connection-scoped session)
- Participant token auth to prevent spoofing
- Safe conn init to prevent NameError on early failure
- IntegrityError catch for race condition on duplicate answers
- Division-by-zero guard in scoring
"""

import asyncio
import json
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession, joinedload

from database import get_db, SessionLocal
from models import Answer, Participant, ParticipantResponse, Question, Quiz, Session, User
from schemas import (
    JoinSession,
    LeaderboardEntry,
    SessionCreate,
    SessionRead,
    SessionSummary,
)
from services.auth import get_current_user, SECRET_KEY, ALGORITHM
from services.qrcode import generate_qr_base64
from websocket.hub import hub

import jwt
from jwt.exceptions import PyJWTError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sessions"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sanitize_csv_value(value) -> str:
    """Prefix dangerous CSV values to prevent formula injection."""
    s = str(value)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


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
        "image_url": question.image_url,
        "answers": answers,
    }


def _fresh_db() -> DBSession:
    """Create a fresh DB session for use in WebSocket handlers (per-operation)."""
    return SessionLocal()


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

    for attempt in range(3):
        session = Session(quiz_id=quiz.id, owner_id=current_user.id)
        db.add(session)
        try:
            db.commit()
            db.refresh(session)
            return session
        except IntegrityError:
            db.rollback()
            if attempt == 2:
                raise HTTPException(status_code=500, detail="Failed to generate unique session code")


@router.get("/api/sessions", response_model=list[SessionSummary])
def list_sessions(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = (
        db.query(Session)
        .options(joinedload(Session.quiz), joinedload(Session.participants))
        .filter(Session.owner_id == current_user.id)
        .order_by(Session.created_at.desc())
        .all()
    )
    return [
        SessionSummary(
            id=s.id,
            quiz_id=s.quiz_id,
            code=s.code,
            status=s.status,
            created_at=s.created_at,
            quiz_title=s.quiz.title if s.quiz else "",
            participant_count=len(s.participants),
            participants=sorted(s.participants, key=lambda p: p.score, reverse=True),
        )
        for s in sessions
    ]


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


@router.delete("/api/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(session_id, db)
    if session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    db.delete(session)
    db.commit()


@router.post("/api/sessions/{session_id}/finish")
async def force_finish_session(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(session_id, db)
    if session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.status == "finished":
        raise HTTPException(status_code=400, detail="Session already finished")
    session.status = "finished"
    db.commit()
    db.refresh(session)
    leaderboard = _build_leaderboard(session, db)
    await hub.broadcast(session_id, {
        "type": "game_ended",
        "leaderboard": leaderboard,
    })
    return {"status": "finished", "id": session.id}


@router.get("/api/sessions/{session_id}/qrcode")
def get_qr_code(
    session_id: str,
    request: Request,
    base_url: str = Query(default=""),
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(session_id, db)
    if session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    if not base_url:
        scheme = request.headers.get("x-forwarded-proto", "http")
        host = request.headers.get("host", "localhost")
        base_url = f"{scheme}://{host}"
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
        .options(joinedload(Participant.responses).joinedload(ParticipantResponse.answer))
        .filter(Participant.session_id == session.id)
        .order_by(Participant.score.desc())
        .all()
    )

    buf = io.StringIO()
    writer = csv.writer(buf)

    questions = sorted(quiz.questions, key=lambda q: q.order)
    header = ["Rank", "Nickname", "Total Score"]
    for q in questions:
        header.extend([f"Q{q.order + 1}: Answer", f"Q{q.order + 1}: Correct?", f"Q{q.order + 1}: Time(s)", f"Q{q.order + 1}: Points"])
    writer.writerow(header)

    for rank, p in enumerate(participants, 1):
        row = [rank, _sanitize_csv_value(p.nickname), p.score]
        resp_by_qid = {r.question_id: r for r in p.responses}
        for q in questions:
            resp = resp_by_qid.get(q.id)
            if resp:
                answer_text = resp.answer.text if resp.answer else ""
                row.extend([_sanitize_csv_value(answer_text), resp.is_correct, resp.response_time or "", resp.points_awarded])
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
# REST: Session analytics (admin, JWT-protected)
# ---------------------------------------------------------------------------

@router.get("/api/sessions/{session_id}/analytics")
def get_session_analytics(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(session_id, db)
    if session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    quiz = db.query(Quiz).options(
        joinedload(Quiz.questions).joinedload(Question.answers)
    ).filter(Quiz.id == session.quiz_id).first()

    questions = sorted(quiz.questions, key=lambda q: q.order)

    participants = (
        db.query(Participant)
        .options(joinedload(Participant.responses))
        .filter(Participant.session_id == session.id)
        .order_by(Participant.score.desc())
        .all()
    )

    total_participants = len(participants)

    # Fetch ALL responses for this session's questions in one query (avoid N+1)
    question_ids = [q.id for q in questions]
    all_pr = (
        db.query(ParticipantResponse)
        .join(Participant)
        .filter(
            Participant.session_id == session.id,
            ParticipantResponse.question_id.in_(question_ids),
        )
        .all()
    )
    responses_by_qid: dict[str, list] = {qid: [] for qid in question_ids}
    for r in all_pr:
        responses_by_qid[r.question_id].append(r)

    # Build per-question stats
    questions_stats = []
    all_correct = 0
    all_responses = 0

    for q in questions:
        responses = responses_by_qid[q.id]
        total_resp = len(responses)
        correct_resp = sum(1 for r in responses if r.is_correct)
        timed = [r.response_time for r in responses if r.response_time is not None]
        avg_time = round(sum(timed) / len(timed), 2) if timed else 0

        all_correct += correct_resp
        all_responses += total_resp

        # Response distribution per answer choice
        answer_distribution = []
        for a in sorted(q.answers, key=lambda a: a.order):
            count = sum(1 for r in responses if r.answer_id == a.id)
            answer_distribution.append({
                "answer_id": a.id,
                "text": a.text,
                "is_correct": a.is_correct,
                "count": count,
                "percentage": round(count / total_resp * 100, 1) if total_resp > 0 else 0,
            })

        questions_stats.append({
            "question_id": q.id,
            "text": q.text,
            "order": q.order,
            "time_limit": q.time_limit,
            "image_url": q.image_url,
            "total_responses": total_resp,
            "correct_percentage": round(correct_resp / total_resp * 100, 1) if total_resp > 0 else 0,
            "avg_response_time": round(avg_time, 2),
            "answer_distribution": answer_distribution,
        })

    # Leaderboard with detailed stats
    leaderboard = []
    for rank, p in enumerate(participants, 1):
        p_responses = [r for r in p.responses]
        p_correct = sum(1 for r in p_responses if r.is_correct)
        p_avg_time = (
            sum(r.response_time for r in p_responses if r.response_time is not None) / len(p_responses)
            if p_responses else 0
        )
        leaderboard.append({
            "rank": rank,
            "participant_id": p.id,
            "nickname": p.nickname,
            "score": p.score,
            "correct_answers": p_correct,
            "total_answers": len(p_responses),
            "avg_response_time": round(p_avg_time, 2),
        })

    # Easiest / hardest questions
    easiest = None
    hardest = None
    for qs in questions_stats:
        if qs["total_responses"] == 0:
            continue
        if easiest is None or qs["correct_percentage"] > easiest["correct_percentage"]:
            easiest = qs
        if hardest is None or qs["correct_percentage"] < hardest["correct_percentage"]:
            hardest = qs

    return {
        "session": {
            "id": session.id,
            "code": session.code,
            "status": session.status,
            "created_at": session.created_at.isoformat(),
            "quiz_title": quiz.title,
            "total_participants": total_participants,
            "total_questions": len(questions),
        },
        "questions": questions_stats,
        "leaderboard": leaderboard,
        "global_stats": {
            "avg_score": round(sum(p.score for p in participants) / total_participants, 1) if total_participants > 0 else 0,
            "success_rate": round(all_correct / all_responses * 100, 1) if all_responses > 0 else 0,
            "easiest_question": {"question_id": easiest["question_id"], "text": easiest["text"], "correct_percentage": easiest["correct_percentage"]} if easiest else None,
            "hardest_question": {"question_id": hardest["question_id"], "text": hardest["text"], "correct_percentage": hardest["correct_percentage"]} if hardest else None,
        },
    }


# ---------------------------------------------------------------------------
# REST: Participant join (no auth)
# ---------------------------------------------------------------------------

@router.post("/api/sessions/join", status_code=201)
async def join_session(payload: JoinSession, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.code == payload.code.upper()).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "finished":
        raise HTTPException(status_code=400, detail="Session is finished")

    existing = (
        db.query(Participant)
        .filter(Participant.session_id == session.id, Participant.nickname == payload.nickname)
        .first()
    )

    # Active/revealing session: only allow rejoin with existing nickname
    if session.status in ("active", "revealing"):
        if not existing:
            raise HTTPException(status_code=400, detail="Session already started")
        return {
            "id": existing.id,
            "nickname": existing.nickname,
            "score": existing.score,
            "joined_at": existing.joined_at,
            "session_id": session.id,
            "token": existing.token,
        }

    # Lobby: reject duplicate nicknames
    if existing:
        raise HTTPException(status_code=409, detail="Nickname already taken in this session")

    participant_token = secrets.token_urlsafe(48)
    participant = Participant(
        session_id=session.id,
        nickname=payload.nickname,
        token=participant_token,
    )
    db.add(participant)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Nickname already taken in this session")
    db.refresh(participant)

    total_participants = (
        db.query(Participant)
        .filter(Participant.session_id == session.id)
        .count()
    )
    await hub.send_to_admin(session.id, {
        "type": "participant_joined",
        "participant_id": participant.id,
        "nickname": participant.nickname,
        "total_participants": total_participants,
    })

    return {
        "id": participant.id,
        "nickname": participant.nickname,
        "score": participant.score,
        "joined_at": participant.joined_at,
        "session_id": session.id,
        "token": participant_token,
    }


# ---------------------------------------------------------------------------
# REST: Participant info (no auth, by session code)
# ---------------------------------------------------------------------------

@router.get("/api/sessions/by-code/{code}")
def get_session_by_code(code: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.code == code.upper()).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    quiz = db.query(Quiz).filter(Quiz.id == session.quiz_id).first()
    participant_count = db.query(Participant).filter(Participant.session_id == session.id).count()
    return {
        "code": session.code,
        "status": session.status,
        "quiz_title": quiz.title if quiz else "",
        "current_question_idx": session.current_question_idx,
        "participant_count": participant_count,
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/session/{session_id}")
async def ws_session(
    websocket: WebSocket,
    session_id: str,
):
    """
    WebSocket entry point.
    First message must be an auth payload:
    - Admin: {"type": "auth", "role": "admin", "token": "JWT"}
    - Participant: {"type": "auth", "role": "participant", "pid": "...", "ptoken": "..."}
    No other messages are accepted before auth succeeds.
    """
    await websocket.accept()

    conn = None
    role = None
    pid = None

    try:
        # Wait for auth message (with timeout)
        try:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        except asyncio.TimeoutError:
            await websocket.close(code=4008)
            return
        auth_data = json.loads(raw)

        if auth_data.get("type") != "auth":
            await websocket.close(code=4001)
            return

        role = auth_data.get("role")

        db = _fresh_db()
        try:
            session = db.query(Session).filter(Session.id == session_id).first()
            if not session:
                await websocket.close(code=4004)
                return

            if role == "admin":
                token = auth_data.get("token")
                if not token:
                    await websocket.close(code=4001)
                    return
                try:
                    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                    user_id = payload.get("sub")
                except PyJWTError:
                    await websocket.close(code=4001)
                    return
                if session.owner_id != user_id:
                    await websocket.close(code=4003)
                    return
                conn = await hub.connect(session_id, websocket, "admin")

            elif role == "participant":
                pid = auth_data.get("pid")
                ptoken = auth_data.get("ptoken")
                if not pid or not ptoken:
                    await websocket.close(code=4001)
                    return
                participant = db.query(Participant).filter(
                    Participant.id == pid,
                    Participant.session_id == session_id,
                    Participant.token == ptoken,
                ).first()
                if not participant:
                    await websocket.close(code=4004)
                    return
                conn = await hub.connect(
                    session_id, websocket, "participant",
                    participant_id=pid, nickname=participant.nickname,
                )
                await hub.send_to_admin(session_id, {
                    "type": "participant_connected",
                    "participant_id": pid,
                    "nickname": participant.nickname,
                    "online_count": hub.get_participant_count(session_id),
                })
            else:
                await websocket.close(code=4001)
                return
        finally:
            db.close()

        await websocket.send_text(json.dumps({"type": "auth_ok"}))

        # Late-joiner sync: if participant connects after game started, send current state
        if role == "participant":
            db_sync = _fresh_db()
            try:
                sess = db_sync.query(Session).filter(Session.id == session_id).first()
                if sess and sess.status in ("active", "revealing"):
                    quiz = db_sync.query(Quiz).options(
                        joinedload(Quiz.questions).joinedload(Question.answers)
                    ).filter(Quiz.id == sess.quiz_id).first()
                    questions = sorted(quiz.questions, key=lambda q: q.order)
                    await websocket.send_text(json.dumps({
                        "type": "game_started",
                        "total_questions": len(questions),
                    }))
                    idx = sess.current_question_idx
                    if 0 <= idx < len(questions):
                        reveal = sess.status == "revealing"
                        await websocket.send_text(json.dumps({
                            "type": "new_question",
                            "question_idx": idx,
                            "total_questions": len(questions),
                            **_question_payload(questions[idx], reveal=reveal),
                        }))
            finally:
                db_sync.close()

        # Message loop
        _ADMIN_MSG_TYPES = {"start_game", "next_question", "reveal_answer", "end_game"}
        _PARTICIPANT_MSG_TYPES = {"submit_answer"}

        while True:
            raw = await websocket.receive_text()

            if len(raw) > 4096:
                await websocket.send_text(json.dumps({
                    "type": "error", "message": "Message too large",
                }))
                continue

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error", "message": "Invalid JSON",
                }))
                continue
            msg_type = data.get("type")

            if role == "admin":
                if msg_type not in _ADMIN_MSG_TYPES:
                    await websocket.send_text(json.dumps({
                        "type": "error", "message": f"Unknown message type: {msg_type}",
                    }))
                    continue
                await _handle_admin_message(session_id, msg_type, data)
            elif role == "participant":
                if msg_type not in _PARTICIPANT_MSG_TYPES:
                    await websocket.send_text(json.dumps({
                        "type": "error", "message": f"Unknown message type: {msg_type}",
                    }))
                    continue
                await _handle_participant_message(session_id, pid, msg_type, data)

    except WebSocketDisconnect:
        if conn:
            hub.disconnect(session_id, conn)
        if role == "participant" and pid:
            await hub.send_to_admin(session_id, {
                "type": "participant_disconnected",
                "participant_id": pid,
                "online_count": hub.get_participant_count(session_id),
            })
    except Exception:
        logger.exception("WebSocket error for session %s", session_id)
        if conn:
            hub.disconnect(session_id, conn)


# ---------------------------------------------------------------------------
# Admin message handlers (each operation gets its own DB session)
# ---------------------------------------------------------------------------

async def _handle_admin_message(session_id: str, msg_type: str, data: dict):
    db = _fresh_db()
    try:
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
            hub.mark_question_sent(session_id)

        elif msg_type == "next_question":
            if session.status not in ("active", "revealing"):
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
            hub.mark_question_sent(session_id)

        elif msg_type == "reveal_answer":
            if session.status not in ("active", "revealing"):
                return
            session.status = "revealing"
            db.commit()

            idx = session.current_question_idx
            question = questions[idx]

            all_participants = (
                db.query(Participant)
                .filter(Participant.session_id == session.id)
                .all()
            )
            responses_for_q = (
                db.query(ParticipantResponse)
                .filter(ParticipantResponse.question_id == question.id)
                .join(Participant)
                .filter(Participant.session_id == session.id)
                .all()
            )

            total_responses = len(responses_for_q)
            correct_count = sum(1 for r in responses_for_q if r.is_correct)

            resp_by_pid = {r.participant_id: r for r in responses_for_q}
            player_results = []
            for p in all_participants:
                r = resp_by_pid.get(p.id)
                player_results.append({
                    "participant_id": p.id,
                    "nickname": p.nickname,
                    "is_correct": r.is_correct if r else False,
                    "answer_id": r.answer_id if r else None,
                    "points_awarded": r.points_awarded if r else 0,
                })

            await hub.broadcast(session_id, {
                "type": "answer_revealed",
                "question_idx": idx,
                **_question_payload(question, reveal=True),
                "stats": {
                    "total_responses": total_responses,
                    "correct_count": correct_count,
                },
                "leaderboard": _build_leaderboard(session, db),
                "player_results": player_results,
            })

        elif msg_type == "end_game":
            session.status = "finished"
            db.commit()
            await hub.broadcast(session_id, {
                "type": "game_ended",
                "leaderboard": _build_leaderboard(session, db),
            })
    except Exception:
        db.rollback()
        logger.exception("Error handling admin message %s", msg_type)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Participant message handlers
# ---------------------------------------------------------------------------

async def _handle_participant_message(
    session_id: str, participant_id: str, msg_type: str, data: dict
):
    db = _fresh_db()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return

        if msg_type == "submit_answer":
            if session.status != "active":
                return

            answer_id = data.get("answer_id")
            if not answer_id or not isinstance(answer_id, str):
                await hub.send_to_one(session_id, participant_id, {
                    "type": "error",
                    "message": "answer_id is required and must be a non-empty string",
                })
                return

            server_elapsed = hub.get_elapsed_since_question(session_id)
            response_time = server_elapsed if server_elapsed is not None else 0

            quiz = db.query(Quiz).options(
                joinedload(Quiz.questions).joinedload(Question.answers)
            ).filter(Quiz.id == session.quiz_id).first()
            questions = sorted(quiz.questions, key=lambda q: q.order)

            if session.current_question_idx < 0 or session.current_question_idx >= len(questions):
                return

            question = questions[session.current_question_idx]
            response_time = min(response_time, question.time_limit)

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

            # Calculate points: base 1000, bonus for speed (guard div-by-zero)
            is_correct = answer.is_correct
            points = 0
            if is_correct:
                time_limit = max(question.time_limit, 1)  # guard: floor at 1s
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

            participant = db.query(Participant).filter(Participant.id == participant_id).first()
            participant.score += points

            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                await hub.send_to_one(session_id, participant_id, {
                    "type": "error",
                    "message": "Already answered this question",
                })
                return

            # Confirm to participant
            await hub.send_to_one(session_id, participant_id, {
                "type": "answer_submitted",
                "is_correct": is_correct,
                "points_awarded": points,
                "total_score": participant.score,
            })

            # Notify admin of new answer
            total_participants = db.query(Participant).filter(Participant.session_id == session.id).count()
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
    except Exception:
        db.rollback()
        logger.exception("Error handling participant message %s", msg_type)
    finally:
        db.close()
