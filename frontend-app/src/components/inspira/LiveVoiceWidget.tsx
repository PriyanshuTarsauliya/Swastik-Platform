import React, { useState, useEffect, useRef } from 'react'
import {
  Mic, PhoneCall, Volume2, Sparkles, CheckCircle2,
  MessageSquare, ShieldCheck, ArrowUpRight, PhoneOff,
  Activity, RefreshCw
} from 'lucide-react'
import BorderBeam from './BorderBeam'

interface Scenario {
  patient: string
  swastik: string
  intent: string
  action: string
}

const SCENARIOS: Scenario[] = [
  {
    patient: "नमस्ते, मुझे कल शाम 5:30 बजे Dr. Sharma के साथ अपॉइंटमेंट बुक करना है।",
    swastik: "नमस्ते! बिल्कुल, कल शाम 5:30 बजे डॉ. शर्मा का स्लॉट उपलब्ध है। क्या मैं आपका नाम और फ़ोन नंबर नोट कर लूँ?",
    intent: "Appointment Booking",
    action: "Slot Reserved (5:30 PM Tomorrow)",
  },
  {
    patient: "डॉक्टर साहब की कंसल्टेशन फीस और क्लिनिक के नियम क्या हैं?",
    swastik: "डॉ. शर्मा का नया कंसल्टेशन ₹500 है जिसमें 7 दिन की मेडिसिन रिव्यू शामिल है। मैंने आपके WhatsApp पर क्लिनिक की पूरी गाइडलाइन्स और लोकेशन भेज दी है!",
    intent: "Consultation Details",
    action: "WhatsApp Guidelines Sent",
  },
  {
    patient: "What are the clinic working hours and location in Kanpur?",
    swastik: "Dr. Sharma's Clinic is open Monday to Saturday from 10:00 AM to 1:00 PM and 5:00 PM to 8:30 PM near Swaroop Nagar. Would you like directions via SMS?",
    intent: "Clinic Timings",
    action: "Location Link Ready",
  },
  {
    patient: "Can I reschedule my appointment from today to Saturday morning?",
    swastik: "Sure! I have rescheduled your appointment to Saturday at 11:00 AM with Dr. Sharma. An instant confirmation is on its way to your WhatsApp!",
    intent: "Reschedule",
    action: "Calendar Synced & SMS Sent",
  },
  {
    patient: "क्या आप हेल्थ इंश्योरेंस या मेडिक्लेम रीइंबर्समेंट स्वीकार करते हैं?",
    swastik: "जी बिल्कुल! डॉक्टर साहब का स्टैम्प और रजिस्ट्रेशन नंबर वाला मेडिकल बिल मिलता है जिससे Star Health, Care, HDFC ERGO सबमें आसानी से क्लेम हो जाता है!",
    intent: "Insurance & Mediclaim",
    action: "Reimbursement Invoice Issued",
  },
  {
    patient: "कंसल्टेशन से पहले क्या परहेज या रिपोर्ट्स लाने की ज़रूरत है?",
    swastik: "दवाई लेने से 30 मिनट पहले कच्चा प्याज़, लहसुन और स्ट्रॉन्ग कॉफ़ी न लें। अपनी पिछली ब्लड रिपोर्ट्स साथ लाएं, पूरी गाइडलाइन्स आपके WhatsApp पर भी भेज दी हैं!",
    intent: "Pre-Visit Guidelines",
    action: "Dietary Rules Sent",
  },
]

