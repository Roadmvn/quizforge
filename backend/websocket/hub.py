"""
WebSocket connection hub for live quiz sessions.

Limitation: the Hub is an in-memory singleton. All WebSocket state lives in
the process memory, so the backend MUST run with a single worker (--workers 1).
Scaling to multiple workers requires an external pub/sub (e.g. Redis).

Design decisions:
- One hub instance per process, rooms keyed by session_id.
- Two connection types: "admin" (one per session) and "participant" (many).
- Messages are JSON dicts with a "type" field for routing on the client.
- The admin sends control commands; participants receive state updates.
- Disconnects are handled gracefully — removed from room, others notified.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field

from fastapi import WebSocket


@dataclass
class Connection:
    ws: WebSocket
    role: str  # "admin" or "participant"
    participant_id: str | None = None
    nickname: str | None = None


class Hub:
    def __init__(self):
        # session_id -> list of Connection
        self._rooms: dict[str, list[Connection]] = {}
        # session_id -> monotonic timestamp of when current question was sent
        self._question_sent_at: dict[str, float] = {}

    def _room(self, session_id: str) -> list[Connection]:
        if session_id not in self._rooms:
            self._rooms[session_id] = []
        return self._rooms[session_id]

    async def connect(
        self,
        session_id: str,
        ws: WebSocket,
        role: str,
        participant_id: str | None = None,
        nickname: str | None = None,
    ) -> Connection:
        conn = Connection(
            ws=ws, role=role, participant_id=participant_id, nickname=nickname
        )
        self._room(session_id).append(conn)
        return conn

    def disconnect(self, session_id: str, conn: Connection):
        room = self._rooms.get(session_id, [])
        if conn in room:
            room.remove(conn)
        if not room:
            self._rooms.pop(session_id, None)

    async def broadcast(self, session_id: str, message: dict):
        """Send message to everyone in the session."""
        room = self._rooms.get(session_id, [])
        dead: list[Connection] = []
        for conn in room:
            try:
                await conn.ws.send_json(message)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(session_id, conn)

    async def send_to_admin(self, session_id: str, message: dict):
        room = self._rooms.get(session_id, [])
        for conn in room:
            if conn.role == "admin":
                try:
                    await conn.ws.send_json(message)
                except Exception:
                    self.disconnect(session_id, conn)

    async def send_to_participants(self, session_id: str, message: dict):
        room = self._rooms.get(session_id, [])
        dead: list[Connection] = []
        for conn in room:
            if conn.role == "participant":
                try:
                    await conn.ws.send_json(message)
                except Exception:
                    dead.append(conn)
        for conn in dead:
            self.disconnect(session_id, conn)

    async def send_to_one(self, session_id: str, participant_id: str, message: dict):
        room = self._rooms.get(session_id, [])
        for conn in room:
            if conn.participant_id == participant_id:
                try:
                    await conn.ws.send_json(message)
                except Exception:
                    self.disconnect(session_id, conn)

    def get_participant_count(self, session_id: str) -> int:
        room = self._rooms.get(session_id, [])
        return sum(1 for c in room if c.role == "participant")

    def mark_question_sent(self, session_id: str):
        self._question_sent_at[session_id] = time.monotonic()

    def get_elapsed_since_question(self, session_id: str) -> float | None:
        sent_at = self._question_sent_at.get(session_id)
        if sent_at is None:
            return None
        return time.monotonic() - sent_at


# Singleton instance
hub = Hub()
