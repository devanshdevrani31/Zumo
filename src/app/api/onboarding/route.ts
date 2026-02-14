import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { withAuth } from '@/lib/api-auth'
import { encrypt } from '@/lib/secrets'
import { validateApiKey } from '@/lib/llm-providers'

export async function GET(request: Request) {
  return withAuth(request, async (_req, auth) => {
    const organization = await prisma.organization.findUnique({
      where: { id: auth.orgId },
    })

    const providerConfigs = await prisma.providerConfig.findMany({
      where: { orgId: auth.orgId },
    })

    const connectedAccounts = await prisma.connectedAccount.findMany({
      where: { orgId: auth.orgId },
    })

    return NextResponse.json({
      organization,
      providerConfigs,
      connectedAccounts,
    })
  })
}

export async function PUT(request: Request) {
  return withAuth(request, async (req, auth) => {
    try {
      const { step, data } = await req.json()

      if (!step || !data) {
        return NextResponse.json(
          { error: 'Missing required fields: step, data' },
          { status: 400 }
        )
      }

      switch (step) {
        case 1: {
          // LLM Provider Configuration + org budgets
          const { provider, mode, credentials, plan, dailySpendCap, perEmployeeSpendCap, endpoint } = data

          // Validate the API key against the real provider
          if (credentials && mode === 'api_key') {
            const validation = await validateApiKey(provider || 'openai', credentials, endpoint)
            if (!validation.valid) {
              return NextResponse.json(
                { error: validation.error || 'Invalid API key', validationFailed: true },
                { status: 400 }
              )
            }
          }

          // Upsert LLM provider config
          const existingLlm = await prisma.providerConfig.findFirst({
            where: { orgId: auth.orgId, type: 'llm' },
          })

          if (existingLlm) {
            await prisma.providerConfig.update({
              where: { id: existingLlm.id },
              data: {
                provider: provider || existingLlm.provider,
                mode: mode || existingLlm.mode,
                credentials: credentials ? encrypt(credentials) : existingLlm.credentials,
                plan: plan || existingLlm.plan,
              },
            })
          } else {
            await prisma.providerConfig.create({
              data: {
                orgId: auth.orgId,
                type: 'llm',
                provider: provider || 'anthropic',
                mode: mode || 'api_key',
                credentials: credentials ? encrypt(credentials) : '',
                plan: plan || 'pro',
              },
            })
          }

          // Update org budgets if provided
          const orgUpdate: Record<string, unknown> = {}
          if (dailySpendCap !== undefined) orgUpdate.dailySpendCap = dailySpendCap
          if (perEmployeeSpendCap !== undefined) orgUpdate.perEmployeeSpendCap = perEmployeeSpendCap
          if (Object.keys(orgUpdate).length > 0) {
            await prisma.organization.update({
              where: { id: auth.orgId },
              data: orgUpdate,
            })
          }

          break
        }

        case 2: {
          // Server Provider Configuration
          const { provider, mode, credentials, region, costEstimate } = data

          const existingServer = await prisma.providerConfig.findFirst({
            where: { orgId: auth.orgId, type: 'server' },
          })

          if (existingServer) {
            await prisma.providerConfig.update({
              where: { id: existingServer.id },
              data: {
                provider: provider || existingServer.provider,
                mode: mode || existingServer.mode,
                credentials: credentials ? encrypt(credentials) : existingServer.credentials,
                region: region || existingServer.region,
                costEstimate: costEstimate ?? existingServer.costEstimate,
              },
            })
          } else {
            await prisma.providerConfig.create({
              data: {
                orgId: auth.orgId,
                type: 'server',
                provider: provider || 'hetzner',
                mode: mode || 'api_key',
                credentials: credentials ? encrypt(credentials) : '',
                region: region || 'eu-central',
                costEstimate: costEstimate ?? 0,
              },
            })
          }

          break
        }

        case 3: {
          // VPN Provider Configuration
          const { provider, mode, credentials } = data

          const existingVpn = await prisma.providerConfig.findFirst({
            where: { orgId: auth.orgId, type: 'vpn' },
          })

          if (existingVpn) {
            await prisma.providerConfig.update({
              where: { id: existingVpn.id },
              data: {
                provider: provider || existingVpn.provider,
                mode: mode || existingVpn.mode,
                credentials: credentials ? encrypt(credentials) : existingVpn.credentials,
              },
            })
          } else {
            await prisma.providerConfig.create({
              data: {
                orgId: auth.orgId,
                type: 'vpn',
                provider: provider || 'tailscale',
                mode: mode || 'oauth',
                credentials: credentials ? encrypt(credentials) : '',
              },
            })
          }

          break
        }

        case 4: {
          // Connected Accounts
          const { accounts } = data

          if (Array.isArray(accounts)) {
            for (const account of accounts) {
              const existing = await prisma.connectedAccount.findFirst({
                where: { orgId: auth.orgId, connector: account.connector },
              })

              if (existing) {
                await prisma.connectedAccount.update({
                  where: { id: existing.id },
                  data: {
                    scopes: account.scopes ? (typeof account.scopes === 'string' ? account.scopes : JSON.stringify(account.scopes)) : existing.scopes,
                    riskLevel: account.riskLevel || existing.riskLevel,
                    writeEnabled: account.writeEnabled ?? existing.writeEnabled,
                    tokenEncrypted: account.token ? encrypt(account.token) : existing.tokenEncrypted,
                    status: account.status || existing.status,
                  },
                })
              } else {
                await prisma.connectedAccount.create({
                  data: {
                    orgId: auth.orgId,
                    connector: account.connector,
                    scopes: account.scopes ? (typeof account.scopes === 'string' ? account.scopes : JSON.stringify(account.scopes)) : '[]',
                    riskLevel: account.riskLevel || 'low',
                    writeEnabled: account.writeEnabled ?? false,
                    tokenEncrypted: account.token ? encrypt(account.token) : '',
                    status: account.status || 'connected',
                  },
                })
              }
            }
          }

          break
        }

        default:
          return NextResponse.json(
            { error: 'Invalid step. Must be 1-4.' },
            { status: 400 }
          )
      }

      // Mark onboarding complete when step >= 4
      if (step >= 4) {
        await prisma.organization.update({
          where: { id: auth.orgId },
          data: { onboardingCompleted: true },
        })
      }

      // Return updated state
      const organization = await prisma.organization.findUnique({
        where: { id: auth.orgId },
      })

      const providerConfigs = await prisma.providerConfig.findMany({
        where: { orgId: auth.orgId },
      })

      const connectedAccounts = await prisma.connectedAccount.findMany({
        where: { orgId: auth.orgId },
      })

      return NextResponse.json({
        organization,
        providerConfigs,
        connectedAccounts,
      })
    } catch (error) {
      console.error('Onboarding error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
