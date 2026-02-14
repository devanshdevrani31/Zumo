'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Team {
  id: string
  name: string
  description: string
}

interface OnboardingState {
  llmProvider?: string
  llmMode?: string
  serverProvider?: string
  vpnProvider?: string
  connectedAccounts?: Array<{ connector: string; riskLevel: string; writeEnabled: boolean }>
  orgDailySpendCap?: number
  perEmployeeSpendCap?: number
}

interface ConnectorInfo {
  id: string
  connector: string
  riskLevel: string
  writeEnabled: boolean
  status: string
}

const ROLE_TEMPLATES = [
  { id: 'customer_support', name: 'Customer Support Agent', icon: '\u{1F4AC}', description: 'Handles tickets, triages issues, responds to customers via Slack and email.' },
  { id: 'developer', name: 'Developer Agent', icon: '\u{1F4BB}', description: 'Writes code, reviews PRs, investigates bugs, deploys fixes via GitHub.' },
  { id: 'security_analyst', name: 'Security Analyst', icon: '\u{1F6E1}', description: 'Monitors alerts, investigates threats, enforces compliance policies.' },
  { id: 'data_analyst', name: 'Data Analyst', icon: '\u{1F4CA}', description: 'Queries databases, generates reports, surfaces insights from data.' },
  { id: 'devops', name: 'DevOps Engineer', icon: '\u{2699}', description: 'Manages infrastructure, deploys services, monitors uptime and performance.' },
  { id: 'hr_sourcer', name: 'HR Sourcer', icon: '\u{1F465}', description: 'Screens candidates, schedules interviews, manages recruiting pipeline.' },
  { id: 'sdr', name: 'SDR', icon: '\u{1F4DE}', description: 'Qualifies leads, sends outreach, books demos via HubSpot and email.' },
  { id: 'ap_clerk', name: 'AP Clerk', icon: '\u{1F4B0}', description: 'Processes invoices, matches POs, manages vendor payments.' },
  { id: 'ops_assistant', name: 'Ops Assistant', icon: '\u{1F4CB}', description: 'Coordinates cross-team tasks, manages schedules, tracks deliverables.' },
  { id: 'custom', name: 'Custom', icon: '\u{2728}', description: 'Define a custom role with your own instructions and tool access.' },
]

const RUNTIMES = [
  { id: 'openclaw', name: 'OpenClaw', description: 'Structured chain-of-thought agent with tool-use support and built-in safety checks.', recommended: true },
  { id: 'autogpt', name: 'AutoGPT Loop', description: 'Autonomous goal-driven loop with self-prompting and task decomposition.', recommended: false },
  { id: 'customplanner', name: 'Custom Planner', description: 'Rule-based task planner with configurable workflows and deterministic execution.', recommended: false },
  { id: 'external', name: 'External Runtime', description: 'Delegates execution to a third-party agent service via API. Full control.', recommended: false },
]

const MODEL_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', model: 'GPT-4o', costEstimate: '$0.03-0.12 / 1K tokens', dailyEstimate: 8.50 },
  { id: 'anthropic', name: 'Anthropic', model: 'Claude', costEstimate: '$0.003-0.075 / 1K tokens', dailyEstimate: 5.20 },
  { id: 'gemini', name: 'Gemini', model: 'Pro', costEstimate: '$0.0025-0.05 / 1K tokens', dailyEstimate: 4.80 },
  { id: 'local', name: 'Local', model: 'OpenAI-compatible', costEstimate: 'Infrastructure costs only', dailyEstimate: 0 },
]

const ALWAYS_AVAILABLE_TOOLS = [
  { id: 'filesystem', name: 'File System', riskLevel: 'Low' },
  { id: 'api_access', name: 'API Access', riskLevel: 'Medium' },
  { id: 'database', name: 'Database', riskLevel: 'High' },
]

const AUTONOMY_MODES = [
  { id: 'observe', name: 'Observe', description: 'Read-only monitoring, all actions require approval.', color: 'border-green-500/40 bg-green-900/10' },
  { id: 'assist', name: 'Assist', description: 'Handles routine tasks, escalates sensitive actions.', color: 'border-blue-500/40 bg-blue-900/10' },
  { id: 'autopilot', name: 'Autopilot', description: 'Fully autonomous within policy boundaries.', color: 'border-purple-500/40 bg-purple-900/10' },
]

