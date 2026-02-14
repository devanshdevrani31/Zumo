'use client'

import { useEffect, useState, useCallback } from 'react'

interface AuditLog {
  id: string
  employeeId: string | null
  action: string
  details: string
  hash: string
  previousHash: string
  timestamp: string
  employee?: {
    id: string
    name: string
  } | null
}

interface Employee {
  id: string
  name: string
}

const PAGE_SIZE = 20

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all')
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [logsRes, employeesRes] = await Promise.allSettled([
        fetch('/api/audit'),
        fetch('/api/employees'),
      ])

      if (logsRes.status === 'fulfilled' && logsRes.value.ok) {
        const data = await logsRes.value.json()
        setLogs(Array.isArray(data) ? data : [])
      } else {
        throw new Error('Failed to fetch audit logs')
      }

      if (employeesRes.status === 'fulfilled' && employeesRes.value.ok) {
        const data = await employeesRes.value.json()
        setEmployees(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleVerifyChain() {
    try {
      setVerifying(true)
      setVerificationResult(null)

      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      })

      if (!res.ok) throw new Error('Verification request failed')

      const data = await res.json()
      setVerificationResult({
        valid: data.valid !== false,
        message: data.message || (data.valid !== false ? 'All hashes verified. Chain integrity is intact.' : 'Chain integrity compromised. Tampered entry detected.'),
      })
    } catch (err) {
      setVerificationResult({
        valid: false,
        message: err instanceof Error ? err.message : 'Verification failed',
      })
    } finally {
      setVerifying(false)
    }
  }

  const filteredLogs =
    filterEmployeeId === 'all'
      ? logs
      : logs.filter(log => log.employeeId === filterEmployeeId)

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const paginatedLogs = filteredLogs.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [filterEmployeeId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading audit logs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-center max-w-md">
          <p className="text-red-400 text-lg font-medium mb-2">Error</p>
          <p className="text-slate-300">{error}</p>
          <button onClick={() => fetchData()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Audit Log</h1>
          <p className="text-slate-400 mt-1">
            SHA-256 hash-chained tamper-proof record of all employee actions ({logs.length} events)
          </p>
        </div>
        <button
          onClick={handleVerifyChain}
          disabled={verifying}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-60 text-white"
        >
          {verifying ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify Chain Integrity
            </>
          )}
        </button>
      </div>

      {/* Verification Result */}
      {verificationResult && (
        <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
          verificationResult.valid ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'
        }`}>
          {verificationResult.valid ? (
            <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <div>
            <p className={`font-medium ${verificationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
              {verificationResult.valid ? 'Chain Verified' : 'Verification Failed'}
            </p>
            <p className="text-sm text-slate-400">{verificationResult.message}</p>
          </div>
          <button onClick={() => setVerificationResult(null)} className="ml-auto text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <label className="text-sm text-slate-400">Filter by employee:</label>
        <select
          value={filterEmployeeId}
          onChange={e => setFilterEmployeeId(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Employees</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">
          Showing {filteredLogs.length} of {logs.length} events
        </span>
      </div>

      {/* Audit Table */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-slate-400 text-lg">No audit logs</p>
          <p className="text-slate-500 text-sm mt-1">Events will be logged as employees perform actions</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Timestamp</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Employee</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Action</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Details</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Hash</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Prev Hash</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map(log => (
                  <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-blue-400">
                        {log.employee?.name || log.employeeId || 'System'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white font-medium">{log.action}</td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{log.details}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded">
                        {log.hash.substring(0, 16)}...
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded">
                        {log.previousHash.substring(0, 16)}...
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <p className="text-sm text-slate-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors disabled:opacity-40 text-white"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors disabled:opacity-40 text-white"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
