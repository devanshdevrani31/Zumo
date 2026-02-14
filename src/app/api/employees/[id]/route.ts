import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'
import { auditLogger } from '@/lib/audit'
import { generateEvents } from '@/lib/simulation'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (_req, auth) => {
    const { id } = params

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { team: true, policies: true },
    })

    if (!employee || employee.orgId !== auth.orgId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { employeeId: id, orgId: auth.orgId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    })

    const activity = generateEvents(id, 5)

    return NextResponse.json({
      ...employee,
      auditLogs,
      activity,
    })
  })
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req, auth) => {
    try {
      const { id } = params

      const employee = await prisma.employee.findUnique({ where: { id } })
      if (!employee || employee.orgId !== auth.orgId) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        )
      }

      const body = await req.json()
      const {
        name,
        role,
        runtime,
        modelProvider,
        tools,
        autonomyMode,
        instructions,
        status,
        teamId,
        action,
      } = body

      const updateData: Record<string, unknown> = {}

      if (action === 'restore') {
        updateData.softDeleted = false
        updateData.deletedAt = null
        updateData.status = 'paused'
      } else {
        if (name !== undefined) updateData.name = name
        if (role !== undefined) updateData.role = role
        if (runtime !== undefined) updateData.runtime = runtime
        if (modelProvider !== undefined) updateData.modelProvider = modelProvider
        if (tools !== undefined) updateData.tools = typeof tools === 'string' ? tools : JSON.stringify(tools)
        if (autonomyMode !== undefined) updateData.autonomyMode = autonomyMode
        if (instructions !== undefined) updateData.instructions = instructions
        if (status !== undefined) updateData.status = status
        if (teamId !== undefined) updateData.teamId = teamId
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: updateData,
      })

      await auditLogger.log(
        action === 'restore' ? 'employee.restored' : 'employee.updated',
        JSON.stringify({ fields: Object.keys(updateData) }),
        id,
        auth.orgId
      )

      return NextResponse.json(updated)
    } catch (error) {
      console.error('Update employee error:', error)
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

      const employee = await prisma.employee.findUnique({ where: { id } })
      if (!employee || employee.orgId !== auth.orgId) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        )
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          softDeleted: true,
          deletedAt: new Date(),
          status: 'stopped',
        },
      })

      await auditLogger.log(
        'employee.deleted',
        JSON.stringify({ name: employee.name, role: employee.role }),
        id,
        auth.orgId
      )

      return NextResponse.json(updated)
    } catch (error) {
      console.error('Delete employee error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
