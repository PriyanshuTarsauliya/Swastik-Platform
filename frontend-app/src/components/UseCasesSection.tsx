import React from 'react'
import { CalendarCheck, PhoneForwarded, HeartPulse, Workflow, CheckCircle2 } from 'lucide-react'
import BorderBeam from './inspira/BorderBeam'
import AnimeHorizontalScroll from './inspira/AnimeHorizontalScroll'
import AnimeSplitText from './inspira/AnimeSplitText'
import AnimeScrollReveal from './inspira/AnimeScrollReveal'

interface UseCase {
  id: string
  title: string
  category: string
  icon: React.ComponentType<{ className?: string }>
  badge: string
  headline: string
  description: string
  bullets: string[]
  metrics: { label: string; value: string }[]
  simulatedCall: { caller: string; ai: string; actionTag: string }
}

const USE_CASES: UseCase[] = [
  {
    id: 'scheduling',
    title: 'Scheduling & Front Desk',
    category: 'Reception Automation',
    icon: CalendarCheck,
    badge: '100% Autonomous',
    headline: 'Eliminate Front Desk Bottlenecks & Double Bookings',
    description: 'Swastik AI answers every incoming caller on the first ring, collects patient details one step at a time, checks real-time slot availability with the doctor’s clinic schedule, and confirms the appointment in under 90 seconds.',
    bullets: [
      'Bidirectional Google Calendar & EHR synchronization',
      'One-question-at-a-time flow prevents patient overwhelm',
      'Handles rescheduling and cancellations automatically',
      'Doctor break times and vacation blocks respected dynamically',
    ],
    metrics: [
      { label: 'Avg Booking Time', value: '78s' },
      { label: 'Missed Calls Prevented', value: '100%' },
      { label: 'Slot Utilization Boost', value: '+34%' },
    ],
    simulatedCall: {
      caller: 'Can I get an appointment with Dr. Sharma tomorrow around 5 PM?',
      ai: 'Yes! Dr. Sharma has an opening at 5:30 PM tomorrow. May I have your full name and WhatsApp number to lock the slot?',
      actionTag: 'Calendar Slot Locked (5:30 PM)',
    },
  },
  {
    id: 'sales',
    title: 'Patient Acquisition & Recall',
    category: 'Revenue & Growth',
    icon: PhoneForwarded,
    badge: 'High Conversion',
    headline: 'Proactive Outbound Recalls & New Inquiry Follow-Ups',
    description: 'Never let prospective patients slip away. Swastik AI autonomously initiates friendly outbound calls to patients due for follow-ups, inquiries from website forms, or routine check-ups with zero manual effort from staff.',
    bullets: [
      'Automated outbound recall for chronic disease follow-ups',
      'Instant callback within 60 seconds of website form submission',
      'Digital intake questionnaire and directions sent via WhatsApp',
      'Reduces no-shows with proactive voice and SMS appointment reminders',
    ],
    metrics: [
      { label: 'No-Show Reduction', value: '45%' },
      { label: 'Inquiry Lead Conversion', value: '2.8x' },
      { label: 'Staff Calling Hours Saved', value: '18 hrs/wk' },
    ],
    simulatedCall: {
      caller: 'I saw your clinic’s Facebook ad about chronic asthma treatment.',
      ai: 'Welcome! Dr. Sharma specializes in personalized constitutional care for asthma. We have introductory slots this Thursday at 5:00 PM.',
      actionTag: 'WhatsApp Intake Dispatched',
    },
  },
  {
    id: 'support',
    title: '24/7 Patient Care & Triage',
    category: 'Patient Experience',
    icon: HeartPulse,
    badge: 'Always Available',
    headline: 'Empathetic Symptom Intake & Post-Visit Guidance',
    description: 'Provide reassurance around the clock. Whether answering FAQs about medicine dosages, clinic parking directions, or conducting pre-visit symptom triage, Swastik AI treats every patient with dignity and care.',
    bullets: [
      'Empathetic Hinglish and vernacular medical explanations',
      'Guides patients on how to store homeopathic dilutions correctly',
      'Collects symptom timeline and prior prescriptions before doctor visit',
      'Answers routine fee, timing, and doctor qualification queries',
    ],
    metrics: [
      { label: 'Patient Satisfaction', value: '4.9/5' },
      { label: 'Evening Call Coverage', value: '24/7' },
      { label: 'Reception FAQ Deflection', value: '72%' },
    ],
    simulatedCall: {
      caller: 'डॉक्टर साहब की दवाई खाने से पहले क्या मुझे कच्चा प्याज़ या लहसुन छोड़ना पड़ेगा?',
      ai: 'जी हाँ, होम्योपैथिक दवाइयों के असर के लिए कच्चा प्याज़, लहसुन और हींग का परहेज़ रखना बेहतर होता है। दवा लेने से 15 मिनट पहले और बाद में मुँह साफ़ रखें।',
      actionTag: 'Dietary Instructions Sent',
    },
  },
  {
    id: 'automation',
    title: 'Automation & Human Handoff',
    category: 'Clinical Safety',
    icon: Workflow,
    badge: 'Zero-Risk Escalation',
    headline: 'Intelligent Human Handoff with Instant Live Transfer',
    description: 'AI handles the repetitive 80% while clinical staff stay fully in control. The moment a critical medical symptom, emotional distress, or complex request is identified, the system transfers the live call with full transcript.',
    bullets: [
      'Instant warm transfer to duty doctor or clinic reception line',
      'Live transcript and caller intent displayed on staff screen',
      'Automated fallback to SMS alerts if staff line is busy',
      'Full compliance audit trail with audio recordings and logs',
    ],
    metrics: [
      { label: 'Handoff Latency', value: '< 2.5s' },
      { label: 'Audit Trail Accuracy', value: '100%' },
      { label: 'Clinical Safety Score', value: '99.9%' },
    ],
    simulatedCall: {
      caller: 'My mother is having severe breathing trouble and dizziness right now!',
      ai: 'I am immediately transferring your call to our emergency duty doctor line. Please stay on the line right now.',
      actionTag: 'Live Emergency Transfer Initiated',
    },
  },
]

