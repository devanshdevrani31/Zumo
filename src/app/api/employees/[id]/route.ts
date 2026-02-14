import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'
import { auditLogger } from '@/lib/audit'
import { generateEvents } from '@/lib/simulation'
import { getContainerStatus, getContainerLogs, stopContainer, startContainer, removeContainer, sendTaskToAgent } from '@/lib/docker'

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

    // Get real container status if available
    let containerInfo = null
    let containerLogs: string[] = []
    if (employee.containerId) {
      try {
        containerInfo = await getContainerStatus(employee.containerId)
        containerLogs = await getContainerLogs(employee.containerId, 50)
      } catch { /* container may not exist */ }
    }

    // Fall back to simulation if no real container
    const activity = containerInfo?.running
      ? containerLogs.slice(-5).map((log, i) => ({
          id: `log-${i}`,
          type: 'container_log',
          message: log,
          timestamp: new Date().toISOString(),
        }))
      : generateEvents(id, 5)

    return NextResponse.json({
      ...employee,
      auditLogs,
      activity,
      containerInfo,
      containerLogs: containerLogs.slice(-20),
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
        taskDescription,
      } = body

      // Handle container actions
      if (action === 'run_task' && employee.containerId && taskDescription) {
        try {
          const taskId = `task-${Date.now()}`
          const result = await sendTaskToAgent(employee.containerId, {
            id: taskId,
            description: taskDescription,
          })
          await auditLogger.log('employee.task_executed', JSON.stringify({ taskId, description: taskDescription }), id, auth.orgId)
          return NextResponse.json({ taskResult: result })
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Task failed'
          return NextResponse.json({ taskResult: { status: 'failed', output: msg } })
        }
      }

      if (action === 'stop_container' && employee.containerId) {
        await stopContainer(employee.containerId)
        await prisma.employee.update({ where: { id }, data: { status: 'paused' } })
        await auditLogger.log('employee.container_stopped', '', id, auth.orgId)
        return NextResponse.json({ status: 'stopped' })
      }

      if (action === 'start_container' && employee.containerId) {
        await startContainer(employee.containerId)
        await prisma.employee.update({ where: { id }, data: { status: 'running' } })
        await auditLogger.log('employee.container_started', '', id, auth.orgId)
        return NextResponse.json({ status: 'running' })
      }

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

      // Stop and remove Docker container if exists
      if (employee.containerId) {
        try { await removeContainer(employee.containerId) } catch { /* ignore */ }
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          softDeleted: true,
          deletedAt: new Date(),
          status: 'stopped',
          containerId: null,
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
