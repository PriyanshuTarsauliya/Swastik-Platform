import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ReactLenis } from 'lenis/react'
import 'lenis/dist/lenis.css'
import Landing from './pages/Landing'
import CustomCursor from './components/inspira/CustomCursor'
import { AuthProvider, useAuth } from './context/AuthContext'

const Checkout = lazy(() => import('./pages/Checkout'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const CallWidget = lazy(() => import('./pages/CallWidget'))
const SmartLinkPage = lazy(() => import('./pages/SmartLinkPage'))

function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#03060B] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#14c8b2] border-t-transparent animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <RouteFallback />
  if (!user) return <Navigate to="/signin" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <ReactLenis root options={{ lerp: 0.08, duration: 1.2, smoothWheel: true }}>
        <CustomCursor />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/orb" element={<Navigate to="/" replace />} />
            <Route path="/orbs" element={<Navigate to="/" replace />} />
            <Route path="/signin" element={<AuthPage defaultMode="signin" />} />
            <Route path="/login" element={<AuthPage defaultMode="signin" />} />
            <Route path="/signup" element={<AuthPage defaultMode="signup" />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/buy" element={<Checkout />} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/call/:clinicId" element={<CallWidget />} />
            <Route path="/voice/:slug" element={<SmartLinkPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ReactLenis>
    </AuthProvider>
  )
}
