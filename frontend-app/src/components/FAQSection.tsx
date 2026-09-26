import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import AnimeScrollReveal from './inspira/AnimeScrollReveal'

const faqs = [
  {
    question: 'What exactly is Swastik AI?',
    answer: 'Swastik AI is an autonomous AI voice receptionist designed specifically for Indian clinics. It acts as your 24/7 front desk—handling inbound patient calls, answering clinic-related queries, and automatically booking appointments in your calendar.',
  },
  {
    question: 'How fast is the voice AI? Will it feel robotic?',
    answer: 'Not at all. Powered by the latest Gemini 2.0 Flash models, Swastik AI delivers a sub-400ms turnaround latency. It features true bidirectional audio, meaning patients can interrupt it mid-sentence and it will respond naturally, just like a real human.',
  },
  {
    question: 'Can it understand Indian accents and Hinglish?',
    answer: 'Absolutely. Swastik AI is heavily optimized for regional Indian accents. It fluidly switches between English, Hindi, and colloquial Hinglish in the same conversation, making it highly accessible to all your patients.',
  },
  {
    question: 'Does it integrate with my existing calendar or EHR?',
    answer: 'Yes! Swastik AI syncs in real-time with Google Calendar and popular EHR systems. It intelligently checks for available slots, prevents double bookings, and can even handle reschedules or cancellations automatically.',
  },
  {
    question: 'What happens during a medical emergency?',
    answer: 'Patient safety is our top priority. Swastik AI includes an intelligent triage system. If a caller mentions acute symptoms or an emergency, the AI will immediately alert your duty staff and seamlessly hand off the call to a human receptionist or doctor.',
  },
  {
    question: 'Is it difficult to set up?',
    answer: 'You can deploy your AI receptionist in under 10 minutes. Simply customize your doctor profile, link your calendar, and you will receive a dedicated phone number (or you can forward your existing calls) to start automating your front desk instantly.',
  },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="relative py-24 px-6 bg-[rgba(8,14,23,0.3)]">
      <div className="max-w-4xl mx-auto">
        <AnimeScrollReveal direction="up" distance={30} duration={800} ease="outExpo">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] text-xs font-semibold text-[#14c8b2] mb-4">
              <HelpCircle className="w-3.5 h-3.5" /> Got Questions?
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-[#94a3b8] max-w-lg mx-auto">
              Everything you need to know about setting up and using Swastik AI for your clinic.
            </p>
          </div>
        </AnimeScrollReveal>

        <div className="space-y-4">
          <AnimeScrollReveal
            childSelector=".faq-item"
            staggerMs={80}
            direction="up"
            distance={20}
          >
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index
              return (
                <div
                  key={index}
                  className="faq-item rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition-colors hover:border-[rgba(20,200,178,0.3)] hover:bg-[rgba(20,200,178,0.02)]"
                >
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none cursor-pointer"
                  >
                    <span className={`text-base font-semibold transition-colors ${isOpen ? 'text-[#14c8b2]' : 'text-white'}`}>
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-[#94a3b8] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#14c8b2]' : ''}`}
                    />
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-6 text-sm text-[#94a3b8] leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </AnimeScrollReveal>
        </div>
      </div>
    </section>
  )
}
