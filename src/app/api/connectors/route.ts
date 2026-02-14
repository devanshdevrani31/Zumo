import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'
import { encrypt } from '@/lib/secrets'

export async function GET(request: Request) {
  return withAuth(request, async (_req, auth) => {
    const accounts = await prisma.connectedAccount.findMany({
      where: { orgId: auth.orgId },
    })

    return NextResponse.json(accounts)
  })
}

export async function POST(request: Request) {
  return withAuth(request, async (req, auth) => {
    try {
      const { connector, scopes, riskLevel, writeEnabled, token, status } = await req.json()

      if (!connector) {
        return NextResponse.json(
          { error: 'Missing required field: connector' },
          { status: 400 }
        )
      }

      const account = await prisma.connectedAccount.create({
        data: {
          orgId: auth.orgId,
          connector,
          scopes: scopes ? (typeof scopes === 'string' ? scopes : JSON.stringify(scopes)) : '[]',
          riskLevel: riskLevel || 'low',
          writeEnabled: writeEnabled ?? false,
          tokenEncrypted: token ? encrypt(token) : '',
          status: status || 'connected',
        },
      })

      return NextResponse.json(account)
    } catch (error) {
      console.error('Create connector error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

export async function PUT(request: Request) {
  return withAuth(request, async (req, auth) => {
    try {
      const { id, scopes, writeEnabled } = await req.json()

      if (!id) {
        return NextResponse.json(
          { error: 'Missing required field: id' },
          { status: 400 }
        )
      }

      const account = await prisma.connectedAccount.findUnique({
        where: { id },
      })

      if (!account || account.orgId !== auth.orgId) {
        return NextResponse.json(
          { error: 'Connected account not found' },
          { status: 404 }
        )
      }

      const updateData: Record<string, unknown> = {}
      if (scopes !== undefined) updateData.scopes = typeof scopes === 'string' ? scopes : JSON.stringify(scopes)
      if (writeEnabled !== undefined) updateData.writeEnabled = writeEnabled

      const updated = await prisma.connectedAccount.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json(updated)
    } catch (error) {
      console.error('Update connector error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
