export type EventType =
  | 'slack_message'
  | 'sentry_error'
  | 'hubspot_event'
  | 'github_event'
  | 'vm_provision'
  | 'heartbeat'
  | 'cost_update'
  | 'knowledge_retrieval'
  | 'vpn_enrollment'
  | 'cost_meter'

export interface SimulatedEvent {
  id: string
  type: EventType
  source: string
  message: string
  timestamp: string
  metadata: Record<string, unknown>
}

class SeededRandom {
  private state: number
  constructor(seed: number) { this.state = seed }

  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)]
  }
}

function deterministicSeed(employeeId: string): number {
  let hash = 0
  for (let i = 0; i < employeeId.length; i++) {
    hash = (hash << 5) - hash + employeeId.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function makeId(rng: SeededRandom): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 12; i++) id += chars[rng.nextInt(0, chars.length - 1)]
  return id
}

function makeTimestamp(rng: SeededRandom, index: number): string {
  const base = new Date('2026-02-13T00:00:00Z').getTime()
  const offset = index * 60000 + rng.nextInt(0, 59999)
  return new Date(base + offset).toISOString()
}

function generateSlackMessage(rng: SeededRandom, employeeId: string, ts: string): SimulatedEvent {
  const channels = ['#engineering', '#incidents', '#deployments', '#general', '#ops', '#security']
  const messages = [
    'Deployment pipeline completed successfully for staging.',
    'Investigating elevated 5xx rates on api-gateway.',
    'Merged PR #482 - add retry logic for external API calls.',
    'Database migration applied: added index on orders.customer_id.',
    'Scale-up event triggered for worker-pool-3 (CPU > 85%).',
    'Alertmanager silence extended for redis-cluster-02 maintenance.',
    'Rolling restart initiated for auth-service pods.',
    'New feature flag enabled: dark-mode-v2 (10% rollout).',
    'On-call handoff acknowledged. Runbook link pinned.',
    "Post-mortem draft shared for last Thursday's outage.",
  ]
  return {
    id: `evt_slack_${makeId(rng)}`, type: 'slack_message', source: 'slack',
    message: rng.pick(messages), timestamp: ts,
    metadata: { employeeId, channel: rng.pick(channels), userId: `U${rng.nextInt(100000, 999999)}`, threadTs: `${Date.now() / 1000}`, reactions: rng.nextInt(0, 12) },
  }
}

function generateSentryError(rng: SeededRandom, employeeId: string, ts: string): SimulatedEvent {
  const projects = ['api-gateway', 'auth-service', 'billing-service', 'dashboard-web', 'worker-pool']
  const errors = [
    { title: "TypeError: Cannot read properties of undefined (reading 'id')", level: 'error' },
    { title: 'ConnectionTimeoutError: Redis connection timed out after 5000ms', level: 'error' },
    { title: 'HTTPError: 502 Bad Gateway from upstream payments-api', level: 'warning' },
    { title: 'ValidationError: Expected string for field "email", got number', level: 'warning' },
    { title: 'OutOfMemoryError: JavaScript heap out of memory', level: 'fatal' },
    { title: 'RateLimitExceeded: Too many requests to /api/v2/search', level: 'warning' },
    { title: 'DatabaseError: deadlock detected on table "transactions"', level: 'error' },
    { title: 'CertificateExpiredError: TLS certificate expired for internal-ca', level: 'fatal' },
  ]
  const err = rng.pick(errors)
  return {
    id: `evt_sentry_${makeId(rng)}`, type: 'sentry_error', source: 'sentry',
    message: err.title, timestamp: ts,
    metadata: { employeeId, project: rng.pick(projects), level: err.level, eventCount: rng.nextInt(1, 500), usersAffected: rng.nextInt(0, 1200), firstSeen: new Date(Date.now() - rng.nextInt(0, 86400000 * 30)).toISOString(), isResolved: rng.next() > 0.7 },
  }
}

