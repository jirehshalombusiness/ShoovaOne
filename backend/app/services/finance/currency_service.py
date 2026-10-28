import time
from decimal import Decimal, InvalidOperation

import httpx


FRANKFURTER_API = "https://api.frankfurter.dev/v2"
REPORTING_CURRENCY = "USD"

# Reference rates move slowly, so cache successful lookups for an hour
# instead of calling the provider once per currency per dashboard load.
RATE_CACHE_TTL_SECONDS = 3600

_rate_cache: dict[tuple[str, str], tuple[float, Decimal]] = {}


def _cached_rate(
    from_currency: str,
    to_currency: str,
) -> Decimal | None:
    key = (from_currency, to_currency)
    entry = _rate_cache.get(key)

    if entry is None:
        return None

    expires_at, rate = entry

    if time.monotonic() >= expires_at:
        _rate_cache.pop(key, None)
        return None

    return rate


def clear_rate_cache() -> None:
    """Drop cached exchange rates (used by tests and admin tooling)."""

    _rate_cache.clear()


class CurrencyConversionError(Exception):
    """Raised when a currency exchange rate cannot be retrieved."""


async def get_exchange_rate(
    from_currency: str,
    to_currency: str = REPORTING_CURRENCY,
) -> Decimal:
    """
    Retrieve the current exchange rate between two currencies.

    Returns:
        Decimal: Exchange rate from `from_currency` to `to_currency`.

    Raises:
        CurrencyConversionError:
            If the exchange rate cannot be retrieved or parsed.
    """

    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    # No conversion is required when both currencies are the same.
    if from_currency == to_currency:
        return Decimal("1")

    cached = _cached_rate(from_currency, to_currency)
    if cached is not None:
        return cached

    url = (
        f"{FRANKFURTER_API}/rate/"
        f"{from_currency}/{to_currency}"
    )

    try:
        async with httpx.AsyncClient(
            timeout=10.0
        ) as client:
            response = await client.get(url)

        response.raise_for_status()

        payload = response.json()

        rate = payload.get("rate")

        if rate is None:
            raise CurrencyConversionError(
                f"No exchange rate returned for "
                f"{from_currency}/{to_currency}."
            )

        parsed_rate = Decimal(str(rate))

        _rate_cache[(from_currency, to_currency)] = (
            time.monotonic() + RATE_CACHE_TTL_SECONDS,
            parsed_rate,
        )

        return parsed_rate

    except httpx.HTTPError as exc:
        raise CurrencyConversionError(
            f"Unable to retrieve exchange rate for "
            f"{from_currency}/{to_currency}."
        ) from exc

    except (InvalidOperation, ValueError, TypeError) as exc:
        raise CurrencyConversionError(
            f"Invalid exchange rate returned for "
            f"{from_currency}/{to_currency}."
        ) from exc