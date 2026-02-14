import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { auditLogger } from '@/lib/audit'

export async function POST(request: Request) {
  return withAuth(request, async (_req, auth) => {
    try {
      const timeline = [
        {
          step: 1,
          title: 'Customer complaint received',
          description: 'Customer complaint detected on Slack channel #support-escalations',
          actor: 'Slack Integration',
          timestamp: new Date(Date.now() - 6 * 60000).toISOString(),
        },
        {
          step: 2,
          title: 'Support agent picks up',
          description: 'AI Support Agent acknowledges the complaint and begins triage',
          actor: 'Support Agent',
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        },
        {
          step: 3,
          title: 'Escalation to developer',
          description: 'Support Agent identifies a code-level bug and escalates to Developer Agent',
          actor: 'Support Agent',
          timestamp: new Date(Date.now() - 4 * 60000).toISOString(),
        },
        {
          step: 4,
          title: 'Developer investigates',
          description: 'Developer Agent analyzes stack traces and identifies root cause in payment module',
          actor: 'Developer Agent',
          timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
        },
        {
          step: 5,
          title: 'Fix applied',
          description: 'Developer Agent opens PR #487 with fix, approved by human reviewer',
          actor: 'Developer Agent',
          timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
        },
        {
          step: 6,
          title: 'Customer reply sent',
          description: 'Support Agent drafts and sends resolution message to customer (after human approval)',
          actor: 'Support Agent',
          timestamp: new Date(Date.now() - 1 * 60000).toISOString(),
        },
        {
          step: 7,
          title: 'Workflow complete',
          description: 'Incident resolved end-to-end. Full audit trail logged. Time to resolution: 6 minutes.',
          actor: 'System',
          timestamp: new Date().toISOString(),
        },
      ]

      // Log all steps to audit
      for (const step of timeline) {
        await auditLogger.log(
          `orchestration.demo.step${step.step}`,
          JSON.stringify({ title: step.title, description: step.description, actor: step.actor }),
          undefined,
          auth.orgId
        )
      }

      return NextResponse.json({ timeline })
    } catch (error) {
      console.error('Orchestration demo error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
