import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'
import { encrypt } from '@/lib/secrets'

export async function GET(request: Request) {
  return withAuth(request, async (_req, auth) => {
    const providers = await prisma.providerConfig.findMany({
      where: { orgId: auth.orgId },
    })

    return NextResponse.json(providers)
  })
}

export async function POST(request: Request) {
  return withAuth(request, async (req, auth) => {
    try {
      const { type, provider, mode, credentials, plan, region, costEstimate } = await req.json()

      if (!type || !provider || !mode) {
        return NextResponse.json(
          { error: 'Missing required fields: type, provider, mode' },
          { status: 400 }
        )
      }

      const config = await prisma.providerConfig.create({
        data: {
          orgId: auth.orgId,
          type,
          provider,
          mode,
          credentials: credentials ? encrypt(credentials) : '',
          plan: plan || '',
          region: region || '',
          costEstimate: costEstimate ?? 0,
        },
      })

      return NextResponse.json(config)
    } catch (error) {
      console.error('Create provider error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
