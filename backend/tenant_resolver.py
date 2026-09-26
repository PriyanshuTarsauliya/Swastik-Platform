"""Tenant Resolver — shared by all entry points (widget, smart link, phone).

Resolves a clinic's full profile from any channel identifier using an
in-process TTL cache. No Redis dependency; works for single-process deploys.
"""

import json
import logging

from cachetools import TTLCache

from backend.database import get_db

log = logging.getLogger("swastik-tenant")

# In-process cache: max 500 clinics, 5-minute TTL
_cache = TTLCache(maxsize=500, ttl=300)


class ClinicNotFoundError(Exception):
    """Raised when no active clinic matches the given channel identifier."""


async def resolve_clinic(channel_type: str, identifier: str) -> dict:
    """Resolve a full clinic profile from a channel type and identifier.

    Args:
        channel_type: One of 'widget', 'smart_link', 'phone'
        identifier: The clinic_id (widget), slug (smart_link), or E.164 number (phone)

    Returns:
        Dict with full clinic profile, plan info, and channel data.

    Raises:
        ClinicNotFoundError: If no active clinic matches.
    """
    cache_key = f"{channel_type}:{identifier}"
    if cache_key in _cache:
        return _cache[cache_key]

    data = _resolve_from_db(channel_type, identifier)
    if not data:
        raise ClinicNotFoundError(f"No active clinic for {channel_type}:{identifier}")

    _cache[cache_key] = data
    return data


def resolve_clinic_sync(channel_type: str, identifier: str) -> dict:
    """Synchronous version of resolve_clinic for non-async contexts."""
    cache_key = f"{channel_type}:{identifier}"
    if cache_key in _cache:
        return _cache[cache_key]

    data = _resolve_from_db(channel_type, identifier)
    if not data:
        raise ClinicNotFoundError(f"No active clinic for {channel_type}:{identifier}")

    _cache[cache_key] = data
    return data


def bust_cache(clinic_id: str):
    """Remove all cached entries for a clinic (call after profile edits)."""
    keys_to_remove = [k for k, v in _cache.items() if v.get("id") == clinic_id]
    for k in keys_to_remove:
        _cache.pop(k, None)
    log.info("Cache busted for clinic %s (%d entries removed)", clinic_id, len(keys_to_remove))


def _resolve_from_db(channel_type: str, identifier: str) -> dict | None:
    """Query DB for clinic data via clinic_channels lookup."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    c.id, c.name, c.slug, c.timezone, c.languages,
                    c.voice_persona, c.status, c.plan_id, c.theme_color,
                    c.system_prompt,
                    p.greeting, p.services, p.working_hours, p.address,
                    p.booking_rules, p.escalation_number, p.custom_instructions,
                    p.doctor_name, p.consultation_fee,
                    pl.name AS plan_name, pl.included_minutes,
                    pl.overage_paise_per_min, pl.allows_phone,
                    pl.allows_widget, pl.allows_smart_link
                FROM clinic_channels ch
                JOIN clinics c ON c.id = ch.clinic_id
                LEFT JOIN clinic_profile p ON p.clinic_id = c.id
                LEFT JOIN plans pl ON pl.id = c.plan_id
                WHERE ch.channel_type = ?
                  AND ch.identifier = ?
                  AND ch.is_active = 1
                  AND c.status = 'active'
            """, (channel_type, identifier))

            row = cursor.fetchone()
            if not row:
                # Fallback: try direct clinic id lookup for backward compat
                if channel_type == "widget":
                    return _resolve_by_clinic_id(conn, identifier)
                return None

            data = dict(row.items()) if hasattr(row, 'items') else dict(row)

            # Parse JSON fields
            for json_field in ("services", "working_hours"):
                val = data.get(json_field)
                if val and isinstance(val, str):
                    try:
                        data[json_field] = json.loads(val)
                    except (json.JSONDecodeError, TypeError):
                        pass

            # Parse languages
            lang_val = data.get("languages")
            if lang_val and isinstance(lang_val, str):
                data["languages"] = [l.strip() for l in lang_val.split(",")]
            elif not lang_val:
                data["languages"] = ["en", "hi"]

            return data

    except Exception as e:
        log.exception("Tenant resolution failed for %s:%s — %s", channel_type, identifier, e)
        return None


def _resolve_by_clinic_id(conn, clinic_id: str) -> dict | None:
    """Backward-compatible fallback: resolve directly by clinics.id."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            c.id, c.name, c.slug, c.timezone, c.languages,
            c.voice_persona, c.status, c.plan_id, c.theme_color,
            c.system_prompt,
            p.greeting, p.services, p.working_hours, p.address,
            p.booking_rules, p.escalation_number, p.custom_instructions,
            p.doctor_name, p.consultation_fee,
            pl.name AS plan_name, pl.included_minutes,
            pl.overage_paise_per_min, pl.allows_phone,
            pl.allows_widget, pl.allows_smart_link
        FROM clinics c
        LEFT JOIN clinic_profile p ON p.clinic_id = c.id
        LEFT JOIN plans pl ON pl.id = c.plan_id
        WHERE c.id = ? AND c.status = 'active'
    """, (clinic_id,))

    row = cursor.fetchone()
    if not row:
        return None

    data = dict(row.items()) if hasattr(row, 'items') else dict(row)

    # Parse JSON fields
    for json_field in ("services", "working_hours"):
        val = data.get(json_field)
        if val and isinstance(val, str):
            try:
                data[json_field] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                pass

    # Parse languages
    lang_val = data.get("languages")
    if lang_val and isinstance(lang_val, str):
        data["languages"] = [l.strip() for l in lang_val.split(",")]
    elif not lang_val:
        data["languages"] = ["en", "hi"]

    return data
