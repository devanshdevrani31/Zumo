import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

function computeHash(
  previousHash: string,
  action: string,
  details: string,
  timestamp: string
): string {
  return createHash('sha256')
    .update(previousHash + '|' + action + '|' + details + '|' + timestamp)
    .digest('hex')
}

async function main() {
  console.log('Clearing existing data...')

  // Delete in correct order to respect foreign key constraints
  await prisma.auditLog.deleteMany()
  await prisma.approvalRequest.deleteMany()
  await prisma.policy.deleteMany()
  await prisma.workflowRule.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.team.deleteMany()
  await prisma.connectedAccount.deleteMany()
  await prisma.providerConfig.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()

  console.log('Seeding database...')

  // 1. Organization
  const org = await prisma.organization.create({
    data: {
      id: 'org-demo',
      name: 'Zumo Demo',
      dataRegion: 'EU',
      dailySpendCap: 100,
      perEmployeeSpendCap: 25,
      hardStopBehavior: 'pause',
      retentionDays: 90,
      onboardingCompleted: true,
    },
  })

  // 2. User
  const passwordHash = await bcrypt.hash('password123', 10)
  const user = await prisma.user.create({
    data: {
      id: 'user-demo',
      email: 'demo@zumo.ai',
      passwordHash,
      name: 'Demo Admin',
      orgId: 'org-demo',
      role: 'admin',
    },
  })

  // 3. Provider Configs
  const llmConfig = await prisma.providerConfig.create({
    data: {
      id: 'prov-llm',
      orgId: 'org-demo',
      type: 'llm',
      provider: 'anthropic',
      mode: 'marketplace',
      plan: 'pro',
      region: 'EU',
      status: 'active',
      costEstimate: 0.015,
    },
  })

  const serverConfig = await prisma.providerConfig.create({
    data: {
      id: 'prov-server',
      orgId: 'org-demo',
      type: 'server',
      provider: 'hetzner',
      mode: 'marketplace',
      plan: 'cx41',
      region: 'eu-central',
      status: 'active',
      costEstimate: 15.90,
    },
  })

  const vpnConfig = await prisma.providerConfig.create({
    data: {
      id: 'prov-vpn',
      orgId: 'org-demo',
      type: 'vpn',
      provider: 'tailscale',
      mode: 'marketplace',
      plan: 'business',
      status: 'active',
      costEstimate: 5.00,
    },
  })

  // 4. Connected Accounts
  await prisma.connectedAccount.create({
    data: {
      id: 'conn-slack',
      orgId: 'org-demo',
      connector: 'slack',
      scopes: '["channels:read","chat:write","users:read"]',
      riskLevel: 'medium',
      writeEnabled: true,
    },
  })

  await prisma.connectedAccount.create({
    data: {
      id: 'conn-github',
      orgId: 'org-demo',
      connector: 'github',
      scopes: '["repo","pull_requests","issues"]',
      riskLevel: 'high',
      writeEnabled: true,
    },
  })

  await prisma.connectedAccount.create({
    data: {
      id: 'conn-hubspot',
      orgId: 'org-demo',
      connector: 'hubspot',
      scopes: '["contacts","deals","tickets"]',
      riskLevel: 'medium',
      writeEnabled: false,
    },
  })

  await prisma.connectedAccount.create({
    data: {
      id: 'conn-gmail',
      orgId: 'org-demo',
      connector: 'gmail',
      scopes: '["gmail.readonly"]',
      riskLevel: 'high',
      writeEnabled: false,
    },
  })

  await prisma.connectedAccount.create({
    data: {
      id: 'conn-gcal',
      orgId: 'org-demo',
      connector: 'google_calendar',
      scopes: '["calendar.readonly"]',
      riskLevel: 'low',
      writeEnabled: false,
    },
  })

  // 5. Teams
  await prisma.team.create({
    data: {
      id: 'team-support',
      name: 'Customer Support',
      orgId: 'org-demo',
    },
  })

  await prisma.team.create({
    data: {
      id: 'team-engineering',
      name: 'Engineering',
      orgId: 'org-demo',
    },
  })

  await prisma.team.create({
    data: {
      id: 'team-security',
      name: 'Security',
      orgId: 'org-demo',
    },
  })

  // 6. Employees
  await prisma.employee.create({
    data: {
      id: 'emp-emma',
      name: 'Emma',
      role: 'Support Agent',
      runtime: 'openclaw',
      modelProvider: 'anthropic',
      tools: '["slack","hubspot","email"]',
      autonomyMode: 'assist',
      teamId: 'team-support',
      orgId: 'org-demo',
      serverId: serverConfig.id,
      status: 'running',
    },
  })

  await prisma.employee.create({
    data: {
      id: 'emp-alex',
      name: 'Alex',
      role: 'Developer',
      runtime: 'autogpt',
      modelProvider: 'openai',
      tools: '["github","sentry","database"]',
      autonomyMode: 'assist',
      teamId: 'team-engineering',
      orgId: 'org-demo',
      status: 'running',
    },
  })

  await prisma.employee.create({
    data: {
      id: 'emp-sentinel',
      name: 'Sentinel',
      role: 'Security Analyst',
      runtime: 'customplanner',
      modelProvider: 'anthropic',
      tools: '["sentry","api_access"]',
      autonomyMode: 'observe',
      teamId: 'team-security',
      orgId: 'org-demo',
      status: 'running',
    },
  })

  await prisma.employee.create({
    data: {
      id: 'emp-maya',
      name: 'Maya',
      role: 'Data Analyst',
      runtime: 'openclaw',
      modelProvider: 'gemini',
      tools: '["database","hubspot","api_access"]',
      autonomyMode: 'autopilot',
      teamId: 'team-engineering',
      orgId: 'org-demo',
      status: 'running',
    },
  })

  await prisma.employee.create({
    data: {
      id: 'emp-otto',
      name: 'Otto',
      role: 'DevOps Engineer',
      runtime: 'external',
      modelProvider: 'local',
      tools: '["github","api_access","file_system"]',
      autonomyMode: 'assist',
      teamId: 'team-engineering',
      orgId: 'org-demo',
      status: 'paused',
    },
  })

  // 7. Policies (17 total)

  // Emma policies
  await prisma.policy.create({
    data: {
      employeeId: 'emp-emma',
      capability: 'send_email',
      permission: 'approval_required',
      rateLimit: 10,
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-emma',
      capability: 'access_database',
      permission: 'deny',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-emma',
      capability: 'inter_agent_comm',
      permission: 'allow',
      orgId: 'org-demo',
    },
  })

  // Alex policies
  await prisma.policy.create({
    data: {
      employeeId: 'emp-alex',
      capability: 'modify_code',
      permission: 'allow',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-alex',
      capability: 'deploy',
      permission: 'approval_required',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-alex',
      capability: 'send_email',
      permission: 'deny',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-alex',
      capability: 'inter_agent_comm',
      permission: 'allow',
      orgId: 'org-demo',
    },
  })

  // Sentinel policies
  await prisma.policy.create({
    data: {
      employeeId: 'emp-sentinel',
      capability: 'api_call',
      permission: 'allow',
      rateLimit: 200,
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-sentinel',
      capability: 'send_email',
      permission: 'approval_required',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-sentinel',
      capability: 'modify_code',
      permission: 'deny',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-sentinel',
      capability: 'file_write',
      permission: 'deny',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-sentinel',
      capability: 'inter_agent_comm',
      permission: 'allow',
      orgId: 'org-demo',
    },
  })

  // Maya policies
  await prisma.policy.create({
    data: {
      employeeId: 'emp-maya',
      capability: 'access_database',
      permission: 'allow',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-maya',
      capability: 'api_call',
      permission: 'allow',
      rateLimit: 100,
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-maya',
      capability: 'send_email',
      permission: 'approval_required',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-maya',
      capability: 'inter_agent_comm',
      permission: 'allow',
      orgId: 'org-demo',
    },
  })

  // Otto policies
  await prisma.policy.create({
    data: {
      employeeId: 'emp-otto',
      capability: 'deploy',
      permission: 'approval_required',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-otto',
      capability: 'modify_code',
      permission: 'allow',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-otto',
      capability: 'file_write',
      permission: 'allow',
      orgId: 'org-demo',
    },
  })
  await prisma.policy.create({
    data: {
      employeeId: 'emp-otto',
      capability: 'inter_agent_comm',
      permission: 'allow',
      orgId: 'org-demo',
    },
  })

  // 8. Workflow Rules
  await prisma.workflowRule.create({
    data: {
      id: 'wf-slack-complaint',
      teamId: 'team-support',
      trigger: 'slack_complaint',
      steps: JSON.stringify([
        { agent: 'Emma', action: 'Receive complaint from Slack', order: 1 },
        { agent: 'Emma', action: 'Classify urgency and sentiment', order: 2 },
        { agent: 'Emma', action: 'Draft response in HubSpot', order: 3 },
        { agent: 'Emma', action: 'Send reply via Slack', order: 4 },
      ]),
    },
  })

  await prisma.workflowRule.create({
    data: {
      id: 'wf-sentry-error',
      teamId: 'team-engineering',
      trigger: 'sentry_error_spike',
      steps: JSON.stringify([
        { agent: 'Sentinel', action: 'Detect error spike in Sentry', order: 1 },
        { agent: 'Alex', action: 'Analyze stack trace and identify root cause', order: 2 },
        { agent: 'Alex', action: 'Create fix PR on GitHub', order: 3 },
        { agent: 'Otto', action: 'Deploy hotfix to staging', order: 4 },
      ]),
    },
  })

  await prisma.workflowRule.create({
    data: {
      id: 'wf-security-alert',
      teamId: 'team-security',
      trigger: 'security_alert',
      steps: JSON.stringify([
        { agent: 'Sentinel', action: 'Detect anomalous API access pattern', order: 1 },
        { agent: 'Sentinel', action: 'Correlate with known threat intelligence', order: 2 },
        { agent: 'Sentinel', action: 'Generate incident report', order: 3 },
        { agent: 'Sentinel', action: 'Request approval to block IP range', order: 4 },
      ]),
    },
  })

  // 9. Approval Requests
  await prisma.approvalRequest.create({
    data: {
      id: 'approval-emma-email',
      employeeId: 'emp-emma',
      action: 'send_email',
      details: 'Send customer response email regarding ticket #4521',
      status: 'pending',
      orgId: 'org-demo',
    },
  })

  await prisma.approvalRequest.create({
    data: {
      id: 'approval-alex-deploy',
      employeeId: 'emp-alex',
      action: 'deploy',
      details: 'Deploy hotfix for auth timeout (PR #287)',
      diff: '--- a/src/auth/session.ts\n+++ b/src/auth/session.ts\n@@ -42,7 +42,7 @@\n-  const timeout = 3600\n+  const timeout = 7200\n   // Double session timeout to fix premature logouts',
      status: 'pending',
      orgId: 'org-demo',
    },
  })

  await prisma.approvalRequest.create({
    data: {
      id: 'approval-sentinel-alert',
      employeeId: 'emp-sentinel',
      action: 'security_alert',
      details: 'Unusual API access pattern detected from 203.0.113.0/24',
      status: 'pending',
      orgId: 'org-demo',
    },
  })

  // 10. Audit Log (24 hash-chained entries)
  const genesisHash = '0000000000000000000000000000000000000000000000000000000000000000'
  const baseTime = new Date('2025-01-15T08:00:00Z')

  interface AuditEntry {
    employeeId: string | null
    action: string
    details: string
    minutesOffset: number
  }

  const auditEntries: AuditEntry[] = [
    { employeeId: null, action: 'system_startup', details: 'Zumo platform initialized', minutesOffset: 0 },
    { employeeId: null, action: 'org_created', details: 'Organization "Zumo Demo" created', minutesOffset: 1 },
    { employeeId: 'emp-emma', action: 'employee_created', details: 'AI Employee "Emma" (Support Agent) created', minutesOffset: 2 },
    { employeeId: 'emp-alex', action: 'employee_created', details: 'AI Employee "Alex" (Developer) created', minutesOffset: 3 },
    { employeeId: 'emp-sentinel', action: 'employee_created', details: 'AI Employee "Sentinel" (Security Analyst) created', minutesOffset: 4 },
    { employeeId: 'emp-maya', action: 'employee_created', details: 'AI Employee "Maya" (Data Analyst) created', minutesOffset: 5 },
    { employeeId: 'emp-otto', action: 'employee_created', details: 'AI Employee "Otto" (DevOps Engineer) created', minutesOffset: 6 },
    { employeeId: 'emp-emma', action: 'policy_created', details: 'Policy: send_email=approval_required (limit 10) for Emma', minutesOffset: 7 },
    { employeeId: 'emp-alex', action: 'policy_created', details: 'Policy: modify_code=allow for Alex', minutesOffset: 8 },
    { employeeId: 'emp-sentinel', action: 'policy_created', details: 'Policy: api_call=allow (limit 200) for Sentinel', minutesOffset: 9 },
    { employeeId: 'emp-maya', action: 'policy_created', details: 'Policy: access_database=allow for Maya', minutesOffset: 10 },
    { employeeId: 'emp-otto', action: 'policy_created', details: 'Policy: deploy=approval_required for Otto', minutesOffset: 11 },
    { employeeId: null, action: 'vm_provisioned', details: 'Hetzner CX41 VM provisioned in eu-central region', minutesOffset: 12 },
    { employeeId: null, action: 'vpn_configured', details: 'Tailscale mesh VPN configured for org network', minutesOffset: 14 },
    { employeeId: 'emp-emma', action: 'runtime_started', details: 'OpenClaw runtime started for Emma on sandbox-emma-01', minutesOffset: 16 },
    { employeeId: 'emp-alex', action: 'runtime_started', details: 'AutoGPT runtime started for Alex on sandbox-alex-01', minutesOffset: 17 },
    { employeeId: 'emp-sentinel', action: 'runtime_started', details: 'CustomPlanner runtime started for Sentinel on sandbox-sentinel-01', minutesOffset: 18 },
    { employeeId: 'emp-maya', action: 'runtime_started', details: 'OpenClaw runtime started for Maya on sandbox-maya-01', minutesOffset: 19 },
    { employeeId: 'emp-emma', action: 'slack_message_received', details: 'Emma received customer complaint from #support channel', minutesOffset: 25 },
    { employeeId: 'emp-emma', action: 'hubspot_ticket_created', details: 'Emma created HubSpot ticket #4521 for customer issue', minutesOffset: 26 },
    { employeeId: 'emp-alex', action: 'sentry_alert_processed', details: 'Alex detected auth timeout errors spiking in Sentry', minutesOffset: 30 },
    { employeeId: 'emp-alex', action: 'github_pr_created', details: 'Alex created PR #287: Fix session timeout configuration', minutesOffset: 35 },
    { employeeId: 'emp-sentinel', action: 'anomaly_detected', details: 'Sentinel flagged unusual API access from 203.0.113.0/24', minutesOffset: 40 },
    { employeeId: 'emp-maya', action: 'database_query_executed', details: 'Maya ran analytics query on customer churn dataset', minutesOffset: 45 },
  ]

  let previousHash = genesisHash

  for (const entry of auditEntries) {
    const timestamp = new Date(baseTime.getTime() + entry.minutesOffset * 60000)
    const hash = computeHash(
      previousHash,
      entry.action,
      entry.details,
      timestamp.toISOString()
    )

    await prisma.auditLog.create({
      data: {
        employeeId: entry.employeeId,
        action: entry.action,
        details: entry.details,
        hash,
        previousHash,
        timestamp,
        orgId: 'org-demo',
      },
    })

    previousHash = hash
  }

  console.log('Seed completed successfully!')
  console.log(`  - 1 organization`)
  console.log(`  - 1 user (demo@zumo.ai / password123)`)
  console.log(`  - 3 provider configs`)
  console.log(`  - 5 connected accounts`)
  console.log(`  - 3 teams`)
  console.log(`  - 5 employees`)
  console.log(`  - 20 policies (15 capability + 5 inter_agent_comm)`)
  console.log(`  - 3 workflow rules`)
  console.log(`  - 3 approval requests`)
  console.log(`  - 24 audit log entries`)
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
