from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import Permissions, require_permission
from app.models.sql.core.user import Person, User
from app.models.sql.crm.opportunity import Opportunity, OpportunityActivity
from app.services.crm import currency_service


router = APIRouter(dependencies=[Depends(currency_service.refresh_if_stale)])

OPEN_STAGES = ["discovery", "qualified", "proposal", "negotiation", "committed"]
STAGE_ORDER = OPEN_STAGES
TYPE_ORDER = ["grant", "partnership", "contract", "programme"]
SOURCE_ORDER = [
    "inbound",
    "outbound",
    "referral",
    "event",
    "existing_relationship",
]
STALLED_AFTER_DAYS = 21


def _as_date(value) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value


def _period_start(period: str, today: date) -> Optional[date]:
    if period == "this_quarter":
        month = ((today.month - 1) // 3) * 3 + 1
        return date(today.year, month, 1)
    if period == "this_year":
        return date(today.year, 1, 1)
    if period == "last_12_months":
        return today - timedelta(days=365)
    return None


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _month_key(value: date) -> str:
    return value.strftime("%Y-%m")


def _closed_on(opportunity: Opportunity) -> Optional[date]:
    if opportunity.stage == "won":
        return _as_date(
            opportunity.won_at or opportunity.updated_at or opportunity.created_at
        )
    if opportunity.stage == "lost":
        return _as_date(
            opportunity.lost_at or opportunity.updated_at or opportunity.created_at
        )
    return None


def _created_on(opportunity: Opportunity) -> Optional[date]:
    return _as_date(opportunity.created_at)


def _round(value: float) -> float:
    return round(float(value or 0), 2)


@router.get("/currency-rates")
async def get_currency_rates(
    current_user: User = Depends(require_permission(Permissions.CRM_VIEW)),
):
    """Supported CRM currencies and their GHS conversion rates."""
    await currency_service.get_rates()
    return currency_service.rates_payload()


@router.get("/reports")
async def get_crm_report(
    period: str = Query(
        "this_year",
        pattern="^(this_quarter|this_year|last_12_months|all_time)$",
    ),
    owner_id: Optional[str] = None,
    type_filter: Optional[str] = Query(None, alias="type"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CRM_VIEW)),
):
    """
    CRM performance report.

    Open pipeline metrics reflect the current book of work. Won/lost
    performance, win rate, and lost reasons respect the selected period.
    All monetary values are standardised to GHS through the shared
    currency service.
    """
    rates = await currency_service.get_rates()
    today = date.today()
    start = _period_start(period, today)

    filters = []
    if owner_id:
        filters.append(Opportunity.owner_id == owner_id)
    if type_filter:
        filters.append(Opportunity.type == type_filter)

    query = (
        select(Opportunity)
        .options(
            selectinload(Opportunity.owner),
            selectinload(Opportunity.organisation),
        )
        .order_by(Opportunity.created_at.desc())
    )
    if filters:
        query = query.where(*filters)

    result = await db.execute(query)
    opportunities = list(result.scalars().all())

    latest_result = await db.execute(
        select(
            OpportunityActivity.opportunity_id,
            func.max(OpportunityActivity.occurred_at),
        ).group_by(OpportunityActivity.opportunity_id)
    )
    last_activity = {
        row[0]: row[1] for row in latest_result.all() if row[1] is not None
    }

    owner_result = await db.execute(
        select(Person.id, Person.first_name, Person.last_name)
        .join(Opportunity, Opportunity.owner_id == Person.id)
        .distinct()
        .order_by(Person.first_name, Person.last_name)
    )
    owner_options = [
        {"id": row[0], "name": f"{row[1]} {row[2]}".strip()}
        for row in owner_result.all()
    ]

    unconverted = set()

    def value_of(opportunity: Opportunity) -> float:
        converted = currency_service.convert_to_base(
            opportunity.amount, opportunity.currency, rates
        )
        if converted is None:
            if opportunity.amount is not None and float(opportunity.amount) > 0:
                unconverted.add(
                    currency_service.normalize_currency(opportunity.currency)
                )
            return 0.0
        return float(converted)

    def weighted_of(opportunity: Opportunity) -> float:
        return value_of(opportunity) * (opportunity.probability or 0) / 100

    def closed_in_period(opportunity: Opportunity) -> bool:
        closed = _closed_on(opportunity)
        if closed is None:
            return False
        return start is None or closed >= start

    open_opportunities = [o for o in opportunities if o.stage in OPEN_STAGES]
    won_opportunities = [
        o for o in opportunities if o.stage == "won" and closed_in_period(o)
    ]
    lost_opportunities = [
        o for o in opportunities if o.stage == "lost" and closed_in_period(o)
    ]

    open_value = sum(value_of(o) for o in open_opportunities)
    weighted_value = sum(weighted_of(o) for o in open_opportunities)
    won_value = sum(value_of(o) for o in won_opportunities)
    lost_value = sum(value_of(o) for o in lost_opportunities)

    closed_count = len(won_opportunities) + len(lost_opportunities)
    win_rate = (
        round(len(won_opportunities) / closed_count * 100, 1)
        if closed_count
        else 0.0
    )

    cycles = []
    for opportunity in won_opportunities:
        closed = _closed_on(opportunity)
        created = _created_on(opportunity)
        if closed and created:
            days = (closed - created).days
            if days >= 0:
                cycles.append(days)

    overdue = [
        o
        for o in open_opportunities
        if _as_date(o.expected_close_date)
        and _as_date(o.expected_close_date) < today
    ]

    stalled = []
    for opportunity in open_opportunities:
        last_seen = _as_date(last_activity.get(opportunity.id))
        baseline = last_seen or _created_on(opportunity)
        if baseline and (today - baseline).days >= STALLED_AFTER_DAYS:
            stalled.append(opportunity)

    by_stage = []
    for stage in STAGE_ORDER:
        rows = [o for o in open_opportunities if o.stage == stage]
        by_stage.append(
            {
                "stage": stage,
                "count": len(rows),
                "value": _round(sum(value_of(o) for o in rows)),
                "weighted_value": _round(sum(weighted_of(o) for o in rows)),
            }
        )

    def breakdown(field: str, values: list[str]) -> list[dict]:
        rows = []
        for value in values:
            open_rows = [
                o
                for o in open_opportunities
                if (getattr(o, field) or "unknown") == value
            ]
            won_rows = [
                o
                for o in won_opportunities
                if (getattr(o, field) or "unknown") == value
            ]
            lost_rows = [
                o
                for o in lost_opportunities
                if (getattr(o, field) or "unknown") == value
            ]
            total_closed = len(won_rows) + len(lost_rows)
            rows.append(
                {
                    field: value,
                    "open_count": len(open_rows),
                    "open_value": _round(sum(value_of(o) for o in open_rows)),
                    "weighted_value": _round(
                        sum(weighted_of(o) for o in open_rows)
                    ),
                    "won_count": len(won_rows),
                    "won_value": _round(sum(value_of(o) for o in won_rows)),
                    "lost_count": len(lost_rows),
                    "win_rate": round(len(won_rows) / total_closed * 100, 1)
                    if total_closed
                    else 0.0,
                }
            )
        return rows

    by_type = breakdown("type", TYPE_ORDER)
    by_source = breakdown("source", SOURCE_ORDER)

    owner_map: dict[str, dict] = {}
    for opportunity in opportunities:
        key = str(opportunity.owner_id)
        if key not in owner_map:
            owner = opportunity.owner
            owner_map[key] = {
                "owner_id": key,
                "owner_name": (
                    f"{owner.first_name} {owner.last_name}".strip()
                    if owner
                    else "Unknown"
                ),
                "open_count": 0,
                "open_value": 0.0,
                "weighted_value": 0.0,
                "won_count": 0,
                "won_value": 0.0,
                "lost_count": 0,
                "win_rate": 0.0,
            }
        row = owner_map[key]
        if opportunity in open_opportunities:
            row["open_count"] += 1
            row["open_value"] += value_of(opportunity)
            row["weighted_value"] += weighted_of(opportunity)
        if opportunity in won_opportunities:
            row["won_count"] += 1
            row["won_value"] += value_of(opportunity)
        if opportunity in lost_opportunities:
            row["lost_count"] += 1

    by_owner = []
    for row in owner_map.values():
        closed_for_owner = row["won_count"] + row["lost_count"]
        row["win_rate"] = (
            round(row["won_count"] / closed_for_owner * 100, 1)
            if closed_for_owner
            else 0.0
        )
        row["open_value"] = _round(row["open_value"])
        row["weighted_value"] = _round(row["weighted_value"])
        row["won_value"] = _round(row["won_value"])
        by_owner.append(row)
    by_owner.sort(key=lambda row: (-row["open_value"], -row["won_value"]))

    # Last 12 calendar months, independent of the performance period.
    month_starts = []
    for offset in range(11, -1, -1):
        index = today.year * 12 + (today.month - 1) - offset
        year, month = divmod(index, 12)
        month_starts.append(date(year, month + 1, 1))

    monthly_map = {
        _month_key(start_date): {
            "month": _month_key(start_date),
            "label": start_date.strftime("%b"),
            "won_count": 0,
            "won_value": 0.0,
            "lost_count": 0,
            "created_count": 0,
        }
        for start_date in month_starts
    }

    for opportunity in opportunities:
        created = _created_on(opportunity)
        if created:
            bucket = monthly_map.get(_month_key(created))
            if bucket:
                bucket["created_count"] += 1

        if opportunity.stage == "won":
            closed = _closed_on(opportunity)
            if closed:
                bucket = monthly_map.get(_month_key(closed))
                if bucket:
                    bucket["won_count"] += 1
                    bucket["won_value"] += value_of(opportunity)

        if opportunity.stage == "lost":
            closed = _closed_on(opportunity)
            if closed:
                bucket = monthly_map.get(_month_key(closed))
                if bucket:
                    bucket["lost_count"] += 1

    monthly = []
    for start_date in month_starts:
        bucket = monthly_map[_month_key(start_date)]
        bucket["won_value"] = _round(bucket["won_value"])
        monthly.append(bucket)

    # Six-month forecast from expected close dates.
    forecast_starts = []
    for offset in range(0, 6):
        index = today.year * 12 + (today.month - 1) + offset
        year, month = divmod(index, 12)
        forecast_starts.append(date(year, month + 1, 1))

    forecast_map = {
        _month_key(start_date): {
            "month": _month_key(start_date),
            "label": start_date.strftime("%b %Y"),
            "count": 0,
            "value": 0.0,
            "weighted_value": 0.0,
        }
        for start_date in forecast_starts
    }
    forecast_overdue = {
        "count": 0,
        "value": 0.0,
        "weighted_value": 0.0,
    }
    forecast_later = {
        "count": 0,
        "value": 0.0,
        "weighted_value": 0.0,
    }

    for opportunity in open_opportunities:
        expected = _as_date(opportunity.expected_close_date)
        if not expected:
            continue
        value = value_of(opportunity)
        weighted = weighted_of(opportunity)

        if expected < today:
            forecast_overdue["count"] += 1
            forecast_overdue["value"] += value
            forecast_overdue["weighted_value"] += weighted
            continue

        bucket = forecast_map.get(_month_key(expected))
        if bucket:
            bucket["count"] += 1
            bucket["value"] += value
            bucket["weighted_value"] += weighted
        else:
            forecast_later["count"] += 1
            forecast_later["value"] += value
            forecast_later["weighted_value"] += weighted

    forecast = list(forecast_map.values())
    for bucket in forecast:
        bucket["value"] = _round(bucket["value"])
        bucket["weighted_value"] = _round(bucket["weighted_value"])
    for bucket in (forecast_overdue, forecast_later):
        bucket["value"] = _round(bucket["value"])
        bucket["weighted_value"] = _round(bucket["weighted_value"])

    lost_reason_map: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "value": 0.0}
    )
    for opportunity in lost_opportunities:
        reason = (opportunity.lost_reason or "unknown").replace("_", " ")
        lost_reason_map[reason]["count"] += 1
        lost_reason_map[reason]["value"] += value_of(opportunity)

    lost_reasons = [
        {
            "reason": reason,
            "count": row["count"],
            "value": _round(row["value"]),
        }
        for reason, row in lost_reason_map.items()
    ]
    lost_reasons.sort(key=lambda row: (-row["count"], -row["value"]))

    top_opportunities = sorted(
        open_opportunities, key=value_of, reverse=True
    )[:5]

    def opportunity_row(opportunity: Opportunity) -> dict:
        owner = opportunity.owner
        organisation = opportunity.organisation
        return {
            "id": opportunity.id,
            "title": opportunity.title,
            "organisation": organisation.name if organisation else "Unknown",
            "owner": (
                f"{owner.first_name} {owner.last_name}".strip()
                if owner
                else "Unknown"
            ),
            "stage": opportunity.stage,
            "probability": opportunity.probability,
            "currency": opportunity.currency,
            "amount": _round(opportunity.amount)
            if opportunity.amount is not None
            else None,
            "amount_base": _round(value_of(opportunity)),
            "expected_close_date": (
                opportunity.expected_close_date.isoformat()
                if opportunity.expected_close_date
                else None
            ),
        }

    attention = []
    for opportunity in open_opportunities:
        expected = _as_date(opportunity.expected_close_date)
        overdue_days = (today - expected).days if expected and expected < today else 0

        last_seen = _as_date(last_activity.get(opportunity.id))
        baseline = last_seen or _created_on(opportunity)
        days_since_activity = (today - baseline).days if baseline else 0

        reasons = []
        if overdue_days > 0:
            reasons.append("overdue")
        if days_since_activity >= STALLED_AFTER_DAYS:
            reasons.append("stalled")
        if not reasons:
            continue

        row = opportunity_row(opportunity)
        row.update(
            {
                "reasons": reasons,
                "overdue_days": overdue_days,
                "days_since_activity": days_since_activity,
                "last_activity_at": last_seen.isoformat() if last_seen else None,
            }
        )
        attention.append(row)

    attention.sort(
        key=lambda row: (-row["overdue_days"], -row["days_since_activity"])
    )

    return {
        "base_currency": currency_service.BASE_CURRENCY,
        "fx": currency_service.rates_payload(),
        "period": period,
        "period_start": start.isoformat() if start else None,
        "filters": {
            "owner_id": owner_id,
            "type": type_filter,
        },
        "summary": {
            "open_count": len(open_opportunities),
            "open_value": _round(open_value),
            "weighted_value": _round(weighted_value),
            "won_count": len(won_opportunities),
            "won_value": _round(won_value),
            "lost_count": len(lost_opportunities),
            "lost_value": _round(lost_value),
            "win_rate": win_rate,
            "avg_deal_size": _round(won_value / len(won_opportunities))
            if won_opportunities
            else 0.0,
            "avg_sales_cycle_days": round(sum(cycles) / len(cycles), 1)
            if cycles
            else 0.0,
            "overdue_count": len(overdue),
            "overdue_value": _round(sum(value_of(o) for o in overdue)),
            "stalled_count": len(stalled),
            "unconverted_count": len(unconverted),
            "unconverted_currencies": sorted(unconverted),
        },
        "by_stage": by_stage,
        "by_type": by_type,
        "by_source": by_source,
        "by_owner": by_owner,
        "monthly": monthly,
        "forecast": {
            "months": forecast,
            "overdue": forecast_overdue,
            "later": forecast_later,
        },
        "win_loss": {
            "won_count": len(won_opportunities),
            "won_value": _round(won_value),
            "lost_count": len(lost_opportunities),
            "lost_value": _round(lost_value),
            "win_rate": win_rate,
            "lost_reasons": lost_reasons,
        },
        "top_opportunities": [opportunity_row(o) for o in top_opportunities],
        "needs_attention": attention[:8],
        "owner_options": owner_options,
    }
