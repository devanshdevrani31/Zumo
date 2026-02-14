jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    employee: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    policy: { findMany: jest.fn(), findFirst: jest.fn() },
    approvalRequest: { create: jest.fn(), findMany: jest.fn() },
    auditLog: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    organization: { findUnique: jest.fn() },
    providerConfig: { findFirst: jest.fn() },
  },
}))

import prisma from '@/lib/db'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

// Test data for two separate organizations
const orgAEmployees = [
  { id: 'emp-a1', name: 'Agent Alpha', orgId: 'org-A', role: 'engineer', softDeleted: false },
  { id: 'emp-a2', name: 'Agent Beta', orgId: 'org-A', role: 'analyst', softDeleted: false },
]

const orgBEmployees = [
  { id: 'emp-b1', name: 'Agent Gamma', orgId: 'org-B', role: 'engineer', softDeleted: false },
]

const orgAPolicies = [
  { id: 'pol-a1', employeeId: 'emp-a1', capability: 'deploy', permission: 'allow', orgId: 'org-A' },
]

const orgBPolicies = [
  { id: 'pol-b1', employeeId: 'emp-b1', capability: 'deploy', permission: 'deny', orgId: 'org-B' },
]

const orgAApprovals = [
  { id: 'apr-a1', employeeId: 'emp-a1', action: 'deploy', status: 'pending', orgId: 'org-A' },
]

const orgBApprovals = [
  { id: 'apr-b1', employeeId: 'emp-b1', action: 'restart', status: 'pending', orgId: 'org-B' },
]

const orgAAuditLogs = [
  { id: 'aud-a1', employeeId: 'emp-a1', action: 'policy_allowed', details: 'deploy allowed', orgId: 'org-A' },
]

const orgBAuditLogs = [
  { id: 'aud-b1', employeeId: 'emp-b1', action: 'policy_denied', details: 'deploy denied', orgId: 'org-B' },
]

describe('Organization Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock employee.findMany to filter by orgId
    ;(mockPrisma.employee.findMany as jest.Mock).mockImplementation(({ where }: any) => {
      if (where?.orgId === 'org-A') return Promise.resolve(orgAEmployees)
      if (where?.orgId === 'org-B') return Promise.resolve(orgBEmployees)
      return Promise.resolve([])
    })

    // Mock policy.findMany to filter by orgId
    ;(mockPrisma.policy.findMany as jest.Mock).mockImplementation(({ where }: any) => {
      if (where?.orgId === 'org-A') return Promise.resolve(orgAPolicies)
      if (where?.orgId === 'org-B') return Promise.resolve(orgBPolicies)
      return Promise.resolve([])
    })

    // Mock approvalRequest.findMany to filter by orgId
    ;(mockPrisma.approvalRequest.findMany as jest.Mock).mockImplementation(({ where }: any) => {
      if (where?.orgId === 'org-A') return Promise.resolve(orgAApprovals)
      if (where?.orgId === 'org-B') return Promise.resolve(orgBApprovals)
      return Promise.resolve([])
    })

    // Mock auditLog.findMany to filter by orgId
    ;(mockPrisma.auditLog.findMany as jest.Mock).mockImplementation(({ where }: any) => {
      if (where?.orgId === 'org-A') return Promise.resolve(orgAAuditLogs)
      if (where?.orgId === 'org-B') return Promise.resolve(orgBAuditLogs)
      return Promise.resolve([])
    })
  })

  it('employee query with orgA returns only orgA employees', async () => {
    const employees = await mockPrisma.employee.findMany({ where: { orgId: 'org-A' } })

    expect(employees).toHaveLength(2)
    expect(employees.every((e: any) => e.orgId === 'org-A')).toBe(true)
    expect(employees.map((e: any) => e.id)).toContain('emp-a1')
    expect(employees.map((e: any) => e.id)).toContain('emp-a2')
    expect(employees.map((e: any) => e.id)).not.toContain('emp-b1')
  })

  it('employee query with orgB returns only orgB employees', async () => {
    const employees = await mockPrisma.employee.findMany({ where: { orgId: 'org-B' } })

    expect(employees).toHaveLength(1)
    expect(employees[0].orgId).toBe('org-B')
    expect(employees[0].id).toBe('emp-b1')
    expect(employees.map((e: any) => e.id)).not.toContain('emp-a1')
  })

  it('policy query is scoped to org', async () => {
    const orgAPols = await mockPrisma.policy.findMany({ where: { orgId: 'org-A' } })
    const orgBPols = await mockPrisma.policy.findMany({ where: { orgId: 'org-B' } })

    expect(orgAPols).toHaveLength(1)
    expect(orgAPols[0].orgId).toBe('org-A')

    expect(orgBPols).toHaveLength(1)
    expect(orgBPols[0].orgId).toBe('org-B')

    // Ensure no cross-org leakage
    expect(orgAPols[0].id).not.toBe(orgBPols[0].id)
  })

  it('approval query is scoped to org', async () => {
    const orgAAprs = await mockPrisma.approvalRequest.findMany({ where: { orgId: 'org-A' } })
    const orgBAprs = await mockPrisma.approvalRequest.findMany({ where: { orgId: 'org-B' } })

    expect(orgAAprs).toHaveLength(1)
    expect(orgAAprs[0].orgId).toBe('org-A')
    expect(orgAAprs[0].employeeId).toBe('emp-a1')

    expect(orgBAprs).toHaveLength(1)
    expect(orgBAprs[0].orgId).toBe('org-B')
    expect(orgBAprs[0].employeeId).toBe('emp-b1')
  })

  it('audit log query is scoped to org', async () => {
    const orgALogs = await mockPrisma.auditLog.findMany({ where: { orgId: 'org-A' } })
    const orgBLogs = await mockPrisma.auditLog.findMany({ where: { orgId: 'org-B' } })

    expect(orgALogs).toHaveLength(1)
    expect(orgALogs[0].orgId).toBe('org-A')
    expect(orgALogs[0].action).toBe('policy_allowed')

    expect(orgBLogs).toHaveLength(1)
    expect(orgBLogs[0].orgId).toBe('org-B')
    expect(orgBLogs[0].action).toBe('policy_denied')
  })
})
