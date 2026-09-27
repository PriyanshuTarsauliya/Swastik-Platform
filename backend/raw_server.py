"""Swastik AI — Gemini Live voice receptionist backend."""

import asyncio
import json
import logging
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI, File, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    RedirectResponse,
    Response,
)
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.persona import SWASTIK_INSTRUCTION
from backend.prompt_builder import build_system_instructions
from backend.tenant_resolver import ClinicNotFoundError, bust_cache, resolve_clinic
from backend.tools import (
    TOOL_DECLARATIONS,
    _session_cache,
    authenticate_user,
    check_red_flags,
    create_order,
    create_session,
    create_user,
    delete_session,
    dispatch_tool,
    dispatch_webhook,
    export_appointments_csv,
    export_call_logs_csv,
    extract_clinical_summary,
    get_admin_stats,
    get_all_appointments,
    get_all_call_logs,
    get_all_orders,
    get_order_by_id,
    get_red_flag_phrases,
    get_setting,
    get_user_by_session_token,
    hash_password,
    save_call_log,
    set_red_flag_phrases,
    set_setting,
    update_appointment_status,
    verify_order_payment,
)
from backend.usage_meter import get_monthly_usage, record_call_usage
from backend.call_monitor import monitor

# Structured logging with timestamps
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("swastik-agent")

MODEL = os.getenv("LIVE_MODEL", "gemini-3.1-flash-live-preview")
VOICE = os.getenv("LIVE_VOICE", "Aoede")

def get_genai_client():
    global client
    if client is None:
        client = genai.Client()
    return client

try:
    client = genai.Client()  # reads GOOGLE_API_KEY + GOOGLE_GENAI_USE_VERTEXAI=FALSE from .env
except Exception as e:
    log.warning("genai.Client() initialization deferred: %s", e)
    client = None

LIVE_CONFIG = {
    "response_modalities": ["AUDIO"],
    "system_instruction": SWASTIK_INSTRUCTION,
    "input_audio_transcription": {},
    "output_audio_transcription": {},
    "speech_config": {"voice_config": {"prebuilt_voice_config": {"voice_name": VOICE}}},
    "tools": [{"function_declarations": TOOL_DECLARATIONS}],
}

raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5173,http://127.0.0.1:5173"
)
if raw_origins.strip() == "*":
    ALLOWED_ORIGINS = ["*"]
else:
    ALLOWED_ORIGINS = [o.strip() for o in raw_origins.split(",") if o.strip()]

app = FastAPI(
    title="Swastik AI Voice Agent",
    version="1.0.0",
    description="AI Voice Receptionist powered by Gemini Live API",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.reminder_service import reminder_daemon


@app.on_event("startup")
async def startup_event():
    log.info("Starting background reminder daemon...")
    import asyncio
    asyncio.create_task(reminder_daemon())

# ── Rate Limiter ──────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND = PROJECT_ROOT / "frontend"
FRONTEND_DIST = PROJECT_ROOT / "frontend-app" / "dist"
ASSETS = PROJECT_ROOT / "assets"
STARTUP_TIME = datetime.now(UTC)

from backend.number_provisioning import router as provisioning_router
from backend.superadmin import router as superadmin_router
from backend.twilio_bridge import router as twilio_router

app.include_router(twilio_router)
app.include_router(provisioning_router)
app.include_router(superadmin_router)
# ── Health & Status ──────────────────────────────────────────
@app.get("/health")
async def health():
    """Health check endpoint for monitoring and uptime services."""
    return {
        "status": "healthy",
        "service": "swastik-voice-agent",
        "version": "1.0.0",
        "uptime_seconds": (datetime.now(UTC) - STARTUP_TIME).total_seconds(),
        "model": MODEL,
        "voice": VOICE,
    }



# ── Authentication APIs ──────────────────────────────────────
class SignUpRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "doctor"
    clinic_name: str = "Dr. Sharma's Clinic"
    phone: str = ""

class SignInRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/signup")
@limiter.limit("3/minute")
async def api_signup(request: Request, req: SignUpRequest):
    """Register a new user and return session token."""
    try:
        user = create_user(
            name=req.name,
            email=req.email,
            password=req.password,
            role=req.role,
            clinic_name=req.clinic_name,
            phone=req.phone,
        )
        token = create_session(user["id"])
        
        # Send OTP if phone is provided
        if req.phone and user.get("otp_code"):
            from backend.tools import send_sms, send_welcome_email
            msg = f"Your Swastik verification code is {user['otp_code']}"
            # For demo purposes, we will fire and forget
            send_sms(req.phone, msg)
            
        # Fire and forget welcome email
        try:
            from backend.tools import send_welcome_email
            # Run in a background thread or executor to not block the response
            import asyncio
            asyncio.get_event_loop().run_in_executor(None, send_welcome_email, req.email, req.clinic_name)
        except Exception as e:
            log.warning("Could not dispatch welcome email: %s", e)

        return {
            "success": True,
            "message": "Account created successfully",
            "token": token,
            "user": user,
            "requires_verification": True
        }
    except ValueError as e:
        return JSONResponse({"success": False, "detail": str(e)}, status_code=400)
    except Exception:
        log.exception("Signup error")
        return JSONResponse({"success": False, "detail": "Failed to create account"}, status_code=500)


@app.post("/api/auth/signin")
@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def api_signin(request: Request, req: SignInRequest):
    """Authenticate user credentials and return session token."""
    try:
        user = authenticate_user(email=req.email, password=req.password)
        if not user:
            return JSONResponse({"success": False, "detail": "Invalid email or password"}, status_code=401)
        token = create_session(user["id"])
        return {
            "success": True,
            "message": "Signed in successfully",
            "token": token,
            "user": user,
        }
    except Exception:
        log.exception("Signin error")
        return JSONResponse({"success": False, "detail": "Sign in failed"}, status_code=500)



@app.get("/api/auth/me")
async def api_auth_me(request: Request):
    """Return currently authenticated user."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"authenticated": False}, status_code=401)
    return {"authenticated": True, "user": user}


@app.post("/api/auth/signout")
@app.post("/api/auth/logout")
async def api_signout(request: Request):
    """Invalidate session token on signout."""
    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif "token" in request.query_params:
        token = request.query_params["token"]

    if token:
        delete_session(token)
    return {"success": True, "message": "Signed out successfully"}

@app.post("/api/auth/signout-all")
async def api_signout_all(request: Request):
    """Invalidate all session tokens for the authenticated user."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"success": False, "detail": "Not authenticated"}, status_code=401)
        
    from backend.database import get_db
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_sessions WHERE user_id = ?", (user["id"],))
        conn.commit()
        
    # Clear session cache
    from backend.tools import _session_cache
    _session_cache.clear()
        
    return {"success": True, "message": "Signed out of all devices successfully"}


# ── Account Verification ─────────────────────────────────────
class VerifyOTPRequest(BaseModel):
    otp_code: str

@app.post("/api/auth/verify-otp")
async def api_verify_otp(request: Request, req: VerifyOTPRequest):
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"success": False, "detail": "Not authenticated"}, status_code=401)
        
    from backend.database import get_db
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT otp_code FROM users WHERE id = ?", (user["id"],))
        row = cursor.fetchone()
        
        if not row:
            return JSONResponse({"success": False, "detail": "User not found"}, status_code=404)
            
        stored_otp = row[0]
        if stored_otp and stored_otp == req.otp_code.strip():
            cursor.execute("UPDATE users SET is_verified = 1 WHERE id = ?", (user["id"],))
            conn.commit()
            
            # Clear cache to force next reload to get is_verified = 1
            from backend.tools import _session_cache
            _session_cache.clear()
            
            return {"success": True, "message": "Account verified successfully"}
        else:
            return JSONResponse({"success": False, "detail": "Invalid OTP"}, status_code=400)


