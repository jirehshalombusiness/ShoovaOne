import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx


BASE_CURRENCY = "GHS"
RATES_PROVIDER_URL = "https://open.er-api.com/v6/latest/USD"
CACHE_TTL = timedelta(hours=6)

SUPPORTED_CURRENCIES = [
    {"code": "GHS", "name": "Ghanaian Cedi", "symbol": "GH₵"},
    {"code": "USD", "name": "US Dollar", "symbol": "$"},
    {"code": "EUR", "name": "Euro", "symbol": "€"},
    {"code": "GBP", "name": "British Pound", "symbol": "£"},
    {"code": "CAD", "name": "Canadian Dollar", "symbol": "C$"},
    {"code": "NGN", "name": "Nigerian Naira", "symbol": "₦"},
    {"code": "XOF", "name": "West African CFA franc", "symbol": "CFA"},
    {"code": "ZAR", "name": "South African Rand", "symbol": "R"},
]

# Used until the live provider responds, or when it is unreachable.
# Rates express how many GHS one unit of the currency is worth.
FALLBACK_RATES = {
    "GHS": 1.0,
    "USD": 11.9,
    "EUR": 13.07,
    "GBP": 15.61,
    "CAD": 8.33,
    "NGN": 0.0088,
    "XOF": 0.0199,
    "ZAR": 0.704,
}

_SUPPORTED_CODES = {item["code"] for item in SUPPORTED_CURRENCIES}

_cache: dict = {
    "rates": dict(FALLBACK_RATES),
    "source": "fallback",
    "updated_at": None,
    "fetched_at": None,
}

_lock = asyncio.Lock()


def normalize_currency(currency: Optional[str]) -> str:
    return (currency or BASE_CURRENCY).strip().upper()


def is_supported(currency: Optional[str]) -> bool:
    return normalize_currency(currency) in _SUPPORTED_CODES


def get_cached_rates() -> dict:
    return _cache["rates"]


def rate_for(currency: Optional[str], rates: Optional[dict] = None) -> Optional[float]:
    code = normalize_currency(currency)
    return (rates or _cache["rates"]).get(code)


def convert_to_base(
    amount: Optional[float],
    currency: Optional[str],
    rates: Optional[dict] = None,
) -> Optional[float]:
    if amount is None:
        return None
    rate = rate_for(currency, rates)
    if rate is None:
        return None
    return float(amount) * rate


def _round_rates(rates: dict) -> dict:
    return {code: round(rate, 6) for code, rate in rates.items()}


async def get_rates(force: bool = False) -> dict:
    """
    Return GHS conversion rates.

    Live rates are cached for six hours. If the provider is unavailable
    the last known (or fallback) rates are used so CRM screens and
    reports never fail because of an FX outage.
    """
    now = datetime.now(timezone.utc)
    fetched_at = _cache.get("fetched_at")

    if not force and fetched_at and now - fetched_at < CACHE_TTL:
        return _cache["rates"]

    async with _lock:
        fetched_at = _cache.get("fetched_at")
        if not force and fetched_at and now - fetched_at < CACHE_TTL:
            return _cache["rates"]

        try:
            async with httpx.AsyncClient(timeout=7.0) as client:
                response = await client.get(RATES_PROVIDER_URL)
                response.raise_for_status()
                payload = response.json()
                usd_rates = payload.get("rates") or {}
                ghs_per_usd = float(usd_rates["GHS"])

                rates = {BASE_CURRENCY: 1.0}
                for item in SUPPORTED_CURRENCIES:
                    code = item["code"]
                    if code == BASE_CURRENCY:
                        continue
                    usd_to_code = usd_rates.get(code)
                    if usd_to_code:
                        rates[code] = ghs_per_usd / float(usd_to_code)

                if "USD" not in rates:
                    raise ValueError("Provider response did not include USD")

                _cache.update(
                    {
                        "rates": rates,
                        "source": "live",
                        "updated_at": payload.get("time_last_update_utc")
                        or now.isoformat(),
                        "fetched_at": now,
                    }
                )
        except Exception:
            _cache["fetched_at"] = now

        return _cache["rates"]


async def refresh_if_stale() -> None:
    """FastAPI dependency that keeps the cache warm for request handlers."""
    await get_rates()


def rates_payload() -> dict:
    rates = _cache["rates"]
    return {
        "base_currency": BASE_CURRENCY,
        "currencies": [
            {
                **item,
                "rate_to_base": round(rates.get(item["code"], 0), 6),
            }
            for item in SUPPORTED_CURRENCIES
        ],
        "rates": _round_rates(rates),
        "source": _cache["source"],
        "updated_at": _cache["updated_at"],
    }