export const LiveVoiceWidget: React.FC = () => {
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0)
  const [isSimulatedSpeaking, setIsSimulatedSpeaking] = useState(true)
  const [audioWaves, setAudioWaves] = useState<number[]>([14, 30, 48, 22, 65, 38, 24, 52, 18])

  // ── Live Voice WebSocket & Web Audio State ──
  const [isLiveActive, setIsLiveActive] = useState(false)
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [liveTranscript, setLiveTranscript] = useState<{ role: 'user' | 'swastik'; text: string }[]>([])
  const [callDuration, setCallDuration] = useState(0)
  const [backgroundTool, setBackgroundTool] = useState<string | null>(null)

  // Audio nodes refs
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const voiceGainRef = useRef<GainNode | null>(null)
  const nextStartRef = useRef<number>(0)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const timerIntervalRef = useRef<any>(null)

  // Simulated audio spectrum animation
  useEffect(() => {
    if (!isSimulatedSpeaking && !isLiveActive) {
      setAudioWaves([6, 6, 6, 6, 6, 6, 6, 6, 6])
      return
    }
    const interval = setInterval(() => {
      setAudioWaves([
        Math.floor(Math.random() * 40 + 10),
        Math.floor(Math.random() * 55 + 15),
        Math.floor(Math.random() * 65 + 20),
        Math.floor(Math.random() * 45 + 10),
        Math.floor(Math.random() * 70 + 25),
        Math.floor(Math.random() * 50 + 15),
        Math.floor(Math.random() * 60 + 20),
        Math.floor(Math.random() * 40 + 12),
        Math.floor(Math.random() * 30 + 8),
      ])
    }, 180)

    return () => clearInterval(interval)
  }, [isSimulatedSpeaking, isLiveActive])

  // Call timer effect
  useEffect(() => {
    if (isLiveActive) {
      setCallDuration(0)
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      setCallDuration(0)
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [isLiveActive])

  // Stop incoming audio chunks
  const stopIncomingAudio = () => {
    activeSourcesRef.current.forEach((src) => {
      try { src.stop() } catch {}
    })
    activeSourcesRef.current = []
    nextStartRef.current = 0
  }

  // Play incoming 24kHz Int16 PCM audio chunk with optimized jitter buffer
  const playIncomingAudio = (buffer: ArrayBuffer) => {
    if (!audioCtxRef.current || !voiceGainRef.current) return
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const int16 = new Int16Array(buffer)
    const f32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      f32[i] = int16[i] / 0x8000
    }

    const audioBuffer = ctx.createBuffer(1, f32.length, 24000)
    audioBuffer.getChannelData(0).set(f32)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(voiceGainRef.current)

    const now = ctx.currentTime
    // Ultra-low latency jitter buffer: 35ms headroom instead of 120ms to eliminate stutter
    if (nextStartRef.current < now) {
      nextStartRef.current = now + 0.035
    }
    source.start(nextStartRef.current)
    nextStartRef.current += audioBuffer.duration

    activeSourcesRef.current.push(source)
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source)
    }
  }

  // Terminate Live Call
  const stopLiveCall = () => {
    setIsLiveActive(false)
    setLiveStatus('idle')
    setStatusMessage('')

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }

    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch {}
      wsRef.current = null
    }

    stopIncomingAudio()
  }

  // Start Live Call
  const startLiveCall = async () => {
    try {
      setLiveStatus('connecting')
      setStatusMessage('Requesting microphone access...')

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      micStreamRef.current = stream

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtxClass()
      ctx.onstatechange = () => {
        if (ctx.state === 'interrupted' || ctx.state === 'suspended') {
          ctx.resume().catch(() => {})
        }
      }
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      audioCtxRef.current = ctx

      // Setup gain node
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(1, ctx.currentTime)
      gain.connect(ctx.destination)
      voiceGainRef.current = gain

      // Load Worklet
      await ctx.audioWorklet.addModule('/pcm-processor.js')
      const source = ctx.createMediaStreamSource(stream)
      const worklet = new AudioWorkletNode(ctx, 'pcm-processor')

      // Connect WebSocket
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      // Use location.host which goes through Vite proxy in dev and FastAPI in prod
      const wsUrl = `${proto}//${window.location.host}/ws`
      setStatusMessage('Connecting to Dr. Sharma\'s AI Voice Engine...')

      const socket = new WebSocket(wsUrl)
      socket.binaryType = 'arraybuffer'
      wsRef.current = socket

      socket.onopen = () => {
        setLiveStatus('connected')
        setIsLiveActive(true)
        setStatusMessage('Connected! Speak into your microphone.')
      }

      socket.onclose = () => {
        stopLiveCall()
      }

      socket.onerror = () => {
        setLiveStatus('error')
        setStatusMessage('WebSocket connection error. Please ensure backend is running.')
        stopLiveCall()
      }

      socket.onmessage = (evt) => {
        if (typeof evt.data !== 'string') {
          // Binary audio chunk from Gemini Live
          playIncomingAudio(evt.data)
        } else {
          try {
            const msg = JSON.parse(evt.data)
            if (msg.type === 'transcript') {
              setLiveTranscript((prev) => [
                ...prev.slice(-3),
                { role: msg.role, text: msg.text },
              ])
            } else if (msg.type === 'background_tool_start') {
              setBackgroundTool(msg.name)
            } else if (msg.type === 'background_tool_end') {
              setBackgroundTool(null)
            } else if (msg.type === 'interrupted') {
              stopIncomingAudio()
            }
          } catch (e) {
            console.error('Error parsing WS message:', e)
          }
        }
      }

      // Stream mic PCM from worklet with acoustic echo gating
      let speechFrameCount = 0
      const BARGE_THRESHOLD = 0.065

      worklet.port.onmessage = (e) => {
        if (socket.readyState !== WebSocket.OPEN || !e.data.pcm) return

        const isAISpeaking = activeSourcesRef.current.length > 0
        const rms = e.data.rms || 0

        if (isAISpeaking) {
          // AI is actively speaking: prevent speaker bleed from triggering self-interruption.
          // Require deliberate caller speech (louder than speaker output) across consecutive frames.
          if (rms >= BARGE_THRESHOLD) {
            speechFrameCount++
            if (speechFrameCount >= 2) {
              stopIncomingAudio()
              socket.send(e.data.pcm)
            }
          } else {
            speechFrameCount = Math.max(0, speechFrameCount - 1)
          }
        } else {
          // AI is listening: stream all mic audio cleanly without threshold
          speechFrameCount = 0
          socket.send(e.data.pcm)
        }
      }

      source.connect(worklet)
      const silentSink = ctx.createGain()
      silentSink.gain.value = 0
      silentSink.connect(ctx.destination)
      worklet.connect(silentSink)

    } catch (err: any) {
      console.error('Failed to start mic / audio stream:', err)
      setLiveStatus('error')
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatusMessage('Microphone access was denied. Please allow microphone in browser.')
      } else {
        setStatusMessage(`Could not start call: ${err.message || 'Check audio device'}`)
      }
      stopLiveCall()
    }
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const current = SCENARIOS[activeScenarioIdx]

  return (
    <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.12)] bg-[rgba(8,14,23,0.95)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl md:p-8">
      {/* Inspira UI Border Beam on the widget */}
      <BorderBeam size={280} duration={9} colorFrom="#14c8b2" colorTo="#00e5ff" borderWidth={2} />

      {/* Top Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#14c8b2] to-[#00e5ff] p-0.5 shadow-[0_0_15px_rgba(20,200,178,0.4)]">
            <img
              src="/swastik-brand-logo.png?v=3.0"
              alt="Swastik Logo"
              className="h-full w-full rounded-[10px] object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <Mic className="h-5 w-5 text-[#04070c] absolute" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Dr. Sharma&apos;s Clinic</h3>
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isLiveActive ? 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]' : 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isLiveActive ? 'bg-[#ef4444]' : 'bg-[#22c55e]'} animate-pulse`} />
                {isLiveActive ? `Live Call (${formatTimer(callDuration)})` : 'Live AI Receptionist'}
              </span>
            </div>
            <p className="text-xs text-[#94a3b8]">Homeopathy & Holistic Care • Real-Time Voice Agent</p>
          </div>
        </div>

        {/* Live Audio Spectrum Bars */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSimulatedSpeaking(!isSimulatedSpeaking)}
            title={isSimulatedSpeaking ? 'Pause Spectrum' : 'Resume Spectrum'}
            aria-label={isSimulatedSpeaking ? 'Pause audio spectrum visualization' : 'Resume audio spectrum visualization'}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition-all hover:border-[rgba(20,200,178,0.4)]"
          >
            <Volume2 className={`h-4 w-4 transition-colors ${isSimulatedSpeaking || isLiveActive ? 'text-[#14c8b2]' : 'text-[#94a3b8]'}`} />
            <div className="flex h-4 items-center gap-1">
              {audioWaves.map((height, i) => (
                <span
                  key={i}
                  style={{ height: `${Math.max(20, height)}%` }}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isSimulatedSpeaking || isLiveActive ? 'bg-gradient-to-t from-[#14c8b2] to-[#00e5ff]' : 'bg-[#475569]'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-mono text-[#00e5ff] pl-1">
              {isLiveActive ? 'LIVE' : isSimulatedSpeaking ? '0.38s' : 'IDLE'}
            </span>
          </button>
        </div>
      </div>

      {/* Live Call Control Banner */}
      <div className="relative z-10 mt-5 rounded-2xl border border-[rgba(20,200,178,0.3)] bg-gradient-to-r from-[rgba(20,200,178,0.1)] to-[rgba(0,229,255,0.05)] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            isLiveActive ? 'bg-red-500/20 text-red-400' : 'bg-[#14c8b2]/20 text-[#14c8b2]'
          }`}>
            <Mic className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              {isLiveActive ? 'Live Voice Call Active' : 'Speak Directly to AI Receptionist'}
              {isLiveActive && <span className="text-xs font-mono text-red-400 font-bold">REC</span>}
            </h4>
            <p className="text-xs text-[#94a3b8]">
              {statusMessage || 'Click the button to talk using your microphone (sub-400ms latency)'}
            </p>
            {backgroundTool && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#00e5ff] animate-pulse">
                <Sparkles className="h-3 w-3" />
                <span>Background Task: Executing {backgroundTool}...</span>
              </div>
            )}
          </div>
        </div>

        {isLiveActive ? (
          <button
            onClick={stopLiveCall}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all hover:bg-red-700 cursor-pointer"
          >
            <PhoneOff className="h-4 w-4" />
            <span>End Call</span>
          </button>
        ) : (
          <button
            onClick={startLiveCall}
            disabled={liveStatus === 'connecting'}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#14c8b2] px-5 py-2.5 text-xs font-bold text-[#04070c] shadow-[0_0_20px_rgba(20,200,178,0.4)] transition-all hover:bg-[#00e5ff] disabled:opacity-50 cursor-pointer"
          >
            {liveStatus === 'connecting' ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                <span>Speak to Live AI</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Live Voice Real-Time Transcript Display (When in call) */}
      {isLiveActive && liveTranscript.length > 0 && (
        <div className="relative z-10 mt-4 rounded-2xl border border-[rgba(20,200,178,0.3)] bg-[rgba(4,7,12,0.85)] p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#14c8b2] tracking-wide">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Live Dialogue Stream
            </span>
            <span className="text-[#94a3b8] font-mono">{formatTimer(callDuration)}</span>
          </div>
          {liveTranscript.map((t, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs">
              <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                t.role === 'user' ? 'bg-white/10 text-white' : 'bg-[#14c8b2]/20 text-[#14c8b2]'
              }`}>
                {t.role === 'user' ? 'YOU' : 'SWASTIK'}
              </span>
              <span className="text-[#f8fafc] flex-1">{t.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Scenario Selector Pills */}
      <div className="relative z-10 mt-5">
        <p className="text-xs font-semibold text-[#94a3b8] mb-4">
          Or test simulated clinical inquiries:
        </p>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((sc, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveScenarioIdx(idx)
                setIsSimulatedSpeaking(true)
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeScenarioIdx === idx
                  ? 'border border-[#14c8b2] bg-[rgba(20,200,178,0.2)] text-[#14c8b2] shadow-[0_0_12px_rgba(20,200,178,0.3)]'
                  : 'border border-white/10 bg-white/5 text-[#94a3b8] hover:border-white/20 hover:text-white'
              }`}
            >
              {sc.intent}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Dialogue Exchange Box */}
      <div className="relative z-10 mt-5 space-y-3 rounded-2xl border border-white/10 bg-[rgba(4,7,12,0.7)] p-4 md:p-5">
        {/* Patient Message */}
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">
            PT
          </div>
          <div className="rounded-2xl rounded-tl-none border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white">
            <span className="block text-xs font-medium text-[#94a3b8] mb-1">Patient Call</span>
            {current.patient}
          </div>
        </div>

        {/* Swastik AI Response */}
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#14c8b2] text-xs font-bold text-[#04070c] shadow-[0_0_10px_rgba(20,200,178,0.5)]">
            AI
          </div>
          <div className="rounded-2xl rounded-tl-none border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.08)] px-4 py-3 text-sm text-[#f8fafc]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#14c8b2] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Swastik Voice Engine
              </span>
              <span className="text-xs text-[#22c55e] flex items-center gap-1.5 font-mono">
                <CheckCircle2 className="h-3.5 w-3.5" /> Intent Identified
              </span>
            </div>
            {current.swastik}

            {/* Instant Trigger Badge */}
            <div className="mt-2.5 flex items-center gap-2 rounded-md border border-[rgba(245,166,35,0.3)] bg-[rgba(245,166,35,0.1)] px-2.5 py-1 text-xs text-[#f5a623]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Auto-Action: <strong>{current.action}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Widget Bottom Actions */}
      <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 text-xs text-[#94a3b8]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#14c8b2]" /> HIPAA-Compliant Voice
          </span>
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-[#22c55e]" /> WhatsApp CRM Sync
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-[#94a3b8] transition-all hover:text-white hover:border-white/30"
          >
            <Activity className="h-3.5 w-3.5 text-[#14c8b2]" />
            <span>Doctor Portal</span>
          </a>

          <a
            href="/console/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:border-[rgba(20,200,178,0.4)] hover:bg-[rgba(20,200,178,0.1)] hover:text-[#14c8b2]"
          >
            <PhoneCall className="h-3.5 w-3.5 text-[#14c8b2]" />
            <span>Full 3D Console</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}

export default LiveVoiceWidget
