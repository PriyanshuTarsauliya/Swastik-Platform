import React from 'react'
import { ShieldCheck, Lock, Server, HeartHandshake, FileCheck, CheckCircle2 } from 'lucide-react'
import CardSpotlight from './inspira/CardSpotlight'

export const TrustSecuritySection: React.FC = () => {
  const guarantees = [
    {
      icon: ShieldCheck,
      title: 'HIPAA & DPDP Act Aligned',
      desc: 'All patient conversations and health inquiries are encrypted in transit and at rest. Zero audio recordings are stored without explicit patient and clinic consent.',
    },
    {
      icon: Lock,
      title: 'Zero Autonomous Diagnosis',
      desc: 'Strict safety guardrails prevent the AI from offering unverified medical prescriptions. The voice agent restricts scope to booking, triage, FAQ, and reminders.',
    },
    {
      icon: Server,
      title: '99.98% High-Availability SLA',
      desc: 'Multi-region cloud clusters guarantee your clinic phone lines never drop, even during monsoon network disruptions, clinic peak rush hours, or holidays.',
    },
    {
      icon: HeartHandshake,
      title: 'Guaranteed Human Handoff',
      desc: 'Any expression of acute distress, complex queries, or patient request for a human transfers the phone call immediately to your clinic desk staff or duty doctor.',
    },
  ]

  return (
    <section id="security" className="relative py-20 px-6 border-t border-white/10 bg-[rgba(8,14,23,0.85)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] text-xs font-semibold text-[#22c55e] mb-4">
            <FileCheck className="w-3.5 h-3.5" /> Clinical Safety & Governance
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
            Built for High-Stakes Patient Trust with Swastik AI
          </h2>
          <p className="text-[#94a3b8] max-w-xl mx-auto text-base">
            Swastik AI ensures uncompromising security, ethical AI boundaries, and strict patient confidentiality.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {guarantees.map((g, idx) => {
            const Icon = g.icon
            return (
              <CardSpotlight
                key={idx}
                gradientColor="rgba(34, 197, 94, 0.12)"
                className="p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] text-[#22c55e] mb-5">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{g.title}</h3>
                  <p className="text-xs text-[#94a3b8] leading-relaxed">{g.desc}</p>
                </div>

                <div className="mt-6 flex items-center gap-1.5 text-[11px] font-semibold text-[#22c55e]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Enterprise Verified</span>
                </div>
              </CardSpotlight>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default TrustSecuritySection
