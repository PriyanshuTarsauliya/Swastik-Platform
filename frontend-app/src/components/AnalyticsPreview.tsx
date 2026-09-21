import React, { useState } from 'react'
import { Activity, BarChart3, Clock, CheckCircle2, ShieldCheck, UserCheck, PhoneCall } from 'lucide-react'
import BorderBeam from './inspira/BorderBeam'

export const AnalyticsPreview: React.FC = () => {
  const [activeCallIdx, setActiveCallIdx] = useState(0)

  const callLogs = [
    {
      caller: '+91 98260 412••',
      patient: 'Rahul Sharma',
      time: 'Just now (12:42 PM)',
      duration: '1m 24s',
      intent: 'New Consultation Booking',
      doctor: 'Dr. A. K. Sharma',
      sentiment: 'Positive (98%)',
      sentimentColor: 'text-[#22c55e]',
      status: 'Confirmed & WhatsApp Sent',
      transcriptSnippet: [
        { speaker: 'Caller', text: 'कल शाम 5:30 बजे डॉक्टर शर्मा से मिलना था।' },
        { speaker: 'Swastik AI', text: 'जी राहुल जी, 5:30 बजे का स्लॉट आपके लिए रिज़र्व कर दिया है। अपॉइंटमेंट की पुष्टि और क्लिनिक की लोकेशन आपके व्हाट्सएप पर भेज दी गई है।' },
      ],
    },
    {
      caller: '+91 94251 883••',
      patient: 'Meena Verma',
      time: '6 mins ago (12:36 PM)',
      duration: '48s',
      intent: 'Dietary & Medicine Dosage FAQ',
      doctor: 'Dr. A. K. Sharma',
      sentiment: 'Neutral (85%)',
      sentimentColor: 'text-[#00e5ff]',
      status: 'Answered & Directions Dispatched',
      transcriptSnippet: [
        { speaker: 'Caller', text: 'Can I take the homeopathic dilution right after lunch?' },
        { speaker: 'Swastik AI', text: 'It is recommended to maintain a 15-minute gap before or after meals for optimal homeopathic absorption. A reminder has been sent to your WhatsApp.' },
      ],
    },
    {
      caller: '+91 88712 901••',
      patient: 'Sunil Agrawal',
      time: '18 mins ago (12:24 PM)',
      duration: '2m 10s',
      intent: 'Reschedule Appointment',
      doctor: 'Dr. A. K. Sharma',
      sentiment: 'Satisfied (94%)',
      sentimentColor: 'text-[#22c55e]',
      status: 'Rescheduled to Saturday 11 AM',
      transcriptSnippet: [
        { speaker: 'Caller', text: 'I need to move my Friday slot to Saturday morning.' },
        { speaker: 'Swastik AI', text: 'Done! Your appointment is rescheduled to Saturday at 11:00 AM with Dr. Sharma. Calendar synced!' },
      ],
    },
  ]

  const activeCall = callLogs[activeCallIdx]

  return (
    <section id="analytics" className="relative py-24 px-6 bg-[rgba(4,7,12,0.9)]">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] text-xs font-semibold text-[#14c8b2] mb-4">
            <BarChart3 className="w-3.5 h-3.5" /> Clinical Intelligence & Oversight
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
            Real-Time Call Analytics & Live Transcripts
          </h2>
          <p className="text-[#94a3b8] max-w-xl mx-auto text-base">
            Doctors and hospital administrators maintain full transparency with searchable audio logs, patient sentiment analysis, and instant human escalation records.
          </p>
        </div>

        {/* Live Telemetry KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-white/10 bg-[rgba(8,14,23,0.8)] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between text-[#94a3b8] text-xs font-medium mb-1">
              <span>Today&apos;s Calls</span>
              <Activity className="h-4 w-4 text-[#14c8b2]" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-[#14c8b2]">142</span>
            <span className="block text-xs text-[#22c55e] mt-1 font-medium">↑ 18% vs last week</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[rgba(8,14,23,0.8)] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between text-[#94a3b8] text-xs font-medium mb-1">
              <span>Avg Latency</span>
              <Clock className="h-4 w-4 text-[#00e5ff]" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-[#00e5ff]">348ms</span>
            <span className="block text-xs text-[#94a3b8] mt-1 font-medium">Sub-second turn</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[rgba(8,14,23,0.8)] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between text-[#94a3b8] text-xs font-medium mb-1">
              <span>Confirmed Slots</span>
              <CheckCircle2 className="h-4 w-4 text-[#14c8b2]" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-[#14c8b2]">118</span>
            <span className="block text-xs text-[#22c55e] mt-1 font-medium">83% booking rate</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[rgba(8,14,23,0.8)] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between text-[#94a3b8] text-xs font-medium mb-1">
              <span>Human Handoffs</span>
              <UserCheck className="h-4 w-4 text-[#f5a623]" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-[#f5a623]">3</span>
            <span className="block text-xs text-[#94a3b8] mt-1 font-medium">Seamless emergency transfer</span>
          </div>
        </div>

        {/* Live Call Console Mockup */}
        <div className="relative rounded-3xl border border-[rgba(255,255,255,0.12)] bg-[rgba(8,14,23,0.95)] p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
          <BorderBeam size={280} duration={10} colorFrom="#14c8b2" colorTo="#00e5ff" borderWidth={1.5} />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Call List */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-[#14c8b2]" /> Inbound Call Queue
                </h3>
                <span className="text-xs font-mono text-[#14c8b2] rounded bg-[rgba(20,200,178,0.1)] px-2.5 py-0.5">
                  Live Stream
                </span>
              </div>

              {callLogs.map((call, idx) => {
                const isSelected = idx === activeCallIdx
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveCallIdx(idx)}
                    className={`rounded-2xl border px-4 py-4.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#14c8b2] bg-[rgba(20,200,178,0.15)] shadow-[0_0_15px_rgba(20,200,178,0.25)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{call.patient}</span>
                      <span className="text-xs text-[#94a3b8] font-mono">{call.time}</span>
                    </div>
                    <p className={`text-xs font-medium ${isSelected ? 'text-[#14c8b2]' : 'text-slate-300'}`}>
                      {call.intent}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-[#94a3b8]">
                      <span>Caller: {call.caller}</span>
                      <span>Duration: {call.duration}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: Live Transcript & Details */}
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[rgba(4,7,12,0.85)] p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{activeCall.patient}</h3>
                    <span className="text-xs text-[#94a3b8] font-mono">{activeCall.caller}</span>
                  </div>
                  <p className="text-xs text-[#94a3b8]">Assigned Doctor: <strong className="text-white">{activeCall.doctor}</strong></p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${activeCall.sentimentColor}`}>
                    Sentiment: {activeCall.sentiment}
                  </span>
                </div>
              </div>

              {/* Transcript Stream - Alternating chat bubbles */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] block">
                  Interactive Audio Transcript & Intent Detection
                </span>

                <div className="flex flex-col space-y-3">
                  {activeCall.transcriptSnippet.map((line, lIdx) => {
                    const isAI = line.speaker === 'Swastik AI'
                    return (
                      <div
                        key={lIdx}
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          isAI
                            ? 'self-end rounded-tr-none border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] text-[#f8fafc]'
                            : 'self-start rounded-tl-none border border-white/10 bg-white/5 text-white'
                        }`}
                      >
                        <span className={`block text-xs font-bold mb-1 ${isAI ? 'text-[#14c8b2]' : 'text-slate-400'}`}>
                          {line.speaker}
                        </span>
                        {line.text}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action Completed & Emergency Handoff Bar */}
              <div className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-[rgba(34,197,94,0.1)] px-3 py-1.5 text-xs text-[#22c55e] font-semibold border border-[rgba(34,197,94,0.2)]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{activeCall.status}</span>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-[rgba(20,200,178,0.08)] px-3 py-1.5 text-xs text-[#14c8b2] font-semibold border border-[rgba(20,200,178,0.2)]">
                  <ShieldCheck className="h-4 w-4" />
                  <span>HIPAA Encrypted Log</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AnalyticsPreview
