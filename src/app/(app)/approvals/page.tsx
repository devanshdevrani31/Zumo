'use client'

import { useEffect, useState } from 'react'

interface ApprovalRequest {
  id: string
  employeeId: string
  action: string
  details: string
  diff: string
  status: string
  createdAt: string
  resolvedAt: string | null
  employee?: {
    id: string
    name: string
    role: string
  }
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'denied'

const statusBadge: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800' },
  approved: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-800' },
  denied: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-800' },
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    fetchApprovals()
  }, [])

  async function fetchApprovals() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/approvals')
      if (!res.ok) throw new Error('Failed to fetch approvals')
      const data = await res.json()
      setApprovals(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(approvalId: string, action: 'approved' | 'denied') {
    try {
      setActionInProgress(approvalId)
      setFeedback(null)

      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to ${action === 'approved' ? 'approve' : 'deny'} request`)
      }

      const updated = await res.json()

      setApprovals((prev) =>
        prev.map((a) => (a.id === approvalId ? { ...a, ...updated } : a))
      )

      setFeedback({
        id: approvalId,
        type: 'success',
        message: `Request ${action === 'approved' ? 'approved' : 'denied'} successfully`,
      })

      setTimeout(() => {
        setFeedback((prev) => (prev?.id === approvalId ? null : prev))
      }, 3000)
    } catch (err) {
      setFeedback({
        id: approvalId,
        type: 'error',
        message: err instanceof Error ? err.message : 'Action failed',
      })
    } finally {
      setActionInProgress(null)
    }
  }

  const filteredApprovals = approvals.filter((a) => {
    if (filter === 'all') return true
    return a.status === filter
  })

  const pendingCount = approvals.filter((a) => a.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading approvals...</p>
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
            onClick={() => fetchApprovals()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Approvals</h1>
          <p className="text-slate-400 mt-1">
            Review and manage approval requests
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchApprovals()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'approved', 'denied'] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {f}
            {f === 'pending' && pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-yellow-500 text-black rounded-full text-xs">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Approval List */}
      {filteredApprovals.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 rounded-lg border border-slate-700">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-400 text-lg">
            {filter === 'all' ? 'No approval requests' : `No ${filter} requests`}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Approval requests will appear when employees attempt restricted actions
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApprovals.map((approval) => {
            const badge = statusBadge[approval.status] || statusBadge.pending
            const isExpanded = expandedId === approval.id

            return (
              <div
                key={approval.id}
                className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-blue-400">
                          {approval.employee?.name || approval.employeeId}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {approval.status}
                        </span>
                      </div>
                      <p className="text-white mb-1">{approval.action}</p>
                      {approval.details && (
                        <p className="text-sm text-slate-400">{approval.details}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-2">
                        Requested: {new Date(approval.createdAt).toLocaleString()}
                        {approval.resolvedAt && (
                          <> | Resolved: {new Date(approval.resolvedAt).toLocaleString()}</>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {approval.diff && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                        >
                          {isExpanded ? 'Hide Diff' : 'View Diff'}
                        </button>
                      )}
                      {approval.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAction(approval.id, 'approved')}
                            disabled={actionInProgress === approval.id}
                            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors disabled:opacity-60"
                          >
                            {actionInProgress === approval.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleAction(approval.id, 'denied')}
                            disabled={actionInProgress === approval.id}
                            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors disabled:opacity-60"
                          >
                            {actionInProgress === approval.id ? '...' : 'Deny'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Feedback Message */}
                  {feedback?.id === approval.id && (
                    <div
                      className={`mt-3 p-2 rounded text-sm ${
                        feedback.type === 'success'
                          ? 'bg-green-900/30 text-green-400 border border-green-800'
                          : 'bg-red-900/30 text-red-400 border border-red-800'
                      }`}
                    >
                      {feedback.message}
                    </div>
                  )}
                </div>

                {/* Expandable Diff Panel */}
                {isExpanded && approval.diff && (
                  <div className="border-t border-slate-700 p-6 bg-slate-900/50">
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Diff Preview</h4>
                    <pre className="text-sm text-slate-300 bg-slate-900 rounded-lg p-4 overflow-x-auto font-mono whitespace-pre-wrap">
                      {approval.diff}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
