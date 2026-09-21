# Swastik AI Voice Agent

Talk to **Swastik**, the warm AI voice receptionist for Dr. Sharma's Clinic. Ask her to book an appointment, inquire about clinic policies, or discuss health issues. Talk over her mid-sentence and she stops, listens, and picks the thread back up.

Built on the **Gemini Live API** with the raw `google-genai` SDK — featuring a highly interactive, cinematic UI built in native HTML5 Canvas and JavaScript.

## Features

- **Real-Time Multimodal Interaction**: Sub-second latency conversational AI using Gemini Live API.
- **Cinematic Visualizations**: Canvas featuring organic orb motion, shockwave pulses, and neural lightning arcs.
- **Tool Execution Engine**: Real-time integration with backend tools for fetching calendar slots and dispatching WhatsApp messages.
- **Barge-in Support**: The browser cuts playback the instant the mic hears you, allowing you to naturally interrupt Swastik.
- **Responsive HUD**: Live call timers, telemetry displays, and a mobile-friendly layout.

## How it works

The browser owns the audio (mic worklet down to 16 kHz, 24 kHz playback, barge-in) and the cinematic canvas rendering. The server owns the socket — one `client.aio.live.connect()` session per browser. The Gemini model handles the conversation and tool execution natively.

## Project Structure

| File/Directory | Description |
|---|---|
| `backend/raw_server.py` | The raw Gemini Live websocket loop, bridging audio bytes and tool calls. |
| `backend/persona.py` | Swastik's behavioral prompt, triage logic, clinic policies, and health tips. |
| `backend/tools.py` | Implementation of functions like `book_consultation`, `get_available_slots`, etc. |
| `frontend/main.js` | The cinematic rendering pipeline, Web Audio API integration, and DOM updates. |
| `frontend/index.html` | The responsive HTML structure with integrated HUD components. |

## Run it

1. Make sure you have python and `uv` installed.
2. Setup your environment variables:
```bash
uv sync
cp .env.example .env          # paste your GOOGLE_API_KEY (Gemini Developer API / AI Studio)
```
3. Run the backend server:
```bash
uv run uvicorn backend.raw_server:app --port 8000
```
4. Open [http://localhost:8000](http://localhost:8000), **put headphones on** (otherwise she hears her own audio), tap **Start Call** and talk!

Try asking: *"I'm having terrible hair fall, can I meet Dr. Sharma?"* · *"What is the consultation fee?"* · *"I want to book an online appointment for tomorrow."*
