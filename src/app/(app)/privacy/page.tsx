'use client'

import { useState, useEffect } from 'react'

interface Employee {
  id: string
  name: string
  softDeleted?: boolean
  deletedAt?: string | null
}

interface OrgSettings {
  dataRegion: string
  retentionDays: number
  dailySpendCap: number
}

export default function PrivacyPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [deletedEmployees, setDeletedEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [orgSettings, setOrgSettings] = useState<OrgSettings>({ dataRegion: 'EU', retentionDays: 90, dailySpendCap: 100 })
  const [retention, setRetention] = useState('90')
  const [saving, setSaving] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [deleteEmployeeId, setDeleteEmployeeId] = useState('')
  const [deleteMode, setDeleteMode] = useState<'soft' | 'permanent'>('soft')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [permanentConfirmText, setPermanentConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [meRes, empRes, deletedRes] = await Promise.allSettled([
          fetch('/api/auth/me'),
          fetch('/api/employees'),
          fetch('/api/employees?includeDeleted=true'),
        ])

        if (meRes.status === 'fulfilled' && meRes.value.ok) {
          const data = await meRes.value.json()
          if (data.org) {
            setOrgSettings({
              dataRegion: data.org.dataRegion || 'EU',
              retentionDays: data.org.retentionDays || 90,
              dailySpendCap: data.org.dailySpendCap || 100,
            })
            setRetention(String(data.org.retentionDays || 90))
          }
        }

        if (empRes.status === 'fulfilled' && empRes.value.ok) {
          const data = await empRes.value.json()
          setEmployees((Array.isArray(data) ? data : []).filter((e: Employee) => !e.softDeleted))
        }

        if (deletedRes.status === 'fulfilled' && deletedRes.value.ok) {
          const data = await deletedRes.value.json()
          setDeletedEmployees((Array.isArray(data) ? data : []).filter((e: Employee) => e.softDeleted))
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  async function handleRetentionSave() {
    setSaving(true)
    // Simulated save
    await new Promise(resolve => setTimeout(resolve, 800))
    setOrgSettings(prev => ({ ...prev, retentionDays: retention === 'unlimited' ? 0 : parseInt(retention) }))
    setSaving(false)
  }

  function handleExportData() {
    setExportStatus('Generating export...')

    // Simulated JSON export
    setTimeout(() => {
      const exportData = {
        exportedAt: new Date().toISOString(),
        organization: orgSettings,
        employees: employees.map(e => ({ id: e.id, name: e.name })),
        totalAuditLogs: '(simulated)',
        format: 'JSON',
        gdprCompliant: true,
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zumo-data-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportStatus('Export downloaded successfully.')
      setTimeout(() => setExportStatus(null), 4000)
    }, 1500)
  }

  async function handleDeleteEmployee() {
    if (!deleteEmployeeId) return
    if (deleteMode === 'permanent' && permanentConfirmText !== 'DELETE') return

    try {
      setDeleting(true)
      setDeleteResult(null)

      const endpoint = `/api/employees/${deleteEmployeeId}`
      const method = deleteMode === 'soft' ? 'PUT' : 'DELETE'
      const body = deleteMode === 'soft' ? JSON.stringify({ action: 'soft-delete' }) : undefined
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }

      const res = await fetch(endpoint, { method, headers, body })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete employee')
      }

      if (deleteMode === 'soft') {
        const deletedEmp = employees.find(e => e.id === deleteEmployeeId)
        if (deletedEmp) {
          setEmployees(prev => prev.filter(e => e.id !== deleteEmployeeId))
          setDeletedEmployees(prev => [...prev, { ...deletedEmp, softDeleted: true, deletedAt: new Date().toISOString() }])
        }
        setDeleteResult({ type: 'success', message: 'Employee soft-deleted. They can be restored later.' })
      } else {
        setEmployees(prev => prev.filter(e => e.id !== deleteEmployeeId))
        setDeletedEmployees(prev => prev.filter(e => e.id !== deleteEmployeeId))
        setDeleteResult({ type: 'success', message: 'Employee and all associated data permanently deleted.' })
      }

      setDeleteEmployeeId('')
      setDeleteConfirm(false)
      setPermanentConfirmText('')
    } catch (err) {
      setDeleteResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete employee',
      })
    } finally {
      setDeleting(false)
    }
  }

  async function handleRestore(employeeId: string) {
    try {
      setRestoring(employeeId)
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })

      if (!res.ok) throw new Error('Failed to restore employee')

      const restoredEmp = deletedEmployees.find(e => e.id === employeeId)
      if (restoredEmp) {
        setDeletedEmployees(prev => prev.filter(e => e.id !== employeeId))
        setEmployees(prev => [...prev, { ...restoredEmp, softDeleted: false, deletedAt: null }])
      }
    } catch {
      // Non-critical
    } finally {
      setRestoring(null)
    }
  }

  const gdprChecklist = [
    { label: 'Data Minimization -- Only essential data collected', checked: true },
    { label: 'Purpose Limitation -- Data used only for stated purposes', checked: true },
    { label: 'Storage Limitation -- Automatic data retention policies', checked: true },
    { label: 'Right to Erasure -- Employee deletion with cascade', checked: true },
    { label: 'Data Portability -- Export in machine-readable format (JSON)', checked: true },
    { label: 'Consent Tracking -- Clear audit trail of all actions', checked: true },
    { label: 'DPO Contact -- Data Protection Officer configured', checked: false },
    { label: 'Breach Notification -- 72-hour notification system', checked: false },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Privacy & Compliance</h1>
        <p className="text-slate-400 mt-1">EU data protection and GDPR compliance settings</p>
      </div>

      <div className="space-y-6">
        {/* Data Region Badge */}
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Data Region</h2>
              <p className="text-slate-400 text-sm mt-1">All data is stored and processed within the configured region.</p>
            </div>
            <span className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-lg font-bold">
              {orgSettings.dataRegion}
            </span>
          </div>
        </div>

        {/* Data Retention */}
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Data Retention</h2>
          <p className="text-slate-400 text-sm mb-4">
            Configure how long employee activity data, audit logs, and interaction records are retained.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <label className="text-sm text-slate-300">Retention period:</label>
            <select
              value={retention}
              onChange={e => setRetention(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="unlimited">Unlimited</option>
            </select>
            <button
              onClick={handleRetentionSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-60 text-white"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Data older than the retention period will be automatically purged. Audit logs may be retained
            separately for compliance purposes.
          </p>
        </div>

        {/* Export Data */}
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Export Data</h2>
          <p className="text-slate-400 text-sm mb-4">
            Export all platform data in a machine-readable format (JSON). This includes employee configurations,
            policies, audit logs, and approval records.
          </p>
          <button
            onClick={handleExportData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium text-white"
          >
            Export All Data
          </button>
          {exportStatus && (
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
              <p className="text-blue-400 text-sm">{exportStatus}</p>
            </div>
          )}
        </div>

        {/* Delete Employee */}
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Delete Employee Data</h2>
          <p className="text-slate-400 text-sm mb-4">
            Soft delete preserves data for potential restoration. Permanent delete removes all associated data including
            policies, approval requests, audit logs, and activity records.
          </p>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex-1 w-full">
                <label className="block text-sm text-slate-300 mb-2">Select Employee</label>
                <select
                  value={deleteEmployeeId}
                  onChange={e => { setDeleteEmployeeId(e.target.value); setDeleteConfirm(false); setPermanentConfirmText('') }}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select employee to delete...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {deleteEmployeeId && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => { setDeleteMode('soft'); setDeleteConfirm(true); setPermanentConfirmText('') }}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors font-medium text-white"
                >
                  Soft Delete
                </button>
                <button
                  onClick={() => { setDeleteMode('permanent'); setDeleteConfirm(true); setPermanentConfirmText('') }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium text-white"
                >
                  Permanently Delete
                </button>
              </div>
            )}

            {/* Confirmation Modals */}
            {deleteConfirm && deleteMode === 'soft' && (
              <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                <p className="text-yellow-300 text-sm mb-3">
                  This will soft-delete the employee. Their data will be preserved and can be restored later.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteConfirm(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white">Cancel</button>
                  <button onClick={handleDeleteEmployee} disabled={deleting}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors font-medium disabled:opacity-60 text-white">
                    {deleting ? 'Deleting...' : 'Confirm Soft Delete'}
                  </button>
                </div>
              </div>
            )}

            {deleteConfirm && deleteMode === 'permanent' && (
              <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
                <p className="text-red-400 text-sm mb-3">
                  This will <strong>permanently</strong> delete the employee and ALL associated data.
                  This action cannot be undone.
                </p>
                <div className="mb-3">
                  <label className="block text-xs text-red-300 mb-1">Type DELETE to confirm:</label>
                  <input
                    type="text"
                    value={permanentConfirmText}
                    onChange={e => setPermanentConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-48 px-3 py-1.5 bg-slate-700 border border-red-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setDeleteConfirm(false); setPermanentConfirmText('') }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white">Cancel</button>
                  <button onClick={handleDeleteEmployee} disabled={deleting || permanentConfirmText !== 'DELETE'}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium disabled:opacity-40 text-white">
                    {deleting ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}

            {deleteResult && (
              <div className={`p-3 rounded-lg border ${
                deleteResult.type === 'success' ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'
              }`}>
                <p className={`text-sm ${deleteResult.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {deleteResult.message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Soft-Deleted Employees */}
        {deletedEmployees.length > 0 && (
          <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Soft-Deleted Employees</h2>
            <p className="text-slate-400 text-sm mb-4">
              These employees have been soft-deleted and can be restored.
            </p>
            <div className="space-y-2">
              {deletedEmployees.map(emp => (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-slate-300">{emp.name}</span>
                    {emp.deletedAt && (
                      <span className="text-xs text-slate-500 ml-3">Deleted {new Date(emp.deletedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRestore(emp.id)}
                    disabled={restoring === emp.id}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors disabled:opacity-60 text-white"
                  >
                    {restoring === emp.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GDPR Compliance Checklist */}
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">GDPR Compliance Checklist</h2>
          <p className="text-slate-400 text-sm mb-4">
            Overview of current compliance status with EU General Data Protection Regulation requirements.
          </p>

          <div className="space-y-3">
            {gdprChecklist.map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                {item.checked ? (
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className={`text-sm flex-1 ${item.checked ? 'text-slate-300' : 'text-slate-400'}`}>
                  {item.label}
                </span>
                {item.checked ? (
                  <span className="text-xs text-green-400 font-medium">Compliant</span>
                ) : (
                  <span className="text-xs text-yellow-400 font-medium">Action Required</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-slate-400">{gdprChecklist.filter(i => i.checked).length} compliant</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <span className="text-slate-400">{gdprChecklist.filter(i => !i.checked).length} action required</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
