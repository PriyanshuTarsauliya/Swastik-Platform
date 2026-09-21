import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic, MessageCircle, CreditCard, Shield, Zap,
  Globe, ChevronRight, Star, ArrowRight,
  CheckCircle2, Sparkles, Headphones, Calendar,
  ExternalLink, PhoneCall, UserCheck, Activity,
  Menu, X, LogOut, User as UserIcon
} from 'lucide-react'
import BorderBeam from '../components/inspira/BorderBeam'
import CardSpotlight from '../components/inspira/CardSpotlight'
import ShimmerButton from '../components/inspira/ShimmerButton'
import Marquee from '../components/inspira/Marquee'
import Meteors from '../components/inspira/Meteors'
import NumberTicker from '../components/inspira/NumberTicker'
import { BentoGrid, BentoCard } from '../components/inspira/BentoGrid'
import VoiceSegmentation from '../components/VoiceSegmentation'
import UseCasesSection from '../components/UseCasesSection'
import AnalyticsPreview from '../components/AnalyticsPreview'
import TrustSecuritySection from '../components/TrustSecuritySection'
import LiveVoiceWidget from '../components/inspira/LiveVoiceWidget'
import { GravityStarsBackground } from '../components/animate-ui'
import { useLenis } from 'lenis/react'
import SparklesText from '../components/inspira/SparklesText'
import AuthModal from '../components/AuthModal'
import { useAuth } from '../context/AuthContext'
import ScrollReveal from '../components/inspira/ScrollReveal'
import TextReveal from '../components/inspira/TextReveal'

/* ════════════════════════════════════════════════════════════
   Swastik AI — Autonomous Voice Platform
   Design Objective & UX Strategy Implementation
   ════════════════════════════════════════════════════════════ */

// ── Background Ambient Lights ──
function OrbBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const orbs = [
      { x: 0.25, y: 0.35, r: 240, color: 'rgba(20, 200, 178, 0.07)', speed: 0.0004 },
      { x: 0.75, y: 0.3, r: 280, color: 'rgba(245, 166, 35, 0.05)', speed: 0.0003 },
      { x: 0.5, y: 0.75, r: 220, color: 'rgba(0, 229, 255, 0.05)', speed: 0.0006 },
    ]

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const orb of orbs) {
        const cx = canvas.width * (orb.x + Math.sin(t * orb.speed) * 0.06)
        const cy = canvas.height * (orb.y + Math.cos(t * orb.speed * 1.2) * 0.06)
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orb.r * (canvas.width / 1000))
        grad.addColorStop(0, orb.color)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      animId = requestAnimationFrame(draw)
    }
    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  )
}

