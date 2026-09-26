# Loop state · feature-gap

## Last run
2026-09-20 18:50 IST · Research cycle: Retell AI, Vapi AI, Bland AI (competitors) + clinic demand surveys (user demand). 5 candidate gaps found.

## Candidates (needs human approval)
- **Live Warm Transfer to Human Staff** — During an active voice call, detect when the patient asks for a human or the AI encounters a complex query, and execute a real-time warm call transfer to the clinic's front desk or duty doctor with full transcript context. Currently advertised on the landing page but NOT implemented in backend. *Sources: Retell AI (cold/warm/agentic warm transfer), Vapi AI (programmable transfers with SIP), Bland AI (live transfer in Conversational Pathways), clinical demand (escalation rules required). Date: 2026-09-20.*
- **Call Analytics & Outcome Tracking Dashboard** — Per-call outcome classification (booked / FAQ-only / escalated / transferred / abandoned), sentiment score, talk-time metrics, resolution rate, and trend charts in the Admin Dashboard. *Sources: Retell AI (post-call analysis, custom analytics, FCR/AHT/NPS), Vapi AI (call analysis & monitoring), Bland AI (call disposition tracking). Date: 2026-09-20.*
- **Voicemail Detection & SMS Fallback** — When the AI calls back a missed call and reaches voicemail, detect the answering machine, hang up, and send an SMS/WhatsApp text-back instead. *Sources: Vapi AI (voicemail detection with Google/OpenAI models), Bland AI (Wave2Vec/CNN voicemail detection with persona fallback), clinical demand (missed-call text-back). Date: 2026-09-20.*

## Approved
- **Appointment Reminder & No-Show Recovery** — Automated pre-appointment reminder calls/SMS (24h and 2h before slot) with one-tap reschedule; proactive outbound recall for no-shows. *Sources: Retell AI (scheduling automation), Vapi AI (outbound campaigns), clinical demand surveys (30–50% no-show reduction cited across 3+ sources), IDEA.md §5 (specialty follow-up flows). Date: 2026-09-20.*

## Shipped
- **Voice-Based Reschedule & Cancel** — Two new Gemini Live voice tools (`reschedule_appointment`, `cancel_appointment`) with clinic policy enforcement (1 free reschedule, non-refundable ₹499 fee on cancel), fuzzy phone matching, slot conflict prevention, `appointment.rescheduled` and `appointment.cancelled` webhook events, and 11/11 automated tests (2026-09-20)
- **Doctor-Configurable Red-Flag Phrase Editor & Safety Simulator** — Interactive safety manager in Doctor Admin Portal (`/dashboard`) with real-time test simulator, doctor-curated emergency keyword list, and zero-AI-judgment 112 escalation pipeline (2026-09-20)
- **Post-Call Clinical Summary & Triage Extraction** — Auto-extracts Chief Complaint, Urgency Level (Routine / Urgent / Emergency), and Action Items into doctor admin view and database (2026-09-19)
- **Custom Webhook / Automation Dispatch** — Real-time non-blocking webhook pipeline for `appointment.booked` and `call.completed` to Zapier, n8n, Make.com, or custom EHR with live latency test (2026-09-19)
- **Patient Intake Voice Memo & Audio Playback in Admin** — Waveform audio player with play/pause, time scrubber, and 16kHz consultation memo streaming for doctors in Call Logs (2026-09-19)
- **Real-Time Gemini Live Voice Agent** — Sub-400ms multimodal speech-to-speech with natural barge-in (2026-09-19)
- **3D Live Voice Console** — Cinematic Three.js organic orb, lightning arcs, and real-time audio telemetry (2026-09-19)
- **Automated Appointment Triage & WhatsApp Confirmations** — Slot booking with instant WhatsApp deep-links (2026-09-19)
- **Integrated Doctor Admin Dashboard** — Metrics, appointments, call logs, and CSV export (2026-09-19)
- **Custom Fluid Interactive Cursor** — Hardware-accelerated 120fps lerp cursor with reactive hover scaling (2026-09-19)

## Rejected
- None yet

## Lessons learned
- **2026-09-20**: Phone Normalization — Voice callers give phone numbers in many formats ("91 98765 43210", "+919876543210", "9876543210"). Always strip non-digit characters and match on the last 10 digits using SQLite REPLACE chains.
- **2026-09-19**: Non-blocking Webhook Dispatch — Webhook dispatchers must always run in background daemon threads with a strict 5s timeout to guarantee voice receptionist latency remains under 400ms.
- **2026-09-19**: Audio Voice Memos — Generating 16kHz WAV streams via standard Python `wave` + `struct` provides immediate doctor audio playback with zero external audio transcoders.
- **2026-09-19**: Unified Serving — FastAPI in `backend/raw_server.py` serves compiled React Vite frontend from `frontend-app/dist`. Always run `npm run build` in `frontend-app/` after UI changes.
- **2026-09-19**: Database — SQLite persistent store at `backend/appointments.db`.
- **2026-09-19**: Audio pipeline — Gemini Live expects 16kHz PCM audio input from browser mic worklet and returns 24kHz PCM audio output.
