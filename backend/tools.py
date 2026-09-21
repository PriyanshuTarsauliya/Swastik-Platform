"""Swastik AI tools for Gemini Live API session."""

import io
import os
import sqlite3
import logging
import urllib.parse
import hashlib
import secrets
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from backend.database import get_db, init_db as db_init, DB_PATH, DBIntegrityError

log = logging.getLogger("swastik-agent")

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Securely hash a password with PBKDF2-HMAC-SHA256 and unique salt."""
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return hashed, salt

def verify_password(password: str, hashed: str, salt: str) -> bool:
    """Verify password against stored PBKDF2 hash and salt."""
    check_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(check_hash, hashed)

def init_db():
    """Ensure appointments, orders, call_logs, settings, users, and user_sessions tables exist."""
    db_init()
    seed_default_user()

def seed_default_user():
    """Seed the default demo doctor account if no users exist."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            count = cursor.fetchone()[0]
            if count == 0:
                demo_email = "drsharma@swastik.ai"
                demo_password = "Doctor@2026"
                pw_hash, salt = hash_password(demo_password)
                conn.execute("""
                    INSERT INTO users (name, email, password_hash, salt, role, clinic_name, phone)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    "Dr. Sharma",
                    demo_email,
                    pw_hash,
                    salt,
                    "doctor",
                    "Dr. Sharma's Clinic",
                    "+91 98765 43210"
                ))
                conn.commit()
                log.info("Default demo doctor user seeded: %s", demo_email)
    except Exception as e:
        log.error(f"Failed to seed default user: {e}")

def create_user(
    name: str,
    email: str,
    password: str,
    role: str = "doctor",
    clinic_name: str = "Dr. Sharma's Clinic",
    phone: str = "",
    avatar_url: str = ""
) -> Dict[str, Any]:
    """Create a new user in SQLite."""
    email_clean = email.strip().lower()
    name_clean = name.strip()
    if not name_clean:
        raise ValueError("Name is required")
    if not email_clean or "@" not in email_clean:
        raise ValueError("A valid email address is required")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long")

    pw_hash, salt = hash_password(password)

    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO users (name, email, password_hash, salt, role, clinic_name, phone, avatar_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (name_clean, email_clean, pw_hash, salt, role, clinic_name, phone, avatar_url))
            user_id = cursor.lastrowid
            conn.commit()
            return {
                "id": user_id,
                "name": name_clean,
                "email": email_clean,
                "role": role,
                "clinic_name": clinic_name,
                "phone": phone,
                "avatar_url": avatar_url,
            }
        except DBIntegrityError:
            raise ValueError("An account with this email already exists")

def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate user credentials and return user profile if valid."""
    email_clean = email.strip().lower()
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, email, password_hash, salt, role, clinic_name, phone, avatar_url
            FROM users WHERE email = ?
        """, (email_clean,))
        row = cursor.fetchone()
        if not row:
            return None
        
        if verify_password(password, row["password_hash"], row["salt"]):
            return {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "role": row["role"],
                "clinic_name": row["clinic_name"],
                "phone": row["phone"],
                "avatar_url": row["avatar_url"],
            }
        return None

def create_session(user_id: int, days_valid: int = 30) -> str:
    """Create a new session token for the given user."""
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=days_valid)).isoformat()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at)
        )
        conn.commit()
    return token

def get_user_by_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Retrieve user associated with session token if not expired."""
    if not token:
        return None
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id, u.name, u.email, u.role, u.clinic_name, u.phone, u.avatar_url, s.expires_at
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
        """, (token,))
        row = cursor.fetchone()
        if not row:
            return None
        try:
            expires_at = datetime.fromisoformat(row["expires_at"])
            if datetime.now(timezone.utc) > expires_at:
                conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
                conn.commit()
                return None
        except Exception:
            pass
        
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "role": row["role"],
            "clinic_name": row["clinic_name"],
            "phone": row["phone"],
            "avatar_url": row["avatar_url"],
        }

def delete_session(token: str) -> bool:
    """Delete session token to sign out user."""
    if not token:
        return False
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
        conn.commit()
        return cursor.rowcount > 0

init_db()

def get_setting(key: str, default: str = "") -> str:
    """Retrieve configuration setting from SQLite."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row[0] if row and row[0] is not None else default
    except Exception as e:
        log.error(f"Failed to get setting {key}: {e}")
        return default

def set_setting(key: str, value: str):
    """Save or update configuration setting in SQLite."""
    try:
        with get_db() as conn:
            conn.execute("""
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            """, (key, value))
            conn.commit()
            log.info(f"Updated setting {key}")
            return True
    except Exception as e:
        log.error(f"Failed to set setting {key}: {e}")
        return False
DEFAULT_RED_FLAG_PHRASES = [
    "chest pain",
    "chest pressure",
    "difficulty breathing",
    "cannot breathe",
    "can't breathe",
    "shortness of breath",
    "sudden weakness",
    "numbness",
    "slurred speech",
    "severe sudden headache",
    "sudden severe headache",
    "unbearable headache",
    "heavy bleeding",
    "severe bleeding",
    "profuse bleeding",
    "bleeding after an accident",
    "poisoning",
    "suspected overdose",
    "overdose",
    "deep burns",
    "severe burns",
    "emergency",
    "112",
    "heart attack",
    "stroke",
    "unconscious",
    "fainted",
    "collapsed",
    "seizure",
    "convulsions",
    "coughing blood",
    "chhati mein",
    "seene mein",
    "saans nahi aa rahi",
    "saans lene mein",
    "oxygen nahi",
    "khoon beh raha",
    "behosh",
    "sunn",
    "tez sir dard",
    "zehar",
    "floor cleaner",
]

def get_red_flag_phrases() -> list[str]:
    """Retrieve doctor-configurable red-flag emergency phrases from SQLite."""
    import json
    saved = get_setting("red_flag_phrases", "")
    if saved:
        try:
            phrases = json.loads(saved)
            if isinstance(phrases, list) and phrases:
                return phrases
        except Exception:
            pass
    return list(DEFAULT_RED_FLAG_PHRASES)

def set_red_flag_phrases(phrases: list[str]) -> bool:
    """Save doctor-configured red-flag emergency phrases to SQLite."""
    import json
    clean = [p.strip().lower() for p in phrases if p and p.strip()]
    return set_setting("red_flag_phrases", json.dumps(clean))

def check_red_flags(text: str) -> tuple[bool, str]:
    """
    Check if a caller's utterance contains any doctor-set red-flag phrase.
    Returns (True, matched_phrase) or (False, '').
    """
    if not text:
        return False, ""
    lowered = text.lower()
    for phrase in get_red_flag_phrases():
        if phrase in lowered:
            return True, phrase
    return False, ""

def extract_clinical_summary(transcript_list: list) -> dict:
    """
    Extract chief complaint, triage urgency level, and clinical action items from conversation turns.
    Urgency levels: Emergency (red), Urgent (amber), Routine (emerald).
    """
    if not transcript_list:
        return {
            "chief_complaint": "General inquiry / Call ended before intake",
            "urgency_level": "Routine",
            "action_items": "No immediate doctor action needed.",
        }

    user_texts = [turn.get("text", "") for turn in transcript_list if turn.get("role") == "user"]
    all_text = " ".join(user_texts).lower()

    # 1. Triage Urgency Detection
    emergency_keywords = [
        "chest pain", "heart attack", "can't breathe", "cannot breathe", "difficulty breathing",
        "shortness of breath", "severe bleeding", "unconscious", "stroke", "paralysis",
        "fainted", "collapsed", "seizure", "convulsions", "severe head injury", "coughing blood"
    ]
    urgent_keywords = [
        "high fever", "severe pain", "acute", "vomiting", "dehydration", "asthma",
        "infection", "severe migraine", "burn", "fracture", "stomach pain", "bleeding",
        "dizziness", "allergic reaction", "rash spreading", "ear pain"
    ]

    urgency_level = "Routine"
    if any(k in all_text for k in emergency_keywords):
        urgency_level = "Emergency"
    elif any(k in all_text for k in urgent_keywords):
        urgency_level = "Urgent"

    # 2. Chief Complaint Extraction
    chief_complaint = "Routine consultation inquiry"
    symptom_map = [
        ("hair fall", "Hair fall and scalp treatment consultation"),
        ("alopecia", "Hair loss / alopecia evaluation"),
        ("skin", "Dermatology / skin lesion or rash evaluation"),
        ("eczema", "Eczema flare-up and homeopathic skin therapy"),
        ("psoriasis", "Psoriasis chronic care consultation"),
        ("fever", "Fever management and clinical follow-up"),
        ("cough", "Respiratory cough and throat congestion"),
        ("cold", "Common cold and respiratory symptoms"),
        ("stomach", "Gastrointestinal / abdominal discomfort"),
        ("digestive", "Digestive health and gut assessment"),
        ("acidity", "Acid reflux and GERD management"),
        ("diabetes", "Blood sugar management and lifestyle consultation"),
        ("hypertension", "Blood pressure monitoring and chronic care"),
        ("pcos", "PCOS / hormonal health consultation"),
        ("thyroid", "Thyroid imbalance evaluation"),
        ("joint", "Joint pain and arthritis management"),
        ("back pain", "Lumbar / back pain assessment"),
        ("headache", "Chronic headache / migraine assessment"),
        ("migraine", "Severe migraine evaluation"),
        ("allergy", "Seasonal or food allergy evaluation"),
        ("child", "Pediatric consultation"),
        ("baby", "Infant health and feeding assessment"),
    ]

    for key, complaint in symptom_map:
        if key in all_text:
            chief_complaint = complaint
            break

    if chief_complaint == "Routine consultation inquiry" and user_texts:
        # Use first informative patient turn as chief complaint snippet
        first_meaningful = [t for t in user_texts if len(t.strip()) > 10]
        if first_meaningful:
            chief_complaint = first_meaningful[0][:120].strip()

    # 3. Action Items
    action_items_list = []
    if urgency_level == "Emergency":
        action_items_list.append("IMMEDIATE: Advise nearest emergency department / ER evaluation.")
        action_items_list.append("Doctor callback required immediately.")
    elif urgency_level == "Urgent":
        action_items_list.append("Priority review: Schedule doctor follow-up within 2-4 hours.")
        action_items_list.append("Collect preliminary vitals and relevant test reports.")
    else:
        action_items_list.append("Confirm consultation slot in clinic schedule.")
        action_items_list.append("Review previous medical prescriptions and diagnostic reports.")

    action_items_list.append("Verify WhatsApp intake form submission before appointment.")

    return {
        "chief_complaint": chief_complaint,
        "urgency_level": urgency_level,
        "action_items": " • ".join(action_items_list),
    }

def dispatch_webhook(event_type: str, data: dict):
    """
    Dispatch webhook event to configured webhook URL in a non-blocking daemon thread.
    Supported events: 'appointment.booked', 'call.completed'
    """
    import threading
    import json
    import urllib.request

    webhook_url = get_setting("webhook_url", "").strip()
    if not webhook_url:
        log.info(f"No webhook URL configured; skipping dispatch for {event_type}")
        return

    def _sender():
        payload = {
            "event": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "Swastik AI Voice Agent",
            "clinic": "Dr. Sharma's Clinic",
            "data": data,
        }
        try:
            req = urllib.request.Request(
                webhook_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "SwastikAI-Webhook/1.0",
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                log.info(f"Webhook {event_type} dispatched to {webhook_url} (HTTP {resp.status})")
        except Exception as e:
            log.warning(f"Webhook dispatch failed for {event_type} to {webhook_url}: {e}")

    threading.Thread(target=_sender, daemon=True, name="webhook-dispatcher").start()

def save_call_log(
    session_id: str,
    caller_name: str,
    phone: str,
    duration_seconds: int,
    summary: str,
    transcript_list: list,
    chief_complaint: str = "",
    urgency_level: str = "Routine",
    action_items: str = "",
    audio_url: str = "",
):
    """Save call transcript and metadata including clinical triage and audio memo to SQLite."""
    import json
    try:
        with get_db() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO call_logs (
                    session_id, caller_name, phone, duration_seconds, summary,
                    transcript_json, chief_complaint, urgency_level, action_items, audio_url
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session_id, caller_name, phone, duration_seconds, summary,
                json.dumps(transcript_list), chief_complaint, urgency_level, action_items, audio_url
            ))
            conn.commit()
            log.info(f"Saved call log for session {session_id} ({duration_seconds}s, triage={urgency_level})")
    except Exception as e:
        log.exception(f"Failed to save call log: {e}")

def get_all_call_logs(limit=50):
    """Fetch call logs with clinical triage data and audio playback for admin view."""
    import json
    try:
        with get_db() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM call_logs ORDER BY id DESC LIMIT ?", (limit,))
            rows = []
            for r in cursor.fetchall():
                d = dict(r)
                try:
                    d["transcript"] = json.loads(d.get("transcript_json") or "[]")
                except Exception:
                    d["transcript"] = []
                d["chief_complaint"] = d.get("chief_complaint") or "General Health Consultation"
                d["urgency_level"] = d.get("urgency_level") or "Routine"
                d["action_items"] = d.get("action_items") or "Review medical reports with doctor."
                d["audio_url"] = d.get("audio_url") or f"/api/audio/memo/{d.get('session_id')}"
                rows.append(d)
            return rows
    except Exception as e:
        log.error(f"Failed to fetch call logs: {e}")
        return []

def update_appointment_status(appointment_id: int, new_status: str):
    """Update appointment status (CONFIRMED, COMPLETED, CANCELLED)."""
    try:
        with get_db() as conn:
            conn.execute("""
                UPDATE appointments SET status = ? WHERE id = ?
            """, (new_status, appointment_id))
            conn.commit()
            return True
    except Exception as e:
        log.error(f"Failed to update appointment {appointment_id}: {e}")
        return False

def reschedule_appointment(phone: str, old_slot_time: str, new_slot_time: str) -> dict:
    """Reschedule a CONFIRMED appointment identified by phone + slot_time.

    Policy enforced:
    - Only CONFIRMED appointments can be rescheduled.
    - Max 1 reschedule per appointment (tracked via reschedule_count column).
    - New slot must be available (not already booked by someone else).
    """
    try:
        with get_db() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Normalize input phone to digits-only (last 10)
            clean_phone = ''.join(filter(str.isdigit, phone.strip()))[-10:]

            # Find the matching appointment using digit-stripped phone
            cursor.execute("""
                SELECT * FROM appointments
                WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ?
                  AND LOWER(slot_time) = LOWER(?)
                  AND status = 'CONFIRMED'
                ORDER BY id DESC LIMIT 1
            """, (f"%{clean_phone}%", old_slot_time.strip()))
            row = cursor.fetchone()
            if not row:
                return {"ok": False, "error": "no_matching_appointment",
                        "message": "No confirmed appointment found for this phone and slot time."}
            appt = dict(row)

            # Check reschedule limit
            reschedule_count = appt.get("reschedule_count", 0) or 0
            if reschedule_count >= 1:
                return {"ok": False, "error": "reschedule_limit_reached",
                        "message": "This appointment has already been rescheduled once. Maximum 1 free reschedule allowed."}

            # Check the new slot is free
            cursor.execute("""
                SELECT id FROM appointments
                WHERE LOWER(slot_time) = LOWER(?) AND status = 'CONFIRMED'
            """, (new_slot_time.strip(),))
            if cursor.fetchone():
                return {"ok": False, "error": "slot_not_available",
                        "message": f"The slot {new_slot_time} is already booked. Please choose a different time."}

            # Perform the reschedule
            cursor.execute("""
                UPDATE appointments
                SET slot_time = ?, reschedule_count = COALESCE(reschedule_count, 0) + 1
                WHERE id = ?
            """, (new_slot_time.strip(), appt["id"]))
            conn.commit()

            updated = {
                "id": appt["id"],
                "patient_name": appt["patient_name"],
                "old_slot_time": old_slot_time,
                "new_slot_time": new_slot_time,
                "phone": appt["phone"],
                "category": appt.get("category", ""),
                "consultation_mode": appt.get("consultation_mode", ""),
                "status": "CONFIRMED",
                "reschedules_remaining": 0,
            }
            dispatch_webhook("appointment.rescheduled", updated)
            return {"ok": True, **updated}
    except Exception as e:
        log.exception("Failed to reschedule appointment")
        return {"ok": False, "error": "internal", "message": str(e)}


def cancel_appointment(phone: str, slot_time: str) -> dict:
    """Cancel a CONFIRMED appointment identified by phone + slot_time.

    Policy: fee is non-refundable. Status changes to CANCELLED.
    """
    try:
        with get_db() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Normalize input phone to digits-only (last 10)
            clean_phone = ''.join(filter(str.isdigit, phone.strip()))[-10:]

            cursor.execute("""
                SELECT * FROM appointments
                WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ?
                  AND LOWER(slot_time) = LOWER(?)
                  AND status = 'CONFIRMED'
                ORDER BY id DESC LIMIT 1
            """, (f"%{clean_phone}%", slot_time.strip()))
            row = cursor.fetchone()
            if not row:
                return {"ok": False, "error": "no_matching_appointment",
                        "message": "No confirmed appointment found for this phone and slot time."}
            appt = dict(row)

            cursor.execute("""
                UPDATE appointments SET status = 'CANCELLED' WHERE id = ?
            """, (appt["id"],))
            conn.commit()

            cancelled = {
                "id": appt["id"],
                "patient_name": appt["patient_name"],
                "slot_time": slot_time,
                "phone": appt["phone"],
                "category": appt.get("category", ""),
                "status": "CANCELLED",
                "refund_note": "Consultation fee (₹499) is non-refundable as per clinic policy.",
            }
            dispatch_webhook("appointment.cancelled", cancelled)
            return {"ok": True, **cancelled}
    except Exception as e:
        log.exception("Failed to cancel appointment")
        return {"ok": False, "error": "internal", "message": str(e)}

def get_all_orders(limit=100):
    """Fetch all subscription orders."""
    try:
        with get_db() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM orders ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(r) for r in cursor.fetchall()]
    except Exception as e:
        log.error(f"Failed to fetch orders: {e}")
        return []

