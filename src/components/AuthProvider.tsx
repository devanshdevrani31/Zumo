'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AuthContext, AuthUser, AuthOrg } from '@/lib/auth-context'

interface AuthProviderProps {
  children: ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [org, setOrg] = useState<AuthOrg | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
          setOrg(data.org)
        } else {
          setUser(null)
          setOrg(null)
        }
      } catch {
        setUser(null)
        setOrg(null)
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Proceed with redirect even if the call fails
    }
    setUser(null)
    setOrg(null)
    router.push('/login')
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, org, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
