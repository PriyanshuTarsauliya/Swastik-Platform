import asyncio
import base64
import logging
from typing import Dict, Set
from fastapi import WebSocket

log = logging.getLogger("swastik-monitor")

class CallMonitor:
    def __init__(self):
        # session_id -> { "clinic_id": str, "caller": str, "status": str, "subscribers": Set[WebSocket] }
        self.active_calls: Dict[str, dict] = {}

    def start_call(self, session_id: str, clinic_id: str, caller_info: str, channel_type: str):
        self.active_calls[session_id] = {
            "clinic_id": clinic_id,
            "caller": caller_info,
            "channel_type": channel_type,
            "status": "in-progress",
            "subscribers": set()
        }
        log.info(f"Monitor: Started tracking call {session_id}")

    def end_call(self, session_id: str):
        if session_id in self.active_calls:
            subs = list(self.active_calls[session_id]["subscribers"])
            for ws in subs:
                asyncio.create_task(self._safe_close(ws))
            del self.active_calls[session_id]
            log.info(f"Monitor: Stopped tracking call {session_id}")

    async def _safe_close(self, ws: WebSocket):
        try:
            await ws.close()
        except:
            pass

    async def broadcast_audio(self, session_id: str, audio_chunk: bytes, source: str, sample_rate: int = 16000):
        if session_id in self.active_calls:
            subs = list(self.active_calls[session_id]["subscribers"])
            if not subs:
                return
            b64 = base64.b64encode(audio_chunk).decode('ascii')
            msg = {
                "type": "audio",
                "source": source,
                "rate": sample_rate,
                "data": b64
            }
            for ws in subs:
                try:
                    await ws.send_json(msg)
                except Exception:
                    self.active_calls[session_id]["subscribers"].discard(ws)

    async def broadcast_transcript(self, session_id: str, role: str, text: str):
        if session_id in self.active_calls:
            subs = list(self.active_calls[session_id]["subscribers"])
            if not subs:
                return
            msg = {
                "type": "transcript",
                "role": role,
                "text": text
            }
            for ws in subs:
                try:
                    await ws.send_json(msg)
                except Exception:
                    self.active_calls[session_id]["subscribers"].discard(ws)

    def subscribe(self, session_id: str, ws: WebSocket) -> bool:
        if session_id in self.active_calls:
            self.active_calls[session_id]["subscribers"].add(ws)
            return True
        return False

    def unsubscribe(self, session_id: str, ws: WebSocket):
        if session_id in self.active_calls:
            self.active_calls[session_id]["subscribers"].discard(ws)

monitor = CallMonitor()
