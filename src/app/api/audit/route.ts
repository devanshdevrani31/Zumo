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

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: { employee: true },
    })

    return NextResponse.json(logs)
  })
}

export async function POST(request: Request) {
  return withAuth(request, async (req, auth) => {
    try {
      const { action } = await req.json()

      if (action !== 'verify') {
        return NextResponse.json(
          { error: 'Invalid action. Only "verify" is supported.' },
          { status: 400 }
        )
      }

      const result = await auditLogger.verifyChain(auth.orgId)
      return NextResponse.json(result)
    } catch (error) {
      console.error('Audit verify error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
