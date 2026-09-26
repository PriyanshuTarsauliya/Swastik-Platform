import React, { createContext, useContext, useState, useEffect } from 'react'

export interface User {
  id: number
  name: string
  email: string
  role: string
  clinic_name: string
  clinic_id?: string
  phone: string
  avatar_url?: string
  is_verified: number
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  signin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (data: {
    name: string
    email: string
    password: string
    role?: string
    clinic_name?: string
    phone?: string
  }) => Promise<{ success: boolean; error?: string }>
  signout: () => Promise<void>
  demoLogin: () => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('swastik_token'))
  const [loading, setLoading] = useState<boolean>(true)

  // Verify session on mount or token change
  useEffect(() => {
    async function verifySession() {
      const storedToken = localStorage.getItem('swastik_token')
      if (!storedToken) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.authenticated && data.user) {
            setUser(data.user)
            setToken(storedToken)
          } else {
            localStorage.removeItem('swastik_token')
            setUser(null)
            setToken(null)
          }
        } else {
          localStorage.removeItem('swastik_token')
          setUser(null)
          setToken(null)
        }
      } catch (err) {
        console.error('Session verification error:', err)
      } finally {
        setLoading(false)
      }
    }

    verifySession()
  }, [])

  const signin = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        localStorage.setItem('swastik_token', data.token)
        setToken(data.token)
        setUser(data.user)
        return { success: true }
      } else {
        return { success: false, error: data.detail || 'Invalid email or password' }
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while signing in' }
    }
  }

  const signup = async (formData: {
    name: string
    email: string
    password: string
    role?: string
    clinic_name?: string
    phone?: string
  }) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        localStorage.setItem('swastik_token', data.token)
        setToken(data.token)
        setUser(data.user)
        return { success: true }
      } else {
        return { success: false, error: data.detail || 'Failed to create account' }
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while signing up' }
    }
  }

  const signout = async () => {
    const currentToken = token || localStorage.getItem('swastik_token')
    if (currentToken) {
      try {
        await fetch('/api/auth/signout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        })
      } catch (err) {
        console.error('Sign out error:', err)
      }
    }
    localStorage.removeItem('swastik_token')
    setToken(null)
    setUser(null)
  }

  const demoLogin = async () => {
    return signin('drsharma@swastik.ai', 'Doctor@2026')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signin,
        signup,
        signout,
        demoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