const PROVISIONING_STEPS = [
  'Provisioning isolated VM sandbox (gVisor)...',
  'Configuring egress-filtered network policy...',
  'Initializing agent runtime loop...',
  'Binding model provider API credentials...',
  'Applying capability policies & rate limits...',
  'Connecting tool integrations (mTLS)...',
  'Starting supervisor & heartbeat monitor...',
  'Employee deployed successfully!',
]

const TOTAL_STEPS = 7
const STEP_LABELS = ['Name & Role', 'Runtime', 'Model', 'Tools', 'Autonomy', 'Team', 'Security Review']

export default function NewEmployeePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [provisioningStep, setProvisioningStep] = useState(-1)
  const [teams, setTeams] = useState<Team[]>([])
  const [error, setError] = useState<string | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null)
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([])

  // Form state
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [runtime, setRuntime] = useState('openclaw')
  const [modelProvider, setModelProvider] = useState('')
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [autonomyMode, setAutonomyMode] = useState('assist')
  const [instructions, setInstructions] = useState('')
  const [teamId, setTeamId] = useState<string>('')

  useEffect(() => {
    async function fetchData() {
      const [teamsRes, onboardingRes, connectorsRes] = await Promise.allSettled([
        fetch('/api/orchestration'),
        fetch('/api/onboarding'),
        fetch('/api/connectors'),
      ])

      if (teamsRes.status === 'fulfilled' && teamsRes.value.ok) {
        const data = await teamsRes.value.json()
        setTeams(Array.isArray(data) ? data : [])
      }

      if (onboardingRes.status === 'fulfilled' && onboardingRes.value.ok) {
        const data = await onboardingRes.value.json()
        setOnboarding(data)
        // Auto-highlight configured provider
        if (data.llmProvider) {
          setModelProvider(data.llmProvider)
        }
      }

      if (connectorsRes.status === 'fulfilled' && connectorsRes.value.ok) {
        const data = await connectorsRes.value.json()
        setConnectors(Array.isArray(data) ? data : [])
      }
    }
    fetchData()
  }, [])

  const effectiveRole = role === 'custom' ? customRole : ROLE_TEMPLATES.find(r => r.id === role)?.name || role

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev =>
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    )
  }

  const vpnConfigured = onboarding?.vpnProvider && onboarding.vpnProvider !== 'none'

  const canProceed = () => {
    switch (step) {
      case 1: return name.trim() && (role !== 'custom' ? role : customRole.trim())
      case 2: return runtime
      case 3: return modelProvider
      case 4: return true
      case 5: return autonomyMode
      case 6: return true
      case 7: return true
      default: return false
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setError(null)

      // Start provisioning animation
      for (let i = 0; i < PROVISIONING_STEPS.length; i++) {
        setProvisioningStep(i)
        await new Promise(resolve => setTimeout(resolve, 800))
      }

      const body = {
        name: name.trim(),
        role: effectiveRole,
        runtime,
        modelProvider,
        tools: JSON.stringify(selectedTools),
        autonomyMode,
        instructions,
        teamId: teamId || null,
      }

      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create employee')
      }

      const data = await res.json()
      const employeeId = data.employee?.id || data.id
      router.push(`/employees/${employeeId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create employee')
      setProvisioningStep(-1)
      setSubmitting(false)
    }
  }

  const budgetRemaining = (onboarding?.orgDailySpendCap || 100) -
    (MODEL_PROVIDERS.find(m => m.id === modelProvider)?.dailyEstimate || 0)

  const selectedProviderCost = MODEL_PROVIDERS.find(m => m.id === modelProvider)?.dailyEstimate || 0
  const dedicatedIdentity = `${name.trim().toLowerCase().replace(/\s+/g, '-')}-ai@yourorg.zumo.app`

  // Available tools: connectors from onboarding + always-available
  const availableTools = [
    ...connectors.map(c => ({ id: c.connector, name: c.connector.charAt(0).toUpperCase() + c.connector.slice(1), riskLevel: c.riskLevel })),
    ...ALWAYS_AVAILABLE_TOOLS.filter(t => !connectors.find(c => c.connector === t.id)),
  ]

  const riskBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case 'high': return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }
  }

  // Provisioning Animation
  if (provisioningStep >= 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-8 max-w-md w-full">
          <h2 className="text-xl font-bold mb-6 text-center text-white">Deploying Employee</h2>
          <div className="space-y-3">
            {PROVISIONING_STEPS.map((stepText, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  index <= provisioningStep ? 'opacity-100' : 'opacity-0'
                } ${
                  index < provisioningStep
                    ? 'bg-green-900/20 border border-green-800'
                    : index === provisioningStep
                    ? 'bg-blue-900/20 border border-blue-800'
                    : ''
                }`}
              >
                {index < provisioningStep ? (
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : index === provisioningStep ? (
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 flex-shrink-0" />
                )}
                <span className={`text-sm font-mono ${
                  index < provisioningStep ? 'text-green-400' : index === provisioningStep ? 'text-blue-400' : 'text-slate-500'
                }`}>
                  {stepText}
                </span>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="mt-6 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((provisioningStep + 1) / PROVISIONING_STEPS.length) * 100}%` }}
            />
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Create New Employee</h1>
        <p className="text-slate-400 mt-1">Configure and deploy a new AI employee</p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className="flex items-center flex-1">
              <button
                onClick={() => i + 1 < step && setStep(i + 1)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i + 1 === step
                    ? 'bg-blue-600 text-white'
                    : i + 1 < step
                    ? 'bg-green-600 text-white cursor-pointer hover:bg-green-500'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {i + 1 < step ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </button>
              {i < TOTAL_STEPS - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i + 1 < step ? 'bg-green-600' : 'bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          {STEP_LABELS.map((label, i) => (
            <span key={i} className={i + 1 === step ? 'text-blue-400 font-medium' : ''}>{label}</span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
        {/* Step 1: Name & Role */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-6 text-white">Name & Role</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Employee Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Emma, Billing Bot, CodeReviewBot"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Role Template</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ROLE_TEMPLATES.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        role === r.id
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-lg mb-1">{r.icon}</div>
                      <h3 className="text-sm font-semibold text-white">{r.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{r.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              {role === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Custom Role Name</label>
                  <input
                    type="text"
                    value={customRole}
                    onChange={e => setCustomRole(e.target.value)}
                    placeholder="Enter custom role..."
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Runtime */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">Runtime</h2>
            <p className="text-slate-400 text-sm mb-6">Select the execution runtime for your AI employee.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RUNTIMES.map(rt => (
                <button
                  key={rt.id}
                  onClick={() => setRuntime(rt.id)}
                  className={`p-4 rounded-lg border text-left transition-all relative ${
                    runtime === rt.id
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  {rt.recommended && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[10px] font-semibold uppercase rounded border border-blue-500/30">
                      Recommended
                    </span>
                  )}
                  <h3 className="font-semibold text-white mb-1">{rt.name}</h3>
                  <p className="text-sm text-slate-400">{rt.description}</p>
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7" />
                </svg>
                Runs on your provisioned server -- isolated VM with gVisor sandboxing
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Model Provider */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">Model Provider</h2>
            <p className="text-slate-400 text-sm mb-6">Choose the LLM provider powering this employee.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MODEL_PROVIDERS.map(mp => {
                const isConfigured = onboarding?.llmProvider === mp.id
                return (
                  <button
                    key={mp.id}
                    onClick={() => setModelProvider(mp.id)}
                    className={`p-4 rounded-lg border text-left transition-all relative ${
                      modelProvider === mp.id
                        ? 'border-blue-500 bg-blue-900/20'
                        : isConfigured
                        ? 'border-green-500/40 bg-green-900/10'
                        : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                    }`}
                  >
                    {isConfigured && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-600/20 text-green-400 text-[10px] font-semibold uppercase rounded border border-green-500/30">
                        Configured
                      </span>
                    )}
                    <h3 className="font-semibold text-white mb-1">{mp.name} <span className="text-slate-400 font-normal text-sm">({mp.model})</span></h3>
                    <p className="text-xs text-blue-400 mb-2">{mp.costEstimate}</p>
                    <p className="text-xs text-slate-500">Est. daily: ${mp.dailyEstimate.toFixed(2)}</p>
                  </button>
                )
              })}
            </div>
            {modelProvider && (
              <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border border-slate-700 flex items-center justify-between">
                <span className="text-sm text-slate-400">Budget remaining after this employee</span>
                <span className={`text-sm font-medium ${budgetRemaining > 20 ? 'text-green-400' : budgetRemaining > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                  ${budgetRemaining.toFixed(2)} / day
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Tools */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">Tool Access</h2>
            <p className="text-slate-400 text-sm mb-6">
              Select the tools this employee can access. Showing connected tools and always-available integrations.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availableTools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  className={`p-4 rounded-lg border text-center transition-all ${
                    selectedTools.includes(tool.id)
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 text-lg font-bold ${
                    selectedTools.includes(tool.id) ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                  }`}>
                    {tool.name.charAt(0)}
                  </div>
                  <span className="text-sm text-white block">{tool.name}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 mt-1 rounded text-[10px] font-semibold uppercase border ${riskBadgeColor(tool.riskLevel)}`}>
                    {tool.riskLevel}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4">
              {selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        {/* Step 5: Autonomy & Instructions */}
        {step === 5 && (
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">Autonomy & Instructions</h2>
            <p className="text-slate-400 text-sm mb-6">How much independence should this employee have?</p>

            {!vpnConfigured && (
              <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg flex items-center gap-3">
                <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-sm text-yellow-300">
                  No VPN configured. Autonomy is restricted to <strong>Observe</strong> mode only.
                  Configure a VPN in onboarding to unlock Assist and Autopilot modes.
                </p>
              </div>
            )}

            <div className="space-y-3 mb-6">
              {AUTONOMY_MODES.map(mode => {
                const disabled = !vpnConfigured && mode.id !== 'observe'
                return (
                  <button
                    key={mode.id}
                    onClick={() => !disabled && setAutonomyMode(mode.id)}
                    disabled={disabled}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                      disabled
                        ? 'border-slate-700 bg-slate-800/30 opacity-40 cursor-not-allowed'
                        : autonomyMode === mode.id
                        ? `${mode.color} border-2`
                        : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                    }`}
                  >
                    <h3 className="font-semibold text-white mb-1">{mode.name}</h3>
                    <p className="text-sm text-slate-400">{mode.description}</p>
                  </button>
                )
              })}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Custom Instructions (optional)</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={4}
                placeholder="Add specific instructions for this employee..."
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 6: Team Assignment */}
        {step === 6 && (
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">Team Assignment</h2>
            <p className="text-slate-400 text-sm mb-6">Optionally assign this employee to a team for multi-agent workflows.</p>

            <div className="space-y-3">
              <button
                onClick={() => setTeamId('')}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  teamId === '' ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                }`}
              >
                <h3 className="font-semibold text-white mb-1">Skip -- No Team</h3>
                <p className="text-sm text-slate-400">This employee will operate independently.</p>
              </button>

              {teams.map(team => (
                <button
                  key={team.id}
                  onClick={() => setTeamId(team.id)}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    teamId === team.id ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  <h3 className="font-semibold text-white mb-1">{team.name}</h3>
                  <p className="text-sm text-slate-400">{team.description}</p>
                </button>
              ))}
            </div>

            {teams.length === 0 && (
              <p className="text-xs text-slate-500 mt-4">No teams created yet. You can assign a team later.</p>
            )}
          </div>
        )}

        {/* Step 7: Security Review */}
        {step === 7 && (
          <div>
            <h2 className="text-xl font-semibold mb-6 text-white">Security Review & Deploy</h2>
            <div className="space-y-4">
              {/* Configuration Summary */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Employee Configuration</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="text-white">{name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="text-white">{effectiveRole}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Runtime</span><span className="text-white">{RUNTIMES.find(r => r.id === runtime)?.name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Model Provider</span><span className="text-white">{MODEL_PROVIDERS.find(m => m.id === modelProvider)?.name} ({MODEL_PROVIDERS.find(m => m.id === modelProvider)?.model})</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Autonomy</span><span className="text-white capitalize">{autonomyMode}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Tools</span><span className="text-white">{selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Team</span><span className="text-white">{teamId ? teams.find(t => t.id === teamId)?.name || 'Selected' : 'Independent'}</span></div>
                </div>
              </div>

              {/* Security Checklist */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Security Checklist</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Runtime isolation (gVisor sandbox)', ok: true },
                    { label: `Private network ${vpnConfigured ? '(VPN active)' : '(NOT configured)'}`, ok: !!vpnConfigured },
                    { label: 'Audit trail enabled (SHA-256 hash chain)', ok: true },
                    { label: 'Policy gateway active', ok: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {item.ok ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      )}
                      <span className="text-sm text-slate-300">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost & Identity */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Cost & Identity</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Est. daily cost</span>
                    <span className="text-white">${selectedProviderCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Budget remaining</span>
                    <span className={`font-medium ${budgetRemaining > 20 ? 'text-green-400' : budgetRemaining > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      ${budgetRemaining.toFixed(2)} / day
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dedicated identity</span>
                    <span className="text-blue-400 font-mono text-xs">{name.trim() ? dedicatedIdentity : '--'}</span>
                  </div>
                </div>
              </div>

              {instructions && (
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Instructions</h3>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap">{instructions}</p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-white"
          >
            Back
          </button>
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed text-white"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed text-white"
            >
              {submitting ? 'Deploying...' : 'Deploy Employee'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
