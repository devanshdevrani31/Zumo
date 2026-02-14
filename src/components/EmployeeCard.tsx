'use client'

import Link from 'next/link'

export interface Employee {
  id: string
  name: string
  role: string
  status: 'running' | 'paused' | 'stopped'
  runtime: string
  modelProvider: string
  tools: string[]
  autonomyMode: string
}

interface EmployeeCardProps {
  employee: Employee
}

const statusConfig: Record<
  Employee['status'],
  { color: string; ringColor: string; label: string }
> = {
  running: {
    color: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    label: 'Running',
  },
  paused: {
    color: 'bg-yellow-500',
    ringColor: 'ring-yellow-500/30',
    label: 'Paused',
  },
  stopped: {
    color: 'bg-red-500',
    ringColor: 'ring-red-500/30',
    label: 'Stopped',
  },
}

const roleBadgeColors: Record<string, string> = {
  'Support Agent': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Developer': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Security Analyst': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Data Analyst': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'DevOps Engineer': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Triage Engineer': 'bg-red-500/10 text-red-400 border-red-500/20',
  'DevOps Lead': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Customer Success': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Sales Development': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

const autonomyBadgeColors: Record<string, string> = {
  assist: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  autopilot: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  observe: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

function getRoleBadgeColor(role: string): string {
  return (
    roleBadgeColors[role] ??
    'bg-slate-500/10 text-slate-400 border-slate-500/20'
  )
}

function getAutonomyBadgeColor(mode: string): string {
  return (
    autonomyBadgeColors[mode] ??
    'bg-slate-500/10 text-slate-400 border-slate-500/20'
  )
}

export default function EmployeeCard({ employee }: EmployeeCardProps) {
  const { id, name, role, status, runtime, modelProvider, tools, autonomyMode } = employee
  const statusInfo = statusConfig[status]

  return (
    <Link href={`/employees/${id}`} className="block group">
      <div
        className="
          bg-slate-800/50 border border-slate-700/50 rounded-xl p-5
          transition-all duration-200
          hover:bg-slate-800 hover:border-slate-600 hover:shadow-lg hover:shadow-blue-500/5
          hover:-translate-y-0.5
          cursor-pointer
        "
      >
        {/* Header: Name + Status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-base truncate group-hover:text-blue-300 transition-colors">
              {name}
            </h3>
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <div className="relative flex items-center">
              {status === 'running' && (
                <span
                  className={`absolute w-2.5 h-2.5 rounded-full ${statusInfo.color} animate-ping opacity-40`}
                />
              )}
              <span
                className={`relative w-2.5 h-2.5 rounded-full ${statusInfo.color}`}
              />
            </div>
            <span className="text-xs text-slate-400">{statusInfo.label}</span>
          </div>
        </div>

        {/* Role badge */}
        <div className="mb-3">
          <span
            className={`
              inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border
              ${getRoleBadgeColor(role)}
            `}
          >
            {role}
          </span>
        </div>

        {/* Tags: Runtime + Model Provider */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7" />
            </svg>
            {runtime}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            {modelProvider}
          </span>
        </div>

        {/* Tools list */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {tools.map((tool) => (
            <span
              key={tool}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/30 text-slate-500 border border-slate-700/50"
            >
              {tool}
            </span>
          ))}
        </div>

        {/* Autonomy mode badge */}
        <div>
          <span
            className={`
              inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border
              ${getAutonomyBadgeColor(autonomyMode)}
            `}
          >
            {autonomyMode}
          </span>
        </div>
      </div>
    </Link>
  )
}
