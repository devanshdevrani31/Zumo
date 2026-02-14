import prisma from '@/lib/db'
import { generateCostSummary } from '@/lib/simulation'

export interface SpendCheckResult {
  allowed: boolean
  reason: string
  remainingOrgBudget: number
  remainingEmployeeBudget: number
}

export class SpendingLimits {
  async checkBudget(orgId: string, employeeId: string, amount: number): Promise<SpendCheckResult> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) {
      return { allowed: false, reason: 'Organization not found', remainingOrgBudget: 0, remainingEmployeeBudget: 0 }
    }

    const todaySpend = await this.getOrgTodaySpend(orgId)
    const employeeSpend = await this.getEmployeeTodaySpend(employeeId)

    const remainingOrg = org.dailySpendCap - todaySpend
    const remainingEmp = org.perEmployeeSpendCap - employeeSpend

    if (amount > remainingOrg) {
      return { allowed: false, reason: `Org daily spend cap ($${org.dailySpendCap}) would be exceeded`, remainingOrgBudget: remainingOrg, remainingEmployeeBudget: remainingEmp }
    }
    if (amount > remainingEmp) {
      return { allowed: false, reason: `Per-employee spend cap ($${org.perEmployeeSpendCap}) would be exceeded`, remainingOrgBudget: remainingOrg, remainingEmployeeBudget: remainingEmp }
    }

    return { allowed: true, reason: 'Within budget', remainingOrgBudget: remainingOrg - amount, remainingEmployeeBudget: remainingEmp - amount }
  }

  async getOrgTodaySpend(orgId: string): Promise<number> {
    const employees = await prisma.employee.findMany({
      where: { orgId, softDeleted: false },
      select: { id: true },
    })
    let total = 0
    for (const emp of employees) {
      total += await this.getEmployeeTodaySpend(emp.id)
    }
    return total
  }

  async getEmployeeTodaySpend(employeeId: string): Promise<number> {
    const cost = generateCostSummary(employeeId)
    return cost.totalDaily
  }

  async getSpendingSummary(orgId: string): Promise<{
    dailySpend: number
    dailyCap: number
    percentUsed: number
    employees: Array<{ id: string; name: string; dailySpend: number; cap: number }>
  }> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) throw new Error('Organization not found')

    const employees = await prisma.employee.findMany({
      where: { orgId, softDeleted: false },
      select: { id: true, name: true },
    })

    let totalDailySpend = 0
    const employeeSpending = []
    for (const emp of employees) {
      const cost = generateCostSummary(emp.id)
      totalDailySpend += cost.totalDaily
      employeeSpending.push({
        id: emp.id,
        name: emp.name,
        dailySpend: cost.totalDaily,
        cap: org.perEmployeeSpendCap,
      })
    }

    return {
      dailySpend: parseFloat(totalDailySpend.toFixed(2)),
      dailyCap: org.dailySpendCap,
      percentUsed: Math.round((totalDailySpend / org.dailySpendCap) * 100),
      employees: employeeSpending,
    }
  }
}

export const spendingLimits = new SpendingLimits()