function generateHubSpotEvent(rng: SeededRandom, employeeId: string, ts: string): SimulatedEvent {
  const eventTypes = ['deal_created', 'deal_stage_changed', 'contact_created', 'email_sent', 'meeting_booked', 'note_added']
  const companies = ['Acme Corp', 'Globex Inc', 'Initech', 'Umbrella LLC', 'Stark Industries', 'Wayne Enterprises']
  const stages = ['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
  const eventType = rng.pick(eventTypes)
  const messageMap: Record<string, string> = {
    deal_created: `New deal created with ${rng.pick(companies)} - $${rng.nextInt(5, 500)}k ARR`,
    deal_stage_changed: `Deal with ${rng.pick(companies)} moved to "${rng.pick(stages)}"`,
    contact_created: `New contact added: ${rng.pick(['VP Engineering', 'CTO', 'Head of Product', 'Director of Ops'])} at ${rng.pick(companies)}`,
    email_sent: `Follow-up email sent to stakeholder at ${rng.pick(companies)}`,
    meeting_booked: `Demo meeting scheduled with ${rng.pick(companies)} for next week`,
    note_added: `Call notes added for ${rng.pick(companies)} opportunity`,
  }
  return {
    id: `evt_hs_${makeId(rng)}`, type: 'hubspot_event', source: 'hubspot',
    message: messageMap[eventType], timestamp: ts,
    metadata: { employeeId, eventType, dealValue: rng.nextInt(5000, 500000), pipeline: rng.pick(['Enterprise', 'Mid-Market', 'SMB']), ownerId: `owner_${rng.nextInt(1, 50)}` },
  }
}

function generateGitHubEvent(rng: SeededRandom, employeeId: string, ts: string): SimulatedEvent {
  const repos = ['zumo/platform', 'zumo/agent-runtime', 'zumo/dashboard', 'zumo/infra', 'zumo/sdk']
  const actions = ['push', 'pull_request_opened', 'pull_request_merged', 'issue_opened', 'issue_closed', 'review_submitted', 'release_published']
  const action = rng.pick(actions)
  const messageMap: Record<string, string> = {
    push: `Pushed ${rng.nextInt(1, 8)} commits to main on ${rng.pick(repos)}`,
    pull_request_opened: `Opened PR #${rng.nextInt(100, 999)}: "${rng.pick(['Fix memory leak in worker', 'Add retry middleware', 'Update dependencies', 'Refactor auth flow', 'Add metrics endpoint'])}"`,
    pull_request_merged: `Merged PR #${rng.nextInt(100, 999)} into main on ${rng.pick(repos)}`,
    issue_opened: `Opened issue #${rng.nextInt(200, 999)}: "${rng.pick(['Intermittent 503 on /health', 'Add dark mode support', 'Upgrade Node to v20', 'Audit log gaps'])}"`,
    issue_closed: `Closed issue #${rng.nextInt(200, 999)} on ${rng.pick(repos)}`,
    review_submitted: `Submitted review (${rng.pick(['approved', 'changes_requested', 'commented'])}) on PR #${rng.nextInt(100, 999)}`,
    release_published: `Published release v${rng.nextInt(1, 5)}.${rng.nextInt(0, 20)}.${rng.nextInt(0, 99)} on ${rng.pick(repos)}`,
  }
  return {
    id: `evt_gh_${makeId(rng)}`, type: 'github_event', source: 'github',
    message: messageMap[action], timestamp: ts,
    metadata: { employeeId, action, repo: rng.pick(repos), sha: makeId(rng) + makeId(rng), linesAdded: rng.nextInt(0, 800), linesRemoved: rng.nextInt(0, 300) },
  }
}

function generateVmProvision(rng: SeededRandom, employeeId: string, ts: string): SimulatedEvent {
  const steps = [
    'Requesting VM allocation from cloud provider...',
    'VM instance provisioned: 4 vCPU, 16 GB RAM, 100 GB SSD',
    'Installing base image (Ubuntu 22.04 LTS)...',
    'Configuring network interfaces and security groups...',
    'Mounting shared storage volume...',
    'Installing agent runtime and dependencies...',
    'Running health checks on new instance...',
    'VM ready. Agent runtime started successfully.',
    'Scaling cluster: adding node to worker pool.',
    'Decommissioning idle VM instance (cost optimization).',
  ]
  const regions = ['eu-central-1', 'eu-west-1', 'us-east-1', 'us-west-2']
  const instanceTypes = ['cx41', 'cx51', 'cpx31', 'cpx41']
  return {
    id: `evt_vm_${makeId(rng)}`, type: 'vm_provision', source: 'infrastructure',
    message: rng.pick(steps), timestamp: ts,
    metadata: { employeeId, instanceId: `i-${makeId(rng)}`, instanceType: rng.pick(instanceTypes), region: rng.pick(regions), costPerHour: parseFloat((rng.next() * 2 + 0.05).toFixed(4)), state: rng.pick(['pending', 'running', 'stopping', 'terminated']) },
  }
}

function generateHeartbeat(rng: SeededRandom, employeeId: string, ts: string): SimulatedEvent {
  const cpuUsage = parseFloat((rng.next() * 100).toFixed(1))
  const memUsage = parseFloat((rng.next() * 100).toFixed(1))
  const statuses = ['healthy', 'healthy', 'healthy', 'degraded', 'warning']
  return {
    id: `evt_hb_${makeId(rng)}`, type: 'heartbeat', source: 'agent-runtime',
    message: `Agent heartbeat: CPU ${cpuUsage}%, MEM ${memUsage}%, status ${rng.pick(statuses)}`,
    timestamp: ts,
    metadata: { employeeId, cpuUsage, memUsage, uptimeSeconds: rng.nextInt(60, 864000), activeTaskCount: rng.nextInt(0, 12), queueDepth: rng.nextInt(0, 50), status: rng.pick(statuses), runtimeVersion: `1.${rng.nextInt(0, 9)}.${rng.nextInt(0, 30)}` },
  }
}

function generateCostUpdate(rng: SeededRandom, employeeId: string, ts: string): SimulatedEvent {
  const categories = ['compute', 'llm-tokens', 'storage', 'network', 'api-calls', 'third-party']
  const category = rng.pick(categories)
  const amount = parseFloat((rng.next() * 50 + 0.01).toFixed(2))
  return {
    id: `evt_cost_${makeId(rng)}`, type: 'cost_update', source: 'billing',
    message: `Cost update: $${amount} for ${category} (period: last hour)`,
    timestamp: ts,
    metadata: { employeeId, category, amount, currency: 'USD', periodStart: new Date(new Date(ts).getTime() - 3600000).toISOString(), periodEnd: ts, cumulativeDailyTotal: parseFloat((rng.next() * 500 + amount).toFixed(2)), budgetRemaining: parseFloat((rng.next() * 5000 + 100).toFixed(2)) },
  }
}

function generateKnowledgeRetrieval(rng: SeededRandom, employeeId: string, ts: string): SimulatedEvent {
  const sources = ['confluence', 'notion', 'internal-wiki', 'runbook', 'slack-archive', 'github-docs']
  const queries = [
    'How to rotate database credentials',
    'Incident response playbook for high-severity alerts',
    'Architecture diagram for payment processing pipeline',
    'SLA requirements for enterprise tier customers',
    'Steps to roll back a failed Kubernetes deployment',
    'API rate limit configuration for partner integrations',
    'On-call escalation policy and contact list',
    'Data retention policy for audit logs',
  ]
  const source = rng.pick(sources)
  const query = rng.pick(queries)
  return {
    id: `evt_kr_${makeId(rng)}`, type: 'knowledge_retrieval', source,
    message: `Retrieved knowledge: "${query}" from ${source}`,
    timestamp: ts,
    metadata: { employeeId, query, resultsCount: rng.nextInt(1, 15), relevanceScore: parseFloat(rng.next().toFixed(3)), documentId: `doc_${makeId(rng)}`, retrievalLatencyMs: rng.nextInt(30, 1200) },
  }
}

function generateVpnEnrollment(rng: SeededRandom, employeeId: string, ts: string): SimulatedEvent {
  const steps = [
    'VPN node enrollment initiated for agent sandbox...',
    'Generating WireGuard keypair for node...',
    'Private IP assigned: 100.64.' + rng.nextInt(0, 255) + '.' + rng.nextInt(1, 254),
    'Tailscale ACL applied: agent-sandbox-policy',
    'VPN tunnel established. Latency: ' + rng.nextInt(1, 15) + 'ms',
    'VPN heartbeat OK. Peer count: ' + rng.nextInt(2, 12),
    'VPN key rotation completed successfully.',
    'Network isolation verified: no public ingress detected.',
  ]
  return {
    id: `evt_vpn_${makeId(rng)}`, type: 'vpn_enrollment', source: 'vpn',
    message: rng.pick(steps), timestamp: ts,
    metadata: { employeeId, provider: rng.pick(['tailscale', 'wireguard']), nodeId: `node-${makeId(rng).slice(0, 8)}`, privateIp: `100.64.${rng.nextInt(0, 255)}.${rng.nextInt(1, 254)}`, tunnelStatus: rng.pick(['connected', 'connected', 'reconnecting']) },
  }
}

function generateCostMeter(rng: SeededRandom, employeeId: string, ts: string): SimulatedEvent {
  const dailySpend = parseFloat((rng.next() * 80 + 5).toFixed(2))
  const cap = 100
  const pct = Math.round((dailySpend / cap) * 100)
  const alerts = pct > 80 ? [`Warning: ${pct}% of daily budget consumed`] : []
  return {
    id: `evt_cm_${makeId(rng)}`, type: 'cost_meter', source: 'spending',
    message: `Daily spend: $${dailySpend}/${cap} (${pct}%)${pct > 80 ? ' - APPROACHING LIMIT' : ''}`,
    timestamp: ts,
    metadata: { employeeId, dailySpend, dailyCap: cap, percentUsed: pct, alerts, hardStopTriggered: pct >= 100 },
  }
}

const generators: Record<EventType, (rng: SeededRandom, employeeId: string, ts: string) => SimulatedEvent> = {
  slack_message: generateSlackMessage,
  sentry_error: generateSentryError,
  hubspot_event: generateHubSpotEvent,
  github_event: generateGitHubEvent,
  vm_provision: generateVmProvision,
  heartbeat: generateHeartbeat,
  cost_update: generateCostUpdate,
  knowledge_retrieval: generateKnowledgeRetrieval,
  vpn_enrollment: generateVpnEnrollment,
  cost_meter: generateCostMeter,
}

const EVENT_TYPES: EventType[] = [
  'slack_message', 'sentry_error', 'hubspot_event', 'github_event',
  'vm_provision', 'heartbeat', 'cost_update', 'knowledge_retrieval',
  'vpn_enrollment', 'cost_meter',
]

export function generateEvents(employeeId: string, count: number): SimulatedEvent[] {
  const rng = new SeededRandom(deterministicSeed(employeeId))
  const events: SimulatedEvent[] = []
  for (let i = 0; i < count; i++) {
    const type = rng.pick(EVENT_TYPES)
    const ts = makeTimestamp(rng, i)
    events.push(generators[type](rng, employeeId, ts))
  }
  return events
}

export function generateEventsByType(employeeId: string, type: EventType, count: number): SimulatedEvent[] {
  const rng = new SeededRandom(deterministicSeed(employeeId) + type.length)
  const events: SimulatedEvent[] = []
  const generator = generators[type]
  for (let i = 0; i < count; i++) {
    const ts = makeTimestamp(rng, i)
    events.push(generator(rng, employeeId, ts))
  }
  return events
}

export function generateHeartbeatSnapshot(employeeId: string): SimulatedEvent {
  const rng = new SeededRandom(deterministicSeed(employeeId) + Date.now() % 10000)
  return generateHeartbeat(rng, employeeId, new Date().toISOString())
}

export function generateCostSummary(employeeId: string): { totalDaily: number; totalMonthly: number; breakdown: Record<string, number> } {
  const rng = new SeededRandom(deterministicSeed(employeeId))
  const categories = ['compute', 'llm-tokens', 'storage', 'network', 'api-calls', 'third-party']
  const breakdown: Record<string, number> = {}
  let total = 0
  for (const cat of categories) {
    const amount = parseFloat((rng.next() * 80 + 1).toFixed(2))
    breakdown[cat] = amount
    total += amount
  }
  return { totalDaily: parseFloat(total.toFixed(2)), totalMonthly: parseFloat((total * 30).toFixed(2)), breakdown }
}
