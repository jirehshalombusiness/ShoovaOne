"""Country helpers.

ShoovaOne runs one shared directory for every team, so nationality is a
label on a person rather than a partition of the data. These helpers keep
that label consistent: people.country stays free text for display, while
people.country_code holds the ISO-style code used for filtering, public
holidays and default currencies.
"""

from typing import Optional

COUNTRY_NAMES: dict[str, str] = {
    "GH": "Ghana",
    "US": "United States",
}

DEFAULT_CURRENCY: dict[str, str] = {
    "GH": "GHS",
    "US": "USD",
}

_ALIASES: dict[str, str] = {
    "gh": "GH",
    "gha": "GH",
    "ghana": "GH",
    "us": "US",
    "usa": "US",
    "u.s.": "US",
    "u.s.a.": "US",
    "united states": "US",
    "united states of america": "US",
    "america": "US",
}


def normalize_country_code(country: Optional[str]) -> Optional[str]:
    """Map a free-text country to its code, or None when unrecognised."""

    if not country:
        return None

    return _ALIASES.get(" ".join(country.strip().lower().split()))


def resolve_country_code(
    country: Optional[str],
    explicit_code: Optional[str] = None,
) -> Optional[str]:
    """Prefer an explicitly supplied code, otherwise derive one."""

    if explicit_code:
        code = explicit_code.strip().upper()
        if len(code) == 2:
            return code

    return normalize_country_code(country)


def country_name(code: Optional[str]) -> Optional[str]:
    if not code:
        return None

    return COUNTRY_NAMES.get(code.strip().upper())


def default_currency_for(country_code: Optional[str]) -> str:
    if not country_code:
        return "GHS"

    return DEFAULT_CURRENCY.get(country_code.strip().upper(), "GHS")
