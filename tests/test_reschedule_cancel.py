"""
Automated Test Suite — Voice-Based Reschedule & Cancel
Validates reschedule_appointment() and cancel_appointment() functions
against clinic policy (1 free reschedule, non-refundable fee, slot conflict checks).
"""

import os
import sys
import sqlite3
import tempfile

# Fix Windows console encoding for Unicode output
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend module is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Use a temporary DB for tests so we don't touch production data
_test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
TEST_DB_PATH = _test_db.name
_test_db.close()

# Patch DB_PATH before importing tools
import backend.tools as tools
tools.DB_PATH = TEST_DB_PATH

from backend.tools import (
    init_db,
    save_appointment,
    reschedule_appointment,
    cancel_appointment,
    dispatch_tool,
    get_current_slots,
)


def setup_db():
    """Initialize a clean test database."""
    # Remove old data
    with sqlite3.connect(TEST_DB_PATH) as conn:
        conn.execute("DROP TABLE IF EXISTS appointments")
        conn.execute("DROP TABLE IF EXISTS orders")
        conn.execute("DROP TABLE IF EXISTS call_logs")
        conn.execute("DROP TABLE IF EXISTS settings")
        conn.execute("DROP TABLE IF EXISTS users")
        conn.execute("DROP TABLE IF EXISTS user_sessions")
    init_db()


def seed_appointment(patient_name="Test Patient", slot_time="11:00 AM",
                     phone="9876543210", category="General Health"):
    """Insert a confirmed test appointment and return its ID."""
    return save_appointment(
        patient_name=patient_name,
        slot_time=slot_time,
        phone=phone,
        age="30",
        gender="Male",
        category=category,
        consultation_mode="Online",
    )


# ──────────────────────────────────────────────
# TESTS
# ──────────────────────────────────────────────

passed = 0
failed = 0
total = 0


def run_test(name, fn):
    global passed, failed, total
    total += 1
    try:
        fn()
        passed += 1
        print(f"  ✅ {name}")
    except AssertionError as e:
        failed += 1
        print(f"  ❌ {name} — {e}")
    except Exception as e:
        failed += 1
        print(f"  ❌ {name} — UNEXPECTED: {e}")


# --- Reschedule Tests ---

def test_reschedule_success():
    """Reschedule a confirmed appointment to a free slot."""
    setup_db()
    seed_appointment(phone="9876543210", slot_time="11:00 AM")
    result = reschedule_appointment("9876543210", "11:00 AM", "12:00 PM")
    assert result["ok"] is True, f"Expected ok=True, got {result}"
    assert result["new_slot_time"] == "12:00 PM", f"Expected 12:00 PM, got {result['new_slot_time']}"
    assert result["old_slot_time"] == "11:00 AM"
    assert result["reschedules_remaining"] == 0


def test_reschedule_no_matching_appointment():
    """Reschedule fails gracefully when no matching appointment exists."""
    setup_db()
    result = reschedule_appointment("0000000000", "11:00 AM", "12:00 PM")
    assert result["ok"] is False
    assert result["error"] == "no_matching_appointment"


def test_reschedule_limit_reached():
    """Second reschedule attempt is blocked (max 1 free reschedule)."""
    setup_db()
    seed_appointment(phone="9876543210", slot_time="11:00 AM")
    first = reschedule_appointment("9876543210", "11:00 AM", "12:00 PM")
    assert first["ok"] is True

    second = reschedule_appointment("9876543210", "12:00 PM", "1:00 PM")
    assert second["ok"] is False
    assert second["error"] == "reschedule_limit_reached"


def test_reschedule_slot_taken():
    """Reschedule fails when the target slot is already booked."""
    setup_db()
    seed_appointment(patient_name="Patient A", phone="1111111111", slot_time="11:00 AM")
    seed_appointment(patient_name="Patient B", phone="2222222222", slot_time="12:00 PM")

    result = reschedule_appointment("1111111111", "11:00 AM", "12:00 PM")
    assert result["ok"] is False
    assert result["error"] == "slot_not_available"


def test_reschedule_case_insensitive():
    """Slot time matching is case-insensitive."""
    setup_db()
    seed_appointment(phone="9876543210", slot_time="11:00 AM")
    result = reschedule_appointment("9876543210", "11:00 am", "12:00 PM")
    assert result["ok"] is True


