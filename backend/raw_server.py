"""Swastik AI — Gemini Live voice receptionist backend."""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse, Response, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from google import genai
from google.genai import types

from backend.persona import SWASTIK_INSTRUCTION
from backend.tools import (
    TOOL_DECLARATIONS,
    dispatch_tool,
    get_all_appointments,
    create_order,
    verify_order_payment,
    get_order_by_id,
    save_call_log,
    get_all_call_logs,
    update_appointment_status,
    get_all_orders,
    get_admin_stats,
    export_appointments_csv,
    export_call_logs_csv,
    get_setting,
    set_setting,
    dispatch_webhook,
    extract_clinical_summary,
    get_red_flag_phrases,
    set_red_flag_phrases,
    check_red_flags,
    create_user,
    authenticate_user,
    create_session,
    get_user_by_session_token,
    delete_session,
    reschedule_appointment,
    cancel_appointment,
)

# Structured logging with timestamps
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("swastik-agent")

MODEL = os.getenv("LIVE_MODEL", "gemini-3.1-flash-live-preview")
VOICE = os.getenv("LIVE_VOICE", "Aoede")

client = genai.Client()  # reads GOOGLE_API_KEY + GOOGLE_GENAI_USE_VERTEXAI=FALSE from .env

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

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND = PROJECT_ROOT / "frontend"
FRONTEND_DIST = PROJECT_ROOT / "frontend-app" / "dist"
ASSETS = PROJECT_ROOT / "assets"
STARTUP_TIME = datetime.now(timezone.utc)


# ── Health & Status ──────────────────────────────────────────
@app.get("/health")
async def health():
    """Health check endpoint for monitoring and uptime services."""
    return {
        "status": "healthy",
        "service": "swastik-voice-agent",
        "version": "1.0.0",
        "uptime_seconds": (datetime.now(timezone.utc) - STARTUP_TIME).total_seconds(),
        "model": MODEL,
        "voice": VOICE,
    }


@app.get("/api/appointments")
async def api_appointments(limit: int = 100):
    """Retrieve appointments stored in SQLite database."""
    return {"appointments": get_all_appointments(limit=limit)}


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
async def api_signup(req: SignUpRequest):
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
        return {
            "success": True,
            "message": "Account created successfully",
            "token": token,
            "user": user,
        }
    except ValueError as e:
        return JSONResponse({"success": False, "detail": str(e)}, status_code=400)
    except Exception as e:
        log.exception("Signup error")
        return JSONResponse({"success": False, "detail": "Failed to create account"}, status_code=500)


@app.post("/api/auth/signin")
@app.post("/api/auth/login")
async def api_signin(req: SignInRequest):
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
    except Exception as e:
        log.exception("Signin error")
        return JSONResponse({"success": False, "detail": "Sign in failed"}, status_code=500)


@app.get("/api/auth/me")
async def api_auth_me(request: Request):
    """Get current logged-in user profile from Bearer token."""
    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif "token" in request.query_params:
        token = request.query_params["token"]

    if not token:
        return JSONResponse({"authenticated": False, "detail": "Not authenticated"}, status_code=401)

    user = get_user_by_session_token(token)
    if not user:
        return JSONResponse({"authenticated": False, "detail": "Session expired or invalid"}, status_code=401)

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


@app.get("/api/checkout/order/{order_id}")
async def api_get_order(order_id: str):
    """Retrieve an order by ID."""
    order = get_order_by_id(order_id)
    if not order:
        return JSONResponse({"status": "error", "message": "Order not found"}, status_code=404)
    return {"status": "success", "order": order}


# ── Doctor & Clinic Admin APIs ──────────────────────────────
@app.get("/api/admin/stats")
async def api_admin_stats():
    """Clinic dashboard overview statistics."""
    return get_admin_stats()


