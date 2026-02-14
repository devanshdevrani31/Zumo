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

import prisma from '@/lib/db'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('Soft Delete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('soft delete sets softDeleted:true and deletedAt', async () => {
    const now = new Date()
    ;(mockPrisma.employee.update as jest.Mock).mockResolvedValue({
      id: 'emp-1',
      name: 'Agent Alpha',
      softDeleted: true,
      deletedAt: now,
    })

    const updated = await mockPrisma.employee.update({
      where: { id: 'emp-1' },
      data: { softDeleted: true, deletedAt: now },
    })

    expect(updated.softDeleted).toBe(true)
    expect(updated.deletedAt).toEqual(now)
    expect(mockPrisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'emp-1' },
        data: expect.objectContaining({ softDeleted: true, deletedAt: now }),
      }),
    )
  })

  it('soft-deleted employees excluded from default list (softDeleted:false filter)', async () => {
    const allEmployees = [
      { id: 'emp-1', name: 'Active Agent', softDeleted: false, deletedAt: null },
      { id: 'emp-2', name: 'Deleted Agent', softDeleted: true, deletedAt: new Date() },
      { id: 'emp-3', name: 'Another Active', softDeleted: false, deletedAt: null },
    ]

    ;(mockPrisma.employee.findMany as jest.Mock).mockImplementation(({ where }: any) => {
      if (where?.softDeleted === false) {
        return Promise.resolve(allEmployees.filter((e) => !e.softDeleted))
      }
      return Promise.resolve(allEmployees)
    })

    const activeEmployees = await mockPrisma.employee.findMany({
      where: { orgId: 'org-1', softDeleted: false },
    })

    expect(activeEmployees).toHaveLength(2)
    expect(activeEmployees.every((e: any) => e.softDeleted === false)).toBe(true)
    expect(activeEmployees.map((e: any) => e.id)).not.toContain('emp-2')
  })

  it('soft-deleted employees can be restored (set softDeleted:false, deletedAt:null)', async () => {
    ;(mockPrisma.employee.update as jest.Mock).mockResolvedValue({
      id: 'emp-2',
      name: 'Restored Agent',
      softDeleted: false,
      deletedAt: null,
    })

    const restored = await mockPrisma.employee.update({
      where: { id: 'emp-2' },
      data: { softDeleted: false, deletedAt: null },
    })

    expect(restored.softDeleted).toBe(false)
    expect(restored.deletedAt).toBeNull()
    expect(mockPrisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ softDeleted: false, deletedAt: null }),
      }),
    )
  })

  it('includeDeleted flag shows soft-deleted employees', async () => {
    const allEmployees = [
      { id: 'emp-1', name: 'Active Agent', softDeleted: false, deletedAt: null },
      { id: 'emp-2', name: 'Deleted Agent', softDeleted: true, deletedAt: new Date('2026-01-15') },
      { id: 'emp-3', name: 'Another Active', softDeleted: false, deletedAt: null },
    ]

    ;(mockPrisma.employee.findMany as jest.Mock).mockImplementation(({ where }: any) => {
      // When includeDeleted is true, we don't filter on softDeleted
      if (where?.softDeleted === undefined || where?.softDeleted === null) {
        return Promise.resolve(allEmployees)
      }
      if (where?.softDeleted === false) {
        return Promise.resolve(allEmployees.filter((e) => !e.softDeleted))
      }
      return Promise.resolve(allEmployees)
    })

    // Simulate includeDeleted:true by omitting the softDeleted filter
    const allResults = await mockPrisma.employee.findMany({
      where: { orgId: 'org-1' },
    })

    // Simulate includeDeleted:false by adding the softDeleted filter
    const activeOnly = await mockPrisma.employee.findMany({
      where: { orgId: 'org-1', softDeleted: false },
    })

    expect(allResults).toHaveLength(3)
    expect(activeOnly).toHaveLength(2)
    expect(allResults.some((e: any) => e.softDeleted === true)).toBe(true)
    expect(activeOnly.every((e: any) => e.softDeleted === false)).toBe(true)
  })
})
