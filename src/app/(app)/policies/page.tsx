'use client'

import { useEffect, useState } from 'react'

interface Employee {
  id: string
  name: string
}

interface Policy {
  id: string
  employeeId: string
  capability: string
  permission: string
  rateLimit: number | null
  employee?: Employee
}

const CAPABILITIES = [
  'send_email',
  'access_database',
  'modify_code',
  'deploy',
  'api_call',
  'file_write',
  'inter_agent_comm',
]

const capabilityLabels: Record<string, string> = {
  send_email: 'Send Email',
  access_database: 'Access Database',
  modify_code: 'Modify Code',
  deploy: 'Deploy',
  api_call: 'API Call',
  file_write: 'File Write',
  inter_agent_comm: 'Inter-Agent Comm',
}

const permissionColors: Record<string, { bg: string; text: string; border: string }> = {
  allow: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-800' },
  deny: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-800' },
  approval_required: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800' },
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formCapability, setFormCapability] = useState('')
  const [formPermission, setFormPermission] = useState('allow')
  const [formRateLimit, setFormRateLimit] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)

      const [policiesRes, employeesRes] = await Promise.allSettled([
        fetch('/api/policies'),
        fetch('/api/employees'),
      ])

      if (policiesRes.status === 'fulfilled' && policiesRes.value.ok) {
        const data = await policiesRes.value.json()
        setPolicies(Array.isArray(data) ? data : [])
      } else {
        throw new Error('Failed to fetch policies')
      }

      if (employeesRes.status === 'fulfilled' && employeesRes.value.ok) {
        const data = await employeesRes.value.json()
        setEmployees(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policies')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormEmployeeId('')
    setFormCapability('')
    setFormPermission('allow')
    setFormRateLimit('')
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(policy: Policy) {
    setFormEmployeeId(policy.employeeId)
    setFormCapability(policy.capability)
    setFormPermission(policy.permission)
    setFormRateLimit(policy.rateLimit?.toString() || '')
    setEditingId(policy.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (!formEmployeeId || !formCapability) return
    try {
      setSaving(true)
      setError(null)

      const body = {
        employeeId: formEmployeeId,
        capability: formCapability,
        permission: formPermission,
        rateLimit: formRateLimit ? parseInt(formRateLimit, 10) : null,
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/policies/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save policy')
      }

      resetForm()
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policy')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(policyId: string) {
    try {
      setDeletingId(policyId)
      setError(null)
      const res = await fetch(`/api/policies/${policyId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete policy')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete policy')
    } finally {
      setDeletingId(null)
    }
  }

  // Group policies by employee
  const groupedPolicies = policies.reduce<Record<string, Policy[]>>((acc, policy) => {
    const key = policy.employeeId
    if (!acc[key]) acc[key] = []
    acc[key].push(policy)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading policies...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Policies</h1>
          <p className="text-slate-400 mt-1">
            Manage capability permissions and rate limits ({policies.length} policies)
          </p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(!showForm)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Policy
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Inline Form */}
      {showForm && (
        <div className="mb-6 bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Policy' : 'New Policy'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Employee</label>
              <select
                value={formEmployeeId}
                onChange={(e) => setFormEmployeeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select employee...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Capability</label>
              <select
                value={formCapability}
                onChange={(e) => setFormCapability(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select capability...</option>
                {CAPABILITIES.map((cap) => (
                  <option key={cap} value={cap}>
                    {capabilityLabels[cap] || cap}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Permission</label>
              <div className="flex gap-2">
                {['allow', 'deny', 'approval_required'].map((perm) => (
                  <label
                    key={perm}
                    className={`flex-1 text-center px-3 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-colors ${
                      formPermission === perm
                        ? perm === 'allow'
                          ? 'bg-green-900/30 border-green-700 text-green-400'
                          : perm === 'deny'
                          ? 'bg-red-900/30 border-red-700 text-red-400'
                          : 'bg-yellow-900/30 border-yellow-700 text-yellow-400'
                        : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="permission"
                      value={perm}
                      checked={formPermission === perm}
                      onChange={() => setFormPermission(perm)}
                      className="sr-only"
                    />
                    {perm === 'approval_required' ? 'Approval' : perm.charAt(0).toUpperCase() + perm.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rate Limit (per min)
              </label>
              <input
                type="number"
                value={formRateLimit}
                onChange={(e) => setFormRateLimit(e.target.value)}
                placeholder="No limit"
                min={0}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formEmployeeId || !formCapability}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-40"
            >
              {saving ? 'Saving...' : editingId ? 'Update Policy' : 'Create Policy'}
            </button>
          </div>
        </div>
      )}

      {/* Policies grouped by employee */}
      {Object.keys(groupedPolicies).length === 0 ? (
        <div className="text-center py-16 bg-slate-800 rounded-lg border border-slate-700">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-slate-400 text-lg">No policies configured</p>
          <p className="text-slate-500 text-sm mt-1">
            Add policies to control employee capabilities
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedPolicies).map(([employeeId, empPolicies]) => {
            const employeeName =
              empPolicies[0]?.employee?.name ||
              employees.find((e) => e.id === employeeId)?.name ||
              employeeId

            return (
              <div
                key={employeeId}
                className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/80">
                  <h3 className="font-semibold">{employeeName}</h3>
                  <p className="text-xs text-slate-400">
                    {empPolicies.length} polic{empPolicies.length !== 1 ? 'ies' : 'y'}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-6 text-slate-400 font-medium">Capability</th>
                        <th className="text-left py-3 px-6 text-slate-400 font-medium">Permission</th>
                        <th className="text-left py-3 px-6 text-slate-400 font-medium">Rate Limit</th>
                        <th className="text-right py-3 px-6 text-slate-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empPolicies.map((policy) => {
                        const colors = permissionColors[policy.permission] || permissionColors.allow
                        return (
                          <tr key={policy.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="py-3 px-6 text-white">
                              {capabilityLabels[policy.capability] || policy.capability}
                            </td>
                            <td className="py-3 px-6">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
                              >
                                {policy.permission === 'approval_required'
                                  ? 'Approval Required'
                                  : policy.permission.charAt(0).toUpperCase() + policy.permission.slice(1)}
                              </span>
                            </td>
                            <td className="py-3 px-6 text-slate-300">
                              {policy.rateLimit ? `${policy.rateLimit}/min` : 'Unlimited'}
                            </td>
                            <td className="py-3 px-6 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => startEdit(policy)}
                                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(policy.id)}
                                  disabled={deletingId === policy.id}
                                  className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs transition-colors disabled:opacity-40"
                                >
                                  {deletingId === policy.id ? '...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
