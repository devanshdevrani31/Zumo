'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface OnboardingState {
  currentStep?: number
  llmProvider?: string
  llmMode?: string
  serverProvider?: string
  serverMode?: string
  serverRegion?: string
  serverPlan?: string
  vpnProvider?: string
  connectedAccounts?: Array<{ connector: string; scopes: string[]; writeEnabled: boolean; riskLevel: string }>
  orgDailySpendCap?: number
  perEmployeeSpendCap?: number
  hardStopBehavior?: string
  completed?: boolean
}

const LLM_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', model: 'GPT-4o', icon: 'O' },
  { id: 'anthropic', name: 'Anthropic', model: 'Claude', icon: 'A' },
  { id: 'gemini', name: 'Gemini', model: 'Pro', icon: 'G' },
  { id: 'local', name: 'Local', model: 'OpenAI-compatible', icon: 'L' },
]

const MARKETPLACE_PLANS = [
  { id: 'starter', name: 'Starter', price: '$0.015 / 1K tokens', tokenLimit: '1M tokens/mo', description: 'Good for testing and light workloads' },
  { id: 'pro', name: 'Pro', price: '$0.010 / 1K tokens', tokenLimit: '10M tokens/mo', description: 'Best value for production workloads' },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', tokenLimit: 'Unlimited', description: 'Volume discounts, dedicated support, SLA' },
]

const SERVER_PROVIDERS = [
  { id: 'hetzner', name: 'Hetzner', recommended: true, region: 'EU', description: 'Best value EU hosting. GDPR-compliant by default.' },
  { id: 'ovh', name: 'OVH', recommended: false, region: 'EU', description: 'French cloud provider. Strong EU data sovereignty.' },
  { id: 'aws', name: 'AWS', recommended: false, region: 'Global', description: 'Amazon Web Services. Widest region selection.' },
  { id: 'gcp', name: 'GCP', recommended: false, region: 'Global', description: 'Google Cloud Platform. Best for AI/ML workloads.' },
  { id: 'custom', name: 'Custom', recommended: false, region: '--', description: 'Bring your own server. Full control.' },
]

const SERVER_PLANS = [
  { id: 'cx41', name: 'CX41', specs: '4 vCPU, 16GB RAM, 100GB SSD', cost: '$18.49/mo', costNum: 18.49 },
  { id: 'cx51', name: 'CX51', specs: '8 vCPU, 32GB RAM, 200GB SSD', cost: '$36.99/mo', costNum: 36.99 },
  { id: 'cpx31', name: 'CPX31 (GPU)', specs: '4 vCPU, 16GB RAM, GPU', cost: '$45.99/mo', costNum: 45.99 },
]

const REGIONS = [
  { id: 'eu-central-1', name: 'EU Central (Frankfurt)', default: true },
  { id: 'eu-west-1', name: 'EU West (Paris)' },
  { id: 'us-east-1', name: 'US East (Virginia)' },
  { id: 'us-west-2', name: 'US West (Oregon)' },
]

const PROVISIONING_STEPS = [
  { label: 'Allocate VM instance...', duration: 1200 },
  { label: 'Configure firewall rules...', duration: 800 },
  { label: 'Create non-root user...', duration: 600 },
  { label: 'Install sandbox runner (gVisor)...', duration: 1400 },
  { label: 'Start supervisor process...', duration: 900 },
  { label: 'Heartbeat active', duration: 500 },
]

const VPN_OPTIONS = [
  {
    id: 'tailscale',
    name: 'Tailscale Overlay',
    description: 'Auto-setup with managed ACLs. Zero-config mesh VPN.',
    borderColor: 'border-green-500/40',
    bgColor: 'bg-green-900/10',
    recommended: true,
    badge: 'Recommended',
    badgeColor: 'bg-green-600/20 text-green-400 border-green-500/30',
  },
  {
    id: 'wireguard',
    name: 'WireGuard',
    description: 'Manual config with full control. Advanced users only.',
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-900/10',
    recommended: false,
    badge: 'Advanced',
    badgeColor: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  },
  {
    id: 'none',
    name: 'None',
    description: 'No VPN. Agents communicate over public internet.',
    borderColor: 'border-red-500/40',
    bgColor: 'bg-red-900/10',
    recommended: false,
    badge: 'Not Recommended',
    badgeColor: 'bg-red-600/20 text-red-400 border-red-500/30',
  },
]

