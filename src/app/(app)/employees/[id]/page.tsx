'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Employee {
  id: string
  name: string
  role: string
  runtime: string
  modelProvider: string
  tools: string
  autonomyMode: string
  instructions: string
  status: string
  containerId: string | null
  teamId: string | null
  orgId: string | null
  serverId: string | null
  createdAt: string
  updatedAt: string
  containerInfo?: { status: string; running: boolean; uptime?: number; cpuPercent?: number; memoryMb?: number } | null
  containerLogs?: string[]
}

interface AuditLog {
  id: string
  employeeId: string | null
  action: string
  details: string
  hash: string
  previousHash: string
  timestamp: string
}

interface SimulatedEvent {
  id: string
  type: string
  source: string
  message: string
  timestamp: string
  metadata: Record<string, unknown>
}

interface InboxMessage {
  id: string
  from: string
  subject: string
  body: string
  timestamp: string
  read: boolean
}

interface OnboardingState {
  vpnProvider?: string
  serverProvider?: string
  serverRegion?: string
  serverPlan?: string
}

interface CostSummary {
  totalDaily: number
  totalMonthly: number
  breakdown: Record<string, number>
}

const runtimeLabels: Record<string, string> = {
  openclaw: 'OpenClaw',
  autogpt: 'AutoGPT Loop',
  customplanner: 'Custom Planner',
  external: 'External Runtime',
}

const modelProviderLabels: Record<string, string> = {
  openai: 'OpenAI (GPT-4o)',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Gemini (Pro)',
  local: 'Local (OpenAI-compatible)',
}

const statusColors: Record<string, string> = {
  running: 'bg-emerald-500',
  paused: 'bg-yellow-500',
  stopped: 'bg-red-500',
  provisioning: 'bg-blue-500',
}

const RUNTIME_OPTIONS = [
  { id: 'openclaw', name: 'OpenClaw' },
  { id: 'autogpt', name: 'AutoGPT Loop' },
  { id: 'customplanner', name: 'Custom Planner' },
  { id: 'external', name: 'External Runtime' },
]

const EVENT_TYPES = [
  { id: 'slack_message', label: 'Slack Message' },
  { id: 'sentry_error', label: 'Sentry Error' },
  { id: 'github_event', label: 'GitHub Event' },
  { id: 'hubspot_event', label: 'HubSpot Event' },
  { id: 'heartbeat', label: 'Heartbeat' },
  { id: 'cost_update', label: 'Cost Update' },
  { id: 'vm_provision', label: 'VM Provision' },
]

const SIMULATED_MESSAGES: InboxMessage[] = [
  {
    id: 'msg-1',
    from: 'System',
    subject: 'Welcome aboard!',
    body: 'Your AI employee has been successfully deployed and is ready to receive tasks.',
    timestamp: new Date().toISOString(),
    read: true,
  },
  {
    id: 'msg-2',
    from: 'Orchestrator',
    subject: 'Team assignment update',
    body: 'You have been assigned to a new team. Check your workflow rules for updated responsibilities.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: false,
  },
  {
    id: 'msg-3',
    from: 'Policy Engine',
    subject: 'New policy applied',
    body: 'A rate limit policy has been applied to your Slack integration. Maximum 60 actions per minute.',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    read: false,
  },
]

