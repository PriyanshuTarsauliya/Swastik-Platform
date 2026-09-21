import React, { useState } from 'react'
import { PhoneCall, Radio, CheckCircle2, ArrowRight, Zap, Bot, Mic2, ShieldCheck, UserCheck, MessageSquare } from 'lucide-react'
import ShimmerButton from './inspira/ShimmerButton'
import CardSpotlight from './inspira/CardSpotlight'
import AudioWavePlayer from './AudioWavePlayer'
import { cn } from '../lib/utils'

export const VoiceSegmentation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'generator'>('agents')

  return (
    <section id="solutions" className="relative py-24 px-6 bg-[rgba(4,7,12,0.8)]">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(0,229,255,0.3)] bg-[rgba(0,229,255,0.1)] px-4 py-1.5 text-xs font-semibold text-[#00e5ff] mb-4">
            <Radio className="h-3.5 w-3.5" /> Product Architecture & Segmentation
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
            Two Powerful Technologies. <br className="hidden sm:inline" />
            <span className="gradient-text">One Unified Voice Platform.</span>
          </h2>
          <p className="text-[#94a3b8] max-w-2xl mx-auto text-base">
            Whether you need an autonomous 24/7 telephone receptionist or lifelike doctor voice generation for patient memos, Swastik delivers enterprise-ready voice intelligence.
          </p>

          {/* Interactive Segment Switcher Tabs */}
          <div className="mt-8 inline-flex items-center rounded-2xl border border-white/10 bg-[rgba(8,14,23,0.9)] p-1.5 backdrop-blur-xl shadow-xl">
            <button
              onClick={() => setActiveTab('agents')}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-bold transition-all cursor-pointer',
                activeTab === 'agents'
                  ? 'bg-gradient-to-r from-[#14c8b2] to-[#00e5ff] text-[#04070c] shadow-[0_0_20px_rgba(20,200,178,0.4)]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
              )}
            >
              <PhoneCall className="h-4 w-4" />
              <span>1. Conversational Voice Agents</span>
              <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-mono">24/7 Live Calls</span>
            </button>

            <button
              onClick={() => setActiveTab('generator')}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-bold transition-all cursor-pointer',
                activeTab === 'generator'
                  ? 'bg-gradient-to-r from-[#00e5ff] to-[#f5a623] text-[#04070c] shadow-[0_0_20px_rgba(245,166,35,0.4)]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
              )}
            >
              <Mic2 className="h-4 w-4" />
              <span>2. Expressive Voice Studio</span>
              <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-mono">Clones & TTS</span>
            </button>
          </div>
        </div>

        {/* Tab 1 Content: Conversational Voice Agents */}
        {activeTab === 'agents' && (
          <div className="space-y-12 animate-fade-in">
            {/* Top Showcase Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Key Features */}
              <div className="lg:col-span-6 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-lg bg-[rgba(20,200,178,0.15)] px-3 py-1 text-xs font-bold text-[#14c8b2]">
                  <Bot className="h-4 w-4" /> Real-Time Inbound & Outbound Calling
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  Autonomous Phone AI That Speaks, Listens & Solves in Real Time
                </h3>
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  Swastik Voice Agents replace outdated IVR phone trees with a warm, natural human receptionist. Operating with <strong className="text-white">&lt;380ms latency</strong>, callers can speak in natural Hinglish, interrupt when needed, and have their appointment locked into the clinic calendar in 90 seconds.
                </p>

                <div className="space-y-3.5 pt-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#14c8b2] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Full Natural Interruption Handling</h4>
                      <p className="text-xs text-[#94a3b8]">Patients can talk over the AI or correct their timing mid-sentence without system confusion.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#14c8b2] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Proactive Outbound Calls & Recalls</h4>
                      <p className="text-xs text-[#94a3b8]">Autonomously calls patients to confirm tomorrow&apos;s appointments, verify reports, or remind about routine reviews.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#14c8b2] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Seamless Human Escalation</h4>
                      <p className="text-xs text-[#94a3b8]">Detects distress or critical medical concerns and immediately transfers the phone line to the on-call doctor or front desk.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-4">
                  <ShimmerButton
                    href="/console/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    shimmerColor="#14c8b2"
                    className="py-3 px-6 text-xs"
                  >
                    <span>Test Interactive Agent</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </ShimmerButton>
                  <a
                    href="/console/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#14c8b2] hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <span>Open Live Audio Console</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Right Column: Static Architecture Preview (Issue 23 fix) */}
              <div className="lg:col-span-6">
                <div className="rounded-3xl border border-[rgba(20,200,178,0.3)] bg-[rgba(8,14,23,0.95)] p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#14c8b2] animate-pulse" />
                      <span className="text-sm font-bold text-white">Voice Agent Telephony Pipeline</span>
                    </div>
                    <span className="text-xs font-mono text-[#14c8b2] rounded-md bg-[rgba(20,200,178,0.1)] px-2.5 py-1">
                      Sub-400ms Turnaround
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-4 transition-all hover:border-[rgba(20,200,178,0.3)]">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(20,200,178,0.15)] text-[#14c8b2]">
                        <PhoneCall className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">1. Inbound Audio Ingestion</div>
                        <p className="text-xs text-[#94a3b8] mt-0.5">
                          High-fidelity 16kHz PCM audio stream via SIP trunking and WebRTC worklet.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-4 transition-all hover:border-[rgba(0,229,255,0.3)]">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,229,255,0.15)] text-[#00e5ff]">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">2. Gemini Live Bidirectional Engine</div>
                        <p className="text-xs text-[#94a3b8] mt-0.5">
                          Instant Hinglish comprehension, barge-in detection, and real-time tool calling.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-4 transition-all hover:border-[rgba(34,197,94,0.3)]">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(34,197,94,0.15)] text-[#22c55e]">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">3. EHR & WhatsApp Dispatch</div>
                        <p className="text-xs text-[#94a3b8] mt-0.5">
                          Atomic calendar locking, SMS/WhatsApp receipts, and doctor dashboard sync.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Pillars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              <CardSpotlight gradientColor="rgba(20, 200, 178, 0.15)">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(20,200,178,0.15)] text-[#14c8b2] mb-4">
                  <Zap className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-white mb-1.5">Sub-400ms Bidirectional Audio</h4>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Direct WebSocket pipeline to Gemini 2.0 Flash Live API ensures zero awkward pauses or robotic hesitations.
                </p>
              </CardSpotlight>

              <CardSpotlight gradientColor="rgba(0, 229, 255, 0.15)">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(0,229,255,0.15)] text-[#00e5ff] mb-4">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-white mb-1.5">Omnichannel WhatsApp Dispatch</h4>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Immediately after the call, sends WhatsApp booking summaries, doctor clinic directions, and digital patient intake forms.
                </p>
              </CardSpotlight>

              <CardSpotlight gradientColor="rgba(245, 166, 35, 0.15)">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(245,166,35,0.15)] text-[#f5a623] mb-4">
                  <UserCheck className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-white mb-1.5">Emergency Triage & Handoff</h4>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Smart keyword and emotion triage transfers the call directly to staff or duty emergency doctor with full live audio transcript.
                </p>
              </CardSpotlight>
            </div>
          </div>
        )}

        {/* Tab 2 Content: Expressive Voice Studio & Generator */}
        {activeTab === 'generator' && (
          <div className="space-y-12 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Features */}
              <div className="lg:col-span-6 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-lg bg-[rgba(245,166,35,0.15)] px-3 py-1 text-xs font-bold text-[#f5a623]">
                  <Mic2 className="h-4 w-4" /> Neural Voice Generation & Doctor Voice Cloning
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  Studio-Quality Medical Voices That Resonate With Human Warmth
                </h3>
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  Synthesize personalized voice messages, post-operative care instructions, and clinic announcements in your doctor&apos;s exact voice. Patients feel cared for by a familiar, trustworthy clinician rather than a sterile robot.
                </p>

                <div className="space-y-3.5 pt-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#f5a623] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Custom Doctor Voice Clones</h4>
                      <p className="text-xs text-[#94a3b8]">Clone your head physician&apos;s voice with just 60 seconds of reference audio, verified with physician consent protocols.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#f5a623] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Multi-Lingual & Dialect Control</h4>
                      <p className="text-xs text-[#94a3b8]">Generate fluent audio in Hinglish, pure Hindi, English, and regional vernaculars with authentic pronunciation of Indian medical terminology.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#f5a623] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Emotion & Tone Modulation</h4>
                      <p className="text-xs text-[#94a3b8]">Dynamically adjust warmth, reassurance, urgency, or clinical authority depending on the patient context.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-4">
                  <ShimmerButton
                    href="#pricing"
                    shimmerColor="#f5a623"
                    className="py-3 px-6 text-xs"
                  >
                    <span>Explore Studio Plans</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </ShimmerButton>
                  <span className="text-xs text-[#94a3b8] flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-[#14c8b2]" /> Anti-Spoofing & Voice Protection Guaranteed
                  </span>
                </div>
              </div>

              {/* Right Column: Audio Wave Player */}
              <div className="lg:col-span-6">
                <AudioWavePlayer />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default VoiceSegmentation
