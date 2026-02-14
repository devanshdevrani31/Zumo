'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Employee {
  id: string
  name: string
  role: string
  status: string
}

interface WorkflowRule {
  id: string
  teamId: string
  trigger: string
  steps: string
}

interface Team {
  id: string
  name: string
  description: string
  employees: Employee[]
  workflowRules: WorkflowRule[]
}

interface TimelineStep {
  id: number
  title: string
  agent: string
  description: string
  status: 'pending' | 'active' | 'completed'
  timestamp?: string
}

const DEMO_TIMELINE: TimelineStep[] = [
  {
    id: 1,
    title: 'Customer Complaint Received',
    agent: 'System',
    description: 'Incoming complaint detected via Slack integration: "App crashes on login page after latest update"',
    status: 'pending',
  },
  {
    id: 2,
    title: 'Support Agent Triages Issue',
    agent: 'Support Agent',
    description: 'Triages the issue, categorizes as high-priority bug, acknowledges customer in Slack thread',
    status: 'pending',
  },
  {
    id: 3,
    title: 'Developer Agent Investigates',
    agent: 'Developer Agent',
    description: 'Pulls Sentry logs, identifies null pointer exception in auth module, locates root cause in recent commit',
    status: 'pending',
  },
  {
    id: 4,
    title: 'Fix Applied & Tested',
    agent: 'Developer Agent',
    description: 'Commits fix to hotfix branch, runs test suite (47/47 passing), opens PR for review',
    status: 'pending',
  },
  {
    id: 5,
    title: 'Security Analyst Reviews',
    agent: 'Security Analyst',
    description: 'Scans fix for vulnerabilities, validates no sensitive data exposure, approves deployment',
    status: 'pending',
  },
  {
    id: 6,
    title: 'DevOps Deploys Fix',
    agent: 'DevOps Engineer',
    description: 'Merges PR, triggers CI/CD pipeline, deploys to staging then production with zero downtime',
    status: 'pending',
  },
  {
    id: 7,
    title: 'Customer Notified',
    agent: 'Support Agent',
    description: 'Sends resolution update to customer with fix details, marks ticket as resolved',
    status: 'pending',
  },
]

const statusColors: Record<string, string> = {
  running: 'bg-emerald-500',
  paused: 'bg-yellow-500',
  stopped: 'bg-red-500',
}

