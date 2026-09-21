import React, { useState, useEffect } from 'react'
import {
  X,
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
  Briefcase
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ShimmerButton from './inspira/ShimmerButton'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'signin' | 'signup'
  onSuccess?: () => void
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'signin',
  onSuccess,
}: AuthModalProps) {
  const { signin, signup, demoLogin } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
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

  useEffect(() => {
    setMode(initialMode)
    setError(null)
    setSuccessMsg(null)
  }, [initialMode, isOpen])

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

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
        setSuccessMsg('Welcome back! Redirecting...')
        setTimeout(() => {
          onClose()
          if (onSuccess) onSuccess()
        }, 600)
      } else {
        setError(res.error || 'Sign in failed')
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
        setSuccessMsg('Account created successfully! Redirecting...')
        setTimeout(() => {
          onClose()
          if (onSuccess) onSuccess()
        }, 600)
      } else {
        setError(res.error || 'Sign up failed')
      }
    }
  }

  const handleDemoSignIn = async () => {
    setError(null)
    setLoading(true)
    const res = await demoLogin()
    setLoading(false)
    if (res.success) {
      setSuccessMsg('Signed in as Dr. Sharma!')
      setTimeout(() => {
        onClose()
        if (onSuccess) onSuccess()
      }, 500)
    } else {
      setError(res.error || 'Demo sign in failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#020408]/80 backdrop-blur-xl transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md glass rounded-3xl p-6 sm:p-8 shadow-[0_20px_70px_rgba(0,0,0,0.8)] border border-[rgba(20,200,178,0.25)] z-10 animate-scale-in">
        {/* Glow corner accents */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[radial-gradient(ellipse_at_center,rgba(20,200,178,0.2),transparent_70%)] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[radial-gradient(ellipse_at_center,rgba(245,166,35,0.15),transparent_70%)] pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full border border-white/10 bg-white/5 text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[rgba(20,200,178,0.1)] border border-[rgba(20,200,178,0.3)] mb-3 shadow-[0_0_20px_rgba(20,200,178,0.25)]">
            <img
              src="/swastik-brand-logo.png?v=3.0"
              alt="Swastik AI Logo"
              className="w-10 h-10 rounded-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {mode === 'signin' ? 'Welcome Back' : 'Create Clinic Account'}
          </h2>
          <p className="text-xs text-[#94a3b8] mt-1">
            {mode === 'signin'
              ? 'Access your autonomous voice triage console & doctor portal'
              : 'Empower your clinic with Gemini Live autonomous voice receptionist'}
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

        {/* Error / Success Feedback */}
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
              {/* Full Name */}
              <div>
                <label htmlFor="auth-modal-name" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                  Full Name / Doctor Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-modal-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Priya Sharma"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                  />
                </div>
              </div>

              {/* Clinic Name */}
              <div>
                <label htmlFor="auth-modal-clinic" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                  Clinic / Hospital Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-modal-clinic"
                    type="text"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. Sharma Multispecialty Clinic"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                  />
                </div>
              </div>

              {/* Role Selection */}
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

          {/* Email Address */}
          <div>
            <label htmlFor="auth-modal-email" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="auth-modal-email"
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
            /* Phone Number */
            <div>
              <label htmlFor="auth-modal-phone" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                Phone Number (WhatsApp notifications)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-modal-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="auth-modal-password" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer">
                Password
              </label>
              {mode === 'signin' && (
                <span className="text-[11px] text-[#14c8b2] hover:underline cursor-pointer">
                  Forgot?
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="auth-modal-password"
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

          {/* Submit Action Button */}
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

        {/* 1-Click Demo Login Button for instant access */}
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
  )
}
