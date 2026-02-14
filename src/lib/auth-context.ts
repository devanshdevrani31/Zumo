'use client'

import { createContext, useContext } from 'react'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

export interface AuthOrg {
  id: string
  name: string
  dataRegion: string
  dailySpendCap: number
  perEmployeeSpendCap: number
  onboardingCompleted: boolean
  retentionDays: number
}

export interface AuthState {
  user: AuthUser | null
  org: AuthOrg | null
  loading: boolean
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState>({
  user: null,
  org: null,
  loading: true,
  logout: async () => {},
})

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