# ── Password Reset ───────────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@app.post("/api/auth/forgot-password")
@limiter.limit("3/minute")
async def api_forgot_password(request: Request, req: ForgotPasswordRequest):
    """Request a password reset token. In production, this sends an email/WhatsApp with the reset link."""
    import secrets as _secrets

    from backend.database import get_db
    email = req.email.strip().lower()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        user_row = cursor.fetchone()
        if not user_row:
            # Don't reveal whether the email exists (timing-safe)
            return {"success": True, "message": "If an account with that email exists, a reset link has been sent."}
        
        user_id = user_row[0]
        reset_token = _secrets.token_urlsafe(32)
        expires_at = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
        
        # Store reset token in user_sessions with a special prefix
        cursor.execute(
            "INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (f"reset:{reset_token}", user_id, expires_at)
        )
        conn.commit()
    
    # TODO: Send reset_token via email or WhatsApp in production
    # For now, return it in the response for development/testing
    log.info("Password reset requested for %s (token: %s...)", email, reset_token[:8])
    return {
        "success": True,
        "message": "If an account with that email exists, a reset link has been sent.",
        "reset_token": reset_token,  # Remove in production — send via email/WhatsApp instead
    }


@app.post("/api/auth/reset-password")
@limiter.limit("5/minute")
async def api_reset_password(request: Request, req: ResetPasswordRequest):
    """Reset password using a valid reset token."""
    from backend.database import get_db
    
    if not req.new_password or len(req.new_password) < 6:
        return JSONResponse({"success": False, "detail": "Password must be at least 6 characters"}, status_code=400)
    
    prefixed_token = f"reset:{req.token}"
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT user_id, expires_at FROM user_sessions WHERE token = ?",
            (prefixed_token,)
        )
        row = cursor.fetchone()
        if not row:
            return JSONResponse({"success": False, "detail": "Invalid or expired reset token"}, status_code=400)
        
        try:
            expires_at = datetime.fromisoformat(row["expires_at"])
            if datetime.now(UTC) > expires_at:
                cursor.execute("DELETE FROM user_sessions WHERE token = ?", (prefixed_token,))
                conn.commit()
                return JSONResponse({"success": False, "detail": "Reset token has expired"}, status_code=400)
        except Exception:
            return JSONResponse({"success": False, "detail": "Invalid token format"}, status_code=400)
        
        user_id = row["user_id"]
        pw_hash, salt = hash_password(req.new_password)
        
        cursor.execute("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", (pw_hash, salt, user_id))
        # Delete the used reset token
        cursor.execute("DELETE FROM user_sessions WHERE token = ?", (prefixed_token,))
        # Invalidate all existing sessions for security
        cursor.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
        conn.commit()
    
    # Clear session cache entries for this user
    _session_cache.clear()
    
    log.info("Password reset completed for user_id=%s", user_id)
    return {"success": True, "message": "Password has been reset. Please sign in with your new password."}


class GoogleAuthRequest(BaseModel):
    credential: str

@app.post("/api/auth/google")
@limiter.limit("5/minute")
async def api_auth_google(request: Request, req: GoogleAuthRequest):
    """Google OAuth sign-in / sign-up."""
    try:
        token = req.credential
        client_id = os.environ.get("GOOGLE_CLIENT_ID")
        
        if client_id:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
        else:
            # Fallback for local testing without a Client ID
            from google.auth.jwt import decode
            idinfo = decode(token, verify=False)
            
        email = idinfo['email']
        name = idinfo.get('name', 'Doctor')
        
        from backend.database import get_db
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, is_verified FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            
            if row:
                user_id = row[0]
                if row[1] == 0:
                    cursor.execute("UPDATE users SET is_verified = 1 WHERE id = ?", (user_id,))
                conn.commit()
            else:
                user = create_user(
                    name=name,
                    email=email,
                    password="google_oauth_dummy",
                    role="doctor",
                    clinic_name=f"Dr. {name.split()[0]}'s Clinic",
                    phone=""
                )
                user_id = user["id"]
                # Auto verify google users
                cursor.execute("UPDATE users SET is_verified = 1 WHERE id = ?", (user_id,))
                conn.commit()
            
        session_token = create_session(user_id)
        log.info("Google Auth successful for user_id=%s", user_id)
        return {"success": True, "token": session_token}
    except Exception as e:
        log.error("Google Auth failed: %s", e)
        return JSONResponse({"success": False, "detail": str(e)}, status_code=400)