def get_admin_stats():
    """Aggregate high-level metrics for Dr. Sharma's admin dashboard."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM appointments")
            total_appts = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM appointments WHERE date(created_at) = date('now')")
            today_appts = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM orders WHERE status = 'PAID'")
            order_row = cursor.fetchone()
            total_orders = order_row[0]
            total_revenue = order_row[1]

            cursor.execute("SELECT COUNT(*), COALESCE(SUM(duration_seconds), 0) FROM call_logs")
            call_row = cursor.fetchone()
            total_calls = call_row[0]
            total_call_seconds = call_row[1]

            return {
                "total_appointments": total_appts,
                "today_appointments": today_appts,
                "total_orders": total_orders,
                "total_revenue": total_revenue,
                "total_calls": total_calls,
                "call_minutes": round(total_call_seconds / 60, 1),
            }
    except Exception as e:
        log.error(f"Failed to calculate admin stats: {e}")
        return {
            "total_appointments": 0,
            "today_appointments": 0,
            "total_orders": 0,
            "total_revenue": 0,
            "total_calls": 0,
            "call_minutes": 0,
        }

def create_order(plan_id: str, plan_name: str, amount: int, doctor_name: str, clinic_name: str, phone: str, email: str = "", city: str = ""):
    """Create a new subscription order in SQLite."""
    import uuid
    order_id = f"ORD-SWK-{uuid.uuid4().hex[:8].upper()}"
    with get_db() as conn:
        conn.execute("""
            INSERT INTO orders (order_id, plan_id, plan_name, amount, doctor_name, clinic_name, phone, email, city, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
        """, (order_id, plan_id, plan_name, amount, doctor_name, clinic_name, phone, email, city))
        conn.commit()
    
    upi_id = os.environ.get("UPI_ID", "6387831138-2@ibl")
    payee_name = os.environ.get("UPI_PAYEE_NAME", "Dr Sharma")
    upi_params = urllib.parse.urlencode({
        "pa": upi_id,
        "pn": payee_name,
        "am": str(amount),
        "cu": "INR",
        "tn": f"Swastik {plan_name} - {order_id}",
    })
    upi_link = f"upi://pay?{upi_params}"

    return {
        "order_id": order_id,
        "plan_id": plan_id,
        "plan_name": plan_name,
        "amount": amount,
        "doctor_name": doctor_name,
        "clinic_name": clinic_name,
        "phone": phone,
        "email": email,
        "city": city,
        "status": "PENDING",
        "upi_id": upi_id,
        "payee_name": payee_name,
        "upi_link": upi_link,
    }

def verify_order_payment(order_id: str, transaction_ref: str, payment_method: str = "UPI"):
    """Update order status to PAID once payment is submitted/verified."""
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        cursor.execute("""
            UPDATE orders
            SET status = 'PAID', transaction_ref = ?, payment_method = ?
            WHERE order_id = ?
        """, (transaction_ref, payment_method, order_id))
        conn.commit()

        cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
        updated = cursor.fetchone()
        return dict(updated)

def get_order_by_id(order_id: str):
    """Retrieve an order by its unique order_id."""
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


TOOL_DECLARATIONS = [
    {
        "name": "get_clinic_info",
        "description": "Get Dr. Sharma's Clinic / Swastik AI clinic hours, ₹499 consultation fee, policies, and address.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_available_slots",
        "description": "Fetch available consultation slots between 11:00 AM and 1:30 PM (Monday to Saturday).",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Medical category (e.g. Women's Health, Skin Problems, Hair Fall, Digestive System, Chronic Care, Children's Health)",
                },
                "date": {
                    "type": "string",
                    "description": "Preferred date or 'Tomorrow'",
                },
            },
            "required": [],
        },
    },
    {
        "name": "book_consultation",
        "description": "Book an appointment slot for a patient at Dr. Sharma's Clinic (Swastik AI).",
        "parameters": {
            "type": "object",
            "properties": {
                "patient_name": {"type": "string", "description": "Patient's full name"},
                "age": {"type": "string", "description": "Patient's age"},
                "gender": {"type": "string", "description": "Gender (Male/Female/Other)"},
                "phone": {"type": "string", "description": "WhatsApp/Contact Number"},
                "category": {"type": "string", "description": "Health issue category"},
                "consultation_mode": {"type": "string", "description": "Consultation mode ('Online' or 'Offline')", "enum": ["Online", "Offline"]},
                "slot_time": {"type": "string", "description": "Confirmed slot time (e.g. 11:00 AM, 11:30 AM, 12:00 PM)"},
                "locality": {"type": "string", "description": "City or Locality"},
            },
            "required": ["patient_name", "slot_time"],
        },
    },
    {
        "name": "send_whatsapp_confirmation",
        "description": "Send instant WhatsApp booking confirmation with clinic guidelines.",
        "parameters": {
            "type": "object",
            "properties": {
                "phone": {"type": "string", "description": "WhatsApp number (default: 76018 39607)"},
                "patient_name": {"type": "string", "description": "Patient Name"},
                "slot_time": {"type": "string", "description": "Confirmed time slot"},
                "category": {"type": "string", "description": "Consultation Category"},
                "consultation_mode": {"type": "string", "description": "Consultation mode: 'Online' or 'Offline'"},
            },
            "required": ["patient_name", "slot_time"],
        },
    },
    {
        "name": "check_insurance_guidelines",
        "description": "Check health insurance reimbursement policies, accepted insurers (Star Health, Care, HDFC Ergo, etc.), and clinic documentation provided.",
        "parameters": {
            "type": "object",
            "properties": {
                "insurer_name": {
                    "type": "string",
                    "description": "Name of insurance company or 'General'",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_previsit_guidelines",
        "description": "Get pre-consultation guidelines, dietary precautions before homeopathic remedies, and required medical documents.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Medical category/specialty",
                },
            },
            "required": [],
        },
    },
    {
        "name": "escalate_emergency",
        "description": "Trigger immediate emergency escalation when a patient mentions red-flag symptoms (chest pain, breathing difficulty, sudden weakness/numbness/slurred speech, heavy bleeding, poisoning, 112). Halts clinic booking and instructs caller to contact emergency services (112) immediately without judging severity.",
        "parameters": {
            "type": "object",
            "properties": {
                "trigger_phrase": {
                    "type": "string",
                    "description": "The red-flag symptom or phrase detected (e.g., chest pain, breathing difficulty)",
                },
                "caller_context": {
                    "type": "string",
                    "description": "Brief description of caller situation",
                },
            },
            "required": ["trigger_phrase"],
        },
    },
    {
        "name": "reschedule_appointment",
        "description": "Reschedule a patient's existing confirmed appointment to a different time slot. The patient gets 1 free reschedule if requested at least 24 hours before the original slot. Ask the patient for their phone number and current slot time to look up the booking, then confirm the new desired slot.",
        "parameters": {
            "type": "object",
            "properties": {
                "phone": {"type": "string", "description": "Patient's phone/WhatsApp number used during booking"},
                "old_slot_time": {"type": "string", "description": "The currently booked slot time (e.g. '11:00 AM')"},
                "new_slot_time": {"type": "string", "description": "The desired new slot time (e.g. '12:30 PM')"},
            },
            "required": ["phone", "old_slot_time", "new_slot_time"],
        },
    },
    {
        "name": "cancel_appointment",
        "description": "Cancel a patient's existing confirmed appointment. Inform the patient that the consultation fee (₹499) is non-refundable as per clinic policy. Ask for their phone number and slot time to look up the booking.",
        "parameters": {
            "type": "object",
            "properties": {
                "phone": {"type": "string", "description": "Patient's phone/WhatsApp number used during booking"},
                "slot_time": {"type": "string", "description": "The booked slot time to cancel (e.g. '11:00 AM')"},
            },
            "required": ["phone", "slot_time"],
        },
    },
]

def export_appointments_csv() -> str:
    """Export all appointments as a CSV string."""
    import csv
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Patient Name", "Slot Time", "Phone", "Age", "Gender", "Category", "Mode", "Fee", "Status", "Created At"])
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, patient_name, slot_time, phone, age, gender, category, consultation_mode, fee, status, created_at FROM appointments ORDER BY id DESC")
        for row in cursor.fetchall():
            writer.writerow(row)
    return output.getvalue()

def export_call_logs_csv() -> str:
    """Export all call logs as a CSV string including clinical triage and audio."""
    import csv
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Session ID", "Caller Name", "Phone", "Duration (s)",
        "Chief Complaint", "Urgency Level", "Action Items", "Audio URL", "Summary", "Created At"
    ])
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, session_id, caller_name, phone, duration_seconds,
                   chief_complaint, urgency_level, action_items, audio_url, summary, created_at
            FROM call_logs ORDER BY id DESC
        """)
        for row in cursor.fetchall():
            writer.writerow(row)
    return output.getvalue()

