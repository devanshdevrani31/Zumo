'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EmployeeCard from '@/components/EmployeeCard'

interface Employee {
  id: string
  name: string
  role: string
  runtime: string
  modelProvider: string
  tools: string
  autonomyMode: string
  status: 'running' | 'paused' | 'stopped'
  teamId: string | null
  createdAt: string
  updatedAt: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchEmployees() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/employees')
        if (!res.ok) throw new Error('Failed to fetch employees')
        const data = await res.json()
        setEmployees(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load employees')
      } finally {
        setLoading(false)
      }
    }

    fetchEmployees()
  }, [])

  const filteredEmployees = employees.filter((emp) => {
    const query = search.toLowerCase()
    return (
      emp.name.toLowerCase().includes(query) ||
      emp.role.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading employees...</p>
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-slate-400 mt-1">
            Manage your AI employees ({employees.length} total)
          </p>
        </div>
        <Link
          href="/employees/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create New Employee
        </Link>
      </div>

      {/* Search/Filter Bar */}
      <div className="mb-6">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Employee Grid */}
      {filteredEmployees.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 rounded-lg border border-slate-700">
          {employees.length === 0 ? (
            <>
              <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-slate-400 text-lg">No employees yet</p>
              <p className="text-slate-500 text-sm mt-1">Create your first AI employee to get started</p>
              <Link
                href="/employees/new"
                className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Create Employee
              </Link>
            </>
          ) : (
            <>
              <p className="text-slate-400 text-lg">No employees match your search</p>
              <p className="text-slate-500 text-sm mt-1">Try a different search term</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((employee) => {
            let tools: string[] = []
            try {
              tools = JSON.parse(employee.tools)
            } catch {
              tools = []
            }
            return (
              <EmployeeCard
                key={employee.id}
                employee={{
                  id: employee.id,
                  name: employee.name,
                  role: employee.role,
                  status: employee.status,
                  runtime: employee.runtime,
                  modelProvider: employee.modelProvider,
                  tools,
                  autonomyMode: employee.autonomyMode,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