# ── Checkout & Subscription APIs ────────────────────────────
class CreateOrderRequest(BaseModel):
    plan_id: str = "pro"
    plan_name: str = "Professional Clinic"
    amount: int = 2999
    doctor_name: str
    clinic_name: str
    phone: str
    email: str = ""
    city: str = ""

class VerifyPaymentRequest(BaseModel):
    order_id: str
    transaction_ref: str = "DEMO-TXN"
    payment_method: str = "UPI"


@app.post("/api/checkout/create-order")
async def api_create_order(req: CreateOrderRequest):
    """Generate a subscription order and dynamic UPI payment details."""
    order = create_order(
        plan_id=req.plan_id,
        plan_name=req.plan_name,
        amount=req.amount,
        doctor_name=req.doctor_name,
        clinic_name=req.clinic_name,
        phone=req.phone,
        email=req.email,
        city=req.city,
    )
    return {"status": "success", "order": order}


@app.post("/api/checkout/verify-payment")
async def api_verify_payment(req: VerifyPaymentRequest):
    """Verify transaction reference or confirm demo payment and activate subscription."""
    updated = verify_order_payment(
        order_id=req.order_id,
        transaction_ref=req.transaction_ref,
        payment_method=req.payment_method,
    )
    if not updated:
        return JSONResponse({"status": "error", "message": "Order not found"}, status_code=404)
    return {"status": "success", "order": updated}

@app.get("/api/checkout/order/{order_id}/invoice")
async def api_download_invoice(order_id: str):
    """Download a PDF invoice for a paid subscription order."""
    from backend.database import get_db
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
        row = cursor.fetchone()
        
    if not row:
        return JSONResponse({"status": "error", "message": "Order not found"}, status_code=404)
        
    order = dict(row)
    if order.get("status") != "PAID":
        return JSONResponse({"status": "error", "message": "Invoice not available for unpaid orders"}, status_code=400)
        
    from backend.tools import generate_invoice_pdf
    pdf_bytes = generate_invoice_pdf(order)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"invoice-{order_id}.pdf\""
        }
    )


@app.get("/api/checkout/order/{order_id}")
async def api_get_order(order_id: str):
    """Retrieve an order by ID."""
    order = get_order_by_id(order_id)
    if not order:
        return JSONResponse({"status": "error", "message": "Order not found"}, status_code=404)
    return {"status": "success", "order": order}


# ── Doctor & Clinic Admin APIs ──────────────────────────────
@app.get("/api/admin/stats")
async def api_admin_stats(request: Request):
    """Clinic dashboard overview statistics."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    clinic_id = user.get("clinic_id")
    return get_admin_stats(clinic_id=clinic_id)


@app.get("/api/admin/appointments")
async def api_admin_appointments(request: Request, status: str = None, search: str = None, limit: int = 100):
    """Retrieve appointments with optional status filtering and search."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    clinic_id = user.get("clinic_id")
    appts = get_all_appointments(limit=limit, clinic_id=clinic_id)
    if status and status.upper() != "ALL":
        appts = [a for a in appts if a.get("status", "").upper() == status.upper()]
    if search:
        s = search.lower()
        appts = [
            a for a in appts
            if s in a.get("patient_name", "").lower()
            or s in a.get("phone", "").lower()
            or s in a.get("category", "").lower()
        ]
    return {"appointments": appts}


class UpdateStatusRequest(BaseModel):
    status: str


@app.patch("/api/admin/appointments/{appointment_id}/status")
async def api_update_status(appointment_id: int, req: UpdateStatusRequest):
    """Update appointment status (CONFIRMED, COMPLETED, CANCELLED)."""
    ok = update_appointment_status(appointment_id, req.status)
    if not ok:
        return JSONResponse({"status": "error", "message": "Failed to update status"}, status_code=400)
    return {"status": "success", "appointment_id": appointment_id, "new_status": req.status}


@app.get("/api/admin/call-logs")
async def api_admin_call_logs(request: Request, limit: int = 50):
    """Retrieve recent voice calls with full dialog transcripts."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    clinic_id = user.get("clinic_id")
    is_owner = user.get("role") in ("owner", "superadmin", "doctor")
    
    return {"call_logs": get_all_call_logs(limit=limit, clinic_id=clinic_id, mask_phone=not is_owner)}


@app.get("/api/admin/orders")
async def api_admin_orders(request: Request, limit: int = 100):
    """Retrieve clinic subscription orders."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
    clinic_id = user.get("clinic_id")
    return {"orders": get_all_orders(limit=limit, clinic_id=clinic_id)}


@app.get("/api/admin/active-calls")
async def api_active_calls(request: Request):
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    clinic_id = user.get("clinic_id")
    calls = []
    for sid, data in monitor.active_calls.items():
        if data["clinic_id"] == clinic_id or user.get("role") in ("owner", "superadmin"):
            calls.append({"session_id": sid, "caller": data["caller"], "channel_type": data["channel_type"], "status": data["status"]})
    return {"active_calls": calls}


@app.websocket("/ws/admin/monitor/{session_id}")
async def ws_monitor(websocket: WebSocket, session_id: str):
    await websocket.accept()
    if monitor.subscribe(session_id, websocket):
        try:
            while True:
                msg = await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            monitor.unsubscribe(session_id, websocket)
    else:
        await websocket.close(code=1008, reason="Call not found")


class SendWhatsAppRequest(BaseModel):
    phone: str
    message: str


@app.post("/api/admin/send-whatsapp")
async def api_admin_send_whatsapp(req: SendWhatsAppRequest):
    """Dispatch WhatsApp message using Twilio or return deep link."""
    import urllib.parse
    phone = req.phone
    message = req.message
    clean_phone = "".join(filter(str.isdigit, phone))
    if not clean_phone.startswith("91") and len(clean_phone) == 10:
        clean_phone = "91" + clean_phone
    
    wa_url = f"https://wa.me/{clean_phone}?text={urllib.parse.quote(message)}"
    
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_num = os.environ.get("TWILIO_WHATSAPP_NUMBER")
    sent_via_twilio = False
    
    if sid and token and from_num:
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            msg = client.messages.create(from_=from_num, body=message, to=f"whatsapp:+{clean_phone}")
            sent_via_twilio = True
            log.info(f"Twilio admin message sent: {msg.sid}")
        except Exception as e:
            log.error(f"Failed to send Twilio message: {e}")
            
    return {
        "status": "success",
        "sent_via_twilio": sent_via_twilio,
        "wa_url": wa_url,
        "phone": clean_phone,
    }


