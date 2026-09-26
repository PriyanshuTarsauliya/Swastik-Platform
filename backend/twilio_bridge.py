import asyncio
import base64
import json
import logging
import os
import time

from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect
from google.genai import types

from backend import audio_utils as audioop
from backend.prompt_builder import build_system_instructions
from backend.raw_server import MODEL, VOICE, client
from backend.tenant_resolver import ClinicNotFoundError, resolve_clinic
from backend.tools import TOOL_DECLARATIONS, dispatch_tool, extract_clinical_summary, dispatch_webhook, save_call_log
from backend.usage_meter import record_call_usage
from backend.call_monitor import monitor

log = logging.getLogger("swastik-twilio")
router = APIRouter()

@router.post("/api/voice/incoming")
async def twilio_incoming_voice(request: Request):
    """
    Twilio webhook for incoming calls.
    Returns TwiML to connect the call to our Media Stream WebSocket.
    """
    form_data = await request.form()

    # ── Twilio Signature Validation ──────────────────────────
    twilio_auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    if twilio_auth_token:
        try:
            from twilio.request_validator import RequestValidator
            validator = RequestValidator(twilio_auth_token)
            # Reconstruct the full URL Twilio signed against
            scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
            url = f"{scheme}://{request.headers.get('host', '')}{request.url.path}"
            signature = request.headers.get("X-Twilio-Signature", "")
            params = {k: v for k, v in form_data.items()}
            if not validator.validate(url, params, signature):
                log.warning("Twilio signature validation FAILED for %s", url)
                return Response(content="Forbidden", status_code=403)
        except ImportError:
            log.warning("twilio package not installed — skipping signature validation")
    else:
        log.warning("TWILIO_AUTH_TOKEN not set — skipping webhook signature validation")

    to_number = form_data.get("To", "")
    from_number = form_data.get("From", "")
    call_sid = form_data.get("CallSid", "")
    
    log.info("Incoming Twilio call from %s to %s (CallSid: %s)", from_number, to_number, call_sid)

    # In a real app, we'd look up the clinic by the `to_number` (E.164 phone number).
    # For now, if the number isn't found, we'll fall back to our default 'dr-sharma' clinic.
    from backend.database import get_db
    clinic_id = "dr-sharma"
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT clinic_id FROM clinic_channels WHERE identifier = ? AND channel_type = 'phone'", (to_number,))
            row = cursor.fetchone()
            if row:
                clinic_id = row[0]
            else:
                # Also check From number (for outbound calls)
                cursor.execute("SELECT clinic_id FROM clinic_channels WHERE identifier = ? AND channel_type = 'phone'", (from_number,))
                row = cursor.fetchone()
                if row:
                    clinic_id = row[0]
    except Exception as e:
        log.error("Failed to lookup clinic by phone number: %s", e)
                    
    # Override with query param if explicitly provided (e.g. for forced outbound calls)
    if request.query_params.get("clinic_id"):
        clinic_id = request.query_params.get("clinic_id")


    host = request.headers.get("host", "localhost:8000")
    # For local development with Ngrok, Twilio needs a WSS URL
    protocol = "wss" if "localhost" not in host and "127.0.0.1" not in host else "ws"
    
    # Render TwiML
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{protocol}://{host}/ws/twilio-stream">
            <Parameter name="clinic_id" value="{clinic_id}" />
            <Parameter name="caller_phone" value="{from_number}" />
        </Stream>
    </Connect>
