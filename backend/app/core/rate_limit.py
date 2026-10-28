from __future__ import annotations

import asyncio
import time
from math import ceil


class SlidingWindowLimiter:
    """Small in-process limiter for authentication endpoints.

    It is intentionally dependency-free. Limits are per process, so a
    multi-worker deployment should treat these as defence in depth rather
    than a hard quota.
    """

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()
        self._operations = 0

    @staticmethod
    def _recent(hits: list[float], now: float, window: float) -> list[float]:
        cutoff = now - window
        return [hit for hit in hits if hit > cutoff]

    async def retry_after(
        self,
        key: str,
        *,
        limit: int,
        window_seconds: float,
    ) -> int:
        """Seconds to wait when the key is at its limit, otherwise 0."""

        now = time.monotonic()

        async with self._lock:
            hits = self._recent(
                self._hits.get(key, []),
                now,
                window_seconds,
            )

            if hits:
                self._hits[key] = hits
            else:
                self._hits.pop(key, None)

            if len(hits) < limit:
                return 0

            return max(1, ceil(window_seconds - (now - hits[0])))

    async def record(
        self,
        key: str,
        *,
        window_seconds: float,
    ) -> int:
        """Record a hit and return the number inside the window."""

        now = time.monotonic()

        async with self._lock:
            hits = self._recent(
                self._hits.get(key, []),
                now,
                window_seconds,
            )
            hits.append(now)
            self._hits[key] = hits

            self._operations += 1
            if self._operations % 1000 == 0:
                self._prune_stale(now)

            return len(hits)

    async def reset(self, key: str) -> None:
        async with self._lock:
            self._hits.pop(key, None)

    def _prune_stale(self, now: float) -> None:
        cutoff = now - 3600
        for key in list(self._hits):
            hits = self._hits[key]
            if not hits or hits[-1] <= cutoff:
                self._hits.pop(key, None)


auth_limiter = SlidingWindowLimiter()
