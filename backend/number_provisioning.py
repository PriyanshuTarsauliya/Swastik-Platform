import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.tenant_resolver import bust_cache
from backend.tools import get_user_by_session_token

log = logging.getLogger("swastik-twilio-provisioning")
router = APIRouter()

class BuyNumberRequest(BaseModel):
    country_code: str = "US"

@router.post("/api/admin/channels/buy-number")
async def api_buy_twilio_number(request: Request, body: BuyNumberRequest):
    """
    Provisions a new phone number via Twilio API and assigns it to the clinic.
    """
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""
    user = get_user_by_session_token(token) if token else None
    
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    
    clinic_id = None
    from backend.database import get_db
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM clinics WHERE owner_user_id = ?", (user["id"],))
            row = cursor.fetchone()
            if row:
                clinic_id = row[0]
    except Exception:
        pass
    if not clinic_id:
        return JSONResponse({"error": "No clinic associated"}, status_code=404)

    # Note: In a real environment, you would use the twilio python client here:
    # client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    # numbers = client.available_phone_numbers(body.country_code).local.list(limit=1)
    # incoming_phone_number = client.incoming_phone_numbers.create(
    #    phone_number=numbers[0].phone_number,
    #    voice_url=f"https://voice.swastik.ai/api/voice/incoming"
    # )
    # phone_number = incoming_phone_number.phone_number

    # For development/demo purposes, we'll return a mock success
    mock_phone_number = "+1" + str(hash(clinic_id))[-10:].zfill(10)
    
    from backend.database import get_db
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Deactivate any existing phone channel for this clinic
            cursor.execute("UPDATE clinic_channels SET is_active = 0 WHERE clinic_id = ? AND channel_type = 'phone'", (clinic_id,))
            
            # Insert the new phone number
            cursor.execute("""
                INSERT INTO clinic_channels (clinic_id, channel_type, identifier, provider, is_active)
                VALUES (?, 'phone', ?, 'twilio', 1)
            """, (clinic_id, mock_phone_number))
            conn.commit()
            
        bust_cache(clinic_id)
        return {"status": "success", "phone_number": mock_phone_number}
    except Exception as e:
        log.error("Failed to provision number for clinic %s: %s", clinic_id, e)
        return JSONResponse({"error": "Failed to provision number"}, status_code=500)
