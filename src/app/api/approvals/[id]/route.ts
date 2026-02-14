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
      const { status } = await req.json()

      if (!status || !['approved', 'denied'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be "approved" or "denied".' },
          { status: 400 }
        )
      }

      const approval = await prisma.approvalRequest.findUnique({
        where: { id },
      })

      if (!approval) {
        return NextResponse.json(
          { error: 'Approval request not found' },
          { status: 404 }
        )
      }

      if (approval.orgId !== auth.orgId) {
        return NextResponse.json(
          { error: 'Approval request not found' },
          { status: 404 }
        )
      }

      if (approval.status !== 'pending') {
        return NextResponse.json(
          { error: 'Approval request is no longer pending' },
          { status: 409 }
        )
      }

      const updated = await prisma.approvalRequest.update({
        where: { id },
        data: {
          status,
          resolvedAt: new Date(),
        },
      })

      await auditLogger.log(
        `approval.${status}`,
        JSON.stringify({ action: approval.action, approvalId: id }),
        approval.employeeId,
        auth.orgId
      )

      return NextResponse.json(updated)
    } catch (error) {
      console.error('Update approval error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
