import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Phone,
  Mail,
  Building2,
  User,
  MapPin,
  QrCode,
  Check,
  Copy,
  Zap,
  ArrowRight,
  Clock,
  CreditCard,
} from 'lucide-react'

interface PlanInfo {
  id: string
  name: string
  price: number
  priceDisplay: string
  period: string
  tagline: string
  features: string[]
  popular?: boolean
}

const PLANS: Record<string, PlanInfo> = {
  starter: {
    id: 'starter',
    name: 'Starter Clinic',
    price: 0,
    priceDisplay: 'Free',
    period: 'Forever',
    tagline: 'Ideal for solo practitioners trying AI receptionist technology.',
    features: [
      '1 Clinic AI Voice Receptionist',
      'Up to 100 Patient Calls / month',
      'Standard Hindi & English Voice',
      'WhatsApp Booking Confirmations',
      'Basic Slot Management',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Professional Clinic',
    price: 2999,
    priceDisplay: '₹2,999',
    period: '/month',
    tagline: 'For busy clinics that require comprehensive voice automation & priority workflows.',
    features: [
      'Unlimited Inbound Patient Calls',
      'Custom Doctor Persona & Voice Tuning',
      'WhatsApp Automated Confirmation & Intake',
      'Multi-Doctor Slot Scheduling',
      'Google Calendar Two-Way Live Sync',
      'Dedicated WhatsApp Support Manager',
      'Instant Interruption & Barge-In Handling',
    ],
    popular: true,
  },
  hospital: {
    id: 'hospital',
    name: 'Hospital Network',
    price: 14999,
    priceDisplay: '₹14,999',
    period: '/month',
    tagline: 'For hospital chains, multi-location clinics, and diagnostic networks.',
    features: [
      'Multi-Clinic Centralized Dashboard',
      'Custom EHR & Hospital HIS Integration',
      'Teleconsultation Voice Routing',
      'Strict HIPAA & NABH Compliance SLA',
      'Dedicated Enterprise Solution Architect',
      'Custom IVR Fallback & PRI Line Support',
    ],
  },
}

export default function Checkout() {
  const [searchParams] = useSearchParams()
  const planKey = searchParams.get('plan')?.toLowerCase() || 'pro'
  const selectedPlan = PLANS[planKey] || PLANS.pro

  // Form State
  const [formData, setFormData] = useState({
    doctorName: '',
    clinicName: '',
    phone: '',
    email: '',
    city: '',
  })

  // Order State
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transactionRef, setTransactionRef] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [copiedUpi, setCopiedUpi] = useState(false)

  // Step state: 1 = Details, 2 = Payment
  const [step, setStep] = useState<1 | 2>(1)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    if (error) setError(null)
  }

  // Handle Step 1 Submit -> Create Order in Backend
  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.doctorName.trim() || !formData.clinicName.trim() || !formData.phone.trim()) {
      setError('Please fill in Doctor Name, Clinic Name, and WhatsApp Number.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          plan_name: selectedPlan.name,
          amount: selectedPlan.price,
          doctor_name: formData.doctorName,
          clinic_name: formData.clinicName,
          phone: formData.phone,
          email: formData.email,
          city: formData.city,
        }),
      })

      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setOrder(data.order)
        setStep(2)
      } else {
        setError(data.message || 'Failed to create order. Please try again.')
      }
    } catch (err: any) {
      setError('Network error connecting to backend. Please check server.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Payment Verification
  const handleVerifyPayment = async (method: 'UPI' | 'DEMO' | 'RAZORPAY' = 'UPI', explicitRef?: string) => {
    if (!order) return
    if (method === 'UPI' && !transactionRef.trim()) {
      setError('Please enter the 12-digit UPI UTR / Transaction Reference number.')
      return
    }

    setVerifying(true)
    setError(null)

    try {
      const ref = method === 'DEMO' ? `DEMO-${Date.now()}` : (explicitRef || transactionRef.trim())
      const res = await fetch('/api/checkout/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.order_id,
          transaction_ref: ref,
          payment_method: method,
        }),
      })

      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setOrder(data.order)
        setIsSuccess(true)
      } else {
        setError(data.message || 'Verification failed. Please check transaction ID.')
      }
    } catch (err: any) {
      setError('Verification network error. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const copyUpiId = () => {
    if (order?.upi_id) {
      navigator.clipboard.writeText(order.upi_id)
      setCopiedUpi(true)
      setTimeout(() => setCopiedUpi(false), 2000)
    }
  }

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleRazorpay = async () => {
    if (!order) return
    setVerifying(true)
    const res = await loadRazorpay()
    if (!res) {
      setError('Razorpay SDK failed to load. Are you offline?')
      setVerifying(false)
      return
    }
    
    const options = {
      key: 'rzp_test_mock_key', // Mock testing key
      amount: order.amount * 100, // in paise
      currency: 'INR',
      name: 'Swastik AI',
      description: `Payment for ${order.plan_name}`,
      handler: function (response: any) {
        handleVerifyPayment('RAZORPAY', response.razorpay_payment_id)
      },
      prefill: {
        name: formData.doctorName,
        email: formData.email,
        contact: formData.phone,
      },
      theme: { color: '#14C8B2' },
    }
    setVerifying(false)
    const paymentObject = new (window as any).Razorpay(options)
    paymentObject.open()
  }

  return (
    <div className="min-h-screen bg-[#04070C] text-[#F8FAFC] antialiased">
      {/* Background radial glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(20,200,178,0.12)_0%,transparent_70%)] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.08] bg-[#04070C]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-semibold text-[#94A3B8] hover:text-[#14C8B2] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Swastik AI</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-[rgba(20,200,178,0.4)] bg-[rgba(20,200,178,0.1)] p-0.5 shadow-[0_0_15px_rgba(20,200,178,0.4)]">
              <img src="/swastik-brand-logo.png?v=3.0" alt="Swastik AI Logo" className="w-full h-full object-cover rounded-full" />
            </div>
            <span className="font-bold tracking-tight text-white">Swastik AI</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(20,200,178,0.15)] text-[#14C8B2] font-semibold border border-[rgba(20,200,178,0.3)]">
              Checkout
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#94A3B8]">
            <Lock className="w-3.5 h-3.5 text-[#10B981]" />
            <span>256-bit Encrypted</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {isSuccess ? (
          /* Success Screen */
          <div className="max-w-xl mx-auto text-center py-12 px-8 rounded-3xl border border-[rgba(20,200,178,0.4)] bg-[rgba(8,14,23,0.9)] shadow-[0_0_80px_rgba(20,200,178,0.25)] backdrop-blur-2xl">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-[#14C8B2] to-[#00E5FF] p-1 shadow-[0_0_30px_rgba(20,200,178,0.5)] mb-6 flex items-center justify-center">
              <div className="w-full h-full bg-[#04070C] rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-[#14C8B2]" />
              </div>
            </div>

            <span className="inline-block px-3 py-1 rounded-full bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[rgba(16,185,129,0.3)] text-xs font-bold uppercase tracking-wider mb-3">
              Payment Confirmed & Verified
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
              Welcome to Swastik AI!
            </h1>
            <p className="text-sm text-[#94A3B8] mb-8 leading-relaxed">
              Your AI Voice Receptionist has been provisioned for{' '}
              <strong className="text-white">{order?.clinic_name || formData.clinicName}</strong>{' '}
              under <strong className="text-white">{order?.doctor_name || formData.doctorName}</strong>.
            </p>

            {/* Receipt Box */}
            <div className="rounded-2xl bg-[#04070C]/80 border border-white/[0.08] p-5 mb-8 text-left text-xs space-y-2.5">
              <div className="flex justify-between text-[#94A3B8]">
                <span>Order Reference:</span>
                <span className="font-mono text-white font-semibold">{order?.order_id}</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Plan Subscribed:</span>
                <span className="text-white font-semibold">{order?.plan_name}</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Amount Paid:</span>
                <span className="text-[#14C8B2] font-bold text-sm">₹{order?.amount}</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Payment Method:</span>
                <span className="text-white">{order?.payment_method || 'UPI'}</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>WhatsApp Notification:</span>
                <span className="text-[#10B981] font-semibold">Sent to {order?.phone || formData.phone}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/console/index.html"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#14C8B2] to-[#00E5FF] text-[#04070C] font-bold text-sm shadow-[0_0_25px_rgba(20,200,178,0.4)] hover:brightness-110 transition-all"
              >
                <span>Launch Live Voice Console</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                to="/"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-white/10 hover:border-white/20 text-sm font-semibold text-[#94A3B8] hover:text-white transition-all"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          /* Checkout Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Order Summary */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="rounded-3xl border border-white/[0.08] bg-[rgba(8,14,23,0.8)] p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#14C8B2]">
                    Selected Clinic Plan
                  </span>
                  {selectedPlan.popular && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#14C8B2] to-[#00E5FF] text-[#04070C]">
                      Recommended
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-black text-white mb-1">{selectedPlan.name}</h2>
                <p className="text-xs text-[#94A3B8] mb-6 leading-relaxed">{selectedPlan.tagline}</p>

                {/* Price Display */}
                <div className="flex items-baseline gap-2 mb-6 pb-6 border-b border-white/[0.08]">
                  <span className="text-4xl font-black text-white">{selectedPlan.priceDisplay}</span>
                  <span className="text-xs text-[#94A3B8] font-medium">{selectedPlan.period}</span>
                </div>

                {/* Features list */}
                <div className="space-y-3 mb-6">
                  <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block mb-2">
                    What's Included:
                  </span>
                  {selectedPlan.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-[#F8FAFC]">
                      <CheckCircle2 className="w-4 h-4 text-[#14C8B2] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Cost Breakdown */}
                <div className="rounded-xl bg-[#04070C]/60 border border-white/[0.06] p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Subscription Fee</span>
                    <span className="text-white font-medium">{selectedPlan.priceDisplay}</span>
                  </div>
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>AI Voice Provisioning</span>
                    <span className="text-[#10B981] font-semibold">FREE (₹0)</span>
                  </div>
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Applicable GST (18%)</span>
                    <span className="text-white">Included</span>
                  </div>
                  <div className="pt-2 border-t border-white/[0.08] flex justify-between text-sm font-bold">
                    <span className="text-white">Total Due Today</span>
                    <span className="text-[#14C8B2]">{selectedPlan.priceDisplay}</span>
                  </div>
                </div>
              </div>

              {/* Guarantees Card */}
              <div className="rounded-2xl border border-white/[0.06] bg-[rgba(8,14,23,0.5)] p-5 space-y-3 text-xs text-[#94A3B8]">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#14C8B2] shrink-0" />
                  <span>
                    <strong className="text-white">7-Day Risk-Free Guarantee:</strong> If Swastik AI doesn't delight your clinic, receive a 100% refund.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#00E5FF] shrink-0" />
                  <span>
                    <strong className="text-white">Instant Activation:</strong> Your custom doctor voice agent starts answering calls in minutes.
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Intake & Payment Form */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-white/[0.08] bg-[rgba(8,14,23,0.9)] p-6 sm:p-10 backdrop-blur-2xl shadow-2xl relative">
                {/* Step Indicator */}
                <div className="flex items-center justify-between pb-6 mb-8 border-b border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        step === 1
                          ? 'bg-[#14C8B2] text-[#04070C]'
                          : 'bg-[#10B981] text-white'
                      }`}
                    >
                      {step === 1 ? '1' : <Check className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Clinic Details</h4>
                      <p className="text-[11px] text-[#94A3B8]">Doctor & Practice Intake</p>
                    </div>
                  </div>

                  <div className="w-12 h-0.5 bg-white/10" />

                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        step === 2
                          ? 'bg-[#14C8B2] text-[#04070C]'
                          : 'bg-white/10 text-[#94A3B8]'
                      }`}
                    >
                      2
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Payment & Activation</h4>
                      <p className="text-[11px] text-[#94A3B8]">UPI & Instant Confirmation</p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium">
                    {error}
                  </div>
                )}

                {step === 1 ? (
                  /* Step 1: Clinic Information Form */
                  <form onSubmit={handleProceedToPayment} className="space-y-5">
                    <div>
                      <label htmlFor="doctorName" className="block text-xs font-semibold text-[#94A3B8] mb-2">
                        Doctor's Full Name <span className="text-[#14C8B2]">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="doctorName"
                          type="text"
                          name="doctorName"
                          placeholder="e.g. Dr. A. K. Sharma"
                          value={formData.doctorName}
                          onChange={handleInputChange}
                          required
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#04070C]/80 border border-white/[0.1] focus:border-[#14C8B2] focus:outline-none text-sm text-white placeholder:text-[#475569] transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="clinicName" className="block text-xs font-semibold text-[#94A3B8] mb-2">
                        Clinic / Hospital Name <span className="text-[#14C8B2]">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="clinicName"
                          type="text"
                          name="clinicName"
                          placeholder="e.g. City Care Clinic (Swastik AI)"
                          value={formData.clinicName}
                          onChange={handleInputChange}
                          required
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#04070C]/80 border border-white/[0.1] focus:border-[#14C8B2] focus:outline-none text-sm text-white placeholder:text-[#475569] transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="phone" className="block text-xs font-semibold text-[#94A3B8] mb-2">
                          WhatsApp Number <span className="text-[#14C8B2]">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            id="phone"
                            type="tel"
                            name="phone"
                            placeholder="e.g. 76018 39607"
                            value={formData.phone}
                            onChange={handleInputChange}
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#04070C]/80 border border-white/[0.1] focus:border-[#14C8B2] focus:outline-none text-sm text-white placeholder:text-[#475569] transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="city" className="block text-xs font-semibold text-[#94A3B8] mb-2">
                          City / Locality
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            id="city"
                            type="text"
                            name="city"
                            placeholder="e.g. Jabalpur, MP"
                            value={formData.city}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#04070C]/80 border border-white/[0.1] focus:border-[#14C8B2] focus:outline-none text-sm text-white placeholder:text-[#475569] transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-xs font-semibold text-[#94A3B8] mb-2">
                        Email Address (for Invoices & Reports)
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="email"
                          type="email"
                          name="email"
                          placeholder="doctor@clinic.com"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#04070C]/80 border border-white/[0.1] focus:border-[#14C8B2] focus:outline-none text-sm text-white placeholder:text-[#475569] transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-[#14C8B2] to-[#00E5FF] text-[#04070C] font-bold text-sm shadow-[0_0_25px_rgba(20,200,178,0.35)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <span>Creating Order...</span>
                      ) : (
                        <>
                          <span>Continue to Payment</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* Step 2: Payment Options */
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#04070C]/80 border border-white/[0.08] text-xs">
                      <div className="text-[#94A3B8]">
                        Order ID: <span className="font-mono text-white font-bold">{order?.order_id}</span>
                      </div>
                      <button
                        onClick={() => setStep(1)}
                        className="text-[#14C8B2] hover:underline font-semibold"
                      >
                        Edit Details
                      </button>
                    </div>

                    {/* QR Code and UPI Box */}
                    <div className="p-6 rounded-2xl border border-[rgba(20,200,178,0.3)] bg-[#04070C]/90 text-center relative overflow-hidden">
                      <span className="text-xs font-bold text-[#14C8B2] uppercase tracking-wider block mb-2">
                        Instant UPI Payment
                      </span>
                      <p className="text-xs text-[#94A3B8] mb-4">
                        Scan with Google Pay, PhonePe, Paytm, or BHIM
                      </p>

                      {/* Dynamic QR Code */}
                      <div className="w-48 h-48 mx-auto p-3 bg-white rounded-2xl shadow-[0_0_30px_rgba(20,200,178,0.3)] flex items-center justify-center mb-4">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                            order?.upi_link || 'upi://pay'
                          )}&color=04-07-12`}
                          alt="UPI Payment QR"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* Deep Link button for Mobile */}
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
                        <a
                          href={order?.upi_link}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[rgba(20,200,178,0.15)] text-[#14C8B2] border border-[rgba(20,200,178,0.3)] text-xs font-bold hover:bg-[rgba(20,200,178,0.25)] transition-colors flex items-center justify-center gap-1.5"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Open UPI App Directly</span>
                        </a>

                        <button
                          onClick={copyUpiId}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-white/10 hover:border-white/20 text-xs text-[#94A3B8] hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedUpi ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedUpi ? 'Copied UPI ID' : `Copy: ${order?.upi_id}`}</span>
                        </button>
                      </div>

                      <div className="text-[11px] text-[#94A3B8]">
                        Amount to Pay: <strong className="text-white text-xs">₹{order?.amount}</strong> • Payee: <strong className="text-white">{order?.payee_name}</strong>
                      </div>
                    </div>

                    {/* UTR / Transaction Ref Input */}
                    <div>
                      <label className="block text-xs font-semibold text-[#94A3B8] mb-2">
                        Enter 12-digit UPI Reference / UTR Number
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. 423987123456"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          className="flex-1 px-4 py-3 rounded-xl bg-[#04070C]/80 border border-white/[0.1] focus:border-[#14C8B2] focus:outline-none text-sm text-white placeholder:text-[#475569] font-mono tracking-wider transition-all"
                        />
                        <button
                          onClick={() => handleVerifyPayment('UPI')}
                          disabled={verifying || !transactionRef.trim()}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#14C8B2] to-[#00E5FF] text-[#04070C] font-bold text-xs shadow-[0_0_20px_rgba(20,200,178,0.3)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {verifying ? 'Verifying...' : 'Verify & Activate'}
                        </button>
                      </div>
                    </div>

                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-white/10"></div>
                      <span className="flex-shrink-0 mx-4 text-[#94A3B8] text-[10px] font-semibold uppercase">Or pay with Cards / Netbanking</span>
                      <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    <button
                      onClick={handleRazorpay}
                      disabled={verifying}
                      className="w-full py-3.5 rounded-xl border border-[rgba(20,200,178,0.4)] bg-transparent hover:bg-[rgba(20,200,178,0.08)] text-[#14C8B2] font-bold text-xs shadow-[0_0_15px_rgba(20,200,178,0.1)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pay Securely via Razorpay</span>
                    </button>

                    {/* Instant Demo/Test Option */}
                    <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
                      <div className="text-xs text-[#94A3B8]">
                        <span className="text-white font-semibold flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-[#F5A623]" />
                          Testing & Demonstration Mode
                        </span>
                        <span>Verify onboarding without real monetary deduction</span>
                      </div>
                      <button
                        onClick={() => handleVerifyPayment('DEMO')}
                        disabled={verifying}
                        className="px-4 py-2 rounded-lg border border-[rgba(245,166,35,0.4)] bg-[rgba(245,166,35,0.1)] text-[#F5A623] text-xs font-bold hover:bg-[rgba(245,166,35,0.2)] transition-colors cursor-pointer"
                      >
                        ⚡ 1-Click Demo Activate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