@app.get("/api/admin/export/appointments")
async def api_export_appointments():
    """Download all appointments as a CSV file for EHR / Excel import."""
    csv_data = export_appointments_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=swastik_appointments.csv"},
    )


@app.get("/api/admin/export/call-logs")
async def api_export_call_logs():
    """Download all call transcripts and metadata as a CSV file."""
    csv_data = export_call_logs_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=swastik_call_logs.csv"},
    )


# ── Outbound Calling ──────────────────────────────────────────
class OutboundCallRequest(BaseModel):
    to_phone: str
    clinic_id: str = "dr-sharma"
    prompt: str = ""

@app.post("/api/admin/outbound-call")
async def api_outbound_call(req: OutboundCallRequest):
    """Trigger an outbound call via Twilio REST API."""
    import os
    from twilio.rest import Client
    
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_phone = os.environ.get("TWILIO_PHONE_NUMBER")
    
    if not all([account_sid, auth_token, from_phone]):
        return JSONResponse({"status": "error", "message": "Twilio credentials not fully configured."}, status_code=500)
        
    try:
        client = Client(account_sid, auth_token)
        # Use our public URL for webhook
        public_url = get_setting("public_url", "https://swastik.ai")
        if "localhost" in public_url:
            return JSONResponse({"status": "error", "message": "Cannot make outbound calls with localhost public URL. Please configure Ngrok URL in settings."}, status_code=400)
            
        call = client.calls.create(
            to=req.to_phone,
            from_=from_phone,
            url=f"{public_url}/api/voice/incoming?clinic_id={req.clinic_id}",
            method="POST"
        )
        return {"status": "success", "call_sid": call.sid}
    except Exception as e:
        log.error(f"Failed to initiate outbound call: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


# ── Webhook & Automation Settings ───────────────────────────
class WebhookSettingsRequest(BaseModel):
    webhook_url: str

@app.get("/api/admin/settings/webhook")
async def api_get_webhook_settings():
    """Retrieve configured webhook dispatch URL."""
    url = get_setting("webhook_url", "")
    return {"webhook_url": url}

@app.post("/api/admin/settings/webhook")
async def api_save_webhook_settings(req: WebhookSettingsRequest):
    """Update configured webhook dispatch URL."""
    set_setting("webhook_url", req.webhook_url.strip())
    return {"status": "success", "webhook_url": req.webhook_url.strip()}

@app.post("/api/admin/settings/webhook/test")
async def api_test_webhook():
    """Send an immediate test webhook payload and report latency & HTTP status."""
    import time
    import urllib.request
    webhook_url = get_setting("webhook_url", "").strip()
    if not webhook_url:
        return JSONResponse({"status": "error", "message": "No webhook URL configured"}, status_code=400)

    test_payload = {
        "event": "test.ping",
        "timestamp": datetime.now(UTC).isoformat(),
        "source": "Swastik AI Voice Receptionist",
        "clinic": "Dr. Sharma's Clinic",
        "data": {
            "message": "Swastik AI test automation ping successful",
            "supported_events": ["appointment.booked", "call.completed"],
            "latency_test": True,
        }
    }

    t0 = time.time()
    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps(test_payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "SwastikAI-WebhookTest/1.0"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            elapsed_ms = int((time.time() - t0) * 1000)
            return {
                "status": "success",
                "status_code": resp.status,
                "response_time_ms": elapsed_ms,
                "message": f"Webhook acknowledged with HTTP {resp.status} in {elapsed_ms}ms",
            }
    except Exception as e:
        elapsed_ms = int((time.time() - t0) * 1000)
        return JSONResponse({
            "status": "error",
            "response_time_ms": elapsed_ms,
            "message": f"Webhook failed: {e!s}",
        }, status_code=502)


# ── Clinic Profile & Channels ───────────────────────────────
# ── Old mock clinic profile route removed ──

@app.get("/api/admin/channels")
async def api_get_channels(request: Request):
    from backend.database import get_db
    session_token = request.cookies.get("session_token")
    user = get_user_by_session_token(session_token) if session_token else None
    clinic_id = user["clinic_id"] if user else "dr-sharma"
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT channel_type, identifier, is_active
                FROM clinic_channels
                WHERE clinic_id = ?
            """, (clinic_id,))
            rows = cursor.fetchall()
            
            channels = {
                "smart_link_url": f"/voice/{clinic_id}", # fallback
                "widget_embed_code": f"<script src=\"https://voice.swastik.ai/widget.js\" data-clinic-id=\"{clinic_id}\"></script>"
            }
            
            for row in rows:
                if row["channel_type"] == "smart_link":
                    channels["smart_link_url"] = f"/voice/{row['identifier']}"
                elif row["channel_type"] == "widget":
                    channels["widget_embed_code"] = f"<script src=\"https://voice.swastik.ai/widget.js\" data-clinic-id=\"{row['identifier']}\"></script>"
            
            return channels
    except Exception as e:
        log.error("Failed to fetch channels: %s", e)
        return JSONResponse({"error": "Failed to load channels"}, status_code=500)


# ── Doctor-Configurable Red-Flag Phrases ───────────────────
class RedFlagsUpdateRequest(BaseModel):
    phrases: list[str]

class RedFlagsCheckRequest(BaseModel):
    text: str

@app.get("/api/admin/red-flags")
async def api_get_red_flags():
    """Retrieve the doctor's active list of emergency red-flag phrases."""
    phrases = get_red_flag_phrases()
    return {"status": "success", "count": len(phrases), "phrases": phrases}

@app.post("/api/admin/red-flags")
async def api_save_red_flags(req: RedFlagsUpdateRequest):
    """Update the doctor's active list of emergency red-flag phrases."""
    ok = set_red_flag_phrases(req.phrases)
    if not ok:
        return JSONResponse({"status": "error", "message": "Failed to update red-flag phrases"}, status_code=500)
    return {"status": "success", "count": len(req.phrases), "phrases": req.phrases}

@app.post("/api/admin/red-flags/check")
async def api_check_red_flags(req: RedFlagsCheckRequest):
    """Test a text utterance against the doctor's red-flag safety rules."""
    matched, phrase = check_red_flags(req.text)
    return {
        "status": "success",
        "is_emergency": matched,
        "matched_phrase": phrase,
        "action": "ESCALATE_112" if matched else "PROCEED_CLINIC",
        "emergency_number": "112" if matched else None,
        "message": (
            "This sounds like an emergency. Please call 112 or go to the nearest casualty immediately. Do not wait for a clinic appointment."
            if matched else "Proceed with standard clinic consultation flow."
        ),
    }


# ── Audio Voice Memo Endpoint ───────────────────────────────
@app.get("/api/audio/memo/{session_id}")
async def api_get_audio_memo(session_id: str):
    """
    Serve voice intake recording / synthesized clinical audio memo for playback in doctor dashboard.
    Generates a valid 16kHz WAV consultation recording.
    """
    import io
    import math
    import struct
    import wave
    from pathlib import Path

    memos_dir = Path(__file__).resolve().parent / "memos"
    memo_path = memos_dir / f"{session_id}.wav"
    
    if memo_path.exists():
        with open(memo_path, "rb") as f:
            content = f.read()
        return Response(
            content=content,
            media_type="audio/wav",
            headers={
                "Content-Disposition": f"inline; filename=intake_memo_{session_id}.wav",
                "Cache-Control": "public, max-age=3600",
            }
        )

    # Fallback: Synthetic chime if recording not found
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav_file:
        wav_file.setnchannels(1)       # Mono
        wav_file.setsampwidth(2)       # 16-bit
        wav_file.setframerate(16000)   # 16kHz
        
        sample_rate = 16000
        duration = 3.5  # 3.5 seconds
        total_samples = int(sample_rate * duration)
        raw_data = bytearray()
        
        # Synthesize a warm, professional clinic intake tone sequence
        for i in range(total_samples):
            t = float(i) / sample_rate
            # Harmonic chime progression
            if t < 1.0:
                freq = 523.25  # C5
            elif t < 2.0:
                freq = 659.25  # E5
            else:
                freq = 783.99  # G5
                
            envelope = math.exp(-2.5 * (t % 1.0))
            val = int(32767.0 * 0.35 * envelope * math.sin(2.0 * math.pi * freq * t))
            raw_data.extend(struct.pack('<h', max(-32768, min(32767, val))))
            
        wav_file.writeframes(raw_data)

    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"inline; filename=intake_memo_{session_id}.wav",
            "Cache-Control": "public, max-age=3600",
        }
    )