BASE_SLOTS = [
    {"time": "11:00 AM", "type": "Initial Consultation"},
    {"time": "11:30 AM", "type": "Follow-up Consultation"},
    {"time": "12:00 PM", "type": "Initial Consultation"},
    {"time": "12:30 PM", "type": "Follow-up Consultation"},
    {"time": "1:00 PM", "type": "Initial Consultation"},
]

def get_current_slots():
    """Retrieve slot availability based on persistent SQLite database."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT LOWER(slot_time) FROM appointments WHERE status = 'CONFIRMED'")
            booked_times = {row[0] for row in cursor.fetchall()}
    except Exception as e:
        log.error(f"Error querying slots from DB: {e}")
        booked_times = set()

    slots = []
    for s in BASE_SLOTS:
        is_booked = s["time"].lower() in booked_times
        slots.append({
            "time": s["time"],
            "type": s["type"],
            "status": "BOOKED" if is_booked else "FREE",
        })
    return slots

def save_appointment(patient_name, slot_time, phone, age, gender, category, consultation_mode):
    """Save an appointment to SQLite."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO appointments (patient_name, slot_time, phone, age, gender, category, consultation_mode)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (patient_name, slot_time, phone, age, gender, category, consultation_mode))
            conn.commit()
            return cursor.lastrowid
    except Exception as e:
        log.exception("Failed to persist appointment")
        return None

