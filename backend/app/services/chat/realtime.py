import asyncio
from collections import defaultdict
from typing import Any, Dict, Iterable, Set

from fastapi import WebSocket


class ChatConnectionManager:
    """Push-only WebSocket hub for chat events.

    Multi-worker deployments would need a shared broker; the current API runs
    as a single Render service, so an in-process registry is sufficient.
    """

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[user_id].add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, payload: Dict[str, Any]) -> None:
        sockets = list(self._connections.get(user_id, ()))
        for websocket in sockets:
            try:
                await websocket.send_json(payload)
            except Exception:
                self.disconnect(user_id, websocket)

    async def broadcast(
        self,
        user_ids: Iterable[str],
        payload: Dict[str, Any],
    ) -> None:
        unique_ids = {str(user_id) for user_id in user_ids}
        await asyncio.gather(
            *(self.send_to_user(user_id, payload) for user_id in unique_ids),
            return_exceptions=True,
        )


manager = ChatConnectionManager()