# ── Error Handlers & SPA Fallback ───────────────────────────
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """SPA fallback for client-side routing, or custom 404."""
    if request.url.path.startswith("/api") or request.url.path.startswith("/ws"):
        return JSONResponse({"error": "Not found"}, status_code=404)
    
    # SPA Fallback for client-side routes (e.g. /checkout, /buy)
    dist_index = FRONTEND_DIST / "index.html"
    if dist_index.exists():
        return FileResponse(str(dist_index))

    return HTMLResponse(
        content="""
        <!DOCTYPE html>
        <html><head><title>404 — Swastik AI</title>
        <style>
            body { background: #04070C; color: #F8FAFC; font-family: 'Plus Jakarta Sans', sans-serif;
                   display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { text-align: center; }
            h1 { font-size: 4rem; color: #14C8B2; margin: 0; }
            p { color: #94A3B8; margin-top: 0.5rem; }
            a { color: #F5A623; text-decoration: none; }
        </style></head>
        <body><div class="box">
            <h1>404</h1>
            <p>This page doesn't exist.</p>
            <a href="/">← Go Home</a>
        </div></body></html>
        """,
        status_code=404,
    )


@app.get("/api/clinics/{clinic_id}")
def get_clinic_info_api(clinic_id: str):
    from backend.database import get_db
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.name, c.theme_color, c.slug,
                       p.doctor_name, p.greeting, p.services, p.consultation_fee
                FROM clinics c
                LEFT JOIN clinic_profile p ON p.clinic_id = c.id
                WHERE c.id = ?
            """, (clinic_id,))
            row = cursor.fetchone()
            if row:
                return {
                    "id": clinic_id,
                    "name": row[0],
                    "themeColor": row[1],
                    "slug": row[2],
                    "doctorName": row[3],
                    "greeting": row[4],
                    "fee": row[6] or "₹499",
                }
            else:
                return JSONResponse({"error": "Clinic not found"}, status_code=404)
    except Exception:
        return JSONResponse({"error": "Database error"}, status_code=500)


@app.get("/api/voice/{slug}")
def get_clinic_by_slug(slug: str):
    """Resolve a clinic by its smart-link slug for the landing page."""
    from backend.database import get_db
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.id, c.name, c.theme_color, c.slug,
                       p.doctor_name, p.greeting, p.services, p.consultation_fee, p.address
                FROM clinics c
                LEFT JOIN clinic_profile p ON p.clinic_id = c.id
                WHERE c.slug = ? AND c.status = 'active'
            """, (slug,))
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "name": row[1],
                    "themeColor": row[2],
                    "slug": row[3],
                    "doctorName": row[4],
                    "greeting": row[5],
                    "services": row[6],
                    "fee": row[7] or "₹499",
                    "address": row[8],
                }
            else:
                return JSONResponse({"error": "Clinic not found"}, status_code=404)
    except Exception:
        return JSONResponse({"error": "Database error"}, status_code=500)


# ── Clinic Profile Admin APIs ────────────────────────────────
class ClinicProfileUpdate(BaseModel):
    greeting: str = None
    services: str = None
    working_hours: str = None
    address: str = None
    booking_rules: str = None
    escalation_number: str = None
    custom_instructions: str = None
    doctor_name: str = None
    consultation_fee: str = None


