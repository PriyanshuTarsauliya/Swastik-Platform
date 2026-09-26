import logging
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.database import get_db
from backend.tools import get_user_by_session_token
from backend.usage_meter import get_monthly_usage

log = logging.getLogger("swastik-superadmin")
router = APIRouter()

async def verify_superadmin(request: Request):
    """Dependency to verify the user has the 'platform_admin' role."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""
    user = get_user_by_session_token(token) if token else None
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user.get("role") != "platform_admin":
        raise HTTPException(status_code=403, detail="Forbidden: Requires platform_admin role")
    return user

@router.get("/api/superadmin/clinics")
async def get_all_clinics(request: Request):
    await verify_superadmin(request)
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.id, c.name, c.slug, c.status, c.plan_id, c.created_at,
                       p.doctor_name
                FROM clinics c
                LEFT JOIN clinic_profile p ON p.clinic_id = c.id
                ORDER BY c.created_at DESC
            """)
            rows = cursor.fetchall()
            
            clinics_list = []
            for row in rows:
                c_dict = dict(row.items()) if hasattr(row, 'items') else dict(row)
                usage = get_monthly_usage(c_dict["id"])
                c_dict["usage_minutes"] = usage.get("minutes_used", 0)
                clinics_list.append(c_dict)
                
            return {"clinics": clinics_list}
    except Exception as e:
        log.error("Failed to list clinics: %s", e)
        return JSONResponse({"error": "Database error"}, status_code=500)

class NewClinicRequest(BaseModel):
    name: str
    owner_email: str
    owner_name: str
    owner_password: str

@router.post("/api/superadmin/clinics")
async def create_new_clinic(request: Request, body: NewClinicRequest):
    await verify_superadmin(request)
    # Reusing the existing create_user logic which creates user, clinic, profile, channels
    from backend.tools import create_user
    try:
        user = create_user(
            name=body.owner_name,
            email=body.owner_email,
            password=body.owner_password,
            role="doctor",
            clinic_name=body.name,
            phone=""
        )
        if not user:
            return JSONResponse({"error": "Failed to create clinic/user. Email might exist."}, status_code=400)
        
        return {"status": "success", "message": "Clinic and owner created"}
    except Exception as e:
        log.error("Error creating clinic: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@router.get("/api/superadmin/usage")
async def get_cross_tenant_usage(request: Request):
    await verify_superadmin(request)
    year_month = datetime.now(UTC).strftime("%Y-%m")
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT SUM(minutes_used) as total_minutes
                FROM usage_monthly
                WHERE year_month = ?
            """, (year_month,))
            row = cursor.fetchone()
            total_minutes = row[0] if row and row[0] else 0.0
            
            return {
                "year_month": year_month,
                "total_minutes_used": round(total_minutes, 1)
            }
    except Exception as e:
        log.error("Error getting aggregate usage: %s", e)
        return JSONResponse({"error": "Database error"}, status_code=500)

class SuperAdminProvisionRequest(BaseModel):
    country_code: str = "US"

@router.post("/api/superadmin/clinics/{clinic_id}/provision-number")
async def superadmin_provision_number(request: Request, clinic_id: str, body: SuperAdminProvisionRequest):
    await verify_superadmin(request)
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM clinics WHERE id = ?", (clinic_id,))
            if not cursor.fetchone():
                return JSONResponse({"error": "Clinic not found"}, status_code=404)
            
            # Stub: in reality this would hit Twilio API
            import random
            mock_phone = f"+1{random.randint(2000000000, 9999999999)}"
            
            cursor.execute("""
                INSERT OR IGNORE INTO clinic_channels (clinic_id, type, value, is_active)
                VALUES (?, 'phone', ?, 1)
            """, (clinic_id, mock_phone))
            conn.commit()
            
            return {"status": "success", "phone_number": mock_phone}
    except Exception as e:
        log.error("Error provisioning number for clinic %s: %s", clinic_id, e)
        return JSONResponse({"error": "Database error"}, status_code=500)
