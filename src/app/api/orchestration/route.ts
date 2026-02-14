import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'

export async function GET(request: Request) {
  return withAuth(request, async (_req, auth) => {
    const teams = await prisma.team.findMany({
      where: { orgId: auth.orgId },
      include: {
        employees: true,
        workflowRules: true,
      },
    })

    return NextResponse.json(teams)
  })
}