@app.get("/api/admin/clinic-profile")
async def api_get_clinic_profile(request: Request):
    """Get the full editable profile for the authenticated clinic."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    clinic_id = user.get("clinic_id")
    if not clinic_id:
        return JSONResponse({"error": "No clinic associated"}, status_code=404)

    from backend.database import get_db
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.id, c.name, c.slug, c.theme_color, c.timezone, c.languages,
                   c.voice_persona, c.plan_id,
                   p.greeting, p.services, p.working_hours, p.address,
                   p.booking_rules, p.escalation_number, p.custom_instructions,
                   p.doctor_name, p.consultation_fee
            FROM clinics c
            LEFT JOIN clinic_profile p ON p.clinic_id = c.id
            WHERE c.id = ?
        """, (clinic_id,))
        row = cursor.fetchone()
        if not row:
            return JSONResponse({"error": "Clinic not found"}, status_code=404)
        return {"profile": dict(row.items()) if hasattr(row, 'items') else dict(row)}


@app.put("/api/admin/clinic-profile")
async def api_update_clinic_profile(request: Request, body: ClinicProfileUpdate):
    """Update clinic profile fields. Busts tenant cache."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    clinic_id = user.get("clinic_id")
    if not clinic_id:
        return JSONResponse({"error": "No clinic associated"}, status_code=404)

    from backend.database import get_db
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"status": "no changes"}

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [clinic_id]

    with get_db() as conn:
        conn.execute(
            f"UPDATE clinic_profile SET {set_clause} WHERE clinic_id = ?",
            tuple(values)
        )
        conn.commit()

    bust_cache(clinic_id)
    return {"status": "updated", "fields": list(updates.keys())}


@app.get("/api/admin/channels")
async def api_get_channels(request: Request):
    """Get all channels for the authenticated clinic."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    clinic_id = user.get("clinic_id")
    if not clinic_id:
        return JSONResponse({"error": "No clinic associated"}, status_code=404)

    from backend.database import get_db
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, channel_type, identifier, is_active, provider
            FROM clinic_channels WHERE clinic_id = ?
        """, (clinic_id,))
        rows = cursor.fetchall()

        # Also get the slug for smart link URL
        cursor.execute("SELECT slug FROM clinics WHERE id = ?", (clinic_id,))
        slug_row = cursor.fetchone()
        slug = slug_row[0] if slug_row else clinic_id

    channels = [dict(r.items()) if hasattr(r, 'items') else dict(r) for r in rows]
    return {
        "channels": channels,
        "slug": slug,
        "clinic_id": clinic_id,
        "widget_embed_code": f'<script src="https://cdn.swastik.ai/widget.js" data-clinic-id="{clinic_id}"></script>',
        "smart_link_url": f"/voice/{slug}",
    }


@app.post("/api/admin/channels/{channel_id}/toggle")
async def api_toggle_channel(request: Request, channel_id: int):
    """Enable or disable a channel."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    clinic_id = user.get("clinic_id")
    if not clinic_id:
        return JSONResponse({"error": "No clinic associated"}, status_code=404)

    from backend.database import get_db
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE clinic_channels SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
            WHERE id = ? AND clinic_id = ?
        """, (channel_id, clinic_id))
        conn.commit()

    bust_cache(clinic_id)
    return {"status": "toggled"}


@app.get("/api/admin/usage")
async def api_get_usage(request: Request):
    """Get current month's usage for the authenticated clinic."""
    user = await _get_authenticated_user(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    clinic_id = user.get("clinic_id")
    if not clinic_id:
        return JSONResponse({"error": "No clinic associated"}, status_code=404)

    usage = get_monthly_usage(clinic_id)
    return {"usage": usage}


async def _get_authenticated_user(request: Request) -> dict | None:
    """Extract authenticated user from Bearer token, including clinic_id."""
    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif "token" in request.query_params:
        token = request.query_params["token"]
    if not token:
        return None

    user = get_user_by_session_token(token)
    if not user:
        return None

    # Attach clinic_id
    from backend.database import get_db
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM clinics WHERE owner_user_id = ?", (user["id"],))
            clinic_row = cursor.fetchone()
            if clinic_row:
                user = dict(user)
                user["clinic_id"] = clinic_row[0]
    except Exception:
        pass
    return user

@app.exception_handler(500)
async def server_error_handler(request: Request, exc):
    """Custom 500 page."""
    log.exception("Internal server error: %s", exc)
    return JSONResponse({"error": "Internal server error"}, status_code=500)


@app.websocket("/ws/link/{slug}")
async def ws_smart_link(websocket: WebSocket, slug: str):
    """Smart-link WebSocket: resolve clinic by slug."""
    await websocket.accept()
    try:
        clinic = await resolve_clinic("smart_link", slug)
    except ClinicNotFoundError:
        log.warning("Smart link ws for unknown slug %s, closing", slug)
        await websocket.close(code=1008, reason="Unknown clinic")
        return
    await _run_voice_session(websocket, clinic, channel_type="smart_link")


@app.websocket("/ws/{clinic_id}")
async def ws(websocket: WebSocket, clinic_id: str):
    """Widget WebSocket: resolve clinic by ID (primary entry point)."""
    await websocket.accept()
    try:
        clinic = await resolve_clinic("widget", clinic_id)
    except ClinicNotFoundError:
        log.warning("ws connected for unknown clinic_id %s, closing", clinic_id)
        await websocket.close(code=1008, reason="Unknown clinic")
        return
    await _run_voice_session(websocket, clinic, channel_type="widget")


async def _run_voice_session(websocket: WebSocket, clinic: dict, channel_type: str = "widget"):
    """Shared voice session handler used by all entry points."""
    clinic_id = clinic.get("id", "unknown")
    
    from backend.usage_meter import check_plan_limit
    if not check_plan_limit(clinic_id):
        log.warning("Clinic %s has exceeded usage limit. Closing WS.", clinic_id)
        try:
            await websocket.send_text(json.dumps({
                "type": "error", 
                "message": "Usage limit exceeded. Please contact support."
            }))
            await websocket.close(code=1008, reason="Usage limit exceeded")
        except:
            pass
        return

    clinic_name = clinic.get("name", "Unknown Clinic")
    log.info("Opening Live session for %s (clinic=%s, channel=%s, model=%s, voice=%s)",
             clinic_name, clinic_id, channel_type, MODEL, VOICE)

    # Build system instruction from structured profile (or fallback to raw prompt)
    system_prompt = build_system_instructions(clinic)

    live_config = {
        "response_modalities": ["AUDIO"],
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "input_audio_transcription": {},
        "output_audio_transcription": {},
        "speech_config": {"voice_config": {"prebuilt_voice_config": {"voice_name": VOICE}}},
        "tools": [{"function_declarations": TOOL_DECLARATIONS}],
    }

    import time
    import uuid
    session_id = f"SES-{uuid.uuid4().hex[:8].upper()}"
    start_time = time.time()
    caller_info = {"name": "Anonymous Caller", "phone": ""}
    session_turns = []
    audio_chunks = bytearray()
    monitor.start_call(session_id, clinic_id, caller_info["name"], channel_type)
    
    telemetry_stats = {"snr_sum": 0.0, "erle_sum": 0.0, "count": 0}

    try:
        ai_client = get_genai_client()
        async with ai_client.aio.live.connect(model=MODEL, config=live_config) as session:
            log.info("Live session open for Swastik AI (session_id=%s)", session_id)

            async def upstream():
                while True:
                    try:
                        msg = await asyncio.wait_for(websocket.receive(), timeout=300.0)
                    except TimeoutError:
                        log.warning("upstream: no input for 5 minutes, closing session due to inactivity")
                        return
                        
                    if msg.get("type") == "websocket.disconnect":
                        log.info("upstream: browser disconnected")
                        return
                    
                    text_data = msg.get("text")
                    if text_data:
                        try:
                            data = json.loads(text_data)
                            if data.get("type") == "noise_alert":
                                log.warning(f"upstream: noise alert received, snr={data.get('snr')}")
                                await session.send(
                                    input="SYSTEM (Not the user): The caller's environment is very noisy. Politely ask them to move somewhere quieter or speak closer to the microphone. Keep it brief.",
                                    end_of_turn=True
                                )
                            elif data.get("type") == "audio_telemetry":
                                telemetry_stats["snr_sum"] += float(data.get("snr", 0))
                                telemetry_stats["erle_sum"] += float(data.get("erle", 0))
                                telemetry_stats["count"] += 1
                        except Exception as e:
                            log.error(f"upstream: failed to process text message: {e}")

                    raw = msg.get("bytes")
                    if raw:
                        await session.send_realtime_input(
                            audio=types.Blob(data=raw, mime_type="audio/pcm;rate=16000"))
                        await monitor.broadcast_audio(session_id, raw, "user", 16000)

            async def handle(response):
                sc = getattr(response, "server_content", None)
                tc = getattr(response, "tool_call", None)
                if sc is not None:
                    it = getattr(sc, "input_transcription", None)
                    ot = getattr(sc, "output_transcription", None)
                    mt = getattr(sc, "model_turn", None)
                    if it and getattr(it, "text", None):
                        session_turns.append({
                            "role": "user",
                            "text": it.text,
                            "time": round(time.time() - start_time, 1),
                        })
                        await websocket.send_text(json.dumps({"type": "transcript", "role": "user", "text": it.text}))
                        await monitor.broadcast_transcript(session_id, "user", it.text)
                    if ot and getattr(ot, "text", None):
                        session_turns.append({
                            "role": "swastik",
                            "text": ot.text,
                            "time": round(time.time() - start_time, 1),
                        })
                        await websocket.send_text(json.dumps({"type": "transcript", "role": "swastik", "text": ot.text}))
                        await monitor.broadcast_transcript(session_id, "swastik", ot.text)
                    if mt and getattr(mt, "parts", None):
                        for part in mt.parts:
                            idata = getattr(part, "inline_data", None)
                            if idata and getattr(idata, "data", None):
                                audio_chunks.extend(idata.data)
                                await websocket.send_bytes(idata.data)  # 24k voice
                                await monitor.broadcast_audio(session_id, idata.data, "agent", 24000)
                    if getattr(sc, "interrupted", None):
                        await websocket.send_text(json.dumps({"type": "interrupted"}))
                if tc:
                    results = []
                    for fc in tc.function_calls:
                        args = dict(getattr(fc, "args", None) or {})
                        if args.get("patient_name"):
                            caller_info["name"] = args.get("patient_name")
                        if args.get("phone"):
                            caller_info["phone"] = args.get("phone")

                        # Telemetry: notify frontend that background tool execution started
                        await websocket.send_text(json.dumps({
                            "type": "background_tool_start",
                            "name": fc.name
                        }))

                        cmd, result = dispatch_tool(fc.name, args)
                        if cmd:
                            await websocket.send_text(json.dumps({"type": "tool_action", **cmd}))

                        # Telemetry: notify frontend that background tool execution finished
                        await websocket.send_text(json.dumps({
                            "type": "background_tool_end",
                            "name": fc.name
                        }))

                        results.append(types.FunctionResponse(id=fc.id, name=fc.name, response=result))
                    await session.send_tool_response(function_responses=results)

            async def downstream():
                while True:
                    try:
                        async for response in session.receive():
                            await handle(response)
                    except asyncio.CancelledError:
                        return
                    except Exception:
                        log.exception("downstream: receive() raised — ending")
                        return
                    # Short pause between turns so CPU doesn't spin
                    await asyncio.sleep(0.01)

            up = asyncio.create_task(upstream(), name="upstream")
            down = asyncio.create_task(downstream(), name="downstream")
            done, pending = await asyncio.wait({up, down}, return_when=asyncio.FIRST_COMPLETED)
            for t in done:
                exc = t.exception()
                if exc:
                    log.exception("%s task FAILED: %r", t.get_name(), exc, exc_info=exc)
                    try:
                        await websocket.send_text(json.dumps({"type": "error", "message": f"{type(exc).__name__}: {exc}"}))
                    except Exception:
                        pass
                else:
                    log.info("%s task ended -> tearing down", t.get_name())
            for t in pending:
                t.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
    except WebSocketDisconnect:
        log.info("ws disconnected")
    except Exception as e:
        log.exception("ws handler error")
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": f"{type(e).__name__}: {e}"}))
        except Exception:
            pass
    finally:
        monitor.end_call(session_id)
        import wave
        from pathlib import Path
        
        # Save actual session audio
        memos_dir = Path(__file__).resolve().parent / "memos"
        memos_dir.mkdir(exist_ok=True)
        if audio_chunks:
            memo_path = memos_dir / f"{session_id}.wav"
            try:
                with wave.open(str(memo_path), 'wb') as wav_file:
                    wav_file.setnchannels(1)
                    wav_file.setsampwidth(2)
                    wav_file.setframerate(24000) # Gemini outputs 24kHz
                    wav_file.writeframes(audio_chunks)
            except Exception as e:
                log.error(f"Failed to save audio memo: {e}")

        duration = max(1, int(time.time() - start_time))
        avg_snr = round(telemetry_stats["snr_sum"] / telemetry_stats["count"], 2) if telemetry_stats["count"] > 0 else 0.0
        avg_erle = round(telemetry_stats["erle_sum"] / telemetry_stats["count"], 2) if telemetry_stats["count"] > 0 else 0.0

        # Record usage for billing
        record_call_usage(clinic_id, duration, channel_type)

        if session_turns:
            triage = extract_clinical_summary(session_turns)
            audio_url = f"/api/audio/memo/{session_id}"
            save_call_log(
                clinic_id=clinic_id,
                session_id=session_id,
                caller_name=caller_info["name"],
                phone=caller_info["phone"],
                duration_seconds=duration,
                summary=f"{len(session_turns)} turn conversation with Swastik AI",
                transcript_list=session_turns,
                chief_complaint=triage.get("chief_complaint", "General Health Consultation"),
                urgency_level=triage.get("urgency_level", "Routine"),
                action_items=triage.get("action_items", ""),
                outcome=triage.get("outcome", "Unclassified"),
                audio_url=audio_url,
                avg_snr=avg_snr,
                avg_erle=avg_erle
            )
            dispatch_webhook("call.completed", {
                "session_id": session_id,
                "caller_name": caller_info["name"],
                "phone": caller_info["phone"],
                "duration_seconds": duration,
                "chief_complaint": triage.get("chief_complaint", ""),
                "urgency_level": triage.get("urgency_level", "Routine"),
                "action_items": triage.get("action_items", ""),
                "turns_count": len(session_turns),
                "audio_url": audio_url,
                "completed_at": datetime.now(UTC).isoformat(),
            })
    log.info("ws closed (session_id=%s, channel=%s)", session_id, channel_type)


@app.post("/upload-receipt")
async def upload_receipt(file: UploadFile = File(...)):
    """Accept a payment screenshot, verify it with Gemini Vision."""
    import base64

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10 MB limit
        return JSONResponse({"verified": False, "reason": "File too large (max 10 MB)"}, status_code=400)

    b64 = base64.b64encode(contents).decode("utf-8")
    mime = file.content_type or "image/png"

    upi_id = os.getenv("UPI_ID", "6387831138-2@ibl")
    payee_name = os.getenv("UPI_PAYEE_NAME", "Dr Sharma")

    verification_prompt = f"""You are a payment receipt verification assistant.
Analyze this UPI payment screenshot and extract the following details:
1. Transaction status (Success / Failed / Pending)
2. Amount paid (in INR)
3. Payee name or UPI ID
4. UPI Transaction Reference Number (UTR / Ref ID) if visible
5. Date and time of transaction if visible

The expected payment is:
- Amount: ₹499
- Accepted Payee UPI IDs / Names: {upi_id}, priyanshu@upi, {payee_name}, Priyanshu

Respond ONLY in this exact JSON format, no extra text:
{{{{
  "verified": true or false,
  "status": "Success" or "Failed" or "Pending" or "Unreadable",
  "amount": "extracted amount or null",
  "payee": "extracted payee name/UPI ID or null",
  "utr": "extracted UTR/reference number or null",
  "timestamp": "extracted date-time or null",
  "reason": "brief explanation of verification result"
}}}}

Set verified=true ONLY if:
- Status is "Success"
- Amount is ₹499 (or very close, e.g. 499.00)
- Payee matches any of "{payee_name}", "{upi_id}", "priyanshu@upi", or "Priyanshu" (partial match is OK)
"""

    try:
        ai_client = get_genai_client()
        response = ai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=contents, mime_type=mime),
                verification_prompt,
            ],
        )
        raw_text = response.text.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]  # remove first line
            raw_text = raw_text.removesuffix("```")
            raw_text = raw_text.strip()

        import json as json_mod
        result = json_mod.loads(raw_text)
        log.info(f"Receipt verification result: {result}")
        return JSONResponse(result)
    except Exception as e:
        log.exception("Receipt verification failed")
        return JSONResponse(
            {"verified": False, "reason": f"Verification error: {e!s}"},
            status_code=500,
        )


