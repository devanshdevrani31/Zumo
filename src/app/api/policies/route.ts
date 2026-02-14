import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'
import { auditLogger } from '@/lib/audit'

export async function GET(request: Request) {
  return withAuth(request, async (_req, auth) => {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    const where: Record<string, unknown> = { orgId: auth.orgId }
    if (employeeId) {
      where.employeeId = employeeId
    }

    const policies = await prisma.policy.findMany({
      where,
      include: { employee: true },
    })

    return NextResponse.json(policies)
  })
}

export async function POST(request: Request) {
  return withAuth(request, async (req, auth) => {
    try {
      const { employeeId, capability, permission, rateLimit } = await req.json()

      if (!employeeId || !capability) {
        return NextResponse.json(
          { error: 'Missing required fields: employeeId, capability' },
          { status: 400 }
        )
      }

      // Verify employee belongs to org
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      })

      if (!employee || employee.orgId !== auth.orgId) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        )
      }

      const policy = await prisma.policy.create({
        data: {
          employeeId,
          capability,
          permission: permission || 'allow',
          rateLimit: rateLimit ?? null,
          orgId: auth.orgId,
        },
      })

      await auditLogger.log(
        'policy.created',
        JSON.stringify({ capability, permission: permission || 'allow', employeeId }),
        employeeId,
        auth.orgId
      )

      return NextResponse.json(policy)
    } catch (error) {
      console.error('Create policy error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
