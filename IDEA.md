# Product Idea · Swastik AI (v2)

## 1. One-line pitch
Swastik AI is a voice front desk for follow-up-heavy clinics in India
(start with one: homeopathy, dermatology/hair, or chronic care). It
answers the calls the team misses, books the visit, sends confirmations
and reminders, and gives the doctor a short summary of what the patient
said. It never diagnoses.

## 2. Problem (verify before quoting numbers)
- Calls missed during consultations, no-shows, and lost follow-ups.
- Collect 2 weeks of call logs from 10 clinics. Quote only what they show.

## 3. Target customer
- Primary: solo doctors in ONE city cluster (e.g. Delhi NCR).
- Later: polyclinics, only after the pilot proves the solo-doctor model.

## 4. Product scope (v1)

Does:
- Answer calls with an AI disclosure and recording consent
- Book, reschedule, cancel within the doctor's slots
- Answer FAQs from a doctor-approved script (fees, timings, address,
  what to bring)
- Take name, phone, and reason for visit in the patient's own words
- Send WhatsApp confirmations and reminders (approved templates,
  minimal data, secure link)
- Call back missed calls within minutes
- Transfer to a human on request
- Show a call summary on the doctor dashboard

Does NOT (v1):
- Diagnose, or rate clinical urgency
- Give medicine or diet advice
- Explain insurer-specific rules
- Collect payments

Safety:
- The doctor sets a red-flag phrase list (chest pain, breathing trouble,
  heavy bleeding, etc.). On a match the AI says "please call 112 or go
  to the nearest emergency room" and alerts the clinic. It does not judge.

Setup: conditional call forwarding (busy / no answer) to a Swastik
number. No PBX hardware. Verify per telecom operator.

## 5. Differentiation (not speed, not Gemini)
- Specialty follow-up flows: revisit reminders, refill reminders,
  no-show recovery
- Doctor-owned scripts, so the AI only says what the doctor approved
- Hindi-English code-mixing quality, tested on real clinic calls
- Done-for-you setup in one day
- Distribution: doctor associations, clinic-software vendors, local
  doctor WhatsApp groups

## 6. Pricing (to test)
- Base fee per clinic + per booked appointment, with minute overage
- Measure cost per call first. Target gross margin of 70% or more.
- Pilot: free for 30 days, then paid
- Fee collection: phase 2, only via a licensed payment aggregator that
  settles directly to the doctor

## 7. Compliance guardrails
- CDSCO: no triage or diagnosis claims in product or marketing. Get
  legal review before any urgency scoring.
- DPDP (enforceable May 2027, build now): consent at call start,
  privacy notice, data processing agreement with each clinic (clinic =
  data fiduciary, Swastik = processor), retention limit, deletion on
  request, 72-hour breach process.
- WhatsApp: approved templates, no clinical details in messages.
- Data: know where audio is processed and stored, and tell clinics.

## 8. Assumptions and tests (thresholds are proposals)

| Assumption | Test | Pass line |
|---|---|---|
| Patients accept an AI | 10 clinics, 30 days | 80%+ finish booking without asking for a human |
| Doctors will pay | End of pilot | 4 of 10 convert to paid |
| No hardware needed | Forwarding setups | 8 of 10 live within 1 day |
| Safety holds | 100 scripted red-flag calls | 100% escalate correctly |
| Speed is natural | Measure p50/p95 time to first audio on real calls | Set target after baseline |
| WhatsApp is enough | Confirmation link opens | 70%+ |
| Margins work | Cost per call vs price | 70%+ gross margin |

## 9. Kill criteria
Stop or pivot if fewer than 4 of 10 pilot clinics pay, or the safety
test fails.