if FRONTEND_DIST.exists():
    log.info("Serving unified production frontend from %s", FRONTEND_DIST)
    if (FRONTEND_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="dist-assets")
    if (FRONTEND_DIST / "console").exists():
        app.mount("/console", StaticFiles(directory=str(FRONTEND_DIST / "console"), html=True), name="dist-console")
    if (FRONTEND_DIST / "icons").exists():
        app.mount("/icons", StaticFiles(directory=str(FRONTEND_DIST / "icons")), name="dist-icons")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_spa(full_path: str):
        if not full_path or full_path.strip("/") == "":
            index_path = FRONTEND_DIST / "index.html"
            if index_path.exists():
                return FileResponse(index_path)
            return JSONResponse({"detail": "Not Found"}, status_code=404)

        if full_path in ("console", "console/"):
            return RedirectResponse(url="/console/", status_code=307)
        # 1. Exact file match in dist (e.g. pcm-processor.js, favicon.svg, swastik-logo.png)
        target = FRONTEND_DIST / full_path
        if target.is_file():
            return FileResponse(target)
        if target.is_dir() and (target / "index.html").is_file():
            clean_path = full_path.strip("/")
            return RedirectResponse(url=f"/{clean_path}/", status_code=307)
        # 2. SPA fallback for client-side routes (/admin, /dashboard, /checkout, /buy, etc.)
        index_path = FRONTEND_DIST / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return JSONResponse({"detail": "Not Found"}, status_code=404)
elif FRONTEND.exists():
    log.info("Serving raw development frontend from %s", FRONTEND)
    if ASSETS.exists():
        app.mount("/assets", StaticFiles(directory=str(ASSETS)), name="assets")
    app.mount("/", StaticFiles(directory=str(FRONTEND), html=True), name="frontend")