// ── Top Navigation Bar with Official Brand Logo ──
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin')
  const { user, signout } = useAuth()
  const navigate = useNavigate()
  const lenis = useLenis()

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    if (lenis) {
      lenis.scrollTo(targetId, { offset: -80, duration: 1.2 })
    } else {
      const el = document.querySelector(targetId)
      el?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthModalMode(mode)
    setAuthModalOpen(true)
    setMobileMenuOpen(false)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onSuccess={() => navigate('/admin')}
      />
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || mobileMenuOpen ? 'glass py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)]' : 'py-5 bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Brand with Official Icon */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="relative h-11 w-11 rounded-full overflow-hidden border border-[rgba(20,200,178,0.4)] bg-[rgba(20,200,178,0.1)] p-0.5 transition-all duration-300 group-hover:border-[#14c8b2] group-hover:shadow-[0_0_20px_rgba(20,200,178,0.5)]">
              <img
                src="/swastik-brand-logo.png?v=3.0"
                alt="Swastik AI Logo"
                className="h-full w-full object-cover rounded-full"
              />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                Swastik <span className="gradient-text font-black">AI</span>
              </span>
              <span className="block text-xs font-medium tracking-wide text-[#94a3b8]">
                Autonomous Voice OS
              </span>
            </div>
          </a>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-[#94a3b8]">
            <a href="#solutions" onClick={(e) => handleNavClick(e, '#solutions')} className="hover:text-[#14c8b2] transition-colors">Solutions</a>
            <a href="#use-cases" onClick={(e) => handleNavClick(e, '#use-cases')} className="hover:text-[#14c8b2] transition-colors">Use Cases</a>
            <a href="#features" onClick={(e) => handleNavClick(e, '#features')} className="hover:text-[#14c8b2] transition-colors">Features</a>
            <a href="#analytics" onClick={(e) => handleNavClick(e, '#analytics')} className="hover:text-[#14c8b2] transition-colors">Analytics</a>
            <a href="#security" onClick={(e) => handleNavClick(e, '#security')} className="hover:text-[#14c8b2] transition-colors">Safety</a>
            <a href="#pricing" onClick={(e) => handleNavClick(e, '#pricing')} className="hover:text-[#14c8b2] transition-colors">Pricing</a>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">

            {/* Doctor Portal entry point grouped with user actions */}
            <a
              href="/admin"
              className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-[#94a3b8] hover:text-[#14c8b2] transition-colors px-3 py-1.5 rounded-lg"
            >
              <Activity className="w-3.5 h-3.5 text-[#14c8b2]" />
              <span>Doctor Portal</span>
            </a>

            {user ? (
              /* Authenticated User Menu */
              <div className="hidden sm:flex items-center gap-2">
                <a
                  href="/admin"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-[#14c8b2] transition-colors border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] px-3 py-1.5 rounded-xl group"
                >
                  <div className="w-5 h-5 rounded-full bg-[#14c8b2]/20 flex items-center justify-center text-[#14c8b2]">
                    <UserIcon className="w-3 h-3" />
                  </div>
                  <div className="text-left">
                    <span className="block leading-none">{user.name}</span>
                    <span className="text-xs text-[#94a3b8] font-normal uppercase tracking-wider">{user.role}</span>
                  </div>
                </a>
                <button
                  onClick={() => signout()}
                  title="Sign Out"
                  className="p-2 rounded-xl border border-white/10 bg-white/5 text-[#94a3b8] hover:text-red-400 hover:border-red-500/30 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Unauthenticated: Sign In & Sign Up */
              <>
                <button
                  onClick={() => openAuth('signin')}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#94a3b8] hover:text-white transition-colors px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  <span>Sign In</span>
                </button>
                <ShimmerButton
                  onClick={() => openAuth('signup')}
                  shimmerColor="#14c8b2"
                  className="hidden sm:inline-flex py-2 px-3.5 text-xs font-semibold cursor-pointer"
                >
                  <span>Sign Up</span>
                  <ArrowRight className="w-3 h-3" />
                </ShimmerButton>
              </>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-white/10 bg-white/5 text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 px-6 pt-3 pb-6 border-t border-white/10 bg-[#04070C]/95 backdrop-blur-2xl space-y-3 shadow-2xl">
            <div className="flex flex-col space-y-2.5 text-sm font-medium text-[#94a3b8]">
              <a
                href="#solutions"
                onClick={(e) => handleNavClick(e, '#solutions')}
                className="hover:text-[#14c8b2] py-1 transition-colors"
              >
                Solutions
              </a>
              <a
                href="#use-cases"
                onClick={(e) => handleNavClick(e, '#use-cases')}
                className="hover:text-[#14c8b2] py-1 transition-colors"
              >
                Use Cases
              </a>
              <a
                href="#features"
                onClick={(e) => handleNavClick(e, '#features')}
                className="hover:text-[#14c8b2] py-1 transition-colors"
              >
                Features
              </a>
              <a
                href="#analytics"
                onClick={(e) => handleNavClick(e, '#analytics')}
                className="hover:text-[#14c8b2] py-1 transition-colors"
              >
                Analytics
              </a>
              <a
                href="#security"
                onClick={(e) => handleNavClick(e, '#security')}
                className="hover:text-[#14c8b2] py-1 transition-colors"
              >
                Safety
              </a>
              <a
                href="#pricing"
                onClick={(e) => handleNavClick(e, '#pricing')}
                className="hover:text-[#14c8b2] py-1 transition-colors"
              >
                Pricing
              </a>
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
              {user ? (
                <>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#14c8b2]/20 flex items-center justify-center text-[#14c8b2]">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{user.name}</div>
                        <div className="text-[10px] text-[#94a3b8]">{user.clinic_name}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        signout()
                        setMobileMenuOpen(false)
                      }}
                      className="text-xs text-red-400 hover:text-red-300 font-semibold"
                    >
                      Sign Out
                    </button>
                  </div>
                  <a
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#14c8b2] border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] py-2.5 rounded-xl"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Doctor Portal</span>
                  </a>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openAuth('signin')}
                      className="py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => openAuth('signup')}
                      className="py-2.5 px-3 rounded-xl bg-[#14c8b2] text-[#04070c] text-xs font-bold shadow-md hover:bg-[#2dd4bf] transition-colors"
                    >
                      Sign Up
                    </button>
                  </div>
                  <a
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#14c8b2] border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] py-2 rounded-xl"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Doctor Portal</span>
                  </a>
                </>
              )}
              <a
                href="/console/index.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-white border border-white/10 bg-white/5 py-2.5 rounded-xl"
              >
                <span>Live Voice Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </nav>
    </>
  )
}

// ── Hero Section ──
function Hero() {
  return (
    <section className="relative min-h-[92vh] flex flex-col items-center justify-center pt-32 pb-16 px-6 overflow-hidden">
      {/* Animate UI Interactive Gravity Stars Background */}
      <div className="absolute inset-0 z-0 opacity-70 pointer-events-auto">
        <GravityStarsBackground
          starsCount={85}
          starsSize={2.2}
          starsOpacity={0.65}
          glowIntensity={16}
          movementSpeed={0.28}
          mouseInfluence={140}
          mouseGravity="attract"
          gravityStrength={85}
          className="w-full h-full text-[#14c8b2]"
        />
      </div>

      {/* Inspira UI Meteors Falling Stars */}
      <Meteors count={25} />

      {/* Radial glow aura */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] bg-[rgba(20,200,178,0.09)] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* Animated Badge with Border Beam */}
        <ScrollReveal delay={100} duration={800} direction="down" distance={20}>
          <div className="relative inline-flex items-center gap-2 px-5 py-2 rounded-full overflow-hidden border border-[rgba(20,200,178,0.3)] bg-[rgba(8,14,23,0.8)] text-xs font-semibold text-[#14c8b2] mb-8 shadow-[0_0_25px_rgba(20,200,178,0.2)]">
            <BorderBeam size={100} duration={6} colorFrom="#14c8b2" colorTo="#f5a623" />
            <span className="flex h-2 w-2 rounded-full bg-[#14c8b2] animate-ping" />
            <span>Real-Time Voice Agents & Neural Audio Studio • Sub-400ms Turnaround</span>
          </div>
        </ScrollReveal>

        {/* Main Headline with Inspira SparklesText + TextReveal */}
        <ScrollReveal delay={300} duration={900}>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.08] mb-6 text-white">
            <TextReveal text="Never Miss a Patient Call." stagger={50} blur={14} triggerOnScroll={false} />
            <br />
            <TextReveal text="The Autonomous" stagger={50} blur={14} triggerOnScroll={false} />{' '}
            <SparklesText
              text="Voice Infrastructure"
              className="gradient-text font-black"
              sparklesCount={8}
              colors={{ first: '#14C8B2', second: '#00E5FF' }}
            />
            <br />
            <TextReveal text="with Swastik AI." stagger={50} blur={14} triggerOnScroll={false} />
          </h1>
        </ScrollReveal>

        {/* Subtitle */}
        <ScrollReveal delay={500} duration={800}>
          <p className="text-lg sm:text-xl text-[#94a3b8] max-w-3xl mx-auto mb-10 leading-relaxed">
            Deploy conversational <strong className="text-white">AI Voice Agents</strong> for 24/7 inbound clinic reception and proactive patient recalls — paired with an expressive <strong className="text-white">Voice Generation Studio</strong> that clones your doctors with human empathy.
          </p>
        </ScrollReveal>

        {/* High-Intent Early CTAs */}
        <ScrollReveal delay={700} duration={700}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <a
              href="#solutions"
              className="inline-flex items-center justify-center gap-2 py-4 px-8 rounded-full text-base font-bold bg-gradient-to-r from-[#14c8b2] to-[#00e5ff] text-[#04070c] shadow-[0_0_30px_rgba(20,200,178,0.4)] hover:shadow-[0_0_40px_rgba(0,229,255,0.6)] transition-all duration-300 transform hover:-translate-y-0.5"
            >
              <Headphones className="w-5 h-5 text-[#04070c]" />
              <span>Explore Voice Solutions</span>
              <ChevronRight className="w-4 h-4 text-[#04070c]" />
            </a>

            <a
              href="/console/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-white hover:border-[#14c8b2] hover:bg-[rgba(20,200,178,0.1)] transition-all duration-300 backdrop-blur-xl"
            >
              <PhoneCall className="w-4 h-4 text-[#14c8b2]" />
              <span>Launch Live Audio Console</span>
              <ExternalLink className="w-4 h-4 text-[#94a3b8]" />
            </a>
          </div>
        </ScrollReveal>

        {/* Trust Badges */}
        <ScrollReveal delay={900} duration={600}>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#94a3b8]">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#14c8b2]" /> HIPAA-Compliant Pipelines</span>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-[#f5a623]" /> &lt;380ms Gemini Live Latency</span>
            <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-[#00e5ff]" /> Fluent Hinglish, Hindi & English</span>
            <span className="flex items-center gap-1.5"><UserCheck className="w-4 h-4 text-[#22c55e]" /> Instant Human Escalation</span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

// ── Interactive Live Voice Demo Section ──
function LiveVoiceSection() {
  return (
    <section id="live-demo" className="relative py-12 px-6 overflow-hidden">
      <ScrollReveal>
        <div className="max-w-4xl mx-auto text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.08)] text-xs font-semibold text-[#14c8b2] mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Browser Voice Terminal</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            <TextReveal text="Test Swastik AI Voice Receptionist Live" stagger={40} />
          </h2>
          <p className="text-sm sm:text-base text-[#94a3b8] max-w-2xl mx-auto">
            Speak with your microphone or try common clinical inquiries below. Experience real-time sub-400ms Hinglish responses and automatic slot booking.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={200}>
        <LiveVoiceWidget />
      </ScrollReveal>
    </section>
  )
}

// ── Live Stats Banner with Inspira UI Number Ticker ──
function StatsBanner() {
  return (
    <section className="relative border-y border-white/10 bg-[rgba(8,14,23,0.6)] py-12 px-6 backdrop-blur-md">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        <ScrollReveal delay={0} direction="up" distance={30} duration={600}>
          <div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white flex items-center justify-center">
              <NumberTicker value={99.4} decimalPlaces={1} suffix="%" />
            </div>
            <p className="mt-2 text-xs sm:text-sm font-medium text-[#94a3b8]">First Call Resolution</p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120} direction="up" distance={30} duration={600}>
          <div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-[#14c8b2] flex items-center justify-center">
              <NumberTicker value={380} suffix="ms" prefix="<" />
            </div>
            <p className="mt-2 text-xs sm:text-sm font-medium text-[#94a3b8]">Voice Turnaround Latency</p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={240} direction="up" distance={30} duration={600}>
          <div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-[#f5a623] flex items-center justify-center">
              <NumberTicker value={24500} suffix="+" />
            </div>
            <p className="mt-2 text-xs sm:text-sm font-medium text-[#94a3b8]">Patient Consultations Handled</p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={360} direction="up" distance={30} duration={600}>
          <div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-[#00e5ff] flex items-center justify-center">
              <span>24/7</span>
            </div>
            <p className="mt-2 text-xs sm:text-sm font-medium text-[#94a3b8]">Zero Receptionist Downtime</p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

// ── Doctor & Clinic Infinite Marquee ──
function DoctorMarquee() {
  const clinics = [
    { name: "Dr. Sharma's Clinic", spec: "Family Health & Holistic Care", city: "Delhi NCR" },
    { name: "Aarogya Dental Hospital", spec: "Oral & Maxillofacial Care", city: "Bhopal" },
    { name: "Sanjeevani Orthopedic Care", spec: "Joints & Sports Medicine", city: "Indore" },
    { name: "Swaroop Multispecialty Clinic", spec: "Internal Medicine & ENT", city: "Kanpur" },
    { name: "Apex Heart & Diabetes Center", spec: "Cardiology & Diabetology", city: "Lucknow" },
    { name: "CarePoint Pediatrics Center", spec: "Child Wellness & Neonatal", city: "Jaipur" },
    { name: "Metro Health Polyclinic", spec: "Dermatology & Cosmetology", city: "Delhi NCR" },
  ]

  const liveFeeds = [
    "⚡ Appointment confirmed with Dr. Sharma (Tomorrow 5:30 PM)",
    "💬 WhatsApp intake form sent to +91 98260 ••••",
    "📋 Patient intake form confirmed & synced with EHR",
    "🎙️ Hindi-speaking patient query resolved in 18 seconds",
    "📅 Rescheduled slot from Friday to Saturday 11:00 AM",
    "🚀 0 missed calls recorded across all partner clinics today",
  ]

  return (
    <section className="relative py-14 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto text-center mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
          Trusted by Top Doctors and Clinics Across India
        </p>
      </div>

      {/* Marquee Row 1: Clinics */}
      <Marquee pauseOnHover duration="45s" gap="1.5rem">
        {clinics.map((clinic, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[rgba(8,14,23,0.85)] px-5 py-3.5 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all hover:border-[rgba(20,200,178,0.4)]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(20,200,178,0.15)] text-[#14c8b2]">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">{clinic.name}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-[#14c8b2]" />
              </div>
              <span className="text-xs text-[#94a3b8]">
                {clinic.spec} • <strong className="text-white/80">{clinic.city}</strong>
              </span>
            </div>
          </div>
        ))}
      </Marquee>

      {/* Marquee Row 2: Live Activity Ticker (Reverse Direction) */}
      <div className="mt-4">
        <Marquee reverse pauseOnHover duration="40s" gap="1.5rem">
          {liveFeeds.map((feed, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(4,7,12,0.7)] px-4 py-2 text-xs font-medium text-[#94a3b8] backdrop-blur-md"
            >
              <Activity className="h-3.5 w-3.5 text-[#00e5ff]" />
              <span>{feed}</span>
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  )
}

// ── Bento Grid Features Section ──
function Features() {
  return (
    <section id="features" className="relative py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] text-xs font-semibold text-[#14c8b2] mb-4">
            <Zap className="w-3.5 h-3.5" /> High-Performance Features
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            An Autonomous Front Desk Built with Swastik AI
          </h2>
          <p className="text-[#94a3b8] max-w-xl mx-auto text-base">
            From inbound patient triage to automated slot booking and payment collection, Swastik AI handles the entire reception workflow.
          </p>
        </div>

        {/* Bento Grid Layout from Inspira UI */}
        <BentoGrid>
          {/* Card 1: Real-Time Voice with Live Interruption (Span 2) */}
          <BentoCard
            name="Sub-Second Conversational Voice AI"
            className="md:col-span-2"
            Icon={Mic}
            badge="Gemini 2.0 Flash"
            description="True bidirectional audio streaming allows callers to interrupt, ask clarifying questions, or change their mind mid-sentence without robotic lag or awkward delays."
            cta="Try voice interaction"
            href="#solutions"
            background={
              <div className="absolute right-4 bottom-4 flex items-end gap-1.5 h-24 opacity-20">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    style={{ height: `${(Math.sin(i * 0.5) + 1.2) * 35}%` }}
                    className="w-1 rounded-full bg-[#14c8b2]"
                  />
                ))}
              </div>
            }
          />

          {/* Card 2: WhatsApp CRM Automation (Span 1) */}
          <BentoCard
            name="Instant WhatsApp Integration"
            className="md:col-span-1"
            Icon={MessageCircle}
            badge="Twilio API"
            description="Automatically dispatches appointment summaries, doctor clinic directions, intake questionnaires, and prescription refill links straight to patient WhatsApp."
            cta="See message templates"
            href="#solutions"
          />

          {/* Card 3: Instant Human Handoff & Triage (Span 1) */}
          <BentoCard
            name="Instant Human Handoff"
            className="md:col-span-1"
            Icon={UserCheck}
            badge="Clinical Safety"
            description="Intelligently detects complex or acute queries and executes an instant warm transfer to duty clinic staff with full audio transcripts."
            cta="Explore safety handoff"
            href="#security"
          />

          {/* Card 4: Hinglish, Hindi & English Fluency (Span 2) */}
          <BentoCard
            name="Natural Hinglish & Regional Dialects"
            className="md:col-span-2"
            Icon={Globe}
            badge="Multi-Lingual"
            description="Indian patients don't speak rigid corporate English. Swastik AI naturally switches between Hindi, English, and everyday colloquial Hinglish with empathetic medical phrasing."
            cta="Listen to sample calls"
            href="#solutions"
            background={
              <div className="absolute right-6 top-8 font-mono text-sm text-[rgba(20,200,178,0.15)] select-none">
                <p>PT: &quot;डॉक्टर साहब कल शाम को मिलेंगे?&quot;</p>
                <p className="text-[#14c8b2]/30">AI: &quot;जी हाँ! शाम 5:30 का स्लॉट फ्री है।&quot;</p>
              </div>
            }
          />

          {/* Card 5: 24/7 Zero Call Drops (Span 2 - Wide) */}
          <BentoCard
            name="24/7 Zero Call Abandonment"
            className="md:col-span-2"
            Icon={PhoneCall}
            badge="99.9% Uptime"
            description="Handles 50+ concurrent patient inquiries simultaneously during peak clinic hours, festival holidays, and emergency evening hours with zero busy signals."
            cta="Read SLA specs"
            href="#security"
          />

          {/* Card 6: Doctor Schedule & EHR Calendar Sync (Span 1 - Narrow) */}
          <BentoCard
            name="Smart Calendar & EHR Slot Sync"
            className="md:col-span-1"
            Icon={Calendar}
            badge="Live Sync"
            description="Directly syncs with doctor schedules and Google Calendar to avoid double-bookings and respect breaks."
            cta="Explore calendar integration"
            href="#use-cases"
          />
        </BentoGrid>
      </div>
    </section>
  )
}

// ── Pricing Section with Inspira UI CardSpotlight & BorderBeam ──
function Pricing() {
  const navigate = useNavigate()
  const plans = [
    {
      id: 'starter',
      name: 'Starter Clinic',
      price: 'Free',
      period: 'Forever',
      desc: 'Ideal for solo practitioners trying AI receptionist technology.',
      features: [
        '1 Clinic AI Voice Receptionist',
        'Up to 100 Patient Calls / month',
        'Standard Hindi & English Voice',
        'WhatsApp Booking Confirmations',
        'Basic Slot Management',
      ],
      cta: 'Start Free Trial',
      highlighted: false,
    },
    {
      id: 'pro',
      name: 'Professional Clinic',
      price: '₹2,999',
      period: '/month',
      desc: 'For busy clinics that require comprehensive voice automation & priority workflows.',
      features: [
        'Unlimited Inbound Patient Calls',
        'Custom Doctor Persona & Voice Tuning',
        'WhatsApp Automated Confirmation & Intake',
        'Multi-Doctor Slot Scheduling',
        'Google Calendar Two-Way Live Sync',
        'Dedicated WhatsApp Support Manager',
      ],
      cta: 'Get Pro Clinic Plan',
      highlighted: true,
    },
    {
      id: 'hospital',
      name: 'Hospital Network',
      price: 'Custom',
      period: 'Billed Annually',
      desc: 'For hospital chains, multi-location clinics, and diagnostic networks.',
      features: [
        'Multi-Clinic Centralized Dashboard',
        'Custom EHR & Hospital HIS Integration',
        'Teleconsultation Voice Routing',
        'Strict HIPAA & NABH Compliance SLA',
        'Dedicated Enterprise Solution Architect',
        'Custom IVR Fallback & PRI Line Support',
      ],
      cta: 'Contact Swastik AI Team',
      highlighted: false,
    },
  ]

  return (
    <section id="pricing" className="relative py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] text-xs font-semibold text-[#14c8b2] mb-4">
            <CreditCard className="w-3.5 h-3.5" /> Fair & Transparent
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Pricing Designed for Indian Clinics
          </h2>
          <p className="text-[#94a3b8] max-w-md mx-auto">
            No expensive PBX hardware. No long-term lock-in. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan, idx) => (
            <div key={idx} className="relative flex flex-col">
              {plan.highlighted ? (
                <div className="relative flex flex-col h-full rounded-2xl border border-[rgba(20,200,178,0.5)] bg-[rgba(8,14,23,0.95)] p-8 shadow-[0_0_50px_rgba(20,200,178,0.2)]">
                  {/* Inspira UI Border Beam on the Pro Plan */}
                  <BorderBeam size={250} duration={8} colorFrom="#14c8b2" colorTo="#00e5ff" borderWidth={2} />

                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#14c8b2] to-[#00e5ff] px-4 py-1 text-xs font-black uppercase tracking-wider text-[#04070c] shadow-lg z-20">
                    Recommended for Clinics
                  </div>

                  <div className="relative z-10 flex flex-col h-full">
                    <h3 className="text-xl font-bold text-white mb-1 mt-2">{plan.name}</h3>
                    <p className="text-xs text-[#94a3b8] mb-6">{plan.desc}</p>

                    <div className="flex items-baseline gap-1.5 mb-6">
                      <span className="text-4xl sm:text-5xl font-black text-white">{plan.price}</span>
                      <span className="text-xs text-[#94a3b8] font-medium">{plan.period}</span>
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((f, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2.5 text-sm text-[#f8fafc]">
                          <CheckCircle2 className="h-4 w-4 text-[#14c8b2] shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <ShimmerButton
                      shimmerColor="#00e5ff"
                      className="w-full mt-auto py-3.5 text-sm font-bold cursor-pointer"
                      onClick={() => navigate(`/checkout?plan=${plan.id}`)}
                    >
                      <span>{plan.cta}</span>
                      <ArrowRight className="h-4 w-4" />
                    </ShimmerButton>
                  </div>
                </div>
              ) : (
                <CardSpotlight
                  gradientColor="rgba(255,255,255,0.06)"
                  className="flex flex-col h-full p-8"
                >
                  <div className="flex flex-col flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                    <p className="text-xs text-[#94a3b8] mb-6">{plan.desc}</p>

                    <div className="flex items-baseline gap-1.5 mb-6">
                      <span className="text-4xl sm:text-5xl font-black text-white">{plan.price}</span>
                      <span className="text-xs text-[#94a3b8] font-medium">{plan.period}</span>
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((f, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2.5 text-sm text-[#94a3b8]">
                          <CheckCircle2 className="h-4 w-4 text-[#14c8b2] shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => navigate(`/checkout?plan=${plan.id}`)}
                      className="group w-full mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-3.5 text-sm font-semibold text-white transition-all hover:border-[#14c8b2] hover:bg-[rgba(20,200,178,0.15)] hover:text-[#14c8b2] cursor-pointer shadow-sm"
                    >
                      <span>{plan.cta}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </CardSpotlight>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Verified Doctor Testimonials ──
function Testimonials() {
  const reviews = [
    {
      name: 'Dr. A. K. Sharma',
      role: 'Senior Consultant Physician',
      clinic: 'Dr. Sharma Clinic, Delhi NCR',
      text: "Swastik AI revolutionized our clinical practice. It speaks warm Hinglish to patients, automatically confirms WhatsApp appointments, and sends QR codes for consultation fees. My staff now focuses 100% on patient care instead of answering phones!",
      rating: 5,
    },
    {
      name: 'Dr. Rajesh Sharma',
      role: 'Dental Surgeon & Implantologist',
      clinic: 'Aarogya Dental Clinic, Bhopal',
      text: "Patients are stunned when they realize they were talking to an AI. There is no awkward delay or pause. Swastik takes patient symptoms, checks my calendar slots, and locks the booking in less than a minute.",
      rating: 5,
    },
    {
      name: 'Dr. Priya Mehta',
      role: 'Consultant Dermatologist',
      clinic: 'Skin & Aesthetics Center, Indore',
      text: "Swastik AI eliminated our missed patient calls by over 45%. Patients receive instant WhatsApp confirmations, and our doctor schedule stays organized automatically.",
      rating: 5,
    },
  ]

  return (
    <section id="testimonials" className="relative py-24 px-6 bg-[rgba(8,14,23,0.5)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[rgba(245,166,35,0.3)] bg-[rgba(245,166,35,0.1)] text-xs font-semibold text-[#f5a623] mb-4">
            <Star className="w-3.5 h-3.5 fill-[#f5a623]" /> Verified Feedback
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Loved by Practicing Doctors
          </h2>
          <p className="text-[#94a3b8] max-w-md mx-auto">
            Discover how clinics eliminate missed calls and delight patients.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((rev, idx) => (
            <CardSpotlight
              key={idx}
              gradientColor="rgba(20, 200, 178, 0.12)"
              className="p-8 flex flex-col justify-between"
            >
              <div>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: rev.rating }).map((_, rIdx) => (
                    <Star key={rIdx} className="h-4 w-4 fill-[#f5a623] text-[#f5a623]" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-[#f8fafc] italic mb-6">
                  &quot;{rev.text}&quot;
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#14c8b2] to-[#00e5ff] font-bold text-[#04070c]">
                    {rev.name.split(' ')[1]?.[0] || 'D'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{rev.name}</h3>
                    <p className="text-xs text-[#14c8b2] font-medium">{rev.role}</p>
                    <p className="text-xs text-[#94a3b8]">{rev.clinic}</p>
                  </div>
                </div>
              </div>
            </CardSpotlight>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA Banner with Inspira Shimmer Button ──
function CTABanner() {
  return (
    <section className="relative py-24 px-6 overflow-hidden">
      <div className="relative max-w-5xl mx-auto rounded-3xl border border-[rgba(20,200,178,0.3)] bg-[rgba(8,14,23,0.9)] p-10 sm:p-16 text-center backdrop-blur-2xl shadow-[0_20px_70px_rgba(20,200,178,0.15)]">
        <BorderBeam size={320} duration={10} colorFrom="#14c8b2" colorTo="#f5a623" />

        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] px-4 py-1.5 text-xs font-semibold text-[#14c8b2] mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Start within 10 minutes
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-4">
            Give Your Clinic the Voice AI Upgrade It Deserves.
          </h2>

          <p className="text-sm sm:text-base text-[#94a3b8] mb-8 leading-relaxed">
            Eliminate missed patient bookings, reduce staff burnout, and provide an effortless appointment experience for every caller.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <ShimmerButton
              href="/console/index.html"
              target="_blank"
              rel="noopener noreferrer"
              shimmerColor="#00e5ff"
              className="py-4 px-8 text-base shadow-[0_0_35px_rgba(20,200,178,0.4)]"
            >
              <Headphones className="w-5 h-5 text-[#14c8b2]" />
              <span>Launch Live Voice Console</span>
              <ArrowRight className="w-4 h-4" />
            </ShimmerButton>

            <a
              href="mailto:priyanshu@swastik.ai"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-4 text-sm font-semibold text-[#94a3b8] transition-all hover:border-white/30 hover:text-white"
            >
              <span>Schedule Doctor Demo</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ──
function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#04070c] py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden border border-[rgba(20,200,178,0.4)] bg-[rgba(20,200,178,0.1)] p-0.5 shadow-[0_0_15px_rgba(20,200,178,0.3)]">
                <img
                  src="/swastik-brand-logo.png?v=3.0"
                  alt="Swastik AI Logo"
                  className="h-full w-full object-cover rounded-full"
                />
              </div>
              <span className="text-lg font-black tracking-tight text-white">
                Swastik <span className="gradient-text">AI</span>
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Autonomous Voice Infrastructure by Swastik AI. Built on Gemini 2.0 Flash Live API.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#22c55e]">
              <span className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span>All Systems Operational • 99.98% Latency SLA</span>
            </div>
          </div>

          {/* Solutions */}
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide mb-4">Voice Infrastructure</h3>
            <ul className="space-y-2.5 text-xs text-[#94a3b8]">
              <li><a href="#solutions" className="hover:text-[#14c8b2] transition-colors">Conversational Voice Agents</a></li>
              <li><a href="#solutions" className="hover:text-[#14c8b2] transition-colors">Doctor Voice Studio & Clones</a></li>
              <li><a href="#use-cases" className="hover:text-[#14c8b2] transition-colors">24/7 Appointment Triage</a></li>
              <li><a href="#use-cases" className="hover:text-[#14c8b2] transition-colors">WhatsApp Intake & Automation</a></li>
              <li><a href="/admin" className="text-[#14c8b2] font-semibold hover:underline">Doctor & Clinic Admin Portal →</a></li>
            </ul>
          </div>

          {/* Use Cases */}
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide mb-4">By Specialty</h3>
            <ul className="space-y-2.5 text-xs text-[#94a3b8]">
              <li><a href="#solutions" className="hover:text-[#14c8b2] transition-colors">Homeopathy & Holistic Health</a></li>
              <li><a href="#solutions" className="hover:text-[#14c8b2] transition-colors">Dental & Maxillofacial Centers</a></li>
              <li><a href="#solutions" className="hover:text-[#14c8b2] transition-colors">Orthopedics & Physiotherapy</a></li>
              <li><a href="#solutions" className="hover:text-[#14c8b2] transition-colors">Dermatology & Cosmetology</a></li>
              <li><a href="#pricing" className="hover:text-[#14c8b2] transition-colors">Pricing & Plans</a></li>
            </ul>
          </div>

          {/* Trust & Compliance */}
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide mb-4">Safety & Governance</h3>
            <ul className="space-y-2.5 text-xs text-[#94a3b8]">
              <li><a href="#security" className="hover:text-[#14c8b2] transition-colors">HIPAA-Compliant Audio Pipelines</a></li>
              <li><a href="#security" className="hover:text-[#14c8b2] transition-colors">DPDP Act (India) Compliance</a></li>
              <li><a href="#security" className="hover:text-[#14c8b2] transition-colors">Guaranteed Human Handoff</a></li>
              <li><a href="#security" className="hover:text-[#14c8b2] transition-colors">Zero Autonomous Prescription Policy</a></li>
              <li><a href="mailto:priyanshu@swastik.ai" className="hover:text-[#14c8b2] transition-colors">Contact Enterprise Security</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#94a3b8]">
          <p>© {new Date().getFullYear()} Swastik AI Technologies. Made with ❤️ by Swastik AI.</p>
          <p>Kanpur • Jabalpur • Bhopal • Delhi NCR</p>
        </div>
      </div>
    </footer>
  )
}

// ── Main Component ──
export default function Landing() {
  return (
    <div className="relative min-h-screen bg-[#04070c] text-[#f8fafc] overflow-x-hidden selection:bg-[rgba(20,200,178,0.3)] selection:text-[#14c8b2]">
      <OrbBackground />
      <Navbar />
      <main>
        <Hero />
        <LiveVoiceSection />
        <StatsBanner />
        <DoctorMarquee />
        <VoiceSegmentation />
        <UseCasesSection />
        <Features />
        <AnalyticsPreview />
        <Pricing />
        <TrustSecuritySection />
        <Testimonials />
        <CTABanner />
      </main>
      <Footer />
    </div>
  )
}