def test_reschedule_partial_phone():
    """Phone matching works with partial numbers (last 10 digits)."""
    setup_db()
    seed_appointment(phone="91 98765 43210", slot_time="11:00 AM")
    result = reschedule_appointment("9876543210", "11:00 AM", "12:00 PM")
    assert result["ok"] is True


# --- Cancel Tests ---

def test_cancel_success():
    """Cancel a confirmed appointment."""
    setup_db()
    seed_appointment(phone="9876543210", slot_time="11:00 AM")
    result = cancel_appointment("9876543210", "11:00 AM")
    assert result["ok"] is True
    assert result["status"] == "CANCELLED"
    assert "non-refundable" in result["refund_note"]


def test_cancel_no_matching_appointment():
    """Cancel fails gracefully when no matching appointment exists."""
    setup_db()
    result = cancel_appointment("0000000000", "11:00 AM")
    assert result["ok"] is False
    assert result["error"] == "no_matching_appointment"


def test_cancel_then_reschedule_fails():
    """After cancellation, reschedule on the same appointment fails."""
    setup_db()
    seed_appointment(phone="9876543210", slot_time="11:00 AM")
    cancel_result = cancel_appointment("9876543210", "11:00 AM")
    assert cancel_result["ok"] is True

    reschedule_result = reschedule_appointment("9876543210", "11:00 AM", "12:00 PM")
    assert reschedule_result["ok"] is False
    assert reschedule_result["error"] == "no_matching_appointment"


# --- dispatch_tool Integration Tests ---

def test_dispatch_reschedule():
    """dispatch_tool correctly routes reschedule_appointment."""
    setup_db()
    seed_appointment(phone="9876543210", slot_time="11:00 AM")
    ui_cmd, fn_result = dispatch_tool("reschedule_appointment", {
        "phone": "9876543210",
        "old_slot_time": "11:00 AM",
        "new_slot_time": "12:30 PM",
    })
    assert fn_result["result"] == "ok", f"Expected result=ok, got {fn_result}"
    assert ui_cmd["action"] == "appointment_rescheduled"


def test_dispatch_cancel():
    """dispatch_tool correctly routes cancel_appointment."""
    setup_db()
    seed_appointment(phone="9876543210", slot_time="11:00 AM")
    ui_cmd, fn_result = dispatch_tool("cancel_appointment", {
        "phone": "9876543210",
        "slot_time": "11:00 AM",
    })
    assert fn_result["result"] == "ok", f"Expected result=ok, got {fn_result}"
    assert ui_cmd["action"] == "appointment_cancelled"


# ──────────────────────────────────────────────
# RUNNER
# ──────────────────────────────────────────────

if __name__ == "__main__":
    print("\n🔄 Voice-Based Reschedule & Cancel — Test Suite\n")

    print("  📅 Reschedule Tests:")
    run_test("Reschedule success", test_reschedule_success)
    run_test("Reschedule no matching appointment", test_reschedule_no_matching_appointment)
    run_test("Reschedule limit reached (max 1)", test_reschedule_limit_reached)
    run_test("Reschedule slot already taken", test_reschedule_slot_taken)
    run_test("Reschedule case-insensitive slot", test_reschedule_case_insensitive)
    run_test("Reschedule partial phone match", test_reschedule_partial_phone)

    print("\n  ❌ Cancel Tests:")
    run_test("Cancel success", test_cancel_success)
    run_test("Cancel no matching appointment", test_cancel_no_matching_appointment)
    run_test("Cancel then reschedule fails", test_cancel_then_reschedule_fails)

    print("\n  ⚡ dispatch_tool Integration:")
    run_test("dispatch_tool reschedule", test_dispatch_reschedule)
    run_test("dispatch_tool cancel", test_dispatch_cancel)

    print(f"\n{'='*50}")
    print(f"  Results: {passed}/{total} passed, {failed} failed")
    print(f"{'='*50}\n")

    # Cleanup temp DB
    try:
        os.unlink(TEST_DB_PATH)
    except Exception:
        pass

    sys.exit(0 if failed == 0 else 1)
