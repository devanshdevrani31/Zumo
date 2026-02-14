import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'

function getDefaultPolicies(role: string, employeeId: string, orgId: string) {
  const roleLower = role.toLowerCase()

  if (roleLower.includes('support')) {
    return [
      { employeeId, orgId, capability: 'send_email', permission: 'approval_required', rateLimit: 10 },
      { employeeId, orgId, capability: 'access_database', permission: 'deny', rateLimit: null },
    ]
  }

  if (roleLower.includes('developer') || roleLower === 'dev') {
    return [
      { employeeId, orgId, capability: 'modify_code', permission: 'allow', rateLimit: null },
      { employeeId, orgId, capability: 'deploy', permission: 'approval_required', rateLimit: null },
      { employeeId, orgId, capability: 'send_email', permission: 'deny', rateLimit: null },
    ]
  }

  if (roleLower.includes('security')) {
    return [
      { employeeId, orgId, capability: 'api_call', permission: 'allow', rateLimit: 200 },
      { employeeId, orgId, capability: 'send_email', permission: 'approval_required', rateLimit: null },
      { employeeId, orgId, capability: 'modify_code', permission: 'deny', rateLimit: null },
      { employeeId, orgId, capability: 'file_write', permission: 'deny', rateLimit: null },
    ]
  }

  if (roleLower.includes('devops') || roleLower.includes('ops')) {
    return [
      { employeeId, orgId, capability: 'deploy', permission: 'approval_required', rateLimit: null },
      { employeeId, orgId, capability: 'modify_code', permission: 'allow', rateLimit: null },
      { employeeId, orgId, capability: 'file_write', permission: 'allow', rateLimit: null },
    ]
  }

  // Default policies
  return [
    { employeeId, orgId, capability: 'basic', permission: 'allow', rateLimit: null },
  ]
}

export async function GET(request: Request) {
  return withAuth(request, async (_req, auth) => {
    const employees = await prisma.employee.findMany({
      where: { orgId: auth.orgId, softDeleted: false },
      include: { team: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(employees)
  })
}

export async function POST(request: Request) {
  return withAuth(request, async (req, auth) => {
    try {
      const body = await req.json()
      const {
        name,
        role,
        runtime,
        modelProvider,
        tools,
        autonomyMode,
        instructions,
        teamId,
        serverId,
      } = body

      if (!name || !role) {
        return NextResponse.json(
          { error: 'Missing required fields: name, role' },
          { status: 400 }
        )
      }

      const employee = await prisma.employee.create({
        data: {
          name,
          role,
          runtime: runtime || 'openclaw',
          modelProvider: modelProvider || 'anthropic',
          tools: tools ? (typeof tools === 'string' ? tools : JSON.stringify(tools)) : '[]',
          autonomyMode: autonomyMode || 'assist',
          instructions: instructions || '',
          teamId: teamId || null,
          serverId: serverId || null,
          orgId: auth.orgId,
          status: 'running',
        },
      })

      // Create default policies based on role
      const defaultPolicies = getDefaultPolicies(role, employee.id, auth.orgId)
      for (const policy of defaultPolicies) {
        await prisma.policy.create({ data: policy })
      }

      const provisioningSteps = [
        'Allocating sandbox...',
        'Configuring network isolation...',
        'Deploying runtime...',
        'Starting supervisor...',
        'Heartbeat active',
      ]

      return NextResponse.json({
        employee,
        provisioningSteps,
      })
    } catch (error) {
      console.error('Create employee error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
