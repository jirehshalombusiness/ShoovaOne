from __future__ import annotations

import ipaddress

from starlette.requests import Request


def client_ip(request: Request) -> str:
    """Best-effort client address, validated to keep rate-limit keys bounded.

    Proxies append to ``X-Forwarded-For``, so the rightmost entry is the one
    the closest proxy saw. Client-supplied values end up to its left and are
    not trusted.
    """
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    for candidate in reversed(forwarded_for.split(",")):
        candidate = candidate.strip()
        if not candidate:
            continue
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            continue
    return request.client.host if request.client else "unknown"
