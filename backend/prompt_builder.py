"""Dynamic System Instruction Builder — constructs clinic-specific AI prompts.

Replaces hardcoded prompts with structured data from the clinic_profile table.
Falls back to the raw system_prompt column for backward compatibility.
"""

import logging

from backend.persona import CORE_BEHAVIOR

log = logging.getLogger("swastik-prompt")


def build_system_instructions(clinic: dict) -> str:
    """Build a complete system instruction string from structured clinic data.

    If the clinic has a populated clinic_profile (greeting, services, etc.),
    constructs the prompt dynamically. Otherwise falls back to the
    system_prompt column stored in the clinics table.

    Args:
        clinic: Dict from tenant_resolver containing all clinic + profile data.

    Returns:
        Complete system instruction string ready for Gemini Live.
    """
    # Check if we have structured profile data
    has_profile = any(clinic.get(k) for k in (
        "greeting", "services", "address", "booking_rules"
    ))

    if not has_profile:
        # Fallback: use the raw system_prompt from clinics table
        raw = clinic.get("system_prompt")
        if raw:
            log.info("Using raw system_prompt for clinic %s (no structured profile)", clinic.get("id"))
            return raw
        # Last resort: minimal prompt
        log.warning("No prompt data for clinic %s, using minimal fallback", clinic.get("id"))
        return _minimal_prompt(clinic)

    return _build_structured_prompt(clinic)


def _build_structured_prompt(clinic: dict) -> str:
    """Construct prompt from structured clinic_profile data + CORE_BEHAVIOR."""
    doctor_name = clinic.get("doctor_name") or "the Doctor"
    clinic_name = clinic.get("name") or "the Clinic"
    agent_name = "Swastik"  # default agent name

    # Build services text
    services = clinic.get("services")
    if isinstance(services, list):
        services_text = "\n".join(
            f"- {s.get('name', 'Service')}: ₹{s.get('price', 'N/A')} ({s.get('duration_min', '?')} min)"
            for s in services
        )
    elif isinstance(services, str):
        services_text = services
    else:
        services_text = "Contact clinic for services and pricing."

    # Build working hours text
    hours = clinic.get("working_hours")
    if isinstance(hours, dict):
        hours_text = ", ".join(f"{day}: {time}" for day, time in hours.items())
    elif isinstance(hours, str):
        hours_text = hours
    else:
        hours_text = "Contact clinic for hours."

    # Build languages list
    languages = clinic.get("languages")
    if isinstance(languages, list):
        languages_text = ", ".join(languages)
    else:
        languages_text = "Hindi, English"

    # Voice persona
    persona = (clinic.get("voice_persona") or "warm_professional").replace("_", " ")

    # Consultation fee
    fee = clinic.get("consultation_fee") or "₹499"

    # Clinic facts section
    clinic_facts = f"""
=== CLINIC DETAILS (your knowledge base; say nothing beyond this and tool results) ===
- Clinic: {clinic_name}
- Doctor: {doctor_name}
- Consultation fee: {fee}
- Working hours: {hours_text}
- Address: {clinic.get('address') or 'Contact clinic for address'}
- Booking rules: {clinic.get('booking_rules') or 'Standard booking, one free reschedule 24h before.'}
- Escalation / human backup: {clinic.get('escalation_number') or 'WhatsApp support during working hours'}
- Languages: {languages_text}

SERVICES & PRICING:
{services_text}
"""

    # Build the greeting instruction
    greeting = clinic.get("greeting") or f"Namaste ji! {clinic_name} se {agent_name} bol rahi hoon, main AI assistant hoon. Kahiye, kaise madad karoon?"

    greeting_section = f"""
GREETING: Use this greeting (adapt naturally): {greeting}
"""

    # Custom instructions
    custom = clinic.get("custom_instructions") or ""
    custom_section = f"\n{custom}\n" if custom else ""

    # Fill placeholders in CORE_BEHAVIOR
    core = CORE_BEHAVIOR
    core = core.replace("[AGENT_NAME]", agent_name)
    core = core.replace("[CLINIC_NAME]", clinic_name)
    core = core.replace("[DOCTOR_NAME]", doctor_name)
    core = core.replace("[DOCTOR_SHORT]", _short_doctor_name(doctor_name))
    core = core.replace("[SPECIALTY_HUMOR_BANK]", "")  # humor bank can be customized later

    return (clinic_facts + greeting_section + custom_section + core).strip()


def _minimal_prompt(clinic: dict) -> str:
    """Last-resort minimal prompt when no data is available."""
    name = clinic.get("name") or "the Clinic"
    return f"""You are the AI receptionist for {name}. 
Speak in a warm, professional tone. You can converse in Hindi and English.
Help callers book appointments, answer questions about the clinic, and transfer to human staff if needed.
Always confirm the patient's name and phone number before ending a booking."""


def _short_doctor_name(full_name: str) -> str:
    """Extract short form: 'Dr. A. K. Sharma' -> 'Dr. Sharma'."""
    if not full_name:
        return "the Doctor"
    parts = full_name.split()
    # Find the last non-initial part
    for i in range(len(parts) - 1, -1, -1):
        if len(parts[i]) > 2 and not parts[i].endswith("."):
            if "Dr" in full_name or "dr" in full_name:
                return f"Dr. {parts[i]}"
            return parts[i]
    return full_name