def get_all_appointments(limit=100):
    """Fetch appointments for admin view."""
    try:
        with get_db() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM appointments ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        log.error(f"Failed to fetch appointments: {e}")
        return []

def dispatch_tool(name: str, args: dict):
    """Dispatch tool call and return (ui_cmd | None, function_result)."""
    if name == "get_clinic_info":
        info = {
            "clinic": "Dr. Sharma's Clinic (Swastik AI)",
            "fee": "₹499",
            "call_hours": "11:00 AM to 1:30 PM (Mon-Sat)",
            "whatsapp_hours": "11:00 AM to 6:00 PM (Mon-Sat)",
            "sunday": "Closed",
            "reschedule_policy": "Reschedule up to 24h prior (Max 1 time). Fee strictly non-refundable.",
            "reports_note": "Bring hard copies of previous medical reports and test results.",
        }
        return {"action": "show_policy", "data": info}, {"result": "ok", "info": info}

    if name == "get_available_slots":
        category = args.get("category", "General Health")
        current_slots = get_current_slots()
        return {
            "action": "show_calendar",
            "category": category,
            "slots": current_slots,
        }, {"result": "ok", "slots": current_slots, "calling_hours": "11:00 AM - 1:30 PM"}

    if name == "book_consultation":
        patient_name = args.get("patient_name", "Patient")
        slot_time = args.get("slot_time", "11:00 AM")
        phone = args.get("phone", "76018 39607")
        age = args.get("age", "")
        gender = args.get("gender", "")
        category = args.get("category", "General Health")
        consultation_mode = args.get("consultation_mode", "Online")

        booking_id = save_appointment(
            patient_name=patient_name,
            slot_time=slot_time,
            phone=phone,
            age=age,
            gender=gender,
            category=category,
            consultation_mode=consultation_mode
        )

        current_slots = get_current_slots()

        booking_data = {
            "id": booking_id,
            "patient_name": patient_name,
            "slot_time": slot_time,
            "phone": phone,
            "category": category,
            "consultation_mode": consultation_mode,
            "fee": "₹499",
            "status": "CONFIRMED",
        }

        # Dispatch async webhook for appointment.booked
        dispatch_webhook("appointment.booked", booking_data)

        return {
            "action": "booking_confirmed",
            "data": booking_data,
            "slots": current_slots,
        }, {"result": "ok", "booking": booking_data}

    if name == "send_whatsapp_confirmation":
        phone = args.get("phone", "76018 39607")
        patient_name = args.get("patient_name", "Patient")
        slot_time = args.get("slot_time", "11:00 AM")
        category = args.get("category", "General Health")
        consultation_mode = args.get("consultation_mode", "Online")

        form_url = "https://docs.google.com/forms/d/e/1FAIpQLScUwhHgwBxD6rYFw_G_GZKGCePkjrBqBoRSTR6Wa9SAQP_Sqg/viewform?usp=dialog"
        message_text = f"Dr. Sharma's Clinic: {patient_name} - your {consultation_mode} appointment for {category} is confirmed for tomorrow at {slot_time}. Consultation fee: ₹499. Clinic guidelines: {form_url}"
        
        # Clean phone number for wa.me link (remove spaces/symbols)
        clean_phone = "".join(filter(str.isdigit, phone))
        if not clean_phone.startswith("91") and len(clean_phone) == 10:
            clean_phone = "91" + clean_phone
            
        wa_url = f"https://wa.me/{clean_phone}?text={urllib.parse.quote(message_text)}"

        sid = os.environ.get("TWILIO_ACCOUNT_SID")
        token = os.environ.get("TWILIO_AUTH_TOKEN")
        from_num = os.environ.get("TWILIO_WHATSAPP_NUMBER")
        
        if sid and token and from_num:
            try:
                from twilio.rest import Client
                client = Client(sid, token)
                content_sid = os.environ.get("TWILIO_CONTENT_SID")
                if content_sid:
                    msg = client.messages.create(
                        from_=from_num,
                        content_sid=content_sid,
                        to=f"whatsapp:+{clean_phone}"
                    )
                else:
                    msg = client.messages.create(
                        from_=from_num,
                        body=message_text,
                        to=f"whatsapp:+{clean_phone}"
                    )
                log.info(f"Twilio message sent: {msg.sid}")
            except Exception as e:
                log.error(f"Failed to send Twilio message: {e}")

        wa_data = {
            "phone": phone,
            "patient_name": patient_name,
            "slot_time": slot_time,
            "category": category,
            "consultation_mode": consultation_mode,
            "fee": "₹499",
            "form_url": form_url,
            "message": message_text,
            "wa_url": wa_url
        }
        return {"action": "whatsapp_send", "data": wa_data}, {"result": "ok", "whatsapp": wa_data}

    if name == "check_insurance_guidelines":
        insurer = args.get("insurer_name", "General")
        info = {
            "insurer": insurer,
            "policy": "Reimbursement Supported",
            "documentation": [
                "Doctor's official clinic bill with registration number",
                "Stamped prescription with diagnosis and treatment plan",
                "Payment transaction receipt (UPI / Cash / Card)",
            ],
            "note": "We provide stamped invoices for reimbursement claims across all major insurers including Star Health, Care Health, HDFC ERGO, Niva Bupa, and ICICI Lombard.",
        }
        return {"action": "show_insurance_info", "data": info}, {"result": "ok", "insurance_info": info}

    if name == "get_previsit_guidelines":
        category = args.get("category", "General")
        info = {
            "category": category,
            "dietary_rules": [
                "Avoid raw onion, garlic, hing, and strong coffee 30 minutes before taking homeopathic medicines.",
                "Do not touch pills with bare fingers — use the bottle cap to dispense.",
            ],
            "document_rules": [
                "Bring hard copies of previous blood test reports, prescriptions, or discharge summaries.",
            ],
            "instructions": "Full guidelines are also sent via WhatsApp along with the intake form.",
        }
        return {"action": "show_guidelines", "data": info}, {"result": "ok", "guidelines": info}

    if name == "escalate_emergency":
        trigger = args.get("trigger_phrase", "Emergency symptom detected")
        ctx = args.get("caller_context", "")
        log.warning(f"🚨 EMERGENCY ESCALATION TRIGGERED: phrase='{trigger}', context='{ctx}'")
        
        # Dispatch emergency webhook immediately
        dispatch_webhook("emergency.escalated", {
            "trigger_phrase": trigger,
            "caller_context": ctx,
            "emergency_number": "112",
            "advised_action": "Call 112 / proceed to nearest emergency casualty",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        escalation_data = {
            "trigger_phrase": trigger,
            "emergency_number": "112",
            "message": "This sounds like an emergency. Please call 112 or go to the nearest casualty immediately. Do not wait for a clinic appointment.",
            "status": "ESCALATED",
        }
        return (
            {"action": "emergency_escalation", "data": escalation_data},
            {
                "result": "ok",
                "escalated": True,
                "speech_directive": "This sounds like an emergency. Please call 112 or go to the nearest casualty immediately. Do not wait for a clinic appointment.",
                "emergency_number": "112",
            },
        )

    if name == "reschedule_appointment":
        phone = args.get("phone", "")
        old_slot = args.get("old_slot_time", "")
        new_slot = args.get("new_slot_time", "")
        log.info(f"Reschedule request: phone={phone}, {old_slot} → {new_slot}")

        result = reschedule_appointment(phone, old_slot, new_slot)
        if result.get("ok"):
            current_slots = get_current_slots()
            return (
                {"action": "appointment_rescheduled", "data": result, "slots": current_slots},
                {"result": "ok", "rescheduled": result},
            )
        else:
            return (
                None,
                {"result": "error", "error": result.get("error"), "message": result.get("message")},
            )

    if name == "cancel_appointment":
        phone = args.get("phone", "")
        slot = args.get("slot_time", "")
        log.info(f"Cancel request: phone={phone}, slot={slot}")

        result = cancel_appointment(phone, slot)
        if result.get("ok"):
            current_slots = get_current_slots()
            return (
                {"action": "appointment_cancelled", "data": result, "slots": current_slots},
                {"result": "ok", "cancelled": result},
            )
        else:
            return (
                None,
                {"result": "error", "error": result.get("error"), "message": result.get("message")},
            )

    return None, {"result": f"unknown tool: {name}"}