const UseCaseCard = ({ uc }: { uc: UseCase }) => {
  const ActiveIcon = uc.icon;
  return (
    <div className="w-[85vw] max-w-[800px] shrink-0 h-full relative rounded-3xl border border-[rgba(20,200,178,0.3)] bg-[rgba(8,14,23,0.95)] p-8 md:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
      <BorderBeam size={260} duration={8} colorFrom="#14c8b2" colorTo="#00e5ff" borderWidth={2} />

      <div className="relative z-10 flex flex-col h-full gap-10">
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[rgba(20,200,178,0.4)] bg-[rgba(20,200,178,0.15)] px-3 py-1 text-xs font-semibold text-[#14c8b2]">
              {uc.badge}
            </span>
            <span className="text-xs text-[#94a3b8] font-medium">{uc.category}</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            {uc.headline}
          </h3>

          <p className="text-sm text-[#94a3b8] leading-relaxed">
            {uc.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {uc.bullets.map((b, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#14c8b2] shrink-0 mt-0.5" />
                <span className="text-xs text-[#f8fafc]">{b}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[rgba(4,7,12,0.85)] p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <ActiveIcon className="h-4 w-4 text-[#14c8b2]" /> Live Conversation Flow
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#22c55e] font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" /> Active Call
            </span>
          </div>

          <div className="rounded-xl rounded-tl-none border border-white/10 bg-white/5 p-3.5 text-xs text-white">
            <span className="text-[10px] text-[#94a3b8] block font-medium mb-1">Incoming Caller</span>
            &quot;{uc.simulatedCall.caller}&quot;
          </div>

          <div className="rounded-xl rounded-tl-none border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] p-4 text-xs text-[#f8fafc]">
            <span className="text-[10px] text-[#14c8b2] block font-semibold mb-1">Swastik Voice AI</span>
            &quot;{uc.simulatedCall.ai}&quot;

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[rgba(245,166,35,0.3)] bg-[rgba(245,166,35,0.1)] px-2.5 py-1 text-[11px] font-semibold text-[#f5a623]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Auto-Action: {uc.simulatedCall.actionTag}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const UseCasesSection: React.FC = () => {
  return (
    <section id="use-cases" className="relative py-24 bg-[rgba(8,14,23,0.7)]">
      <div className="max-w-6xl mx-auto px-6 mb-16">
        <div className="text-center">
          <AnimeScrollReveal direction="up" distance={30} duration={800}>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] text-xs font-semibold text-[#14c8b2] mb-4">
              <Workflow className="w-3.5 h-3.5" /> Use-Case Driven Architecture
            </span>
            <AnimeSplitText as="h2" by="lines" className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
              Designed for Every Critical Touchpoint
            </AnimeSplitText>
            <p className="text-[#94a3b8] max-w-xl mx-auto text-base">
              From initial discovery to post-consultation follow-up, explore how Swastik AI elevates the patient experience.
            </p>
          </AnimeScrollReveal>
        </div>
      </div>

      <AnimeHorizontalScroll topOffset="96px">
        {USE_CASES.map((uc) => (
          <UseCaseCard key={uc.id} uc={uc} />
        ))}
      </AnimeHorizontalScroll>
    </section>
  )
}

export default UseCasesSection

