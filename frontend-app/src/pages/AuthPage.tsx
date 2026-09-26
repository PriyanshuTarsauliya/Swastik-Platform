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
  const { signin, signup, demoLogin, signout, user } = useAuth()

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
  const [emailError, setEmailError] = useState<string | null>(null)

  // Forgot password states
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email')

  // OTP Verification states
  const [verifyMode, setVerifyMode] = useState(false)
  const [otp, setOtp] = useState('')

  // Google Auth callback
  const handleGoogleCredentialResponse = async (response: any) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('swastik_token', data.token)
        window.location.href = '/admin'
      } else {
        setError(data.detail || 'Google Auth failed')
      }
    } catch (err) {
      setError('Network error during Google Auth')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (clientId) {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => {
        if ((window as any).google) {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
          });
          const btnContainer = document.getElementById("google-button-container");
          if (btnContainer) {
            (window as any).google.accounts.id.renderButton(
              btnContainer,
              { theme: "filled_black", size: "large", type: "standard", shape: "rectangular", text: "continue_with", width: 350 }
            );
          }
        }
      }
      document.body.appendChild(script)
      return () => { document.body.removeChild(script) }
    }
  }, [])

  const handleMockGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    const payload = btoa(JSON.stringify({
      email: "doctor.demo@gmail.com",
      name: "Dr. Demo User",
      sub: "1234567890"
    }))
    const signature = btoa("mock_signature")
    const fakeToken = `${header}.${payload}.${signature}`
    
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: fakeToken })
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('swastik_token', data.token)
        window.location.href = '/admin'
      } else {
        setError(data.detail || 'Google Auth failed')
      }
    } catch (e) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // If already logged in, redirect to admin
  useEffect(() => {
    if (user) {
      if (user.is_verified === 0) {
        setVerifyMode(true)
      } else {
        navigate('/admin')
      }
    }
  }, [user, navigate])

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Need the current token
      const currentToken = localStorage.getItem('swastik_token')
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify({ otp_code: otp }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessMsg('Phone verified! Redirecting to Doctor Portal...')
        // We could just reload or navigate
        setTimeout(() => window.location.href = '/admin', 600)
      } else {
        setError(data.detail || 'Invalid code')
      }
    } catch (err: any) {
      setError(err?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

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
        // Handled by useEffect!
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
        // Handled by useEffect
      } else {
        setError(res.error || 'Failed to create account')
      }
    }
  }

  const [phoneError, setPhoneError] = useState<string | null>(null)

  const validateEmail = (value: string) => {
    setEmail(value)
    if (!value) { setEmailError(null); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    setEmailError(emailRegex.test(value) ? null : 'Please enter a valid email address')
  }

  const validatePhone = (value: string) => {
    setPhone(value)
    if (!value) { setPhoneError(null); return }
    // Basic phone validation (allowing digits, spaces, +, -, (, ))
    const phoneRegex = /^[+\d\s()-]{10,20}$/
    setPhoneError(phoneRegex.test(value) ? null : 'Please enter a valid phone number')
  }

  const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
    if (pw.length < 6) return { label: 'Too short', color: '#ef4444', width: '20%' }
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 1) return { label: 'Weak', color: '#f97316', width: '40%' }
    if (score === 2) return { label: 'Fair', color: '#eab308', width: '60%' }
    if (score === 3) return { label: 'Good', color: '#22c55e', width: '80%' }
    return { label: 'Strong', color: '#14c8b2', width: '100%' }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (data.reset_token) {
          setResetToken(data.reset_token)
          setForgotStep('reset')
          setSuccessMsg('Reset token generated. Enter your new password below.')
        } else {
          setSuccessMsg(data.message || 'If an account exists, a reset link has been sent.')
        }
      } else {
        setError(data.detail || 'Failed to process request')
      }
    } catch (err: any) {
      setError(err?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: newPassword }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessMsg('Password reset! Redirecting to sign in...')
        setTimeout(() => {
          setForgotMode(false)
          setForgotStep('email')
          setResetToken('')
          setNewPassword('')
          setForgotEmail('')
        }, 1500)
      } else {
        setError(data.detail || 'Failed to reset password')
      }
    } catch (err: any) {
      setError(err?.message || 'Network error')
    } finally {
      setLoading(false)
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
      <div className="absolute inset-0 z-0 pointer-events-none">
        <GravityStarsBackground className="w-full h-full opacity-40 text-[#14c8b2]" />
      </div>

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
                  <span className="gradient-text inline-block">Sign In</span>
                </>
              ) : (
                <>
                  Elevate Your Clinic With <br />
                  <span className="gradient-text inline-block">Swastik AI Reception</span>
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
                  {verifyMode
                    ? 'Verify Phone Number'
                    : forgotMode
                    ? (forgotStep === 'email' ? 'Reset Password' : 'New Password')
                    : (mode === 'signin' ? 'Sign In to Portal' : 'Create Clinic Account')}
                </h2>
                <p className="text-xs text-[#94a3b8] mt-1">
                  {verifyMode
                    ? 'Enter the 6-digit code sent to your phone/WhatsApp'
                    : forgotMode
                    ? (forgotStep === 'email' ? 'Enter your email to receive a reset link' : 'Enter your new secure password')
                    : (mode === 'signin' ? 'Enter your credentials to access the doctor dashboard' : 'Get started with autonomous voice reception for your clinic')}
                </p>
              </div>

              {/* Mode Switcher Tabs */}
              {!(forgotMode || verifyMode) && (
                <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin')
                      setError(null)
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-[10px] transition-all ${
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
                    className={`flex-1 py-2 text-xs font-semibold rounded-[10px] transition-all ${
                      mode === 'signup'
                        ? 'bg-[#14c8b2] text-[#04070c] shadow-md font-bold'
                        : 'text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              )}

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
              {verifyMode ? (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label htmlFor="otp-input" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                      Verification Code
                    </label>
                    <div className="relative">
                      <input
                        id="otp-input"
                        type="text"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-center text-xl tracking-[0.5em] focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="w-full py-3.5 bg-[#14c8b2] hover:bg-[#10b981] text-[#04070c] rounded-xl font-bold text-[13px] uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-[0_0_20px_rgba(20,200,178,0.3)] hover:shadow-[0_0_30px_rgba(20,200,178,0.5)]"
                  >
                    {loading ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                  
                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => signout()}
                      className="text-xs text-[#94a3b8] hover:text-white transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </form>
              ) : forgotMode ? (
                <form onSubmit={forgotStep === 'email' ? handleForgotPassword : handleResetPassword} className="space-y-4">
                  {forgotStep === 'email' ? (
                    <div>
                      <label htmlFor="forgot-email" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-[18px] h-[18px] text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="forgot-email"
                          type="email"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="doctor@clinic.com"
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="reset-password" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="w-[18px] h-[18px] text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="reset-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-11 pr-10 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col gap-3">
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
                            <span>{forgotStep === 'email' ? 'Send Reset Link' : 'Reset Password'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </div>
                    </ShimmerButton>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(false); setError(null); setSuccessMsg(null); }}
                      className="text-[11px] font-semibold text-[#94a3b8] hover:text-white transition-colors py-2"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'signup' && (
                    <>
                      <div>
                        <label htmlFor="auth-page-name" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                          Full Name / Doctor Name
                        </label>
                        <div className="relative">
                          <User className="w-[18px] h-[18px] text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            id="auth-page-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Dr. Priya Sharma"
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="auth-page-clinic" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                          Clinic / Hospital Name
                        </label>
                        <div className="relative">
                          <Building2 className="w-[18px] h-[18px] text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            id="auth-page-clinic"
                            type="text"
                            value={clinicName}
                            onChange={(e) => setClinicName(e.target.value)}
                            placeholder="e.g. Sharma Multispecialty Clinic"
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
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
                      <Mail className="w-[18px] h-[18px] text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-page-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => validateEmail(e.target.value)}
                        placeholder="doctor@clinic.com"
                        className={`w-full pl-11 pr-4 py-3 rounded-xl bg-black/40 border ${
                          emailError ? 'border-red-500/60' : 'border-white/10'
                        } text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all`}
                      />
                      {emailError && (
                        <p className="mt-1 text-[10px] text-red-400">{emailError}</p>
                      )}
                    </div>
                  </div>

                  {mode === 'signup' && (
                    <div>
                      <label htmlFor="auth-page-phone" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 cursor-pointer">
                        Phone Number (WhatsApp notifications)
                      </label>
                      <div className="relative">
                        <Phone className="w-[18px] h-[18px] text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="auth-page-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => validatePhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className={`w-full pl-11 pr-4 py-3 rounded-xl bg-black/40 border ${
                            phoneError ? 'border-red-500/60' : 'border-white/10'
                          } text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all`}
                        />
                      </div>
                      {phoneError && (
                        <p className="mt-1 text-[10px] text-red-400">{phoneError}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="auth-page-password" className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer">
                        Password
                      </label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => { setForgotMode(true); setError(null); setSuccessMsg(null); setForgotEmail(email); }}
                          className="text-[10px] font-medium text-[#14c8b2] hover:text-[#2dd4bf] transition-colors"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-[18px] h-[18px] text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-page-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-11 pr-10 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-[#475569] text-xs focus:outline-none focus:border-[#14c8b2] focus:ring-1 focus:ring-[#14c8b2] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                    {mode === 'signup' && password.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: getPasswordStrength(password).width, backgroundColor: getPasswordStrength(password).color }}
                            />
                          </div>
                          <span className="text-[10px] font-medium" style={{ color: getPasswordStrength(password).color }}>
                            {getPasswordStrength(password).label}
                          </span>
                        </div>
                      </div>
                    )}
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
              )}

              {/* Google OAuth & 1-Click Demo Login */}
              <div className="mt-5 pt-4 border-t border-white/10">
                {/* Google Sign In Container */}
                <div className="mb-3 flex justify-center w-full" id="google-button-container">
                  {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                    <button
                      type="button"
                      onClick={handleMockGoogleLogin}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-all group"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  )}
                </div>

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