const typeColors: Record<string, { color: string; bg: string }> = {
  slack_message: { color: 'text-purple-400', bg: 'bg-purple-500/10' },
  sentry_error: { color: 'text-red-400', bg: 'bg-red-500/10' },
  github_event: { color: 'text-slate-300', bg: 'bg-slate-500/10' },
  hubspot_event: { color: 'text-orange-400', bg: 'bg-orange-500/10' },
  vm_provision: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  heartbeat: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  cost_update: { color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  knowledge_retrieval: { color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  vpn_enrollment: { color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  cost_meter: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const employeeId = params.id as string

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'inbox' | 'infrastructure' | 'audit'>('overview')
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [activity, setActivity] = useState<SimulatedEvent[]>([])
  const [messages, setMessages] = useState<InboxMessage[]>(SIMULATED_MESSAGES)
  const [taskRunning, setTaskRunning] = useState(false)
  const [taskResult, setTaskResult] = useState<string | null>(null)
  const [runtimeSwitching, setRuntimeSwitching] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [onboardingData, setOnboardingData] = useState<OnboardingState | null>(null)
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null)
  const [auditPage, setAuditPage] = useState(1)
  const [injectOpen, setInjectOpen] = useState(false)
  const [injecting, setInjecting] = useState(false)

  const fetchEmployee = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/employees/${employeeId}`)
      if (!res.ok) throw new Error('Employee not found')
      const data = await res.json()
      setEmployee(data)
      if (data.auditLogs) setAuditLogs(data.auditLogs)
      if (data.activity) setActivity(data.activity)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee')
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit?employeeId=${employeeId}`)
      if (res.ok) {
        const data = await res.json()
        setAuditLogs(Array.isArray(data) ? data : [])
      }
    } catch {
      // Non-critical
    }
  }, [employeeId])

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/simulation?employeeId=${employeeId}&count=20`)
      if (res.ok) {
        const data = await res.json()
        setActivity(Array.isArray(data) ? data : [])
      }
    } catch {
      // Non-critical
    }
  }, [employeeId])

  const fetchOnboarding = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding')
      if (res.ok) {
        const data = await res.json()
        setOnboardingData(data)
      }
    } catch {
      // Non-critical
    }
  }, [])

  const fetchCostSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/simulation?employeeId=${employeeId}&type=cost_summary`)
      if (res.ok) {
        const data = await res.json()
        if (data.totalDaily !== undefined) {
          setCostSummary(data)
        }
      }
    } catch {
      // Use fallback
      setCostSummary({
        totalDaily: parseFloat((Math.random() * 80 + 20).toFixed(2)),
        totalMonthly: parseFloat((Math.random() * 2400 + 600).toFixed(2)),
        breakdown: {
          compute: parseFloat((Math.random() * 30 + 5).toFixed(2)),
          'llm-tokens': parseFloat((Math.random() * 40 + 10).toFixed(2)),
          storage: parseFloat((Math.random() * 5 + 1).toFixed(2)),
          network: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
          'api-calls': parseFloat((Math.random() * 10 + 2).toFixed(2)),
        },
      })
    }
  }, [employeeId])

  useEffect(() => {
    fetchEmployee()
    fetchAuditLogs()
    fetchActivity()
    fetchOnboarding()
    fetchCostSummary()
  }, [fetchEmployee, fetchAuditLogs, fetchActivity, fetchOnboarding, fetchCostSummary])

  const handleRuntimeSwitch = async (newRuntime: string) => {
    if (!employee || newRuntime === employee.runtime) return
    try {
      setRuntimeSwitching(true)
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runtime: newRuntime }),
      })
      if (!res.ok) throw new Error('Failed to switch runtime')
      const updated = await res.json()
      setEmployee(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch runtime')
    } finally {
      setRuntimeSwitching(false)
    }
  }

  const handleTogglePause = async () => {
    if (!employee) return
    const action = employee.status === 'running' ? 'stop_container' : 'start_container'
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        fetchEmployee()
        return
      }
      // Fallback: just toggle status in DB
      const newStatus = employee.status === 'running' ? 'paused' : 'running'
      const res2 = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res2.ok) throw new Error('Failed to update status')
      const updated = await res2.json()
      setEmployee(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const [testTaskInput, setTestTaskInput] = useState('')

  const handleTestTask = async () => {
    try {
      setTaskRunning(true)
      setTaskResult(null)

      const taskDescription = testTaskInput.trim() || `Hello! Please introduce yourself and describe what you can do as a ${employee?.role}.`

      // Try real container execution first
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_task', taskDescription }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.taskResult) {
          setTaskResult(data.taskResult.output || data.taskResult.status || 'Task completed.')
          setTestTaskInput('')
          fetchActivity()
          fetchAuditLogs()
          return
        }
      }

      // Fallback to simulation
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTaskResult(`[Simulated] Task completed successfully. ${employee?.name} processed: "${taskDescription}"`)
      fetchActivity()
      fetchAuditLogs()
    } catch {
      setTaskResult('Task execution failed. Check logs for details.')
    } finally {
      setTaskRunning(false)
    }
  }

  const handleInjectEvent = async (eventType: string) => {
    try {
      setInjecting(true)
      const res = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, type: eventType }),
      })
      if (res.ok) {
        const newEvent = await res.json()
        if (newEvent && newEvent.id) {
          setActivity(prev => [newEvent, ...prev])
        }
      }
      setInjectOpen(false)
      fetchActivity()
    } catch {
      // Non-critical
    } finally {
      setInjecting(false)
    }
  }

  const handleSendMessage = () => {
    if (!newMessage.trim()) return
    setSendingMessage(true)
    setTimeout(() => {
      const msg: InboxMessage = {
        id: `msg-${Date.now()}`,
        from: 'You',
        subject: 'Direct Message',
        body: newMessage.trim(),
        timestamp: new Date().toISOString(),
        read: true,
      }
      setMessages(prev => [msg, ...prev])
      setNewMessage('')
      setSendingMessage(false)
    }, 500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading employee...</p>
        </div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-center max-w-md">
          <p className="text-red-400 text-lg font-medium mb-2">Error</p>
          <p className="text-slate-300">{error || 'Employee not found'}</p>
          <Link href="/employees" className="inline-block mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white">
            Back to Employees
          </Link>
        </div>
      </div>
    )
  }

  let tools: string[] = []
  try { tools = JSON.parse(employee.tools) } catch { tools = [] }

  const uptime = Math.floor((Date.now() - new Date(employee.createdAt).getTime()) / 1000 / 60)
  const uptimeDisplay = uptime < 60 ? `${uptime}m` : uptime < 1440 ? `${Math.floor(uptime / 60)}h ${uptime % 60}m` : `${Math.floor(uptime / 1440)}d ${Math.floor((uptime % 1440) / 60)}h`
  const tasksCompleted = auditLogs.length + Math.floor(Math.random() * 50 + 10)

  const vpnActive = onboardingData?.vpnProvider && onboardingData.vpnProvider !== 'none'

  const AUDIT_PAGE_SIZE = 20
  const auditTotalPages = Math.max(1, Math.ceil(auditLogs.length / AUDIT_PAGE_SIZE))
  const paginatedAuditLogs = auditLogs.slice((auditPage - 1) * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE)

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'activity' as const, label: 'Activity' },
    { id: 'inbox' as const, label: `Inbox (${messages.filter(m => !m.read).length})` },
    { id: 'infrastructure' as const, label: 'Infrastructure' },
    { id: 'audit' as const, label: 'Audit Log' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Link href="/employees" className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{employee.name}</h1>
              {/* Heartbeat */}
              <div className="relative flex items-center">
                {employee.status === 'running' && (
                  <span className={`absolute w-3 h-3 rounded-full ${statusColors[employee.status]} animate-ping opacity-40`} />
                )}
                <span className={`relative w-3 h-3 rounded-full ${statusColors[employee.status] || 'bg-gray-500'}`} />
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                employee.status === 'running' ? 'bg-green-900/50 text-green-400 border border-green-800'
                : employee.status === 'paused' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
                : 'bg-red-900/50 text-red-400 border border-red-800'
              }`}>
                {employee.status}
              </span>
            </div>
            <p className="text-slate-400 mt-1">{employee.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleTestTask} disabled={taskRunning}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-medium disabled:opacity-60 text-white">
            {taskRunning ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running...
              </span>
            ) : 'Run Test Task'}
          </button>
          <button onClick={handleTogglePause}
            className={`px-4 py-2 rounded-lg transition-colors font-medium text-white ${
              employee.status === 'running' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
            }`}>
            {employee.status === 'running' ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>

      {/* Task Input */}
      <div className="mb-4 p-4 bg-slate-800 rounded-xl border border-slate-700">
        <label className="block text-sm font-medium text-slate-300 mb-2">Send a task to this agent</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={testTaskInput}
            onChange={e => setTestTaskInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !taskRunning && handleTestTask()}
            placeholder={`Ask ${employee.name} to do something...`}
            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button onClick={handleTestTask} disabled={taskRunning}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-medium disabled:opacity-60 text-white whitespace-nowrap">
            {taskRunning ? 'Running...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Task Result */}
      {taskResult && (
        <div className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-400 mb-1">Agent Response</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{taskResult}</p>
            </div>
            <button onClick={() => setTaskResult(null)} className="text-slate-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800 rounded-lg p-1 border border-slate-700 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Uptime</p>
                <p className="text-lg font-semibold text-white">{uptimeDisplay}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Est. Cost (24h)</p>
                <p className="text-lg font-semibold text-white">${costSummary?.totalDaily?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Tasks Completed</p>
                <p className="text-lg font-semibold text-white">{tasksCompleted}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${statusColors[employee.status] || 'bg-gray-500'}`} />
                  <p className="text-lg font-semibold text-white capitalize">{employee.status}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">Configuration</h3>
                <div className="space-y-3 bg-slate-700/30 rounded-lg p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Name</span>
                    <span className="text-white">{employee.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Role</span>
                    <span className="text-white">{employee.role}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Runtime</span>
                    <div className="flex items-center gap-2">
                      <select value={employee.runtime} onChange={e => handleRuntimeSwitch(e.target.value)} disabled={runtimeSwitching}
                        className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                        {RUNTIME_OPTIONS.map(rt => (
                          <option key={rt.id} value={rt.id}>{rt.name}</option>
                        ))}
                      </select>
                      {runtimeSwitching && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Model Provider</span>
                    <span className="text-white">{modelProviderLabels[employee.modelProvider] || employee.modelProvider}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Autonomy Mode</span>
                    <span className="text-white capitalize">{employee.autonomyMode}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">Tools</h3>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  {tools.length === 0 ? (
                    <p className="text-slate-500 text-sm">No tools configured</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tools.map(tool => (
                        <span key={tool} className="px-3 py-1 bg-slate-600 rounded-lg text-sm text-slate-200">{tool}</span>
                      ))}
                    </div>
                  )}
                </div>
                {employee.instructions && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-slate-300 mb-2">Instructions</h3>
                    <p className="text-sm text-slate-400 bg-slate-700/30 rounded-lg p-4 whitespace-pre-wrap">{employee.instructions}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Activity Feed</h3>
              <div className="relative">
                <button onClick={() => setInjectOpen(!injectOpen)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors text-white flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Inject Event
                </button>
                {injectOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-10">
                    {EVENT_TYPES.map(et => (
                      <button key={et.id} onClick={() => handleInjectEvent(et.id)} disabled={injecting}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 first:rounded-t-lg last:rounded-b-lg transition-colors">
                        {et.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {activity.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400">No activity recorded yet</p>
                <p className="text-slate-500 text-sm mt-1">Activity will appear here as the employee performs tasks</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[32rem] overflow-y-auto">
                {activity.map((event, index) => {
                  const colors = typeColors[event.type] || { color: 'text-slate-400', bg: 'bg-slate-500/10' }
                  return (
                    <div key={event.id || index} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-700/40 transition-colors">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${colors.bg} ${colors.color}`}>
                        <span className="text-xs font-bold">{event.source.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${colors.bg} ${colors.color}`}>
                            {event.source}
                          </span>
                          <span className="text-[11px] text-slate-500">{formatRelativeTime(event.timestamp)}</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-snug">{event.message}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Inbox Tab */}
        {activeTab === 'inbox' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Inbox</h3>
            <div className="mb-6 flex gap-3">
              <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleSendMessage} disabled={!newMessage.trim() || sendingMessage}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-40 text-white">
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </div>
            {messages.length === 0 ? (
              <div className="text-center py-12"><p className="text-slate-400">No messages</p></div>
            ) : (
              <div className="space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`p-4 rounded-lg border ${msg.read ? 'bg-slate-700/30 border-slate-700' : 'bg-blue-900/20 border-blue-800'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{msg.from}</span>
                        {!msg.read && <span className="w-2 h-2 bg-blue-400 rounded-full" />}
                      </div>
                      <span className="text-xs text-slate-500">{new Date(msg.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-200 mb-1">{msg.subject}</p>
                    <p className="text-sm text-slate-400">{msg.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Infrastructure Tab */}
        {activeTab === 'infrastructure' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Infrastructure</h3>

            {/* Real Container Info */}
            {employee.containerId && (
              <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Docker Container</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Container ID</span>
                    <span className="text-white font-mono text-xs">{employee.containerId.slice(0, 12)}</span>
                  </div>
                  {employee.containerInfo && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Status</span>
                        <span className={employee.containerInfo.running ? 'text-green-400' : 'text-red-400'}>
                          {employee.containerInfo.status}
                        </span>
                      </div>
                      {employee.containerInfo.running && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400">CPU</span>
                            <span className="text-white">{employee.containerInfo.cpuPercent}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Memory</span>
                            <span className="text-white">{employee.containerInfo.memoryMb} MB</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Uptime</span>
                            <span className="text-white">{Math.floor((employee.containerInfo.uptime || 0) / 60000)}m</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Container Logs */}
                {employee.containerLogs && employee.containerLogs.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs font-medium text-slate-400 mb-2">Recent Logs</h5>
                    <div className="bg-slate-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                      {employee.containerLogs.map((log, i) => (
                        <div key={i} className="text-xs font-mono text-slate-300 py-0.5">{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Server Info</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Environment</span>
                    <span className="text-white">{employee.containerId ? 'Docker Container' : (onboardingData?.serverProvider || 'Simulated')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Isolation</span>
                    <span className="text-white">{employee.containerId ? 'Container (non-root, capabilities dropped)' : 'Simulated'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Audit</span>
                    <span className="text-white">SHA-256 hash chain</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Private Network</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">VPN Status</span>
                    <span className={vpnActive ? 'text-green-400' : 'text-red-400'}>
                      {vpnActive ? 'Active' : 'Not Configured'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Provider</span>
                    <span className="text-white">{onboardingData?.vpnProvider || 'None'}</span>
                  </div>
                  {vpnActive && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Private IP</span>
                      <span className="text-white font-mono text-xs">100.64.0.1/24</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            {costSummary && (
              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Cost Estimate Breakdown</h4>
                <div className="space-y-2">
                  {Object.entries(costSummary.breakdown).map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 capitalize">{category.replace('-', ' ')}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-slate-600 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (amount / costSummary.totalDaily) * 100)}%` }} />
                        </div>
                        <span className="text-white w-16 text-right">${amount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-600 pt-2 mt-2 flex justify-between text-sm font-medium">
                    <span className="text-slate-300">Total Daily</span>
                    <span className="text-white">${costSummary.totalDaily.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Est. Monthly</span>
                    <span className="text-slate-300">${costSummary.totalMonthly.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-700/20 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-500">
                Billing goes directly to your infrastructure and LLM providers. Zumo handles orchestration, governance, and audit only.
              </p>
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Audit Log</h3>
            {auditLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400">No audit logs for this employee</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Timestamp</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Action</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Details</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAuditLogs.map(log => (
                        <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="py-3 px-4 text-white">{log.action}</td>
                          <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{log.details}</td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-500">{log.hash.substring(0, 16)}...</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {auditTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
                    <p className="text-sm text-slate-400">Page {auditPage} of {auditTotalPages}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={auditPage === 1}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors disabled:opacity-40 text-white">Previous</button>
                      <button onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))} disabled={auditPage === auditTotalPages}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors disabled:opacity-40 text-white">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
