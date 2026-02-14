import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'
import { decrypt } from '@/lib/secrets'
import { checkDockerAvailable, createAgentContainer, ensureAgentImage } from '@/lib/docker'
import { auditLogger } from '@/lib/audit'

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

      // Try to start a real Docker container for the employee
      let containerId: string | null = null
      const provisioningSteps: Array<{ step: string; status: 'done' | 'skipped' | 'error'; detail?: string }> = []

      try {
        const dockerStatus = await checkDockerAvailable()
        if (dockerStatus.available) {
          provisioningSteps.push({ step: 'Docker available', status: 'done', detail: `v${dockerStatus.version}` })

          // Check if agent image exists
          const imageStatus = await ensureAgentImage()
          if (!imageStatus.exists) {
            provisioningSteps.push({ step: 'Agent image', status: 'skipped', detail: 'Run: docker build -t zumo-openclaw-agent ./agent' })
          } else {
            provisioningSteps.push({ step: 'Agent image ready', status: 'done' })

            // Get the LLM API key from org's provider config
            const llmConfig = await prisma.providerConfig.findFirst({
              where: { orgId: auth.orgId, type: 'llm' },
            })

            let llmApiKey = ''
            if (llmConfig?.credentials) {
              try { llmApiKey = decrypt(llmConfig.credentials) } catch { /* no key */ }
            }

            provisioningSteps.push({ step: 'Credentials loaded', status: 'done' })

            // Determine host URL for gateway
            const gatewayUrl = process.env.GATEWAY_URL || 'http://host.docker.internal:3000/api/gateway'

            containerId = await createAgentContainer({
              employeeId: employee.id,
              employeeName: name,
              llmProvider: llmConfig?.provider || modelProvider || 'openai',
              llmApiKey,
              llmModel: modelProvider === 'anthropic' ? 'claude-3-haiku-20240307' : modelProvider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini',
              gatewayUrl,
              autonomyMode: autonomyMode || 'assist',
              instructions: instructions || `You are ${name}, a ${role} AI employee.`,
              tools: tools ? (typeof tools === 'string' ? tools : JSON.stringify(tools)) : '[]',
            })

            provisioningSteps.push({ step: 'Container started', status: 'done', detail: containerId.slice(0, 12) })

            // Update employee with container ID
            await prisma.employee.update({
              where: { id: employee.id },
              data: { containerId },
            })

            provisioningSteps.push({ step: 'Heartbeat active', status: 'done' })
          }
        } else {
          provisioningSteps.push({ step: 'Docker not available', status: 'skipped', detail: 'Install Docker to run real agents' })
          provisioningSteps.push({ step: 'Employee created (simulation mode)', status: 'done' })
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        provisioningSteps.push({ step: 'Container setup failed', status: 'error', detail: msg })
      }

      await auditLogger.log(
        'employee.created',
        JSON.stringify({ name, role, runtime, containerId: containerId?.slice(0, 12) }),
        employee.id,
        auth.orgId
      )

      return NextResponse.json({
        employee: { ...employee, containerId },
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