</Response>"""
    return Response(content=twiml, media_type="text/xml")


@router.websocket("/ws/twilio-stream")
async def twilio_stream_ws(websocket: WebSocket):
    """
    Handles the Twilio Media Stream WebSocket connection.
    Bridges audio between Twilio (8kHz mu-law) and Gemini Live (16kHz in, 24kHz out PCM).
    """
    await websocket.accept()
    
    stream_sid = None
    call_sid = None
    clinic_id = "dr-sharma"
    caller_phone = ""
    
    # Wait for the "start" event from Twilio to get parameters
    try:
        msg = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        data = json.loads(msg)
        if data.get("event") == "start":
            stream_sid = data["start"]["streamSid"]
            call_sid = data["start"]["callSid"]
            custom_params = data["start"].get("customParameters", {})
            clinic_id = custom_params.get("clinic_id", "dr-sharma")
            caller_phone = custom_params.get("caller_phone", "")
            log.info("Twilio Stream %s started for call %s (clinic: %s)", stream_sid, call_sid, clinic_id)
        else:
            log.error("Expected 'start' event, got: %s", data.get("event"))
            await websocket.close()
            return
    except Exception as e:
        log.error("Failed to initialize Twilio stream: %s", e)
        await websocket.close()
        return

    # Resolve clinic and build instructions
    try:
        clinic = await resolve_clinic("phone", caller_phone) # We can use phone channel type here, but it doesn't strictly matter
    except ClinicNotFoundError:
        # Fallback to resolving by ID if phone isn't tracked properly yet
        try:
            clinic = await resolve_clinic("widget", clinic_id) 
        except ClinicNotFoundError:
            log.error("Clinic %s not found for Twilio stream", clinic_id)
            await websocket.close(code=1008)
            return

    system_prompt = build_system_instructions(clinic)
    # Add phone-specific instruction to keep it brief since phone is half-duplex-ish
    system_prompt += "\n\nCRITICAL: You are talking on a regular telephone line. Keep your responses extremely short, concise, and conversational. Do not use markdown or lists."

    live_config = {
        "response_modalities": ["AUDIO"],
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "input_audio_transcription": {},
        "output_audio_transcription": {},
        "speech_config": {"voice_config": {"prebuilt_voice_config": {"voice_name": VOICE}}},
        "tools": [{"function_declarations": TOOL_DECLARATIONS}],
    }

    start_time = time.time()
    session_turns = []
    audio_chunks = bytearray()
    monitor.start_call(stream_sid, clinic_id, caller_phone, "phone")
    
    # Audio Conversion States
    # audioop ratecv state tuples
    in_rate_state = None  # 8k -> 16k
    out_rate_state = None # 24k -> 8k

    try:
        async with client.aio.live.connect(model=MODEL, config=live_config) as session:
            log.info("Gemini Live session open for Twilio stream %s", stream_sid)

            async def receive_from_twilio():
                nonlocal in_rate_state
                try:
                    while True:
                        msg = await websocket.receive_text()
                        data = json.loads(msg)
                        event = data.get("event")
                        
                        if event == "media":
                            payload = data["media"]["payload"]
                            # 1. Base64 decode
                            chunk = base64.b64decode(payload)
                            # 2. mu-law to linear PCM (16-bit)
                            pcm_8k = audioop.ulaw2lin(chunk, 2)
                            # 3. Resample 8kHz to 16kHz
                            pcm_16k, in_rate_state = audioop.ratecv(pcm_8k, 2, 1, 8000, 16000, in_rate_state)
                            
                            # Send to Gemini
                            await session.send_realtime_input(audio=types.Blob(data=pcm_16k, mime_type="audio/pcm;rate=16000"))
                            await monitor.broadcast_audio(stream_sid, pcm_16k, "user", 16000)
                            
                        elif event == "stop":
                            log.info("Twilio stream %s stopped by remote", stream_sid)
                            break
                        elif event == "mark":
                            pass # Can be used to track playout progress
                except WebSocketDisconnect:
                    log.info("Twilio websocket disconnected")
                except Exception as e:
                    log.error("Error receiving from Twilio: %s", e)

            async def receive_from_gemini():
                nonlocal out_rate_state
                try:
                    async for response in session.receive():
                        sc = getattr(response, "server_content", None)
                        tc = getattr(response, "tool_call", None)
                        
                        if sc is not None:
                            mt = getattr(sc, "model_turn", None)
                            it = getattr(sc, "input_transcription", None)
                            ot = getattr(sc, "output_transcription", None)
                            
                            if it and getattr(it, "text", None):
                                session_turns.append({"role": "user", "text": it.text, "time": round(time.time() - start_time, 1)})
                                await monitor.broadcast_transcript(stream_sid, "user", it.text)
                            if ot and getattr(ot, "text", None):
                                session_turns.append({"role": "swastik", "text": ot.text, "time": round(time.time() - start_time, 1)})
                                await monitor.broadcast_transcript(stream_sid, "swastik", ot.text)

                            if mt and getattr(mt, "parts", None):
                                for part in mt.parts:
                                    idata = getattr(part, "inline_data", None)
                                    if idata and getattr(idata, "data", None):
                                        pcm_24k = idata.data
                                        audio_chunks.extend(pcm_24k)
                                        await monitor.broadcast_audio(stream_sid, pcm_24k, "agent", 24000)
                                        # 1. Resample 24kHz to 8kHz
                                        pcm_8k, out_rate_state = audioop.ratecv(pcm_24k, 2, 1, 24000, 8000, out_rate_state)
                                        # 2. linear PCM to mu-law
                                        mulaw = audioop.lin2ulaw(pcm_8k, 2)
                                        # 3. Base64 encode
                                        payload = base64.b64encode(mulaw).decode("ascii")
                                        
                                        # Send to Twilio
                                        media_msg = {
                                            "event": "media",
                                            "streamSid": stream_sid,
                                            "media": {"payload": payload}
                                        }
                                        await websocket.send_text(json.dumps(media_msg))
                                        
                            if getattr(sc, "interrupted", None):
                                # Gemini detected user interrupting. Send clear message to Twilio
                                clear_msg = {
                                    "event": "clear",
                                    "streamSid": stream_sid
                                }
                                await websocket.send_text(json.dumps(clear_msg))
                                out_rate_state = None # Reset resampler state

                        if tc is not None:
                            # Handle tool calls
                            fc_list = getattr(tc, "function_calls", [])
                            if fc_list:
                                tool_responses = []
                                for fc in fc_list:
                                    t_name = fc.name
                                    t_args = fc.args if hasattr(fc, "args") else {}
                                    if hasattr(t_args, "items"):
                                        t_args = dict(t_args.items())
                                    log.info("Twilio session tool call: %s(%s)", t_name, t_args)
                                    cmd, result = dispatch_tool(t_name, t_args)
                                    tool_responses.append(types.FunctionResponse(
                                        name=t_name,
                                        response=result
                                    ))

                                    if cmd and cmd.get("action") == "transfer_to_human":
                                        log.info("Executing Twilio Call Modification for Warm Transfer...")
                                        try:
                                            from twilio.rest import Client
                                            tw_client = Client(os.environ.get("TWILIO_ACCOUNT_SID"), os.environ.get("TWILIO_AUTH_TOKEN"))
                                            tw_client.calls(call_sid).update(
                                                twiml='<Response><Say>Please hold while we transfer your call.</Say><Dial>+919876543210</Dial></Response>'
                                            )
                                        except Exception as err:
                                            log.error("Failed to transfer call via Twilio REST: %s", err)
                                            
                                await session.send(input=tool_responses)
                                
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    log.error("Error receiving from Gemini: %s", e)

            # Run both tasks concurrently
            task_twilio = asyncio.create_task(receive_from_twilio())
            task_gemini = asyncio.create_task(receive_from_gemini())
            
            done, pending = await asyncio.wait([task_twilio, task_gemini], return_when=asyncio.FIRST_COMPLETED)
            
            # Cancel pending tasks
            for p in pending:
                p.cancel()

    except Exception as e:
        log.error("Twilio session crashed: %s", e)
    finally:
        import wave
        from pathlib import Path
        from datetime import UTC, datetime

        duration = int(time.time() - start_time)
        try:
            await websocket.close()
        except:
            pass
        monitor.end_call(stream_sid)
        log.info("Twilio stream session %s ended. Duration: %ds", stream_sid, duration)
        
        # Save actual session audio
        memos_dir = Path(__file__).resolve().parent / "memos"
        memos_dir.mkdir(exist_ok=True)
        if audio_chunks:
            memo_path = memos_dir / f"{stream_sid}.wav"
            try:
                with wave.open(str(memo_path), 'wb') as wav_file:
                    wav_file.setnchannels(1)
                    wav_file.setsampwidth(2)
                    wav_file.setframerate(24000)
                    wav_file.writeframes(audio_chunks)
            except Exception as e:
                log.error(f"Failed to save audio memo: {e}")

        # Record usage
        record_call_usage(clinic_id, duration, "phone")
        
        if session_turns:
            triage = extract_clinical_summary(session_turns)
            audio_url = f"/api/audio/memo/{stream_sid}"
            save_call_log(
                clinic_id=clinic_id,
                session_id=stream_sid,
                caller_name="Unknown Caller",
                phone=caller_phone,
                duration_seconds=duration,
                summary=f"{len(session_turns)} turn conversation with Swastik AI",
                transcript_list=session_turns,
                chief_complaint=triage.get("chief_complaint", "General Health Consultation"),
                urgency_level=triage.get("urgency_level", "Routine"),
                action_items=triage.get("action_items", ""),
                outcome=triage.get("outcome", "Unclassified"),
                audio_url=audio_url,
                avg_snr=0.0,
                avg_erle=0.0
            )
            dispatch_webhook("call.completed", {
                "session_id": stream_sid,
                "caller_name": "Unknown Caller",
                "phone": caller_phone,
                "duration_seconds": duration,
                "chief_complaint": triage.get("chief_complaint", ""),
                "urgency_level": triage.get("urgency_level", "Routine"),
                "action_items": triage.get("action_items", ""),
                "turns_count": len(session_turns),
                "audio_url": audio_url,
                "completed_at": datetime.now(UTC).isoformat(),
            })
