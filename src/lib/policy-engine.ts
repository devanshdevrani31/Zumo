import prisma from '@/lib/db'

export interface PolicyResult {
  allowed: boolean
  reason: string
  requiresApproval: boolean
}

interface RateLimitEntry {
  count: number
  windowStart: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_WINDOW_MS = 60_000

export class PolicyEngine {
  async evaluate(
    employeeId: string,
    action: string,
    context?: Record<string, unknown>,
  ): Promise<PolicyResult> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    })

    if (!employee) {
      return { allowed: false, reason: `Employee ${employeeId} not found`, requiresApproval: false }
    }

    const policies = await prisma.policy.findMany({
      where: { employeeId, capability: action },
    })

    if (policies.length === 0) {
      return this.evaluateAutonomyFallback(employee.autonomyMode, employeeId, action, context, employee.orgId)
    }

    let hasDeny = false
    let hasApprovalRequired = false
    let hasAllow = false
    let applicableRateLimit: number | null = null

    for (const policy of policies) {
      switch (policy.permission) {
        case 'deny':
          hasDeny = true
          break
        case 'approval_required':
          hasApprovalRequired = true
          break
        case 'allow':
          hasAllow = true
          break
      }
      if (policy.rateLimit !== null) {
        applicableRateLimit =
          applicableRateLimit === null
            ? policy.rateLimit
            : Math.min(applicableRateLimit, policy.rateLimit)
      }
    }

    if (hasDeny) {
      await this.logAudit('policy_denied', `Action "${action}" denied by explicit policy`, employeeId)
      return { allowed: false, reason: `Action "${action}" is explicitly denied by policy`, requiresApproval: false }
    }

    if (applicableRateLimit !== null) {
      const withinLimit = await this.checkRateLimit(employeeId, action, applicableRateLimit)
      if (!withinLimit) {
        await this.logAudit('rate_limit_exceeded', `Rate limit exceeded for "${action}" (limit: ${applicableRateLimit}/min)`, employeeId)
        return { allowed: false, reason: `Rate limit exceeded for "${action}" (max ${applicableRateLimit} per minute)`, requiresApproval: false }
      }
    }

    if (hasApprovalRequired) {
      await this.createApprovalRequest(employeeId, action, context)
      await this.logAudit('approval_requested', `Approval requested for "${action}"`, employeeId)
      return { allowed: false, reason: `Action "${action}" requires human approval. An approval request has been created.`, requiresApproval: true }
    }

    if (hasAllow) {
      await this.logAudit('policy_allowed', `Action "${action}" allowed by policy`, employeeId)
      this.incrementRateCounter(employeeId, action)
      return { allowed: true, reason: `Action "${action}" is allowed by policy`, requiresApproval: false }
    }

    return { allowed: false, reason: 'No matching permission found; defaulting to deny', requiresApproval: false }
  }

  async checkRateLimit(employeeId: string, action: string, limit?: number): Promise<boolean> {
    const effectiveLimit = limit ?? 60
    const key = `${employeeId}:${action}`
    const now = Date.now()
    const entry = rateLimitMap.get(key)

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.set(key, { count: 1, windowStart: now })
      return true
    }

    return entry.count < effectiveLimit
  }

  async checkInterAgentPermission(fromId: string, toId: string, action: string): Promise<boolean> {
    const [fromEmployee, toEmployee] = await Promise.all([
      prisma.employee.findUnique({ where: { id: fromId } }),
      prisma.employee.findUnique({ where: { id: toId } }),
    ])

    if (!fromEmployee || !toEmployee) return false

    if (!fromEmployee.teamId || !toEmployee.teamId || fromEmployee.teamId !== toEmployee.teamId) {
      const crossTeamPolicy = await prisma.policy.findFirst({
        where: { employeeId: fromId, capability: `cross_team:${action}`, permission: 'allow' },
      })
      if (!crossTeamPolicy) {
        await this.logAudit('inter_agent_denied', `Cross-team action "${action}" from ${fromId} to ${toId} denied`, fromId)
        return false
      }
    }

    const policy = await prisma.policy.findFirst({
      where: { employeeId: fromId, capability: `inter_agent:${action}`, permission: 'allow' },
    })

    if (!policy) {
      await this.logAudit('inter_agent_denied', `Inter-agent action "${action}" from ${fromId} to ${toId} denied (no policy)`, fromId)
      return false
    }

    await this.logAudit('inter_agent_allowed', `Inter-agent action "${action}" from ${fromId} to ${toId} allowed`, fromId)
    return true
  }

  private async evaluateAutonomyFallback(
    autonomyMode: string,
    employeeId: string,
    action: string,
    context?: Record<string, unknown>,
    orgId?: string | null,
  ): Promise<PolicyResult> {
    switch (autonomyMode) {
      case 'autopilot':
      case 'full':
        await this.logAudit('autonomy_allowed', `No explicit policy for "${action}"; autopilot mode allows by default`, employeeId)
        return { allowed: true, reason: `No explicit policy for "${action}"; allowed under autopilot mode`, requiresApproval: false }

      case 'assist':
      case 'supervised':
        await this.createApprovalRequest(employeeId, action, context, orgId)
        await this.logAudit('autonomy_approval', `No explicit policy for "${action}"; assist mode requires approval`, employeeId)
        return { allowed: false, reason: `No explicit policy for "${action}"; assist mode requires approval`, requiresApproval: true }

      case 'observe':
      case 'restricted':
      default:
        await this.logAudit('autonomy_denied', `No explicit policy for "${action}"; observe mode denies by default`, employeeId)
        return { allowed: false, reason: `No explicit policy for "${action}"; denied under observe mode`, requiresApproval: false }
    }
  }

  private async createApprovalRequest(
    employeeId: string,
    action: string,
    context?: Record<string, unknown>,
    orgId?: string | null,
  ): Promise<void> {
    await prisma.approvalRequest.create({
      data: {
        employeeId,
        action,
        details: context ? JSON.stringify(context) : '',
        status: 'pending',
        ...(orgId ? { orgId } : {}),
      },
    })
  }

  private incrementRateCounter(employeeId: string, action: string): void {
    const key = `${employeeId}:${action}`
    const now = Date.now()
    const entry = rateLimitMap.get(key)

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.set(key, { count: 1, windowStart: now })
    } else {
      entry.count++
    }
  }

  private async logAudit(action: string, details: string, employeeId?: string): Promise<void> {
    const { AuditLogger } = await import('@/lib/audit')
    const logger = new AuditLogger()
    await logger.log(action, details, employeeId)
  }
}

export const policyEngine = new PolicyEngine()