export default function OrchestrationPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [demoRunning, setDemoRunning] = useState(false)
  const [demoCompleted, setDemoCompleted] = useState(false)
  const [timeline, setTimeline] = useState<TimelineStep[]>([])
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false)

  useEffect(() => {
    fetchTeams()
  }, [])

  async function fetchTeams() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/orchestration')
      if (!res.ok) throw new Error('Failed to fetch teams')
      const data = await res.json()
      setTeams(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  async function handleRunDemo() {
    try {
      setDemoRunning(true)
      setDemoCompleted(false)
      setIsTimelineCollapsed(false)
      setTimeline([])
      await new Promise(resolve => setTimeout(resolve, 50))
      setTimeline(DEMO_TIMELINE.map(s => ({ ...s, status: 'pending', timestamp: undefined })))

      // Try to call the demo API
      try {
        await fetch('/api/orchestration/demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      } catch {
        // Demo endpoint may not exist yet
      }

      // Animate timeline progression
      for (let i = 0; i < DEMO_TIMELINE.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        setTimeline(prev =>
          prev.map((step, idx) => ({
            ...step,
            status: idx < i ? 'completed' : idx === i ? 'active' : 'pending',
            timestamp: idx <= i ? new Date().toLocaleTimeString() : undefined,
          }))
        )
        await new Promise(resolve => setTimeout(resolve, 500))
        setTimeline(prev =>
          prev.map((step, idx) => ({
            ...step,
            status: idx <= i ? 'completed' : idx === i + 1 ? 'active' : 'pending',
            timestamp: idx <= i ? step.timestamp || new Date().toLocaleTimeString() : undefined,
          }))
        )
      }

      setDemoCompleted(true)
      await new Promise(resolve => setTimeout(resolve, 3000))
      setIsTimelineCollapsed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo failed')
    } finally {
      setDemoRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading orchestration...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Orchestration</h1>
          <p className="text-slate-400 mt-1">Manage teams and run multi-agent workflows</p>
        </div>
        <button
          onClick={handleRunDemo}
          disabled={demoRunning}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-medium disabled:opacity-60 text-white"
        >
          {demoRunning ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running Demo...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Demo Scenario
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Demo Timeline */}
      {timeline.length > 0 && (
        <div className="mb-8 bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Demo: Multi-Agent Incident Resolution</h2>
              {demoCompleted && (
                <span className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-800 rounded text-sm font-medium">
                  Completed
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                title={isTimelineCollapsed ? 'Expand' : 'Collapse'}
              >
                <svg className={`w-5 h-5 transition-transform ${isTimelineCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => { setTimeline([]); setDemoCompleted(false); setIsTimelineCollapsed(false) }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {!isTimelineCollapsed && (
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-700" />
              <div className="space-y-6">
                {timeline.map(step => (
                  <div key={step.id} className="relative flex gap-4">
                    <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                      step.status === 'completed' ? 'bg-green-600'
                      : step.status === 'active' ? 'bg-blue-600 animate-pulse'
                      : 'bg-slate-700'
                    }`}>
                      {step.status === 'completed' ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : step.status === 'active' ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-sm text-slate-400">{step.id}</span>
                      )}
                    </div>
                    <div className={`flex-1 p-4 rounded-lg border transition-all duration-500 ${
                      step.status === 'completed' ? 'bg-green-900/10 border-green-800/50'
                      : step.status === 'active' ? 'bg-blue-900/20 border-blue-700'
                      : 'bg-slate-700/30 border-slate-700'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-white">{step.title}</h3>
                        {step.timestamp && <span className="text-xs text-slate-500">{step.timestamp}</span>}
                      </div>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-1">
                        {step.agent}
                      </span>
                      <p className="text-sm text-slate-400">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isTimelineCollapsed && (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm">
                Demo completed with {timeline.filter(s => s.status === 'completed').length} steps -- click expand to review
              </p>
            </div>
          )}
        </div>
      )}

      {/* Teams List */}
      {teams.length === 0 ? (
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 text-center py-16">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="text-slate-400 text-lg">No teams configured</p>
          <p className="text-slate-500 text-sm mt-1">Teams are created when employees are assigned to groups during creation</p>
        </div>
      ) : (
        <div className="space-y-6">
          {teams.map(team => (
            <div key={team.id} className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white">{team.name}</h2>
                {team.description && <p className="text-slate-400 text-sm mt-1">{team.description}</p>}
              </div>

              {/* Team Members */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Members ({team.employees?.length || 0})</h3>
                {(!team.employees || team.employees.length === 0) ? (
                  <p className="text-slate-500 text-sm">No employees in this team</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {team.employees.map(emp => (
                      <Link key={emp.id} href={`/employees/${emp.id}`}
                        className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="relative">
                            {emp.status === 'running' && (
                              <span className={`absolute w-2.5 h-2.5 rounded-full ${statusColors[emp.status]} animate-ping opacity-40`} />
                            )}
                            <span className={`relative w-2.5 h-2.5 rounded-full block ${statusColors[emp.status] || 'bg-gray-500'}`} />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.role}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Workflow Rules */}
              {team.workflowRules && team.workflowRules.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Workflow Rules</h3>
                  <div className="space-y-3">
                    {team.workflowRules.map(rule => {
                      let steps: Array<{ agent?: string; action?: string; order?: number }> = []
                      try { steps = JSON.parse(rule.steps) } catch { steps = [] }
                      return (
                        <div key={rule.id} className="p-4 bg-slate-700/50 rounded-lg border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-sm font-medium text-white">Trigger: {rule.trigger.replace(/_/g, ' ')}</span>
                          </div>
                          {steps.length > 0 && (
                            <div className="ml-6 space-y-1">
                              {steps.map((s, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                                  <span className="w-4 h-4 bg-slate-600 rounded-full flex items-center justify-center text-[10px] text-slate-300">
                                    {idx + 1}
                                  </span>
                                  <span className="text-blue-400 font-medium">{s.agent}</span>
                                  <span className="text-slate-500">{'\u2192'}</span>
                                  <span>{s.action?.replace(/_/g, ' ')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
