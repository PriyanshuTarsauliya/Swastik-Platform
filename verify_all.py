import sys
from fastapi.testclient import TestClient
from backend.raw_server import app
from backend.database import get_db

def run_verifications():
    client = TestClient(app)
    
    # 1. Super Admin Logs In (Phase 6)
    from backend.tools import create_user
    try:
        super_user = create_user(
            name="Super Admin",
            email="super@swastik.ai",
            password="superhash123",
            role="platform_admin",
            clinic_name="Super Clinic",
            phone=""
        )
    except ValueError:
        pass # Already exists

    # Give them a fake token in DB
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = 'super@swastik.ai'")
        super_id = cursor.fetchone()[0]
        cursor.execute("INSERT OR REPLACE INTO user_sessions (token, user_id, expires_at) VALUES ('super_token', ?, '2099-01-01 00:00:00')", (super_id,))
        # Also clean up dr.gupta so we can recreate it in the test without UNIQUE constraint failures
        cursor.execute("DELETE FROM users WHERE email = 'dr.gupta@swastik.ai'")
        conn.commit()

    # Phase 6 & Phase 1: Create a second clinic via super admin API
    print("Testing Phase 1 & 6 (Create Clinic via SuperAdmin API)...")
    res = client.post(
        "/api/superadmin/clinics",
        headers={"Authorization": "Bearer super_token"},
        json={
            "name": "Dr. Gupta's Clinic",
            "owner_email": "dr.gupta@swastik.ai",
            "owner_name": "Dr. Gupta",
            "owner_password": "password123"
        }
    )
    assert res.status_code == 200, f"Failed to create clinic: {res.text}"
    print("  ✅ Second clinic created successfully.")
    
    # Phase 6: Verify cross-tenant clinic list
    print("Testing Phase 6 (List Clinics)...")
    res = client.get("/api/superadmin/clinics", headers={"Authorization": "Bearer super_token"})
    assert res.status_code == 200
    clinics = res.json()["clinics"]
    assert len(clinics) >= 2, "Should have at least 2 clinics (Sharma and Gupta)"
    
    # Find Gupta's clinic and check slug
    gupta_clinic = next(c for c in clinics if c["name"] == "Dr. Gupta's Clinic")
    assert gupta_clinic["slug"] is not None
    print(f"  ✅ Cross-tenant list verified. Gupta slug is '{gupta_clinic['slug']}'")
    
    # Login as Dr. Gupta
    res = client.post("/api/auth/signin", json={"email": "dr.gupta@swastik.ai", "password": "password123"})
    assert res.status_code == 200
    gupta_token = res.json()["token"]
    
    # Phase 3: Dashboard Profile Edits
    print("Testing Phase 3 (Dashboard Profile Edits)...")
    res = client.put(
        "/api/admin/clinic-profile",
        headers={"Authorization": f"Bearer {gupta_token}"},
        json={
            "greeting": "Hello, this is Dr. Gupta automated assistant.",
            "services": "Heart Surgery",
            "doctor_name": "Dr. Gupta",
            "consultation_fee": "499"
        }
    )
    assert res.status_code == 200
    
    res = client.get("/api/admin/clinic-profile", headers={"Authorization": f"Bearer {gupta_token}"})
    assert res.json()["profile"]["greeting"] == "Hello, this is Dr. Gupta automated assistant."
    print("  ✅ Dashboard profile edit successful.")

    # Phase 2: Resolve smart link
    print("Testing Phase 2 (Smart Link Resolution)...")
    slug = gupta_clinic["slug"]
    res = client.get(f"/api/voice/{slug}")
    assert res.status_code == 200
    assert "Dr. Gupta automated assistant" in res.json()["greeting"]
    print("  ✅ Smart link resolves with customized profile.")
    
    # Phase 4 & 5: Twilio Test number provisioning and usage
    print("Testing Phase 4 & 5 (Provision Number & Usage limits)...")
    res = client.post("/api/admin/channels/buy-number", headers={"Authorization": f"Bearer {gupta_token}"}, json={"country_code": "US"})
    assert res.status_code == 200
    phone = res.json()["phone_number"]
    print(f"  ✅ Phone number {phone} provisioned.")
    
    # Mock usage: we'll call record_call_usage manually to simulate a completed call
    from backend.usage_meter import record_call_usage, get_monthly_usage
    record_call_usage(gupta_clinic["id"], 600, "phone") # 10 mins
    usage = get_monthly_usage(gupta_clinic["id"])
    assert usage["minutes_used"] == 10.0
    print("  ✅ Usage meter tracks minutes accurately.")
    
    # Check plan limits API logic
    from backend.usage_meter import check_plan_limit
    is_under_limit = check_plan_limit(gupta_clinic["id"])
    assert is_under_limit is True
    
    # Exhaust the limit
    record_call_usage(gupta_clinic["id"], 60000, "phone") # 1000 mins -> goes over the Starter plan 200 min limit
    assert check_plan_limit(gupta_clinic["id"]) is False
    print("  ✅ Usage meter accurately blocks after limit is exceeded.")
    
    print("\n🎉 ALL TESTS PASSED! Verification Complete.")

if __name__ == "__main__":
    run_verifications()
