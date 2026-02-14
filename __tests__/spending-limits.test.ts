jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    employee: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    policy: { findMany: jest.fn(), findFirst: jest.fn() },
    approvalRequest: { create: jest.fn() },
    auditLog: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    organization: { findUnique: jest.fn() },
    providerConfig: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/simulation', () => ({
  __esModule: true,
  generateCostSummary: jest.fn().mockReturnValue({
    totalDaily: 10.0,
    totalMonthly: 300.0,
    breakdown: {
      compute: 3.0,
      'llm-tokens': 2.5,
      storage: 1.0,
      network: 1.5,
      'api-calls': 1.0,
      'third-party': 1.0,
    },
  }),
  generateEvents: jest.fn(),
  generateHeartbeatSnapshot: jest.fn(),
}))

import { SpendingLimits } from '@/lib/spending'
import prisma from '@/lib/db'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('SpendingLimits', () => {
  let limits: SpendingLimits

  beforeEach(() => {
    limits = new SpendingLimits()
    jest.clearAllMocks()

    // Re-apply the simulation mock return value after clearAllMocks
    const { generateCostSummary } = require('@/lib/simulation')
    ;(generateCostSummary as jest.Mock).mockReturnValue({
      totalDaily: 10.0,
      totalMonthly: 300.0,
      breakdown: {
        compute: 3.0,
        'llm-tokens': 2.5,
        storage: 1.0,
        network: 1.5,
        'api-calls': 1.0,
        'third-party': 1.0,
      },
    })
  })

  it('checkBudget returns allowed when within budget', async () => {
    ;(mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      id: 'org-1',
      dailySpendCap: 500,
      perEmployeeSpendCap: 100,
    })
    // getOrgTodaySpend calls findMany to get employees, each returns totalDaily = 10
    ;(mockPrisma.employee.findMany as jest.Mock).mockResolvedValue([
      { id: 'emp-1' },
    ])

    const result = await limits.checkBudget('org-1', 'emp-1', 5)

    expect(result.allowed).toBe(true)
    expect(result.reason).toContain('Within budget')
  })

  it('checkBudget returns denied when org cap exceeded', async () => {
    ;(mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      id: 'org-1',
      dailySpendCap: 15,
      perEmployeeSpendCap: 100,
    })
    // Two employees, each spending 10/day = 20 total org spend
    ;(mockPrisma.employee.findMany as jest.Mock).mockResolvedValue([
      { id: 'emp-1' },
      { id: 'emp-2' },
    ])

    // Org remaining = 15 - 20 = -5, so requesting any amount exceeds the cap
    const result = await limits.checkBudget('org-1', 'emp-1', 5)

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Org daily spend cap')
  })

  it('checkBudget returns denied when per-employee cap exceeded', async () => {
    ;(mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      id: 'org-1',
      dailySpendCap: 1000,
      perEmployeeSpendCap: 12,
    })
    ;(mockPrisma.employee.findMany as jest.Mock).mockResolvedValue([
      { id: 'emp-1' },
    ])

    // Employee already spent 10, cap is 12, remaining is 2. Requesting 5 exceeds it.
    const result = await limits.checkBudget('org-1', 'emp-1', 5)

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Per-employee spend cap')
  })

  it('checkBudget returns denied for non-existent org', async () => {
    ;(mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await limits.checkBudget('org-missing', 'emp-1', 5)

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Organization not found')
    expect(result.remainingOrgBudget).toBe(0)
    expect(result.remainingEmployeeBudget).toBe(0)
  })

  it('remaining budget calculations are correct', async () => {
    ;(mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      id: 'org-1',
      dailySpendCap: 500,
      perEmployeeSpendCap: 100,
    })
    ;(mockPrisma.employee.findMany as jest.Mock).mockResolvedValue([
      { id: 'emp-1' },
    ])

    // orgTodaySpend = 10 (one employee at 10/day), remainingOrg = 500 - 10 = 490
    // employeeSpend = 10, remainingEmp = 100 - 10 = 90
    // After requesting 5: remainingOrg = 490 - 5 = 485, remainingEmp = 90 - 5 = 85
    const result = await limits.checkBudget('org-1', 'emp-1', 5)

    expect(result.allowed).toBe(true)
    expect(result.remainingOrgBudget).toBe(485)
    expect(result.remainingEmployeeBudget).toBe(85)
  })
})
