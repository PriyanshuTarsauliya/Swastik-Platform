# Loop state · mistake-finder

## Last run
2026-09-20 12:05 IST · 5 pages crawled, 1 website mistake found & fixed, 1 idea risk added

## Website mistakes
- None pending

## Fixed
- **Authentication Form Accessibility (WCAG AA)**: Bound all form `<label>` elements with `htmlFor` matching input `id` attributes (`name`, `clinic`, `email`, `phone`, `password`) in both `AuthModal.tsx` and `AuthPage.tsx`, enabling screen reader field announcement and tap-to-focus on mobile/desktop browsers (2026-09-20)
- **WhatsApp Link Accessibility & Security**: Added explicit `aria-label` attributes and `rel="noopener noreferrer"` to `#waFormLink` and `#waSendBtn` across `/console/index.html` and static console assets (2026-09-19)
- **Mobile Responsive Navigation**: Added glassmorphic mobile navigation hamburger menu and dropdown overlay with links to all page sections, Doctor Portal, and Live Voice Console for viewports under 768px (`Landing.tsx`) (2026-09-19)
- **Accessibility & Form Usability**: Associated all clinic intake `<label>` elements with input `id` attributes (`doctorName`, `clinicName`, `phone`, `city`, `email`) on `/checkout`, and added explicit `aria-label` attributes to the spectrum visualizer toggle and patient intake voice memo player button (2026-09-19)

## Idea risks (human decides)
- Competitor / Telephony Standard: Retell AI, Vapi, and Bland AI offer automated inbound PSTN/DID phone number provisioning via Twilio SIP trunking. Swastik AI currently runs the voice session primarily in-browser; true clinic adoption requires patients to dial a real Indian 10-digit mobile or landline number directly without opening a webpage. (Source: Vapi Telephony docs & Retell AI Inbound Calling specs, Sept 2026)
- Competitor: Saral AI and VaaniYantra already serve Indian clinics. Speed and Gemini are not a moat; need a specialty wedge (homeopathy, dermatology/hair, or chronic care).
- Regulation (CDSCO): Autonomous urgency scoring may count as medical device software under Indian law. Replaced in v2 with doctor-set red-flag phrases.
- Privacy (DPDP): Enforceable May 2027. Consent at call start, retention limits, and 72-hour breach reporting must be built early.
- Payments (RBI): Direct fee collection may need a payment aggregator licence. Deferred to phase 2 via a licensed provider.

## Accepted / ignored
- None yet

## Lessons learned
- 2026-09-20: Authentication Accessibility — Every interactive input in modals and standalone auth routes must have explicit htmlFor/id pairings to maintain WCAG 2.1 compliance and seamless mobile usability.
- 2026-09-19: Dual-track loop separation — Website mistakes are objectively verifiable by tools and fixed one at a time. Idea risks cannot be verified by a compiler; they require market evidence and human decision.
- 2026-09-19: One mistake per cycle — Never batch multiple site fixes in one run. Single-issue fixes prevent regressions and ensure clean CI verification.
- 2026-09-19: Form accessibility — Always pair `<label htmlFor="fieldId">` with `<input id="fieldId">` across all React forms to support mobile tap-to-focus and screen readers.
- 2026-09-19: Mobile navigation — Hide desktop action pills on `< md` viewports and provide a high-contrast, touch-friendly hamburger overlay with explicit `aria-label`s.
