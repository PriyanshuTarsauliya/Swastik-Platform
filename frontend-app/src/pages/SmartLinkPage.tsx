import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LiveVoiceWidget } from '../components/inspira/LiveVoiceWidget'
import {
  Sparkles, Phone, MapPin, Clock, IndianRupee,
  ShieldCheck, CheckCircle2, Star, Share2,
  Stethoscope, Heart, Calendar
} from 'lucide-react'

interface ServiceItem {
  name: string
  price?: number | string
  duration_min?: number
}

interface ClinicData {
  id: string
  name: string
  themeColor: string
  slug: string
  doctorName: string
  greeting: string
  fee: string
  address: string
  services: string | ServiceItem[]
}

export default function SmartLinkPage() {
  const { slug } = useParams<{ slug: string }>()
  const [clinic, setClinic] = useState<ClinicData | null>(null)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [activeTab, setActiveTab] = useState<'voice' | 'services' | 'about'>('voice')

  useEffect(() => {
    if (!slug) return

    fetch(`/api/voice/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('Clinic not found')
        return res.json()
      })
      .then(data => {
        setClinic(data)
        if (data.services) {
          try {
            const parsed = typeof data.services === 'string' ? JSON.parse(data.services) : data.services
            if (Array.isArray(parsed)) {
              setServices(parsed)
            }
          } catch {
            setServices([])
          }
        }
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(true)
        setLoading(false)
      })
  }, [slug])

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: clinic?.name || 'Swastik Voice Receptionist',
        text: `Book appointment or speak with ${clinic?.name || 'clinic'} AI receptionist directly:`,
        url: window.location.href,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04070C] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[radial-gradient(ellipse_at_center,rgba(20,200,178,0.15)_0%,transparent_70%)] pointer-events-none" />
        <div className="w-12 h-12 rounded-full border-2 border-[#14c8b2] border-t-transparent animate-spin mb-4" />
        <h3 className="text-white font-bold text-base tracking-tight">Connecting to Voice Receptionist</h3>
        <p className="text-zinc-500 font-mono text-xs mt-1">Loading clinic calendar & AI persona...</p>
      </div>
    )
  }

  if (error || !clinic) {
    return (
      <div className="min-h-screen bg-[#04070C] flex flex-col items-center justify-center p-6 text-center relative">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <Phone className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-2">Clinic Not Found</h1>
        <p className="text-zinc-400 max-w-md text-sm mb-6">
          The smart link you followed is invalid or the clinic is no longer active.
          Please check the URL or contact the healthcare provider.
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold transition-all"
        >
          Return to Swastik AI Home
        </Link>
      </div>
    )
  }

  const themeColor = clinic.themeColor || '#14c8b2'

  return (
    <div className="min-h-screen bg-[#04070C] text-[#F8FAFC] antialiased flex flex-col relative selection:bg-[#14c8b2]/30 selection:text-[#14c8b2]">
      {/* Background Ambient Radial Glow */}
      <div 
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] pointer-events-none opacity-50 blur-3xl transition-all"
        style={{
          background: `radial-gradient(ellipse at center, ${themeColor}22 0%, rgba(0,229,255,0.08) 40%, transparent 70%)`
        }}
      />

      {/* ── Top Navigation Bar ── */}
      <header className="relative z-20 border-b border-white/[0.08] bg-[#04070C]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(20,200,178,0.35)]"
              style={{ background: `linear-gradient(135deg, ${themeColor}, #00e5ff)` }}
            >
              <Stethoscope className="w-4 h-4 text-[#04070C]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-white text-sm sm:text-base tracking-tight leading-none">
                  {clinic.name}
                </h1>
                <span title="Verified Healthcare Provider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#14c8b2]" />
                </span>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                {clinic.doctorName || 'Doctor Appointment Desk'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 text-xs text-[#cbd5e1] hover:text-white transition-all cursor-pointer"
              title="Share clinic voice link"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copiedLink ? 'Copied Link!' : 'Share'}</span>
            </button>

            <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[11px] font-bold tracking-wider uppercase">AI Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col justify-center">
        {/* Doctor & Clinic Identity Card */}
        <div className="mb-6 rounded-3xl border border-white/[0.08] bg-[rgba(8,14,23,0.85)] p-5 sm:p-6 backdrop-blur-xl shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#14c8b2]/20 to-[#00e5ff]/20 border border-[#14c8b2]/30 flex items-center justify-center shrink-0 p-1">
                <img
                  src="/swastik-brand-logo.png?v=3.0"
                  alt="Doctor clinic avatar"
                  className="w-full h-full rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <Heart className="w-7 h-7 text-[#14c8b2]" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    {clinic.doctorName || clinic.name}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#14c8b2]/10 text-[#14c8b2] border border-[#14c8b2]/20">
                    <Star className="w-3 h-3 fill-[#14c8b2]" /> 4.9 (1,200+ Reviews)
                  </span>
                </div>

                <p className="text-xs text-[#94a3b8] mt-1 line-clamp-1">
                  {clinic.greeting 
                    ? clinic.greeting.split('.')[0] 
                    : "Consultation, Treatment & In-Clinic Appointments"}
                </p>

                {/* Key Clinic Signals */}
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#cbd5e1]">
                  {clinic.fee && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 font-semibold text-[#14c8b2]">
                      <IndianRupee className="w-3.5 h-3.5" />
                      <span>{clinic.fee}</span>
                    </div>
                  )}

                  {clinic.address && (
                    <div className="flex items-center gap-1 text-[#94a3b8]">
                      <MapPin className="w-3.5 h-3.5 text-[#14c8b2]" />
                      <span>{clinic.address}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-[#94a3b8]">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mon - Sat (10 AM - 8:30 PM)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="text-[11px] text-[#94a3b8] block uppercase font-bold tracking-wider">
                Instant Scheduling
              </span>
              <span className="text-sm font-bold text-emerald-400 flex items-center sm:justify-end gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Slots Available Today
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs (Voice Assistant vs Services vs Clinic FAQ) */}
        <div className="flex items-center justify-center border-b border-white/[0.08] mb-6 gap-2">
          <button
            onClick={() => setActiveTab('voice')}
            className={`pb-3 px-5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'voice'
                ? 'border-[#14c8b2] text-[#14c8b2]'
                : 'border-transparent text-[#94a3b8] hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Voice Receptionist</span>
          </button>

          {services.length > 0 && (
            <button
              onClick={() => setActiveTab('services')}
              className={`pb-3 px-5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === 'services'
                  ? 'border-[#14c8b2] text-[#14c8b2]'
                  : 'border-transparent text-[#94a3b8] hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Available Treatments ({services.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('about')}
            className={`pb-3 px-5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'about'
                ? 'border-[#14c8b2] text-[#14c8b2]'
                : 'border-transparent text-[#94a3b8] hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Clinic Info & Safety</span>
          </button>
        </div>

        {/* TAB 1: Voice Receptionist Centerpiece */}
        {activeTab === 'voice' && (
          <div className="space-y-6 animate-fade-in">
            {/* Embedded LiveVoiceWidget in Hero Mode */}
            <LiveVoiceWidget 
              clinicId={clinic.id} 
              clinicName={clinic.name}
              doctorName={clinic.doctorName}
              themeColor={themeColor}
              wsPath={`/ws/link/${slug}`}
              hideHeader={true}
              variant="hero"
            />
          </div>
        )}

        {/* TAB 2: Available Clinic Services */}
        {activeTab === 'services' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-white tracking-tight">Clinical Services & Consultation Rates</h3>
              <p className="text-xs text-[#94a3b8] mt-1">
                You can ask the AI receptionist about any of these treatments or book a consultation directly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {services.map((item, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-2xl border border-white/[0.08] bg-[rgba(8,14,23,0.85)] backdrop-blur-xl hover:border-[#14c8b2]/30 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#14c8b2]/10 border border-[#14c8b2]/20 flex items-center justify-center text-[#14c8b2] font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.name}</h4>
                      <span className="text-[11px] text-[#94a3b8]">
                        Duration: {item.duration_min ? `${item.duration_min} mins` : '30 mins'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-[#14c8b2]">
                      ₹{item.price || clinic.fee || '499'}
                    </span>
                    <span className="block text-[10px] text-zinc-500">Per Session</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 text-center">
              <button
                onClick={() => setActiveTab('voice')}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#14c8b2] to-[#00e5ff] text-[#04070C] font-bold text-xs shadow-[0_0_20px_rgba(20,200,178,0.35)] hover:brightness-110 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tap to Book Any Service via Voice</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Clinic Information & Safety */}
        {activeTab === 'about' && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-3xl border border-white/[0.08] bg-[rgba(8,14,23,0.85)] p-6 backdrop-blur-xl">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Clinical Safety & Receptionist Protocol
              </h3>
              <p className="text-xs text-[#94a3b8] leading-relaxed">
                Swastik AI serves as an automated voice receptionist for administrative tasks including booking, rescheduling, consultation fee inquiries, and clinic timings. Per strict medical safety standards, the AI receptionist <strong className="text-white">never provides clinical diagnosis or prescription recommendations</strong>. All clinical guidance is reserved for your consultation with {clinic.doctorName || 'the doctor'}.
              </p>

              <div className="mt-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                <strong>Emergency Notice:</strong> If you or a family member is experiencing severe chest pain, breathing difficulty, or loss of consciousness, please hang up and call <strong>112</strong> immediately.
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4 border-t border-white/[0.08]">
                <div>
                  <span className="text-[#94a3b8] block uppercase text-[10px] font-bold">Clinic Address</span>
                  <p className="text-white mt-1">{clinic.address || 'Delhi NCR'}</p>
                </div>
                <div>
                  <span className="text-[#94a3b8] block uppercase text-[10px] font-bold">Consultation Fee</span>
                  <p className="text-white mt-1">{clinic.fee || '₹499'} (Includes 7-day medicine follow-up)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-20 border-t border-white/[0.06] bg-[#04070C]/90 py-4 text-center">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#64748b]">
          <p>
            {clinic.name} • AI Voice Receptionist powered by <span className="text-[#14c8b2] font-semibold">Swastik AI</span>
          </p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> HIPAA/NABH Compliant
            </span>
            <span>•</span>
            <Link to="/admin" className="hover:text-white transition-colors">Doctor Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
