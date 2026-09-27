import { useState, useEffect, useRef } from 'react'
import { Headphones, Mic, Volume2, X, Circle, PhoneCall } from 'lucide-react'

interface CallMonitorProps {
  token?: string | null
}

export default function CallMonitor({ token }: CallMonitorProps) {
  const [activeCalls, setActiveCalls] = useState<any[]>([])
  const [monitoringCall, setMonitoringCall] = useState<string | null>(null)
  const [transcripts, setTranscripts] = useState<{ role: string, text: string }[]>([])
  
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  
  // Polling for active calls
  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch('/api/admin/active-calls', { headers })
        if (res.ok) {
          const data = await res.json()
          setActiveCalls(data.active_calls || [])
        }
      } catch (e) {
        console.error("Failed to fetch active calls", e)
      }
    }
    
    fetchCalls()
    const interval = setInterval(fetchCalls, 3000)
    return () => clearInterval(interval)
  }, [token])

  const stopMonitoring = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    setMonitoringCall(null)
    setTranscripts([])
  }

  const startMonitoring = async (sessionId: string) => {
    stopMonitoring()
    setMonitoringCall(sessionId)
    setTranscripts([])
    
    try {
      // Setup Web Audio API
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
      audioCtxRef.current = ctx
      
      // Wait for audio context to resume (if blocked)
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      // We don't actually need pcm-processor.js if we are just playing back audio!
      // But we can play raw PCM using createBuffer
      // To play streaming PCM in real-time smoothly, we use a simple queue.
      let nextPlayTime = ctx.currentTime

      const playPCM = (base64Data: string, sampleRate: number) => {
        if (!audioCtxRef.current) return
        const binaryString = atob(base64Data)
        const len = binaryString.length
        const bytes = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        // 16-bit PCM to Float32
        const floatData = new Float32Array(bytes.length / 2)
        const dataView = new DataView(bytes.buffer)
        for (let i = 0; i < floatData.length; i++) {
          floatData[i] = dataView.getInt16(i * 2, true) / 32768.0
        }
        
        const audioBuffer = ctx.createBuffer(1, floatData.length, sampleRate)
        audioBuffer.getChannelData(0).set(floatData)
        
        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(ctx.destination)
        
        const startTime = Math.max(ctx.currentTime, nextPlayTime)
        source.start(startTime)
        nextPlayTime = startTime + audioBuffer.duration
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/admin/monitor/${sessionId}`)
      wsRef.current = ws
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'transcript') {
            setTranscripts(prev => [...prev, { role: data.role, text: data.text }])
          } else if (data.type === 'audio') {
            playPCM(data.data, data.rate)
          }
        } catch (e) {
          console.error("Monitor WS Error", e)
        }
      }
      
      ws.onclose = () => {
        if (monitoringCall === sessionId) {
           // Do not clear it out immediately, but stop audio
        }
      }
    } catch (err) {
      console.error("Failed to start monitoring", err)
      stopMonitoring()
    }
  }

  // Auto-scroll transcripts
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcripts])

  return (
    <div className="p-6 rounded-2xl border border-white/[0.08] bg-[rgba(8,14,23,0.85)] backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-black text-white flex items-center gap-2">
          <Headphones className="w-5 h-5 text-[#14C8B2]" />
          Real-Time Call Monitoring
        </h3>
        <span className="px-2.5 py-1 rounded-full bg-[rgba(20,200,178,0.15)] border border-[rgba(20,200,178,0.3)] text-[10px] font-bold text-[#14C8B2] uppercase">
          Live
        </span>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Calls List */}
        <div className="lg:col-span-1 border-r border-white/10 pr-0 lg:pr-6">
          <h4 className="text-xs font-bold text-[#94A3B8] mb-4 uppercase tracking-wider">Active Conversations ({activeCalls.length})</h4>
          
          {activeCalls.length === 0 ? (
            <div className="text-center py-10 bg-white/5 rounded-xl border border-white/5 border-dashed">
              <PhoneCall className="w-8 h-8 text-[#475569] mx-auto mb-2 opacity-50" />
              <p className="text-xs text-[#64748B]">No active calls at the moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCalls.map((call, idx) => (
                <div 
                  key={idx}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${monitoringCall === call.session_id ? 'bg-[#14C8B2]/10 border-[#14C8B2]' : 'bg-black/40 border-white/10 hover:border-white/20'}`}
                  onClick={() => { if(monitoringCall !== call.session_id) startMonitoring(call.session_id) }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[13px] font-bold text-white block">{call.caller || "Anonymous Caller"}</span>
                      <span className="text-[10px] text-[#94A3B8]">{call.session_id}</span>
                    </div>
                    {monitoringCall === call.session_id ? (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#14C8B2] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#14C8B2]"></span>
                      </span>
                    ) : (
                      <Circle className="w-2 h-2 text-emerald-500 fill-emerald-500" />
                    )}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] flex justify-between items-center mt-1">
                    <span>Channel: {call.channel_type}</span>
                    <button className="text-[#14C8B2] hover:text-[#00E5FF]">Listen In</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Active Monitor View */}
        <div className="lg:col-span-2 flex flex-col h-[400px]">
          {monitoringCall ? (
            <>
              <div className="flex justify-between items-center mb-4 bg-black/50 p-3 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#14C8B2]/20 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-[#14C8B2]" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-white">Monitoring Session</span>
                    <span className="block text-[10px] text-[#94A3B8] font-mono">{monitoringCall}</span>
                  </div>
                </div>
                <button 
                  onClick={stopMonitoring}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-bold transition-all flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Stop Listening
                </button>
              </div>
              
              <div className="flex-1 bg-black/30 rounded-xl border border-white/5 p-4 overflow-y-auto flex flex-col gap-3 font-mono">
                {transcripts.length === 0 ? (
                  <div className="m-auto text-center opacity-50">
                    <Mic className="w-6 h-6 text-[#94A3B8] mx-auto mb-2 animate-pulse" />
                    <p className="text-[11px] text-[#94A3B8]">Waiting for audio / transcripts...</p>
                  </div>
                ) : (
                  transcripts.map((t, idx) => (
                    <div key={idx} className={`flex flex-col max-w-[80%] ${t.role === 'swastik' ? 'self-start' : 'self-end'}`}>
                      <span className={`text-[9px] mb-1 font-sans font-bold uppercase tracking-wider ${t.role === 'swastik' ? 'text-[#14C8B2]' : 'text-[#F5A623] text-right'}`}>
                        {t.role === 'swastik' ? 'Swastik AI' : 'Caller'}
                      </span>
                      <div className={`p-2.5 rounded-lg text-xs leading-relaxed ${t.role === 'swastik' ? 'bg-[#14C8B2]/10 border border-[#14C8B2]/30 text-white' : 'bg-[#F5A623]/10 border border-[#F5A623]/30 text-white'}`}>
                        {t.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </>
          ) : (
            <div className="h-full border border-white/5 rounded-xl bg-black/20 flex flex-col items-center justify-center text-center p-6">
              <Headphones className="w-10 h-10 text-[#475569] mb-4 opacity-50" />
              <h4 className="text-sm font-bold text-white mb-2">Select a call to monitor</h4>
              <p className="text-xs text-[#94A3B8] max-w-sm">
                Click on any active call on the left to securely listen to the live audio stream and view the real-time transcript.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