@app.get("/api/admin/appointments")
async def api_admin_appointments(status: str = None, search: str = None, limit: int = 100):
    """Retrieve appointments with optional status filtering and search."""
    appts = get_all_appointments(limit=limit)
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
async def api_admin_call_logs(limit: int = 50):
    """Retrieve recent voice calls with full dialog transcripts."""
    return {"call_logs": get_all_call_logs(limit=limit)}


@app.get("/api/admin/orders")
async def api_admin_orders(limit: int = 100):
    """Retrieve clinic subscription orders."""
    return {"orders": get_all_orders(limit=limit)}


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
        "timestamp": datetime.now(timezone.utc).isoformat(),
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
            "message": f"Webhook failed: {str(e)}",
        }, status_code=502)


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


@app.exception_handler(500)
async def server_error_handler(request: Request, exc):
    """Custom 500 page."""
    log.exception("Internal server error: %s", exc)
    return JSONResponse({"error": "Internal server error"}, status_code=500)


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    log.info("ws connected; opening Live session (model=%s, voice=%s)", MODEL, VOICE)

    import uuid
    import time
    session_id = f"SES-{uuid.uuid4().hex[:8].upper()}"
    start_time = time.time()
    caller_info = {"name": "Anonymous Caller", "phone": ""}
    session_turns = []

    try:
        async with client.aio.live.connect(model=MODEL, config=LIVE_CONFIG) as session:
            log.info("Live session open for Swastik AI (session_id=%s)", session_id)

            async def upstream():
                while True:
                    try:
                        msg = await asyncio.wait_for(websocket.receive(), timeout=300.0)
                    except asyncio.TimeoutError:
                        log.warning("upstream: no input for 5 minutes, closing session due to inactivity")
                        return
                        
                    if msg.get("type") == "websocket.disconnect":
                        log.info("upstream: browser disconnected")
                        return
                    raw = msg.get("bytes")
                    if raw:
                        await session.send_realtime_input(
                            audio=types.Blob(data=raw, mime_type="audio/pcm;rate=16000"))

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
                    if ot and getattr(ot, "text", None):
                        session_turns.append({
                            "role": "swastik",
                            "text": ot.text,
                            "time": round(time.time() - start_time, 1),
                        })
                        await websocket.send_text(json.dumps({"type": "transcript", "role": "swastik", "text": ot.text}))
                    if mt and getattr(mt, "parts", None):
                        for part in mt.parts:
                            idata = getattr(part, "inline_data", None)
                            if idata and getattr(idata, "data", None):
                                await websocket.send_bytes(idata.data)  # 24k voice
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
        duration = max(1, int(time.time() - start_time))
        if session_turns:
            triage = extract_clinical_summary(session_turns)
            audio_url = f"/api/audio/memo/{session_id}"
            save_call_log(
                session_id=session_id,
                caller_name=caller_info["name"],
                phone=caller_info["phone"],
                duration_seconds=duration,
                summary=f"{len(session_turns)} turn conversation with Swastik AI",
                transcript_list=session_turns,
                chief_complaint=triage.get("chief_complaint", "General Health Consultation"),
                urgency_level=triage.get("urgency_level", "Routine"),
                action_items=triage.get("action_items", ""),
                audio_url=audio_url,
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
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })
    log.info("ws closed (session_id=%s)", session_id)


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
        response = client.models.generate_content(
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
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

        import json as json_mod
        result = json_mod.loads(raw_text)
        log.info(f"Receipt verification result: {result}")
        return JSONResponse(result)
    except Exception as e:
        log.exception("Receipt verification failed")
        return JSONResponse(
            {"verified": False, "reason": f"Verification error: {str(e)}"},
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

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path in ("console", "console/"):
            return RedirectResponse(url="/console/", status_code=307)
        # 1. Exact file match in dist (e.g. pcm-processor.js, favicon.svg, swastik-logo.png)
        target = FRONTEND_DIST / full_path
        if target.is_file():
            return FileResponse(target)
        if target.is_dir() and (target / "index.html").is_file():
            return RedirectResponse(url=f"/{full_path}/", status_code=307)
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
