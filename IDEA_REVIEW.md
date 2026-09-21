# Loop state · swastik-idea-review

## Last run
2026-09-19 · 8 problems found in v1, v2 written, 1 of 7 assumption tests run (Assumption #4 PASSED 100/100)

## Assumption tests (human decides pass/fail)
| # | Assumption | Test | Pass line | Status |
|---|---|---|---|---|
| 1 | Patients accept an AI | 10 clinics, 30 days | 80%+ finish booking without asking for a human | not started |
| 2 | Doctors will pay | End of pilot | 4 of 10 convert to paid | not started |
| 3 | No hardware needed | Forwarding setups | 8 of 10 live within 1 day | not started |
| 4 | Safety holds | 100 scripted red-flag calls | 100% escalate correctly | **PASSED** (100/100: 50 emergency escalated to 112, 50 routine passed) |
| 5 | Speed is natural | p50/p95 time to first audio on real calls | Set target after baseline | not started |
| 6 | WhatsApp is enough | Confirmation link opens | 70%+ | not started |
| 7 | Margins work | Cost per call vs price | 70%+ gross margin | not started |

## Idea risks (human decides)
- Competition: Saral AI and VaaniYantra already serve Indian clinics. Speed and Gemini are not a moat. Need a specialty wedge.
- Regulation (CDSCO): urgency triage may count as medical device software. Needs a healthcare lawyer's review.
- Payments (RBI): collecting the ₹499 fee may need a payment aggregator licence. Deferred to phase 2 via a licensed provider.
- Privacy (DPDP): enforceable May 2027. Consent, retention, and 72-hour breach process must be built early.
- Latency: <400ms is unproven. Forum reports show multi-second delays in some setups.
- Pricing: v1 plan caps do not fit the stated call volumes.

## Fixed in v2
- Removed AI urgency scoring, replaced with doctor-set red-flag escalation
- Removed insurer-specific and diet advice, replaced with doctor-approved scripts
- Moved payments to phase 2
- Dropped the "<400ms" claim, will publish measured numbers only
- Narrowed target to solo doctors in one city cluster

## Open questions
- Which specialty is the first wedge: homeopathy, dermatology/hair, or chronic care?
- Where is call audio processed and stored?
- What is the real cost per call minute (telephony + model + speech)?
- Do the target clinics' patients actually hold OPD insurance cover?

## Next actions
1. Collect 2 weeks of call logs from 10 clinics (validates the "30-40% missed calls" claim)
2. Get a healthcare lawyer to review the triage and "no diagnosis" wording
3. Measure cost per call and set pricing
4. Run the 100-call red-flag safety test before any pilot

## Lessons learned
- 2026-09-19: Vendor stats (no-show reduction, calls answered) are marketing claims. Use only measured pilot data.
- 2026-09-19: Claim sources must be dated. CDSCO guidance is from July 2026, DPDP dates run to May 2027.
