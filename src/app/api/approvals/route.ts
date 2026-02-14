import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'

export async function GET(request: Request) {
  return withAuth(request, async (_req, auth) => {
    const approvals = await prisma.approvalRequest.findMany({
      where: { orgId: auth.orgId },
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(approvals)
  })
}
