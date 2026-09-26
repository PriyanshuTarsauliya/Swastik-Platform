import asyncio
import logging
from datetime import datetime, timedelta

from backend.database import get_db
from backend.tools import dispatch_webhook, get_setting

log = logging.getLogger(__name__)

async def check_and_send_reminders():
    """Poll the database for upcoming and missed appointments and send WhatsApp/SMS reminders."""
    log.info("Running appointment reminder check...")
    try:
        now = datetime.now()
        # Today's date to parse slot_time since slot_time is like "11:00 AM"
        today_date = now.strftime("%Y-%m-%d")

        with get_db() as conn:
            conn.row_factory = dict_factory
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM appointments WHERE status = 'CONFIRMED'")
            appointments = cursor.fetchall()
            
            for appt in appointments:
                # slot_time example: "11:00 AM"
                try:
                    slot_dt = datetime.strptime(f"{today_date} {appt['slot_time']}", "%Y-%m-%d %I:%M %p")
                except ValueError:
                    continue # Invalid time format
                
                time_diff = slot_dt - now
                
                # Check 24h reminder
                # If the appointment is between 22h and 24h away
                if timedelta(hours=22) < time_diff <= timedelta(hours=24) and not appt.get("reminder_24h_sent"):
                    send_reminder(appt, "24h_reminder")
                    cursor.execute("UPDATE appointments SET reminder_24h_sent = 1 WHERE id = ?", (appt["id"],))
                    conn.commit()

                # Check 2h reminder
                # If the appointment is in less than 2h but more than 0h away
                elif timedelta(hours=0) < time_diff <= timedelta(hours=2) and not appt.get("reminder_2h_sent"):
                    send_reminder(appt, "2h_reminder")
                    cursor.execute("UPDATE appointments SET reminder_2h_sent = 1 WHERE id = ?", (appt["id"],))
                    conn.commit()
                
                # Check no-show (if the appointment time has passed by at least 15 minutes)
                elif time_diff < timedelta(minutes=-15) and not appt.get("no_show_recovery_sent"):
                    send_reminder(appt, "no_show_recovery")
                    cursor.execute("UPDATE appointments SET no_show_recovery_sent = 1 WHERE id = ?", (appt["id"],))
                    conn.commit()
                    
    except Exception as e:
        log.exception(f"Error checking reminders: {e}")

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def send_reminder(appt: dict, reminder_type: str):
    """Dispatch a webhook or simulated WhatsApp message for the reminder."""
    patient_name = appt.get("patient_name", "Patient")
    phone = appt.get("phone", "")
    slot_time = appt.get("slot_time", "")
    clinic_id = appt.get("clinic_id", "default")
    
    # Generate the Smart Link for 1-tap management
    host = get_setting("public_url", "https://swastik.ai")
    smart_link = f"{host}/book/{clinic_id}"
    
    if reminder_type == "24h_reminder":
        message = f"Hi {patient_name}, you have an appointment tomorrow at {slot_time} at Swastik Clinic. Need to change the time? One-tap manage here: {smart_link}"
        event = "appointment.reminder"
    elif reminder_type == "2h_reminder":
        message = f"Hi {patient_name}, this is a gentle reminder from Swastik Clinic for your appointment today at {slot_time}. To manage or reschedule, click here: {smart_link}"
        event = "appointment.reminder"
    elif reminder_type == "no_show_recovery":
        message = f"Hi {patient_name}, we missed you today at {slot_time} at Swastik Clinic. Would you like to reschedule? One-tap reschedule here: {smart_link}"
        event = "appointment.no_show"
    else:
        return
        
    log.info(f"Sending {reminder_type} to {phone}: {message}")
    
    # We can dispatch a webhook to an external automation system
    dispatch_webhook(event, {
        "appointment_id": appt["id"],
        "patient_name": patient_name,
        "phone": phone,
        "slot_time": slot_time,
        "message": message,
        "smart_link": smart_link
    })
    
    # Actually send the SMS if phone is available
    if phone:
        try:
            from backend.tools import send_sms
            send_sms(phone, message)
        except Exception as e:
            log.error(f"Failed to send SMS reminder to {phone}: {e}")

async def reminder_daemon():
    """Background task that runs every minute to check for reminders."""
    while True:
        await check_and_send_reminders()
        await asyncio.sleep(60)
