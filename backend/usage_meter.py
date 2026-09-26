"""Usage Metering — tracks call minutes per clinic per month.

Records usage after each call ends and provides plan-limit checks.
Drives the billing foundation without requiring an external billing provider yet.
"""

import logging
from datetime import UTC, datetime

from backend.database import get_db

log = logging.getLogger("swastik-usage")


def record_call_usage(
    clinic_id: str,
    duration_seconds: int,
    channel_type: str = "widget",
) -> None:
    """Record call duration into usage_monthly rollup.

    Called from the WebSocket handler's finally block after every call.
    """
    if duration_seconds <= 0:
        return

    minutes = round(duration_seconds / 60, 2)
    year_month = datetime.now(UTC).strftime("%Y-%m")

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Upsert into usage_monthly
            cursor.execute("""
                INSERT INTO usage_monthly (clinic_id, year_month, minutes_used)
                VALUES (?, ?, ?)
                ON CONFLICT(clinic_id, year_month)
                DO UPDATE SET minutes_used = usage_monthly.minutes_used + ?
            """, (clinic_id, year_month, minutes, minutes))
            conn.commit()
            log.info("Recorded %.1f min usage for clinic %s (%s, channel=%s)",
                     minutes, clinic_id, year_month, channel_type)
    except Exception as e:
        log.error("Failed to record usage for clinic %s: %s", clinic_id, e)


def get_monthly_usage(clinic_id: str) -> dict:
    """Get current month's usage vs plan limits.

    Returns:
        {
            "clinic_id": str,
            "year_month": str,
            "minutes_used": float,
            "minutes_included": int,
            "overage_minutes": float,
            "is_over_limit": bool,
            "plan_name": str
        }
    """
    year_month = datetime.now(UTC).strftime("%Y-%m")

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    COALESCE(u.minutes_used, 0) as minutes_used,
                    COALESCE(p.included_minutes, 200) as included_minutes,
                    COALESCE(p.overage_paise_per_min, 1200) as overage_paise_per_min,
                    COALESCE(p.name, 'Starter') as plan_name
                FROM clinics c
                LEFT JOIN plans p ON p.id = c.plan_id
                LEFT JOIN usage_monthly u ON u.clinic_id = c.id AND u.year_month = ?
                WHERE c.id = ?
            """, (year_month, clinic_id))

            row = cursor.fetchone()
            if not row:
                return {
                    "clinic_id": clinic_id,
                    "year_month": year_month,
                    "minutes_used": 0,
                    "minutes_included": 200,
                    "overage_minutes": 0,
                    "is_over_limit": False,
                    "plan_name": "Starter",
                }

            minutes_used = float(row["minutes_used"] or 0)
            included = int(row["included_minutes"] or 200)
            overage = max(0, minutes_used - included)

            return {
                "clinic_id": clinic_id,
                "year_month": year_month,
                "minutes_used": round(minutes_used, 1),
                "minutes_included": included,
                "overage_minutes": round(overage, 1),
                "is_over_limit": minutes_used >= included,
                "plan_name": row["plan_name"] or "Starter",
            }
    except Exception as e:
        log.error("Failed to get usage for clinic %s: %s", clinic_id, e)
        return {
            "clinic_id": clinic_id,
            "year_month": year_month,
            "minutes_used": 0,
            "minutes_included": 200,
            "overage_minutes": 0,
            "is_over_limit": False,
            "plan_name": "Unknown",
        }


def check_plan_limit(clinic_id: str) -> bool:
    """Check if a clinic is within their plan's minute limit.

    Returns True if the clinic can make calls, False if over limit.
    """
    usage = get_monthly_usage(clinic_id)
    return not usage["is_over_limit"]
