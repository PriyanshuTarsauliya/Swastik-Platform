import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LiveVoiceWidget } from '../components/inspira/LiveVoiceWidget'
import { Phone, Stethoscope, CheckCircle2 } from 'lucide-react'

export default function CallWidget() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const [clinicName, setClinicName] = useState<string>("Swastik AI")
  const [doctorName, setDoctorName] = useState<string>("")
  const [themeColor, setThemeColor] = useState<string>("#14c8b2")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!clinicId) return
    
    // Fetch clinic info from API
    fetch(`/api/clinics/${clinicId}`)
      .then(res => {
        if (!res.ok) throw new Error('Clinic not found')
        return res.json()
      })
      .then(data => {
        setClinicName(data.name || "Clinic Voice Desk")
        setDoctorName(data.doctorName || "")
        setThemeColor(data.themeColor || "#14c8b2")
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(true)
        setLoading(false)
      })
  }, [clinicId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04070C] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#14c8b2] border-t-transparent animate-spin mb-3" />
        <p className="text-zinc-400 font-mono text-xs">Connecting to Voice Engine...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#04070C] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <Phone className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Clinic Not Found</h1>
        <p className="text-zinc-400 text-sm max-w-sm mb-6">
          The clinic ID in this widget tag is invalid or expired.
        </p>
        <Link to="/" className="text-xs text-[#14c8b2] hover:underline">
          Return to Swastik AI
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#04070C] text-[#F8FAFC] antialiased flex flex-col justify-center items-center p-4 sm:p-6 relative selection:bg-[#14c8b2]/30 selection:text-[#14c8b2]">
      {/* Background radial glow */}
      <div 
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] pointer-events-none opacity-40 blur-3xl"
        style={{
          background: `radial-gradient(ellipse at center, ${themeColor}22 0%, transparent 70%)`
        }}
      />

      {/* Top Bar for Widget */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: `linear-gradient(135deg, ${themeColor}, #00e5ff)` }}
          >
            <Stethoscope className="w-4 h-4 text-[#04070C]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
              <span>{clinicName}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#14c8b2]" />
            </h2>
            {doctorName && <p className="text-[11px] text-[#94a3b8]">{doctorName}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>WIDGET ACTIVE</span>
        </div>
      </div>

      {/* Widget Container */}
      <div className="w-full max-w-2xl relative z-10">
        <LiveVoiceWidget 
          clinicId={clinicId} 
          clinicName={clinicName} 
          doctorName={doctorName}
          themeColor={themeColor}
          hideHeader={true}
          variant="compact"
        />
      </div>

      <div className="mt-4 text-center text-[11px] text-[#64748b]">
        Powered by <span className="text-[#14c8b2] font-semibold">Swastik AI</span> • 256-Bit Encrypted Audio
      </div>
    </div>
  )
}
