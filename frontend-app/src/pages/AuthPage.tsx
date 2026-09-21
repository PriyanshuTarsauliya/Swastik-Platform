import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Mail,
  Lock,
  User,
  Building2,
  Phone,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Briefcase,
  ArrowLeft,
  Check
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ShimmerButton from '../components/inspira/ShimmerButton'
import { GravityStarsBackground } from '../components/animate-ui'

interface AuthPageProps {
  defaultMode?: 'signin' | 'signup'
}

export default function AuthPage({ defaultMode = 'signin' }: AuthPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signin, signup, demoLogin, user } = useAuth()

  // Determine initial mode from route or prop
  const [mode, setMode] = useState<'signin' | 'signup'>(() => {
    if (location.pathname.includes('signup')) return 'signup'
    return defaultMode
  })

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'doctor' | 'staff'>('doctor')

  // If already logged in, redirect to admin
  useEffect(() => {
    if (user) {
      navigate('/admin')
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    if (mode === 'signin') {
      if (!email || !password) {
        setError('Please enter your email and password')
        setLoading(false)
        return
      }
      const res = await signin(email, password)
      setLoading(false)
      if (res.success) {
        setSuccessMsg('Signed in successfully! Redirecting to Doctor Portal...')
        setTimeout(() => navigate('/admin'), 600)
      } else {
        setError(res.error || 'Invalid credentials')
      }
    } else {
      if (!name || !email || !password) {
        setError('Name, email, and password are required')
        setLoading(false)
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        setLoading(false)
        return
      }
      const res = await signup({
        name,
        email,
        password,
        role,
        clinic_name: clinicName || "Dr. Sharma's Clinic",
        phone,
      })
      setLoading(false)
      if (res.success) {
        setSuccessMsg('Clinic account created! Redirecting to Doctor Portal...')
        setTimeout(() => navigate('/admin'), 600)
      } else {
        setError(res.error || 'Failed to create account')
      }
    }
  }

  const handleDemoSignIn = async () => {
    setError(null)
    setLoading(true)
    const res = await demoLogin()
    setLoading(false)
    if (res.success) {
      setSuccessMsg('Signed in as Dr. Sharma! Redirecting...')
      setTimeout(() => navigate('/admin'), 500)
    } else {
      setError(res.error || 'Demo login failed')
    }
  }

  return (
    <div className="relative min-h-screen bg-[#04070c] text-white flex flex-col justify-between overflow-x-hidden selection:bg-[#14c8b2]/20 selection:text-[#2dd4bf]">
      {/* Background Ambience */}
      <GravityStarsBackground className="opacity-40" />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative h-10 w-10 rounded-full overflow-hidden border border-[rgba(20,200,178,0.4)] bg-[rgba(20,200,178,0.1)] p-0.5 transition-all group-hover:border-[#14c8b2] group-hover:shadow-[0_0_20px_rgba(20,200,178,0.5)]">
            <img
              src="/swastik-brand-logo.png?v=3.0"
              alt="Swastik AI Logo"
              className="h-full w-full object-cover rounded-full"
            />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white flex items-center gap-1">
              Swastik <span className="gradient-text">AI</span>
            </span>
            <span className="block text-[9px] font-medium tracking-widest text-[#94a3b8] uppercase">
              Autonomous Voice OS
            </span>
          </div>
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#94a3b8] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="relative z-20 flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Brand / Features Panel */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] text-[#14c8b2] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Healthcare Voice Intelligence</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              {mode === 'signin' ? (
                <>
                  Doctor Portal <br />
                  <span className="gradient-text">Sign In</span>
                </>
              ) : (
                <>
                  Elevate Your Clinic With <br />
                  <span className="gradient-text">Swastik AI Reception</span>
                </>
              )}
            </h1>

            <p className="text-sm text-[#94a3b8] leading-relaxed max-w-md">
              Zero hold times, real-time Gemini Live triage, automated WhatsApp scheduling, and
              instant clinical summaries directly in your clinic management dashboard.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs text-[#cbd5e1]">
                <div className="w-5 h-5 rounded-full bg-[#14c8b2]/20 border border-[#14c8b2]/40 flex items-center justify-center text-[#14c8b2]">
                  <Check className="w-3 h-3" />
                </div>
                <span>Sub-second voice latency with natural human interruption</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#cbd5e1]">
                <div className="w-5 h-5 rounded-full bg-[#14c8b2]/20 border border-[#14c8b2]/40 flex items-center justify-center text-[#14c8b2]">
                  <Check className="w-3 h-3" />
                </div>
                <span>Automatic appointment booking & WhatsApp instant confirmations</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#cbd5e1]">
                <div className="w-5 h-5 rounded-full bg-[#14c8b2]/20 border border-[#14c8b2]/40 flex items-center justify-center text-[#14c8b2]">
                  <Check className="w-3 h-3" />
                </div>
                <span>Emergency red-flag symptom detection & priority triage alerts</span>
              </div>
            </div>

            {/* Testimonial / Trust callout */}
            <div className="glass p-4 rounded-2xl border border-white/10 max-w-md">
              <p className="text-xs text-[#94a3b8] italic">
                "Swastik handles over 80% of our after-hours clinic calls and books confirmed slots directly into our calendar without missing a beat."
              </p>
              <div className="mt-2 text-[11px] font-semibold text-white flex items-center gap-1.5">
                <span className="text-[#14c8b2]">●</span>
                <span>Dr. Sharma · Sharma Healthcare Clinic</span>
              </div>
            </div>
          </div>

          {/* Right Authentication Card */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-md glass rounded-3xl p-6 sm:p-8 shadow-[0_20px_70px_rgba(0,0,0,0.7)] border border-[rgba(20,200,178,0.25)] relative">
              {/* Corner Glow */}
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-[radial-gradient(ellipse_at_center,rgba(20,200,178,0.2),transparent_70%)] pointer-events-none" />

              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {mode === 'signin' ? 'Sign In to Portal' : 'Create Clinic Account'}
                </h2>
                <p className="text-xs text-[#94a3b8] mt-1">
                  {mode === 'signin'
                    ? 'Enter your credentials to access the doctor dashboard'
                    : 'Get started with autonomous voice reception for your clinic'}
                </p>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setError(null)
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'signin'
                      ? 'bg-[#14c8b2] text-[#04070c] shadow-md font-bold'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setError(null)
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'signup'
                      ? 'bg-[#14c8b2] text-[#04070c] shadow-md font-bold'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Error / Success feedback */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <>
                    <div>
                      <label htmlFor="auth-page-name" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                        Full Name / Doctor Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="auth-page-name"
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Dr. Priya Sharma"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="auth-page-clinic" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                        Clinic / Hospital Name
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="auth-page-clinic"
                          type="text"
                          value={clinicName}
                          onChange={(e) => setClinicName(e.target.value)}
                          placeholder="e.g. Sharma Multispecialty Clinic"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">
                        Role
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRole('doctor')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                            role === 'doctor'
                              ? 'border-[#14c8b2] bg-[#14c8b2]/15 text-[#14c8b2]'
                              : 'border-white/10 bg-white/5 text-[#94a3b8] hover:text-white'
                          }`}
                        >
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>Doctor / MD</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole('staff')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                            role === 'staff'
                              ? 'border-[#14c8b2] bg-[#14c8b2]/15 text-[#14c8b2]'
                              : 'border-white/10 bg-white/5 text-[#94a3b8] hover:text-white'
                          }`}
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>Clinic Admin</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="auth-page-email" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-page-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="doctor@clinic.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                    />
                  </div>
                </div>

                {mode === 'signup' && (
                  <div>
                    <label htmlFor="auth-page-phone" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                      Phone Number (WhatsApp notifications)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-page-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="auth-page-password" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-page-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <ShimmerButton
                    shimmerColor="#14c8b2"
                    className="w-full py-3 text-xs font-bold justify-center"
                    disabled={loading}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>{mode === 'signin' ? 'Sign In to Portal' : 'Create Clinic Account'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </div>
                  </ShimmerButton>
                </div>
              </form>

              {/* 1-Click Demo Login */}
              <div className="mt-5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleDemoSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[rgba(245,166,35,0.3)] bg-[rgba(245,166,35,0.08)] hover:bg-[rgba(245,166,35,0.15)] text-[#f5a623] hover:text-[#fbbf24] text-xs font-semibold transition-all group"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#f5a623] group-hover:rotate-12 transition-transform" />
                  <span>1-Click Demo Sign In (Dr. Sharma)</span>
                </button>
                <p className="text-[10px] text-center text-[#64748b] mt-2 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#14c8b2]" />
                  <span>Pre-seeded demo credentials: drsharma@swastik.ai / Doctor@2026</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 py-6 text-center text-xs text-[#64748b] border-t border-white/5">
        Swastik AI · Autonomous Healthcare Voice OS · Built with Gemini Live API
      </footer>
    </div>
  )
}
