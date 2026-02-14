import { NextResponse } from 'next/server'
import { policyEngine } from '@/lib/policy-engine'

/**
 * Policy Gateway — agents in Docker call this endpoint before executing any tool.
 * The gateway checks the policy engine and returns allow/deny.
 * No auth required (agents authenticate via employeeId which is validated against DB).
 */
export async function POST(request: Request) {
  try {
    const { employeeId, action, details } = await request.json()

    if (!employeeId || !action) {
      return NextResponse.json(
        { allowed: false, reason: 'Missing employeeId or action' },
        { status: 400 }
      )
    }

    const result = await policyEngine.evaluate(employeeId, action, details ? { details } : undefined)

    return NextResponse.json({
      allowed: result.allowed,
      reason: result.reason,
      requiresApproval: result.requiresApproval,
    })
  } catch (error) {
    console.error('Gateway error:', error)
    return NextResponse.json(
      { allowed: false, reason: 'Internal gateway error' },
      { status: 500 }
    )
  }
}
