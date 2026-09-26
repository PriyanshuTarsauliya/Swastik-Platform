import React, { useState, useEffect, useRef } from 'react'
import {
  Mic, MicOff, Volume2, Sparkles, CheckCircle2,
  ShieldCheck, PhoneOff, Activity, RefreshCw, Zap
} from 'lucide-react'
import BorderBeam from './BorderBeam'
import GlyphSphere from './GlyphSphere'
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
    patient: "What are the clinic working hours and location in Delhi NCR?",
    swastik: "Dr. Sharma's Clinic is open Monday to Saturday from 10:00 AM to 1:00 PM and 5:00 PM to 8:30 PM. Would you like directions via SMS?",
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

export interface LiveVoiceWidgetProps {
  clinicId?: string
  clinicName?: string
  doctorName?: string
  themeColor?: string
  wsPath?: string
  hideHeader?: boolean
  variant?: 'full' | 'hero' | 'compact'
  onCallStateChange?: (isActive: boolean) => void
}

export const LiveVoiceWidget: React.FC<LiveVoiceWidgetProps> = ({ 
  clinicId = 'dr-sharma', 
  clinicName = "Dr. Sharma's Clinic",
  doctorName,
  themeColor: _themeColor = '#14c8b2',
  wsPath,
  hideHeader = false,
  variant: _variant = 'full',
  onCallStateChange,
}) => {
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0)
  const [isSimulatedSpeaking, setIsSimulatedSpeaking] = useState(true)
  const [audioWaves, setAudioWaves] = useState<number[]>([14, 30, 48, 22, 65, 38, 24, 52, 18])

  // ── Live Voice WebSocket & Web Audio State ──
  const [isLiveActive, setIsLiveActive] = useState(false)
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [liveTranscript, setLiveTranscript] = useState<{ role: 'user' | 'swastik'; text: string; time?: string }[]>([])
  const [callDuration, setCallDuration] = useState(0)
  const [backgroundTool, setBackgroundTool] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [showSimulations, setShowSimulations] = useState(false)

  // Audio nodes refs
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const voiceGainRef = useRef<GainNode | null>(null)
  const nextStartRef = useRef<number>(0)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const timerIntervalRef = useRef<any>(null)
  const isMutedRef = useRef(false)

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    onCallStateChange?.(isLiveActive)
  }, [isLiveActive, onCallStateChange])

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
    }, 150)

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
    // Ultra-low latency jitter buffer: 35ms headroom
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
    setIsMuted(false)

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

  // Toggle Mute
  const toggleMute = () => {
    if (!micStreamRef.current) return
    const newMuted = !isMuted
    setIsMuted(newMuted)
    micStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted
    })
  }

  // Start Live Call
  const startLiveCall = async () => {
    try {
      setLiveStatus('connecting')
      setStatusMessage('Requesting microphone permission...')

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
        } as any,
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

      // Hardware-accelerated DSP Speech Filter Chain:
      const highpass = ctx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.setValueAtTime(85, ctx.currentTime)
      highpass.Q.setValueAtTime(0.7, ctx.currentTime)

      const lowpass = ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.setValueAtTime(4000, ctx.currentTime)
      lowpass.Q.setValueAtTime(0.7, ctx.currentTime)

      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.setValueAtTime(-45, ctx.currentTime)
      compressor.knee.setValueAtTime(10, ctx.currentTime)
      compressor.ratio.setValueAtTime(4, ctx.currentTime)
      compressor.attack.setValueAtTime(0.003, ctx.currentTime)
      compressor.release.setValueAtTime(0.15, ctx.currentTime)

      const source = ctx.createMediaStreamSource(stream)
      source.connect(highpass)
      highpass.connect(lowpass)
      lowpass.connect(compressor)

      // Load Worklet
      await ctx.audioWorklet.addModule('/pcm-processor.js')
      const worklet = new AudioWorkletNode(ctx, 'pcm-processor')
      compressor.connect(worklet)

      // Connect WebSocket
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const path = wsPath || `/ws/${clinicId}`
      const wsUrl = `${proto}//${window.location.host}${path}`
      setStatusMessage(`Connecting to ${clinicName} AI...`)

      const socket = new WebSocket(wsUrl)
      socket.binaryType = 'arraybuffer'
      wsRef.current = socket

      socket.onopen = () => {
        setLiveStatus('connected')
        setIsLiveActive(true)
        setStatusMessage('AI Receptionist is listening. Say hello!')
      }

      socket.onclose = () => {
        stopLiveCall()
      }

      socket.onerror = () => {
        setLiveStatus('error')
        setStatusMessage('Connection failed. Please retry.')
        stopLiveCall()
      }

      socket.onmessage = (evt) => {
        if (typeof evt.data !== 'string') {
          playIncomingAudio(evt.data)
        } else {
          try {
            const msg = JSON.parse(evt.data)
            if (msg.type === 'transcript') {
              const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              setLiveTranscript((prev) => [
                ...prev.slice(-6),
                { role: msg.role, text: msg.text, time: nowTime },
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
        if (socket.readyState !== WebSocket.OPEN || !e.data.pcm || isMutedRef.current) return

        const isAISpeaking = activeSourcesRef.current.length > 0
        const rms = e.data.rms || 0

        if (isAISpeaking) {
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
          speechFrameCount = 0
          socket.send(e.data.pcm)
        }
      }

      const silentSink = ctx.createGain()
      silentSink.gain.value = 0
      silentSink.connect(ctx.destination)
      worklet.connect(silentSink)

    } catch (err: any) {
      console.error('Failed to start mic / audio stream:', err)
      setLiveStatus('error')
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatusMessage('Microphone permission denied. Please allow microphone access in browser settings.')
      } else {
        setStatusMessage(`Audio error: ${err.message || 'Check microphone'}`)
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
    <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-white/[0.08] bg-[rgba(8,14,23,0.85)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl md:p-8">
      {/* Dynamic Border Beam */}
      <BorderBeam size={280} duration={8} colorFrom="#14c8b2" colorTo="#00e5ff" borderWidth={2} />

      {/* Top Header (Optional or Custom Branded) */}
      {!hideHeader && (
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#14c8b2] to-[#00e5ff] p-0.5 shadow-[0_0_20px_rgba(20,200,178,0.4)]">
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
                <h3 className="text-base font-bold text-white tracking-tight">{clinicName}</h3>
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                  isLiveActive ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isLiveActive ? 'bg-red-400' : 'bg-emerald-400'} animate-pulse`} />
                  {isLiveActive ? `Live Call (${formatTimer(callDuration)})` : 'AI Receptionist Ready'}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8]">
                {doctorName ? `${doctorName} • Real-Time Voice Agent` : 'Verified Healthcare Voice AI • Sub-350ms'}
              </p>
            </div>
          </div>

          {/* Audio Visualizer Pill */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
              <Volume2 className={`h-3.5 w-3.5 ${isLiveActive ? 'text-[#14c8b2] animate-pulse' : 'text-[#94a3b8]'}`} />
              <div className="flex h-3.5 items-center gap-0.5">
                {audioWaves.map((height, i) => (
                  <span
                    key={i}
                    style={{ height: `${Math.max(20, height)}%` }}
                    className={`w-0.5 rounded-full transition-all duration-150 ${
                      isLiveActive ? 'bg-gradient-to-t from-[#14c8b2] to-[#00e5ff]' : 'bg-[#475569]'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-mono font-bold text-[#00e5ff] uppercase tracking-wider pl-1">
                {isLiveActive ? 'LIVE' : 'READY'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO VOICE ORB CENTERPIECE ── */}
      <div className="relative z-10 flex flex-col items-center justify-center py-6 text-center">
        {/* Pulsing Glow Rings around the Orb */}
        <div className="relative flex items-center justify-center">
          {/* Outermost ambient glow */}
          <div className={`absolute h-48 w-48 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
            isLiveActive 
              ? 'bg-gradient-to-r from-red-500/25 via-[#14c8b2]/30 to-[#00e5ff]/25 scale-125' 
              : liveStatus === 'connecting'
              ? 'bg-amber-500/20 scale-110 animate-pulse'
              : 'bg-[#14c8b2]/15 hover:bg-[#14c8b2]/25'
          }`} />

          {/* Concentric Animated Ripple Rings when Live */}
          {isLiveActive && (
            <>
              <div className="absolute h-40 w-40 rounded-full border border-[#14c8b2]/30 animate-ping pointer-events-none" style={{ animationDuration: '2.5s' }} />
              <div className="absolute h-48 w-48 rounded-full border border-[#00e5ff]/20 animate-pulse pointer-events-none" />
            </>
          )}

          {/* Central Interactive Voice Orb Button */}
          <button
            onClick={isLiveActive ? stopLiveCall : startLiveCall}
            disabled={liveStatus === 'connecting'}
            aria-label={isLiveActive ? 'End voice call' : 'Start live voice call with AI receptionist'}
            className={`group relative flex h-28 w-28 md:h-32 md:w-32 items-center justify-center rounded-full transition-all duration-300 transform active:scale-95 cursor-pointer shadow-2xl focus:outline-none focus:ring-4 ${
              isLiveActive
                ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-[0_0_40px_rgba(239,68,68,0.5)] focus:ring-rose-500/40'
                : liveStatus === 'connecting'
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-[0_0_30px_rgba(245,166,35,0.4)] focus:ring-amber-500/40'
                : 'bg-gradient-to-tr from-[#14c8b2] via-[#00e5ff] to-[#10b981] shadow-[0_0_40px_rgba(20,200,178,0.45)] hover:shadow-[0_0_55px_rgba(20,200,178,0.65)] hover:scale-105 focus:ring-[#14c8b2]/40'
            }`}
          >
            {/* Inner Glass Disc */}
            <div className="absolute inset-1.5 rounded-full bg-[#04070C]/30 backdrop-blur-sm transition-opacity group-hover:opacity-10" />

            {/* Icon & State */}
            <div className="relative z-10 flex flex-col items-center justify-center text-white">
              {liveStatus === 'connecting' ? (
                <RefreshCw className="h-10 w-10 animate-spin text-white drop-shadow-md" />
              ) : isLiveActive ? (
                <div className="flex flex-col items-center">
                  <GlyphSphere size={40} glyphCount={1200} color="#14c8b2" />
                  <span className="text-[10px] font-black uppercase tracking-wider mt-1 text-white/90">End</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Mic className="h-11 w-11 text-[#04070C] drop-shadow transition-transform group-hover:scale-110" />
                  <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 text-[#04070C]">Talk</span>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Dynamic Status Title & Subtitle */}
        <div className="mt-5 space-y-1">
          <h4 className="text-lg md:text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            {isLiveActive ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                <span>In Call • {formatTimer(callDuration)}</span>
              </>
            ) : liveStatus === 'connecting' ? (
              <span>Connecting Voice Engine...</span>
            ) : (
              <span>Tap Orb to Speak with AI Receptionist</span>
            )}
          </h4>
          <p className="text-xs md:text-sm text-[#94a3b8] max-w-md mx-auto">
            {statusMessage || 'Natural voice conversation powered by Gemini Live API (sub-350ms turnaround)'}
          </p>
        </div>

        {/* Active Tool Execution Pill */}
        {backgroundTool && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-300 animate-pulse">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>AI Action: Executing {backgroundTool}...</span>
          </div>
        )}

        {/* Live Call Control Strip (Mute, Audio Toggle, End Call) */}
        {isLiveActive && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={toggleMute}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                isMuted
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-[#14c8b2]" />}
              <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>

            <button
              onClick={stopLiveCall}
              className="flex items-center gap-2 rounded-xl bg-red-600/90 hover:bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all cursor-pointer"
            >
              <PhoneOff className="h-4 w-4" />
              <span>Hang Up</span>
            </button>
          </div>
        )}
      </div>

      {/* ── LIVE TRANSCRIPT STREAM ── */}
      {isLiveActive && (
        <div className="relative z-10 mt-4 rounded-2xl border border-white/[0.08] bg-[#04070C]/80 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-[#14c8b2] pb-2 border-b border-white/[0.06] mb-3">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Live Dialogue Stream
            </span>
            <span className="text-[#94a3b8] font-mono text-[11px]">Real-time Transcription</span>
          </div>

          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {liveTranscript.length === 0 ? (
              <p className="text-xs text-[#64748b] italic text-center py-2">
                Listening for speech... (Try saying "Namaste, I want to book an appointment")
              </p>
            ) : (
              liveTranscript.map((t, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start gap-2.5 text-xs p-2 rounded-xl transition-all ${
                    t.role === 'user' 
                      ? 'bg-white/[0.04] border border-white/[0.06]' 
                      : 'bg-[#14c8b2]/[0.08] border border-[#14c8b2]/20'
                  }`}
                >
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                    t.role === 'user' ? 'bg-white/10 text-white' : 'bg-[#14c8b2] text-[#04070C]'
                  }`}>
                    {t.role === 'user' ? 'YOU' : 'AI'}
                  </span>
                  <span className="text-[#f8fafc] flex-1 leading-relaxed">{t.text}</span>
                  {t.time && <span className="text-[10px] text-[#64748b] font-mono shrink-0">{t.time}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── QUICK PATIENT INQUIRY PILLS ── */}
      {!isLiveActive && (
        <div className="relative z-10 mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2.5 text-center">
            Common Patient Inquiries (Speak anytime):
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "📅 Book appointment for tomorrow",
              "💰 Consultation fees & rules",
              "⏰ Clinic hours & directions",
              "💊 Medicine review & reports",
              "🔄 Reschedule my visit",
            ].map((prompt, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#cbd5e1] transition-all cursor-default select-none flex items-center gap-1.5"
              >
                <span>{prompt}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── SIMULATED CLINICAL DEMO (COLLAPSIBLE) ── */}
      <div className="relative z-10 mt-6 pt-4 border-t border-white/[0.06]">
        <button
          onClick={() => setShowSimulations(!showSimulations)}
          className="w-full flex items-center justify-between text-xs font-semibold text-[#94a3b8] hover:text-white transition-colors cursor-pointer py-1"
        >
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#14c8b2]" />
            <span>Interactive Clinical Dialogue Scenarios ({SCENARIOS.length})</span>
          </span>
          <span className="text-[11px] text-[#14c8b2]">
            {showSimulations ? 'Hide Scenarios ▲' : 'Explore Sample Scenarios ▼'}
          </span>
        </button>

        {showSimulations && (
          <div className="mt-4 space-y-4">
            {/* Scenario Pills */}
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((sc, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveScenarioIdx(idx)
                    setIsSimulatedSpeaking(true)
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    activeScenarioIdx === idx
                      ? 'border border-[#14c8b2] bg-[rgba(20,200,178,0.2)] text-[#14c8b2] shadow-[0_0_12px_rgba(20,200,178,0.3)]'
                      : 'border border-white/10 bg-white/5 text-[#94a3b8] hover:border-white/20 hover:text-white'
                  }`}
                >
                  {sc.intent}
                </button>
              ))}
            </div>

            {/* Simulated Exchange Box */}
            <div className="space-y-3 rounded-2xl border border-white/10 bg-[rgba(4,7,12,0.7)] p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">
                  PT
                </div>
                <div className="rounded-2xl rounded-tl-none border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white flex-1">
                  <span className="block text-xs font-medium text-[#94a3b8] mb-1">Patient Call</span>
                  {current.patient}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#14c8b2] text-xs font-bold text-[#04070c] shadow-[0_0_10px_rgba(20,200,178,0.5)]">
                  AI
                </div>
                <div className="rounded-2xl rounded-tl-none border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.08)] px-4 py-3 text-sm text-[#f8fafc] flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#14c8b2] flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Swastik Voice Engine
                    </span>
                    <span className="text-xs text-[#22c55e] flex items-center gap-1.5 font-mono">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Intent Identified
                    </span>
                  </div>
                  {current.swastik}

                  <div className="mt-2.5 flex items-center gap-2 rounded-md border border-[rgba(245,166,35,0.3)] bg-[rgba(245,166,35,0.1)] px-2.5 py-1 text-xs text-[#f5a623]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Auto-Action: <strong>{current.action}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Widget Security & Trust Footer */}
      <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.06] text-xs text-[#94a3b8]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="h-4 w-4" /> Zero AI Clinical Diagnosis
          </span>
          <span className="hidden sm:inline text-white/20">•</span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-cyan-400" /> Sub-350ms Gemini Live
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-[#94a3b8] hover:text-white hover:border-white/20 transition-all"
          >
            <Activity className="h-3 w-3 text-[#14c8b2]" />
            <span>Clinic Admin</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default LiveVoiceWidget
