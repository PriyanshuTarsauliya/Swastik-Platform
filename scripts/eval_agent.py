import asyncio
import json
import os
import sys
from pathlib import Path

# Add project root to sys.path so we can import backend modules
sys.path.append(str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from backend.prompt_builder import build_system_instructions
from backend.tools import TOOL_DECLARATIONS, dispatch_tool
from backend.tenant_resolver import resolve_clinic
from backend.database import get_db
from google import genai
from google.genai import types

MODEL = os.getenv("LIVE_MODEL", "gemini-3.1-flash-live-preview")

async def run_eval(test_name: str, patient_messages: list, expected_tools: list, unexpected_tools: list = None):
    print(f"\n{'='*50}\nRunning Eval: {test_name}\n{'='*50}")
    unexpected_tools = unexpected_tools or []
    
    # 1. Fetch the default clinic
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM clinics LIMIT 1")
        row = cursor.fetchone()
        if not row:
            print("No clinic found in DB for eval.")
            return False
            
        clinic_id = row[0]
        
    clinic = await resolve_clinic("widget", clinic_id)
    system_prompt = build_system_instructions(clinic)
    
    client = genai.Client()
    
    config = {
        "response_modalities": ["AUDIO"], 
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "tools": [{"function_declarations": TOOL_DECLARATIONS}],
        "input_audio_transcription": {},
        "output_audio_transcription": {},
    }
    
    called_tools = set()
    success = True
    
    try:
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            for msg in patient_messages:
                print(f"\n[Patient]: {msg}")
                await session.send(input=msg, end_of_turn=True)
                
                # Wait for the model to finish its turn
                async for response in session.receive():
                    sc = getattr(response, "server_content", None)
                    tc = getattr(response, "tool_call", None)
                    
                    if sc is not None:
                        ot = getattr(sc, "output_transcription", None)
                        if ot and getattr(ot, "text", None):
                            print(f"[Swastik]: {ot.text.strip()}")
                        
                        # If the turn is complete, break the receive loop so we can send the next message
                        if sc.turn_complete:
                            break
                    
                    if tc is not None:
                        # Handle tool calls
                        results = []
                        for fc in tc.function_calls:
                            args = dict(getattr(fc, "args", None) or {})
                            print(f"[Tool Call]: {fc.name} with args: {args}")
                            called_tools.add(fc.name)
                            
                            # Simulate tool execution
                            cmd, result = dispatch_tool(fc.name, args)
                            print(f"[Tool Result]: {result}")
                            results.append(types.FunctionResponse(id=fc.id, name=fc.name, response=result))
                        
                        if results:
                            await session.send_tool_response(function_responses=results)
                            
            # Evaluate results
            print("\n--- Eval Results ---")
            for expected in expected_tools:
                if expected not in called_tools:
                    print(f"[FAIL] Expected tool '{expected}' was not called.")
                    success = False
                else:
                    print(f"[PASS] Expected tool '{expected}' was called.")
                    
            for unexpected in unexpected_tools:
                if unexpected in called_tools:
                    print(f"[FAIL] Unexpected tool '{unexpected}' WAS called.")
                    success = False
                else:
                    print(f"[PASS] Unexpected tool '{unexpected}' was not called.")
                    
            if success:
                print(">>> EVALUATION PASSED")
            else:
                print(">>> EVALUATION FAILED")
                    
    except Exception as e:
        print(f"Eval error: {e}")
        success = False
        
    return success

async def main():
    print("Starting Swastik AI Evaluation Suite...")
    
    # Test 1: Standard Appointment Booking
    test_1 = [
        "Hi, I want to book an appointment for tomorrow.",
        "My name is John Doe, and my phone number is 555-0199.",
        "Morning around 10 AM is fine.",
        "11 AM works for me, my condition is just a mild fever."
    ]
    await run_eval("Standard Booking Flow", test_1, expected_tools=["create_session"], unexpected_tools=["escalate_emergency"])
    
    # Test 2: Emergency Triage
    test_2 = [
        "Hi, I am having severe chest pain and shortness of breath.",
    ]
    await run_eval("Emergency Triage", test_2, expected_tools=["escalate_emergency"], unexpected_tools=["create_session"])

if __name__ == "__main__":
    asyncio.run(main())
