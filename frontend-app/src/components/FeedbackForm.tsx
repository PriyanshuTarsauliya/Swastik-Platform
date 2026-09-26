import { useState } from 'react'
import { Send, CheckCircle2, MessageSquare } from 'lucide-react'
import AnimeScrollReveal from './inspira/AnimeScrollReveal'

export default function FeedbackForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    // Simulate API call
    setTimeout(() => {
      setStatus('success')
      setFormData({ name: '', email: '', message: '' })
      // Reset success message after 3 seconds
      setTimeout(() => setStatus('idle'), 3000)
    }, 1500)
  }

  return (
    <section id="feedback" className="relative py-24 px-6 bg-[rgba(4,7,12,0.8)] border-t border-white/5">
      <div className="max-w-3xl mx-auto">
        <AnimeScrollReveal direction="up" distance={30} duration={800} ease="outExpo">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] text-xs font-semibold text-[#14c8b2] mb-4">
              <MessageSquare className="w-3.5 h-3.5" /> Share Your Thoughts
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
              We Value Your Feedback
            </h2>
            <p className="text-[#94a3b8] max-w-lg mx-auto">
              Help us improve Swastik AI. Whether it's a feature request, bug report, or general feedback, we'd love to hear from you.
            </p>
          </div>
        </AnimeScrollReveal>

        <AnimeScrollReveal direction="up" distance={20} delay={100} duration={800}>
          <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-6 sm:p-8 backdrop-blur-sm shadow-[0_0_40px_rgba(20,200,178,0.05)]">
            {status === 'success' ? (
              <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-full bg-[#14c8b2]/20 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#14c8b2]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Thank you!</h3>
                <p className="text-[#94a3b8]">Your feedback has been submitted successfully.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label htmlFor="name" className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-[rgba(0,0,0,0.3)] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                      placeholder="Dr. Smith"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-[rgba(0,0,0,0.3)] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                      placeholder="doctor@clinic.com"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label htmlFor="message" className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-[rgba(0,0,0,0.3)] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all resize-none"
                    placeholder="Tell us what you think..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full flex items-center justify-center gap-2 bg-[#14c8b2] text-[#04070c] font-bold text-sm py-3.5 rounded-xl hover:bg-[#2dd4bf] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {status === 'submitting' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#04070c] border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Feedback</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </AnimeScrollReveal>
      </div>
    </section>
  )
}