const CONNECTORS = [
  { id: 'slack', name: 'Slack', riskLevel: 'Low', icon: '#', scopes: ['channels:read', 'chat:write', 'users:read'] },
  { id: 'gmail', name: 'Gmail', riskLevel: 'Medium', icon: '@', scopes: ['gmail.readonly', 'gmail.send', 'gmail.labels'] },
  { id: 'hubspot', name: 'HubSpot', riskLevel: 'Medium', icon: 'H', scopes: ['contacts.read', 'deals.read', 'deals.write'] },
  { id: 'github', name: 'GitHub', riskLevel: 'High', icon: 'G', scopes: ['repo:read', 'repo:write', 'issues:read', 'issues:write'] },
  { id: 'google_calendar', name: 'Google Calendar', riskLevel: 'Low', icon: 'C', scopes: ['calendar.readonly', 'calendar.events'] },
  { id: 'sentry', name: 'Sentry', riskLevel: 'Low', icon: '!', scopes: ['project:read', 'event:read'], optional: true },
  { id: 'linear', name: 'Linear', riskLevel: 'Low', icon: 'L', scopes: ['read', 'write'], optional: true },
]

const TOTAL_STEPS = 4
const STEP_LABELS = ['LLM Provider', 'Server', 'VPN / Network', 'Connectors']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState<OnboardingState>({})

  // Step 1: LLM Provider
  const [llmMode, setLlmMode] = useState<'byo' | 'marketplace'>('byo')
  const [llmProvider, setLlmProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyValidated, setApiKeyValidated] = useState(false)
  const [apiKeyValidating, setApiKeyValidating] = useState(false)
  const [apiKeyError, setApiKeyError] = useState('')
  const [apiKeyModels, setApiKeyModels] = useState<string[]>([])
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false)
  const [localEndpoint, setLocalEndpoint] = useState('http://localhost:11434/v1')
  const [marketplacePlan, setMarketplacePlan] = useState('')
  const [dailySpendCap, setDailySpendCap] = useState(100)
  const [perEmployeeCap, setPerEmployeeCap] = useState(25)
  const [hardStopBehavior, setHardStopBehavior] = useState('pause')

  // Step 2: Docker / Server
  const [serverMode, setServerMode] = useState<'docker' | 'marketplace'>('docker')
  const [dockerStatus, setDockerStatus] = useState<{ available: boolean; version?: string; error?: string } | null>(null)
  const [dockerChecking, setDockerChecking] = useState(false)
  const [serverProvider, setServerProvider] = useState('hetzner')
  const [serverPlan, setServerPlan] = useState('cx41')
  const [serverRegion, setServerRegion] = useState('eu-central-1')
  const [provisioning, setProvisioning] = useState(false)
  const [provisioningStep, setProvisioningStep] = useState(-1)
  const [provisioningComplete, setProvisioningComplete] = useState(false)

  // Step 3: VPN
  const [vpnProvider, setVpnProvider] = useState('tailscale')
  const [vpnEnrolled, setVpnEnrolled] = useState(false)

  // Step 4: Connectors
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, { connected: boolean; writeEnabled: boolean; scopes: string[] }>>({})
  const [connectingModal, setConnectingModal] = useState<string | null>(null)
  const [modalWriteEnabled, setModalWriteEnabled] = useState(false)
  const [modalWriteAcknowledged, setModalWriteAcknowledged] = useState(false)
  const [modalScopes, setModalScopes] = useState<string[]>([])
  const [showDangerChecklist, setShowDangerChecklist] = useState(false)
  const [dangerAcknowledged, setDangerAcknowledged] = useState(false)

  useEffect(() => {
    async function fetchOnboarding() {
      try {
        setLoading(true)
        const res = await fetch('/api/onboarding')
        if (res.ok) {
          const data = await res.json()
          setOnboarding(data)
          if (data.currentStep) setStep(data.currentStep)
          if (data.llmProvider) setLlmProvider(data.llmProvider)
          if (data.llmMode) setLlmMode(data.llmMode)
          if (data.serverProvider) setServerProvider(data.serverProvider)
          if (data.vpnProvider) setVpnProvider(data.vpnProvider)
          if (data.orgDailySpendCap) setDailySpendCap(data.orgDailySpendCap)
          if (data.perEmployeeSpendCap) setPerEmployeeCap(data.perEmployeeSpendCap)
        }
      } catch {
        // Start fresh
      } finally {
        setLoading(false)
      }
    }
    fetchOnboarding()
  }, [])

  // Real API key validation
  const handleValidateApiKey = async () => {
    if (!apiKey || !llmProvider) return
    setApiKeyValidating(true)
    setApiKeyError('')
    setApiKeyValidated(false)
    setApiKeyModels([])
    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: llmProvider,
          key: apiKey,
          endpoint: llmProvider === 'local' ? localEndpoint : undefined,
        }),
      })
      const data = await res.json()
      if (data.valid) {
        setApiKeyValidated(true)
        setApiKeyModels(data.models || [])
      } else {
        setApiKeyError(data.error || 'Invalid API key')
      }
    } catch {
      setApiKeyError('Could not reach validation service. Check your connection.')
    } finally {
      setApiKeyValidating(false)
    }
  }

  // Docker availability check
  const handleCheckDocker = async () => {
    setDockerChecking(true)
    try {
      const res = await fetch('/api/docker')
      const data = await res.json()
      setDockerStatus(data.docker)
    } catch {
      setDockerStatus({ available: false, error: 'Could not check Docker status' })
    } finally {
      setDockerChecking(false)
    }
  }

  const API_KEY_HELP: Record<string, { url: string; steps: string[] }> = {
    openai: {
      url: 'https://platform.openai.com/api-keys',
      steps: [
        'Go to platform.openai.com and sign in',
        'Click your profile icon → "API keys"',
        'Click "Create new secret key"',
        'Copy the key (starts with sk-)',
        'Paste it here',
      ],
    },
    anthropic: {
      url: 'https://console.anthropic.com/settings/keys',
      steps: [
        'Go to console.anthropic.com and sign in',
        'Click "Settings" → "API keys"',
        'Click "Create Key"',
        'Copy the key (starts with sk-ant-)',
        'Paste it here',
      ],
    },
    gemini: {
      url: 'https://aistudio.google.com/apikey',
      steps: [
        'Go to aistudio.google.com/apikey',
        'Sign in with your Google account',
        'Click "Create API Key"',
        'Copy the key',
        'Paste it here',
      ],
    },
    local: {
      url: '',
      steps: [
        'Install Ollama (ollama.com) or another OpenAI-compatible server',
        'Start the server (e.g., "ollama serve")',
        'The default endpoint is http://localhost:11434/v1',
        'No API key needed for local — leave it blank or enter any value',
      ],
    },
  }

  const riskBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case 'high': return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }
  }

  const handleProvisionServer = async () => {
    setProvisioning(true)
    setProvisioningStep(0)

    for (let i = 0; i < PROVISIONING_STEPS.length; i++) {
      setProvisioningStep(i)
      await new Promise(resolve => setTimeout(resolve, PROVISIONING_STEPS[i].duration))
    }

    setProvisioningComplete(true)
    setProvisioning(false)
  }

  const handleVpnEnroll = async () => {
    // Simulate enrollment
    await new Promise(resolve => setTimeout(resolve, 1500))
    setVpnEnrolled(true)
  }

  const openConnectorModal = (connectorId: string) => {
    const connector = CONNECTORS.find(c => c.id === connectorId)
    if (!connector) return
    setConnectingModal(connectorId)
    setModalWriteEnabled(false)
    setModalWriteAcknowledged(false)
    setModalScopes(connector.scopes.filter(s => s.includes('read') || s.includes('readonly')))
    setShowDangerChecklist(false)
    setDangerAcknowledged(false)
  }

  const handleConnectConfirm = () => {
    if (!connectingModal) return
    const connector = CONNECTORS.find(c => c.id === connectingModal)
    if (!connector) return

    // Check if high-risk + write needs danger checklist
    if (connector.riskLevel === 'High' && modalWriteEnabled && !dangerAcknowledged) {
      setShowDangerChecklist(true)
      return
    }

    setConnectedAccounts(prev => ({
      ...prev,
      [connectingModal]: {
        connected: true,
        writeEnabled: modalWriteEnabled,
        scopes: modalScopes,
      },
    }))
    setConnectingModal(null)
  }

  const saveStep = useCallback(async (stepNum: number, data: Record<string, unknown>) => {
    try {
      await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepNum, data }),
      })
    } catch { /* silent */ }
  }, [])

  const handleNext = async () => {
    // Save current step data when advancing
    if (step === 1 && llmProvider) {
      await saveStep(1, {
        provider: llmProvider.startsWith('marketplace-') ? llmProvider.replace('marketplace-', '') : llmProvider,
        mode: llmMode === 'marketplace' ? 'marketplace' : 'api_key',
        credentials: apiKey || undefined,
        plan: marketplacePlan || undefined,
        endpoint: llmProvider === 'local' ? localEndpoint : undefined,
        dailySpendCap,
        perEmployeeSpendCap: perEmployeeCap,
      })
    }
    if (step === 2) {
      await saveStep(2, {
        provider: serverMode === 'docker' ? 'docker' : serverProvider,
        mode: serverMode,
        region: serverRegion,
        costEstimate: 0,
      })
    }
    if (step === 3) {
      await saveStep(3, { provider: vpnProvider, mode: vpnProvider === 'none' ? 'none' : 'overlay' })
    }
    setStep(s => s + 1)
  }

  const handleFinishOnboarding = async () => {
    try {
      // Save connectors as step 4
      await saveStep(4, {
        accounts: Object.entries(connectedAccounts)
          .filter(([, v]) => v.connected)
          .map(([k, v]) => ({
            connector: k,
            scopes: v.scopes,
            writeEnabled: v.writeEnabled,
            riskLevel: CONNECTORS.find(c => c.id === k)?.riskLevel || 'low',
            status: 'connected',
          })),
      })
      router.push('/')
    } catch {
      router.push('/')
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1: return llmProvider !== ''
      case 2: return serverProvider !== ''
      case 3: return vpnProvider !== ''
      case 4: return true
      default: return false
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading onboarding...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Platform Setup</h1>
        <p className="text-slate-400 mt-1">Configure your infrastructure, providers, and integrations</p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className="flex items-center flex-1">
              <button
                onClick={() => i + 1 < step && setStep(i + 1)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i + 1 === step ? 'bg-blue-600 text-white'
                  : i + 1 < step ? 'bg-green-600 text-white cursor-pointer hover:bg-green-500'
                  : 'bg-slate-700 text-slate-400'
                }`}
              >
                {i + 1 < step ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (i + 1)}
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

        {/* Step 1: LLM Provider */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">LLM Provider</h2>
            <p className="text-slate-400 text-sm mb-6">Choose how to access Large Language Models.</p>

            {/* Mode Tabs */}
            <div className="flex gap-1 mb-6 bg-slate-700/50 rounded-lg p-1">
              <button onClick={() => setLlmMode('byo')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  llmMode === 'byo' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                Bring Your Own
              </button>
              <button onClick={() => setLlmMode('marketplace')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  llmMode === 'marketplace' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                Buy Through Zumo
              </button>
            </div>

            {llmMode === 'byo' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {LLM_PROVIDERS.map(p => (
                    <button key={p.id} onClick={() => setLlmProvider(p.id)}
                      className={`p-4 rounded-lg border text-center transition-all ${
                        llmProvider === p.id ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 text-lg font-bold ${
                        llmProvider === p.id ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                      }`}>{p.icon}</div>
                      <span className="text-sm font-medium text-white block">{p.name}</span>
                      <span className="text-xs text-slate-400">{p.model}</span>
                    </button>
                  ))}
                </div>
                {llmProvider && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-300">API Key</label>
                      <button onClick={() => setShowApiKeyHelp(!showApiKeyHelp)}
                        className="text-xs text-blue-400 hover:text-blue-300 underline">
                        {showApiKeyHelp ? 'Hide help' : "What's an API key?"}
                      </button>
                    </div>

                    {showApiKeyHelp && API_KEY_HELP[llmProvider] && (
                      <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-4 text-sm">
                        <p className="text-blue-300 font-medium mb-2">How to get your {LLM_PROVIDERS.find(p => p.id === llmProvider)?.name} API key:</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-300">
                          {API_KEY_HELP[llmProvider].steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                        {API_KEY_HELP[llmProvider].url && (
                          <a href={API_KEY_HELP[llmProvider].url} target="_blank" rel="noopener noreferrer"
                            className="inline-block mt-2 text-blue-400 hover:text-blue-300 underline">
                            Open {LLM_PROVIDERS.find(p => p.id === llmProvider)?.name} dashboard
                          </a>
                        )}
                      </div>
                    )}

                    {llmProvider === 'local' && (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Server Endpoint</label>
                        <input type="text" value={localEndpoint} onChange={e => setLocalEndpoint(e.target.value)}
                          placeholder="http://localhost:11434/v1"
                          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); setApiKeyValidated(false); setApiKeyError('') }}
                        placeholder={llmProvider === 'local' ? 'API key (optional for local)' : 'sk-... (stored encrypted)'}
                        className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button onClick={handleValidateApiKey} disabled={apiKeyValidating || (!apiKey && llmProvider !== 'local')}
                        className={`px-4 py-3 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                          apiKeyValidated
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40'
                        }`}>
                        {apiKeyValidating ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Testing...
                          </span>
                        ) : apiKeyValidated ? (
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Valid
                          </span>
                        ) : 'Test Connection'}
                      </button>
                    </div>

                    {apiKeyError && (
                      <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-lg">
                        <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-sm text-red-300">{apiKeyError}</span>
                      </div>
                    )}

                    {apiKeyValidated && apiKeyModels.length > 0 && (
                      <div className="p-3 bg-green-900/20 border border-green-700/40 rounded-lg">
                        <p className="text-sm text-green-300 font-medium mb-1">Connection successful!</p>
                        <p className="text-xs text-slate-400">Available models: {apiKeyModels.slice(0, 5).join(', ')}{apiKeyModels.length > 5 ? ` +${apiKeyModels.length - 5} more` : ''}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {llmMode === 'marketplace' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {MARKETPLACE_PLANS.map(plan => (
                    <button key={plan.id} onClick={() => { setMarketplacePlan(plan.id); setLlmProvider('marketplace-' + plan.id) }}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        marketplacePlan === plan.id ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}>
                      <h3 className="font-semibold text-white mb-1">{plan.name}</h3>
                      <p className="text-blue-400 text-sm font-medium mb-1">{plan.price}</p>
                      <p className="text-xs text-slate-400 mb-2">{plan.tokenLimit}</p>
                      <p className="text-xs text-slate-500">{plan.description}</p>
                      {marketplacePlan === plan.id && plan.id !== 'enterprise' && (
                        <button className="mt-3 w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium text-white transition-colors">
                          Subscribe
                        </button>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Budget Config */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Budget Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Org daily spend cap ($)</label>
                  <input type="number" value={dailySpendCap} onChange={e => setDailySpendCap(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Per-employee default cap ($)</label>
                  <input type="number" value={perEmployeeCap} onChange={e => setPerEmployeeCap(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Hard stop behavior</label>
                  <select value={hardStopBehavior} onChange={e => setHardStopBehavior(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="pause">Pause Employee</option>
                    <option value="notify">Notify Only</option>
                    <option value="shutdown">Shutdown</option>
                  </select>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-4">
              Billing goes to your provider. Zumo handles setup + governance only.
            </p>
          </div>
        )}

        {/* Step 2: Agent Environment */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">Agent Environment</h2>
            <p className="text-slate-400 text-sm mb-6">Where should your AI employees run? Each agent runs in a secure, isolated container.</p>

            {/* Mode Tabs */}
            <div className="flex gap-1 mb-6 bg-slate-700/50 rounded-lg p-1">
              <button onClick={() => setServerMode('docker')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  serverMode === 'docker' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                This Machine (Recommended)
              </button>
              <button onClick={() => setServerMode('marketplace')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  serverMode === 'marketplace' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                Cloud Server
              </button>
            </div>

            {serverMode === 'docker' && (
              <div className="space-y-4">
                <div className="bg-slate-700/30 border border-slate-700 rounded-lg p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">Docker Containers</h3>
                      <p className="text-sm text-slate-400 mb-3">
                        Each AI employee runs in its own isolated Docker container on this machine.
                        Containers are locked down with no root access, limited memory, and network isolation.
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Non-root execution
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Memory limits enforced
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Network isolation
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Capabilities dropped
                        </div>
                      </div>

                      <button onClick={handleCheckDocker} disabled={dockerChecking}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60">
                        {dockerChecking ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Checking...
                          </span>
                        ) : dockerStatus?.available ? 'Re-check Docker' : 'Check Docker'}
                      </button>
                    </div>
                  </div>
                </div>

                {dockerStatus && (
                  <div className={`p-4 rounded-lg border ${dockerStatus.available
                    ? 'bg-green-900/10 border-green-800/50'
                    : 'bg-red-900/10 border-red-800/50'
                  }`}>
                    {dockerStatus.available ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-400 font-medium">Docker is running</span>
                        </div>
                        <p className="text-xs text-slate-400">Version: {dockerStatus.version}</p>
                        <p className="text-xs text-slate-400 mt-1">Your AI agents will run in secure containers on this machine.</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-red-400 font-medium">Docker not found</span>
                        </div>
                        <p className="text-sm text-slate-300 mb-2">Docker is required to run AI agents securely. Here is how to install it:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-400">
                          <li>Download Docker Desktop from <a href="https://docker.com/products/docker-desktop" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">docker.com</a></li>
                          <li>Install and start Docker Desktop</li>
                          <li>Come back here and click &quot;Check Docker&quot; again</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                {!dockerStatus && (
                  <p className="text-xs text-slate-500">Click &quot;Check Docker&quot; to verify your setup. You can also skip this and set it up later.</p>
                )}
              </div>
            )}

            {serverMode === 'marketplace' && (
              <>
                {/* Provider Selection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  {SERVER_PROVIDERS.map(sp => (
                    <button key={sp.id} onClick={() => setServerProvider(sp.id)}
                      className={`p-4 rounded-lg border text-left transition-all relative ${
                        serverProvider === sp.id ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}>
                      {sp.recommended && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-green-600/20 text-green-400 text-[9px] font-semibold uppercase rounded border border-green-500/30">
                          Recommended
                        </span>
                      )}
                      <h3 className="font-semibold text-white mb-1">{sp.name}</h3>
                      <p className="text-xs text-slate-400">{sp.description}</p>
                    </button>
                  ))}
                </div>

                {serverProvider !== 'custom' && (
                  <>
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-slate-300 mb-3">Server Plan</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {SERVER_PLANS.map(plan => (
                          <button key={plan.id} onClick={() => setServerPlan(plan.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              serverPlan === plan.id ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                            }`}>
                            <h4 className="font-semibold text-white text-sm">{plan.name}</h4>
                            <p className="text-xs text-slate-400 mt-1">{plan.specs}</p>
                            <p className="text-xs text-blue-400 mt-1">{plan.cost}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-slate-300 mb-2">Region</label>
                      <select value={serverRegion} onChange={e => setServerRegion(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {REGIONS.map(r => (
                          <option key={r.id} value={r.id}>{r.name}{r.default ? ' (default)' : ''}</option>
                        ))}
                      </select>
                    </div>

                    {!provisioningComplete && (
                      <button onClick={handleProvisionServer} disabled={provisioning}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-60 text-white mb-4">
                        {provisioning ? 'Provisioning...' : 'Provision Server'}
                      </button>
                    )}

                    {(provisioning || provisioningComplete) && (
                      <div className="bg-slate-700/30 border border-slate-700 rounded-lg p-4 mb-4">
                        <div className="space-y-2">
                          {PROVISIONING_STEPS.map((ps, idx) => {
                            const isActive = provisioning && idx === provisioningStep
                            const isComplete = idx < provisioningStep || provisioningComplete
                            const isVisible = idx <= provisioningStep || provisioningComplete
                            if (!isVisible) return null
                            return (
                              <div key={idx} className="flex items-center gap-3">
                                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                  {isComplete ? (
                                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  ) : isActive ? (
                                    <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                  ) : null}
                                </div>
                                <span className={`text-sm font-mono ${isComplete ? 'text-emerald-400' : isActive ? 'text-blue-300' : 'text-slate-500'}`}>
                                  {ps.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-3 h-1 bg-slate-600 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${provisioningComplete ? 100 : ((provisioningStep + 1) / PROVISIONING_STEPS.length) * 100}%` }} />
                        </div>
                      </div>
                    )}

                    {provisioningComplete && (
                      <div className="bg-green-900/10 border border-green-800/50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-green-400 mb-2">Security Posture</h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {['Region: ' + (REGIONS.find(r => r.id === serverRegion)?.name || serverRegion), 'Firewall configured', 'Non-root user', 'gVisor sandbox active'].map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-slate-300">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: VPN / Network */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">VPN & Network Security</h2>
            <p className="text-slate-400 text-sm mb-6">How should agents communicate with your infrastructure?</p>

            <div className="space-y-3 mb-6">
              {VPN_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => { setVpnProvider(opt.id); setVpnEnrolled(false) }}
                  className={`w-full p-4 rounded-lg border text-left transition-all relative ${
                    vpnProvider === opt.id ? `${opt.borderColor} ${opt.bgColor} border-2` : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  }`}>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-white">{opt.name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{opt.description}</p>
                </button>
              ))}
            </div>

            {/* VPN Config for Tailscale/WireGuard */}
            {(vpnProvider === 'tailscale' || vpnProvider === 'wireguard') && (
              <div className="space-y-4">
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Generated Config</h3>
                  <pre className="bg-slate-900 rounded-lg p-3 text-xs text-slate-300 font-mono overflow-x-auto">
{vpnProvider === 'tailscale' ? `# Tailscale Agent Config
tailscale up --authkey=tskey-auth-xxxx \\
  --hostname=zumo-agent-sandbox \\
  --advertise-tags=tag:zumo-agent \\
  --accept-routes

# ACL Policy (auto-managed)
{
  "acls": [
    {"action": "accept", "src": ["tag:zumo-agent"], "dst": ["tag:zumo-infra:*"]}
  ]
}` : `# WireGuard Config
[Interface]
PrivateKey = <generated>
Address = 100.64.0.2/24
DNS = 100.64.0.1

[Peer]
PublicKey = <server-pubkey>
Endpoint = vpn.yourorg.zumo.app:51820
AllowedIPs = 100.64.0.0/24
PersistentKeepalive = 25`}
                  </pre>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-300">Node enrollment status</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {vpnEnrolled ? 'Enrolled. Private IP: 100.64.0.2' : 'Not enrolled yet'}
                    </p>
                  </div>
                  {vpnEnrolled ? (
                    <span className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-800 rounded text-sm font-medium">
                      Connected
                    </span>
                  ) : (
                    <button onClick={handleVpnEnroll}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium text-white transition-colors">
                      Enroll Node
                    </button>
                  )}
                </div>

                {vpnEnrolled && (
                  <div className="p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-xs text-slate-400">Private IP: <span className="text-white font-mono">100.64.0.2</span></p>
                  </div>
                )}
              </div>
            )}

            {/* No VPN Warning */}
            {vpnProvider === 'none' && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="text-red-400 font-semibold">Public Internet Risk</h3>
                </div>
                <ul className="space-y-1 text-sm text-red-300">
                  <li>- Agents communicate over public internet (no encryption overlay)</li>
                  <li>- Autonomy restricted to Observe mode only</li>
                  <li>- Write access to connectors disabled</li>
                  <li>- API credentials sent over TLS but no network isolation</li>
                  <li>- Not recommended for production or sensitive data</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Connectors */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">Connect Tools & Services</h2>
            <p className="text-slate-400 text-sm mb-6">Grant your AI employees access to your tools via OAuth.</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CONNECTORS.map(connector => {
                const isConnected = connectedAccounts[connector.id]?.connected
                return (
                  <div key={connector.id}
                    className={`p-4 rounded-lg border transition-all ${
                      isConnected ? 'border-green-500/40 bg-green-900/10' : 'border-slate-600 bg-slate-700/50'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                        isConnected ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-300'
                      }`}>
                        {isConnected ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : connector.icon}
                      </div>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${riskBadgeColor(connector.riskLevel)}`}>
                        {connector.riskLevel}
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="text-sm font-medium text-white block">{connector.name}</span>
                      {connector.optional && <span className="text-xs text-slate-500">(optional)</span>}
                    </div>
                    {isConnected ? (
                      <div className="flex items-center gap-1 text-xs text-green-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Connected{connectedAccounts[connector.id]?.writeEnabled ? ' (read+write)' : ' (read-only)'}
                      </div>
                    ) : (
                      <button onClick={() => openConnectorModal(connector.id)}
                        className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium text-white transition-colors">
                        Connect
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-white">
            Back
          </button>
          <div className="flex gap-3">
            {step < TOTAL_STEPS && (
              <button onClick={() => setStep(s => s + 1)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-slate-300">
                Skip
              </button>
            )}
            {step < TOTAL_STEPS ? (
              <button onClick={handleNext} disabled={!canProceed()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed text-white">
                Next
              </button>
            ) : (
              <button onClick={handleFinishOnboarding}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-medium text-white">
                Complete Setup
              </button>
            )}
          </div>
        </div>
      </div>

      {/* OAuth Consent Modal */}
      {connectingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setConnectingModal(null); setShowDangerChecklist(false) }} />
          <div className="relative bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            {!showDangerChecklist ? (
              <>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Connect {CONNECTORS.find(c => c.id === connectingModal)?.name}
                </h3>
                <p className="text-sm text-slate-400 mb-4">Select permissions for this integration.</p>

                {/* Scopes */}
                <div className="space-y-2 mb-4">
                  {CONNECTORS.find(c => c.id === connectingModal)?.scopes.map(scope => {
                    const isRead = scope.includes('read') || scope.includes('readonly')
                    const isWrite = scope.includes('write') || scope.includes('send') || scope.includes('events')
                    const isChecked = modalScopes.includes(scope)

                    if (isWrite && !modalWriteEnabled) return null

                    return (
                      <label key={scope} className="flex items-center gap-3 p-2 bg-slate-700/50 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={isChecked || isRead}
                          onChange={e => {
                            if (isRead) return // Read scopes always enabled
                            setModalScopes(prev => e.target.checked ? [...prev, scope] : prev.filter(s => s !== scope))
                          }}
                          disabled={isRead}
                          className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-slate-300">{scope}</span>
                        {isRead && <span className="text-[10px] text-slate-500 ml-auto">default</span>}
                      </label>
                    )
                  })}
                </div>

                {/* Write Toggle */}
                <div className="p-3 bg-slate-700/30 rounded-lg mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-300 font-medium">Enable write access</label>
                    <button
                      onClick={() => {
                        setModalWriteEnabled(!modalWriteEnabled)
                        if (modalWriteEnabled) setModalWriteAcknowledged(false)
                      }}
                      className={`w-10 h-5 rounded-full transition-colors relative ${modalWriteEnabled ? 'bg-blue-600' : 'bg-slate-600'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${modalWriteEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {modalWriteEnabled && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={modalWriteAcknowledged} onChange={e => setModalWriteAcknowledged(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs text-yellow-400">I understand the risks of write access</span>
                    </label>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setConnectingModal(null)}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white">
                    Cancel
                  </button>
                  <button onClick={handleConnectConfirm}
                    disabled={modalWriteEnabled && !modalWriteAcknowledged}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-40 text-white">
                    Connect
                  </button>
                </div>
              </>
            ) : (
              /* Danger Checklist for High-Risk + Write */
              <>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-red-400">High-Risk Write Access</h3>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  You are granting <strong className="text-white">{CONNECTORS.find(c => c.id === connectingModal)?.name}</strong> write access.
                  This is a high-risk integration. Please confirm you understand:
                </p>
                <div className="space-y-2 mb-4">
                  {[
                    'AI employees can modify data in this service',
                    'Actions are logged but may not be reversible',
                    'Rate limits apply per your policy configuration',
                    'Approval workflows will gate sensitive operations',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-red-900/20 rounded">
                      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                      </svg>
                      <span className="text-sm text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowDangerChecklist(false); setConnectingModal(null) }}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white">
                    Cancel
                  </button>
                  <button onClick={() => { setDangerAcknowledged(true); handleConnectConfirm() }}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium text-white">
                    Accept Risk & Connect
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
