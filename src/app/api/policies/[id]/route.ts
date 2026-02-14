import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'
import { auditLogger } from '@/lib/audit'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req, auth) => {
    try {
      const { id } = params

      const policy = await prisma.policy.findUnique({ where: { id } })
      if (!policy || policy.orgId !== auth.orgId) {
        return NextResponse.json(
          { error: 'Policy not found' },
          { status: 404 }
        )
      }

      const { capability, permission, rateLimit } = await req.json()

      const updateData: Record<string, unknown> = {}
      if (capability !== undefined) updateData.capability = capability
      if (permission !== undefined) updateData.permission = permission
      if (rateLimit !== undefined) updateData.rateLimit = rateLimit

      const updated = await prisma.policy.update({
        where: { id },
        data: updateData,
      })

      await auditLogger.log(
        'policy.updated',
        JSON.stringify({ policyId: id, fields: Object.keys(updateData) }),
        policy.employeeId,
        auth.orgId
      )

      return NextResponse.json(updated)
    } catch (error) {
      console.error('Update policy error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (_req, auth) => {
    try {
      const { id } = params

      const policy = await prisma.policy.findUnique({ where: { id } })
      if (!policy || policy.orgId !== auth.orgId) {
        return NextResponse.json(
          { error: 'Policy not found' },
          { status: 404 }
        )
      }

      await prisma.policy.delete({ where: { id } })

      await auditLogger.log(
        'policy.deleted',
        JSON.stringify({ policyId: id, capability: policy.capability }),
        policy.employeeId,
        auth.orgId
      )

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Delete policy error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
