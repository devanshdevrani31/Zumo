'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import ActivityFeed, { ActivityEvent } from '@/components/ActivityFeed'

interface Employee {
  id: string
  name: string
  role: string
  status: string
}

interface ApprovalRequest {
  id: string
  status: string
}

interface AuditLogEntry {
  id: string
  action: string
  details: string
  timestamp: string
}

interface SimulatedEvent {
  id: string
  type: string
  source: string
  message: string
  timestamp: string
}

interface SpendingSummary {
  dailySpend: number
  dailyCap: number
  percentUsed: number
}

interface OnboardingData {
  providerConfigs?: Array<{
    type: string
    provider: string
    status: string
  }>
  dataRegion?: string
  vpnEnabled?: boolean
}

function mapSimEventToActivity(ev: SimulatedEvent): ActivityEvent {
  const typeMap: Record<string, ActivityEvent['type']> = {
    slack_message: 'slack',
    sentry_error: 'sentry',
    github_event: 'github',
    hubspot_event: 'hubspot',
    vm_provision: 'vm',
    heartbeat: 'heartbeat',
    vpn_enrollment: 'vm',
    cost_update: 'heartbeat',
    cost_meter: 'heartbeat',
    knowledge_retrieval: 'github',
  }
  return {
    type: typeMap[ev.type] || 'heartbeat',
    source: ev.source,
    message: ev.message,
    timestamp: ev.timestamp,
  }
}

export default function DashboardPage() {
  const { org } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [spending, setSpending] = useState<SpendingSummary | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true)
        setError(null)

        const [employeesRes, approvalsRes, auditRes, spendingRes, onboardingRes] =
          await Promise.allSettled([
            fetch('/api/employees'),
            fetch('/api/approvals'),
            fetch('/api/audit'),
            fetch('/api/spending'),
            fetch('/api/onboarding'),
          ])

        let empData: Employee[] = []
        if (employeesRes.status === 'fulfilled' && employeesRes.value.ok) {
          empData = await employeesRes.value.json()
          setEmployees(Array.isArray(empData) ? empData : [])
        }

        if (approvalsRes.status === 'fulfilled' && approvalsRes.value.ok) {
          const data = await approvalsRes.value.json()
          setApprovals(Array.isArray(data) ? data : [])
        }

        if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
          const data = await auditRes.value.json()
          setAuditLogs(Array.isArray(data) ? data : [])
        }

        if (spendingRes.status === 'fulfilled' && spendingRes.value.ok) {
          const data = await spendingRes.value.json()
          setSpending(data)
        }

        if (onboardingRes.status === 'fulfilled' && onboardingRes.value.ok) {
          const data = await onboardingRes.value.json()
          setOnboarding(data)
        }

        // Fetch simulation events using the first employee
        if (Array.isArray(empData) && empData.length > 0) {
          try {
            const simRes = await fetch(`/api/simulation?employeeId=${empData[0].id}&count=5`)
            if (simRes.ok) {
              const simData: SimulatedEvent[] = await simRes.json()
              setActivity(simData.map(mapSimEventToActivity))
            }
          } catch {
            // Simulation is optional, don't block dashboard
          }
        }
      } catch (err) {
        setError('Failed to load dashboard data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 text-center max-w-md">
          <p className="text-red-400 text-lg font-medium mb-2">Error</p>
          <p className="text-slate-300">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const totalEmployees = employees.length
  const runningCount = employees.filter((e) => e.status === 'running').length
  const pendingApprovals = approvals.filter((a) => a.status === 'pending').length
  const totalAuditEvents = auditLogs.length
  const dailySpend = spending?.dailySpend ?? 0
  const dailyCap = spending?.dailyCap ?? (org?.dailySpendCap ?? 100)
  const spendPercent = dailyCap > 0 ? Math.round((dailySpend / dailyCap) * 100) : 0

  // Infrastructure data from onboarding
  const llmProvider = onboarding?.providerConfigs?.find((c) => c.type === 'llm')
  const serverProvider = onboarding?.providerConfigs?.find((c) => c.type === 'server')
  const vpnConfig = onboarding?.providerConfigs?.find((c) => c.type === 'vpn')
  const vpnEnabled = onboarding?.vpnEnabled ?? (vpnConfig?.provider !== 'none' && vpnConfig != null)
  const dataRegion = onboarding?.dataRegion ?? org?.dataRegion ?? 'EU'

  const statCards = [
    {
      label: 'Total Employees',
      value: totalEmployees,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Running',
      value: runningCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Pending Approvals',
      value: pendingApprovals,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    {
      label: 'Audit Events',
      value: totalAuditEvents,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Daily Spend',
      value: `$${dailySpend.toFixed(2)}/$${dailyCap}`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-slate-400 mt-1">Overview of your AI employee platform</p>
      </div>

      {/* Value Prop Hero Banner */}
      <div className="mb-6 bg-gradient-to-br from-blue-900/30 via-slate-800 to-purple-900/20 rounded-xl border border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-2">
          Deploy AI employees in minutes. Multi-agent collaboration. Secure by default.
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-3xl mb-4">
          Create and manage AI employees powered by frameworks like OpenClaw and AutoGPT with governance built in.
          Your AI employees work together 24/7 in sandboxed environments with policy controls,
          human oversight, and full audit trails.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/employees/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            Create Employee
          </Link>
          <Link
            href="/orchestration"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            Run Demo
          </Link>
        </div>
      </div>

      {/* Infrastructure Status Banner */}
      <div className="mb-6 bg-gradient-to-r from-slate-800 via-blue-900/20 to-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-slate-300">Infrastructure Status</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
            {llmProvider && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                LLM: {llmProvider.provider}
              </span>
            )}
            {serverProvider && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                Server: {serverProvider.provider}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${vpnEnabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
              VPN: {vpnEnabled ? 'Connected' : 'Not configured'}
            </span>
            <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
              {dataRegion}
            </span>
          </div>
        </div>
      </div>

      {/* Network Posture Indicator */}
      {vpnEnabled ? (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-emerald-900/20 border border-emerald-800/50 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-emerald-400 font-medium">Private Network Active</span>
          <span className="text-xs text-slate-400 ml-2">Agents communicate over encrypted VPN tunnel</span>
        </div>
      ) : (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-800/50 rounded-lg">
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm text-red-400 font-medium">No Private Network</span>
          <span className="text-xs text-slate-400 ml-2">Configure a VPN for secure agent communication</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <span className={card.color}>{card.icon}</span>
              </div>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-slate-400 text-sm mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Spending Overview */}
      {spending && (
        <div className="mb-8 bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Spending Overview</h2>
            <span className="text-sm text-slate-400">{spendPercent}% of daily cap</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                spendPercent > 80 ? 'bg-red-500' : spendPercent > 50 ? 'bg-yellow-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(spendPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>${dailySpend.toFixed(2)} spent today</span>
            <span>${dailyCap} daily cap</span>
          </div>
        </div>
      )}

      {/* Quick Actions + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              href="/employees/new"
              className="flex items-center gap-3 w-full p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Employee
            </Link>
            <Link
              href="/approvals"
              className="flex items-center gap-3 w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              View Approvals
              {pendingApprovals > 0 && (
                <span className="ml-auto bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingApprovals}
                </span>
              )}
            </Link>
            <Link
              href="/orchestration"
              className="flex items-center gap-3 w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Demo
            </Link>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          {activity.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">No recent activity</p>
              <p className="text-slate-500 text-sm mt-1">
                Activity will appear here when employees start working
              </p>
            </div>
          ) : (
            <ActivityFeed events={activity} />
          )}
        </div>
      </div>
    </div>
  )
}
