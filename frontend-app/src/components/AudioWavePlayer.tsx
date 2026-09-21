import React, { useState, useEffect } from 'react'
import { Play, Pause, Volume2, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'

interface VoiceSample {
  id: string
  name: string
  role: string
  emotion: string
  language: string
  accent: string
  previewText: string
  waveHeights: number[]
}

const VOICE_SAMPLES: VoiceSample[] = [
  {
    id: 'dr-sharma-empathic',
    name: 'Dr. Sharma (Warm & Empathetic)',
    role: 'Consultant Physician Persona',
    emotion: 'Gentle • Reassuring',
    language: 'Hinglish & Hindi',
    accent: 'Neutral Indian',
    previewText: 'नमस्ते, बिल्कुल चिंता मत कीजिए। परामर्श और उपचार से आपके लक्षणों में 2 से 3 दिन में काफ़ी आराम मिलेगा।',
    waveHeights: [35, 60, 85, 45, 95, 70, 50, 80, 65, 40, 90, 75, 55, 30, 85, 65, 45, 90, 60, 40],
  },
  {
    id: 'priya-receptionist',
    name: 'Priya (Professional Clinic Host)',
    role: 'Front Desk AI Agent',
    emotion: 'Crisp • Welcoming',
    language: 'English & Hinglish',
    accent: 'Neutral Indian',
    previewText: 'Good afternoon! Dr. Sharma has open consultation slots tomorrow at 11:30 AM and 5:00 PM. Shall I reserve one for you?',
    waveHeights: [25, 45, 70, 90, 60, 85, 40, 75, 95, 50, 70, 85, 60, 45, 80, 55, 35, 75, 50, 30],
  },
  {
    id: 'vikram-triage',
    name: 'Dr. Vikram (Urgent Care Triage)',
    role: 'Emergency & Acute Care Persona',
    emotion: 'Calm • Direct • Authoritative',
    language: 'Hindi & English',
    accent: 'North Indian',
    previewText: 'If you are experiencing acute chest pain or breathing difficulty, please tap below for immediate duty doctor escalation.',
    waveHeights: [40, 70, 95, 60, 80, 55, 90, 65, 45, 85, 100, 75, 60, 80, 50, 70, 45, 85, 60, 35],
  },
  {
    id: 'ananya-pediatric',
    name: 'Ananya (Pediatric Voice Clone)',
    role: 'Child Wellness Guide',
    emotion: 'Cheerful • Friendly',
    language: 'Hindi & English',
    accent: 'Warm Conversational',
    previewText: 'Hello parents! Baby Aarav’s vaccination reminder is scheduled for Saturday 10 AM. You can also upload his growth chart.',
    waveHeights: [30, 55, 80, 65, 90, 50, 75, 60, 85, 45, 70, 90, 55, 40, 85, 60, 75, 50, 35, 25],
  },
]

export const AudioWavePlayer: React.FC = () => {
  const [activeSampleId, setActiveSampleId] = useState<string>(VOICE_SAMPLES[0].id)
  const [isPlaying, setIsPlaying] = useState<boolean>(true)
  const [currentHeights, setCurrentHeights] = useState<number[]>(VOICE_SAMPLES[0].waveHeights)

  const activeSample = VOICE_SAMPLES.find((s) => s.id === activeSampleId) || VOICE_SAMPLES[0]

  // Animate sound waves dynamically when playing
  useEffect(() => {
    if (!isPlaying) {
      setCurrentHeights(activeSample.waveHeights.map(() => 15))
      return
    }

    const interval = setInterval(() => {
      setCurrentHeights(
        activeSample.waveHeights.map((base) => {
          const jitter = (Math.random() - 0.5) * 45
          return Math.max(15, Math.min(100, Math.round(base + jitter)))
        })
      )
    }, 140)

    return () => clearInterval(interval)
  }, [isPlaying, activeSample])

  const handleSelectSample = (sample: VoiceSample) => {
    setActiveSampleId(sample.id)
    setIsPlaying(true)
    setCurrentHeights(sample.waveHeights)
  }

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(8,14,23,0.95)] p-6 backdrop-blur-xl md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#14c8b2] animate-pulse" />
            <h3 className="text-lg font-bold text-white">Ultra-Realistic Voice Studio</h3>
            <span className="rounded-full border border-[rgba(0,229,255,0.3)] bg-[rgba(0,229,255,0.1)] px-2.5 py-0.5 text-[11px] font-semibold text-[#00e5ff]">
              Zero Robotic Artifacts
            </span>
          </div>
          <p className="text-xs text-[#94a3b8]">
            Compare expressive human inflections, Indian regional pronunciations, and doctor vocal clones.
          </p>
        </div>

        {/* Play/Pause Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={cn(
            'flex items-center gap-2.5 rounded-full px-5 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-lg',
            isPlaying
              ? 'bg-[#14c8b2] text-[#04070c] shadow-[0_0_20px_rgba(20,200,178,0.4)]'
              : 'border border-white/20 bg-white/10 text-white hover:border-[#14c8b2]'
          )}
        >
          {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          <span>{isPlaying ? 'Pause Audio Preview' : 'Play Voice Demo'}</span>
        </button>
      </div>

      {/* Voice Persona Selector Pills */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {VOICE_SAMPLES.map((sample) => {
          const isSelected = sample.id === activeSampleId
          return (
            <button
              key={sample.id}
              onClick={() => handleSelectSample(sample)}
              className={cn(
                'flex flex-col items-start rounded-xl p-3 text-left transition-all cursor-pointer border',
                isSelected
                  ? 'border-[#14c8b2] bg-[rgba(20,200,178,0.15)] shadow-[0_0_15px_rgba(20,200,178,0.2)]'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 text-[#94a3b8]'
              )}
            >
              <span className={cn('text-xs font-bold truncate w-full', isSelected ? 'text-white' : 'text-slate-300')}>
                {sample.name.split(' (')[0]}
              </span>
              <span className="text-[10px] text-[#14c8b2] mt-0.5 font-medium">{sample.emotion.split(' •')[0]}</span>
              <span className="text-[10px] text-[#94a3b8]">{sample.language}</span>
            </button>
          )
        })}
      </div>

      {/* Interactive Sound-Wave Visualizer Display */}
      <div className="mt-6 rounded-2xl border border-[rgba(20,200,178,0.2)] bg-[rgba(4,7,12,0.8)] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-[#14c8b2]" />
              <h4 className="text-sm font-bold text-white">{activeSample.name}</h4>
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-mono text-[#00e5ff]">
                {activeSample.role}
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] mt-1">
              Accent: <strong className="text-white">{activeSample.accent}</strong> • Emotion:{' '}
              <strong className="text-[#f5a623]">{activeSample.emotion}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-mono text-[#14c8b2] rounded-full border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] px-3 py-1">
              <Sparkles className="h-3 w-3" /> 24kHz High-Fidelity Neural Audio
            </span>
          </div>
        </div>

        {/* Dynamic Sound Wave Bars */}
        <div className="flex items-center justify-between gap-1.5 h-20 px-2 py-3 bg-[rgba(0,0,0,0.4)] rounded-xl border border-white/5">
          {currentHeights.map((h, i) => (
            <div
              key={i}
              className="flex-1 flex items-center justify-center h-full"
            >
              <span
                style={{ height: `${h}%` }}
                className={cn(
                  'w-1.5 rounded-full transition-all duration-150',
                  isPlaying
                    ? i % 2 === 0
                      ? 'bg-gradient-to-t from-[#14c8b2] to-[#00e5ff]'
                      : 'bg-gradient-to-t from-[#00e5ff] to-[#f5a623]'
                    : 'bg-[#475569]'
                )}
              />
            </div>
          ))}
        </div>

        {/* Spoken Text Quote */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-1">
            Real-Time Spoken Dialogue
          </span>
          <p className="text-sm italic text-[#f8fafc] leading-relaxed">
            &quot;{activeSample.previewText}&quot;
          </p>
        </div>
      </div>
    </div>
  )
}

export default AudioWavePlayer
