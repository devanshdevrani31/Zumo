/**
 * Real LLM provider integration — validates API keys and makes real completions.
 */

export interface ValidationResult {
  valid: boolean
  error?: string
  models?: string[]
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionResult {
  content: string
  model: string
  tokensIn: number
  tokensOut: number
  costUsd: number
}

// Cost per 1M tokens (approximate, as of early 2025)
const COST_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gemini-pro': { input: 0.5, output: 1.5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'local': { input: 0, output: 0 },
}

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const costs = COST_TABLE[model] || { input: 1, output: 3 }
  return (tokensIn / 1_000_000) * costs.input + (tokensOut / 1_000_000) * costs.output
}

/**
 * Validate an API key by making a lightweight test call to the provider.
 */
export async function validateApiKey(
  provider: string,
  key: string,
  endpoint?: string
): Promise<ValidationResult> {
  try {
    switch (provider.toLowerCase()) {
      case 'openai':
        return await validateOpenAI(key)
      case 'anthropic':
        return await validateAnthropic(key)
      case 'gemini':
      case 'google':
        return await validateGemini(key)
      case 'openai_compatible':
      case 'local':
        return await validateOpenAICompatible(key, endpoint || 'http://localhost:11434/v1')
      default:
        return { valid: false, error: `Unknown provider: ${provider}` }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { valid: false, error: message }
  }
}

async function validateOpenAI(key: string): Promise<ValidationResult> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    if (res.status === 401) return { valid: false, error: 'Invalid API key. Check that you copied the full key from platform.openai.com.' }
    return { valid: false, error: `OpenAI returned ${res.status}: ${res.statusText}` }
  }
  const data = await res.json()
  const models = (data.data || []).map((m: { id: string }) => m.id).slice(0, 10)
  return { valid: true, models }
}

async function validateAnthropic(key: string): Promise<ValidationResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  })
  if (!res.ok) {
    if (res.status === 401) return { valid: false, error: 'Invalid API key. Check that you copied the full key from console.anthropic.com.' }
    // 400 with overloaded or other non-auth errors still means the key works
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}))
      if (body?.error?.type === 'authentication_error') return { valid: false, error: 'Invalid API key.' }
      return { valid: true, models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] }
    }
    return { valid: false, error: `Anthropic returned ${res.status}: ${res.statusText}` }
  }
  return { valid: true, models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] }
}

async function validateGemini(key: string): Promise<ValidationResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${key}`
  )
  if (!res.ok) {
    if (res.status === 400 || res.status === 403) return { valid: false, error: 'Invalid API key. Get one from ai.google.dev.' }
    return { valid: false, error: `Gemini returned ${res.status}: ${res.statusText}` }
  }
  const data = await res.json()
  const models = (data.models || []).map((m: { name: string }) => m.name).slice(0, 10)
  return { valid: true, models }
}

async function validateOpenAICompatible(key: string, endpoint: string): Promise<ValidationResult> {
  try {
    const url = endpoint.replace(/\/+$/, '') + '/models'
    const headers: Record<string, string> = {}
    if (key) headers['Authorization'] = `Bearer ${key}`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { valid: false, error: `Endpoint returned ${res.status}. Is the server running at ${endpoint}?` }
    return { valid: true, models: ['local-model'] }
  } catch {
    return { valid: false, error: `Could not connect to ${endpoint}. Make sure the server is running.` }
  }
}

/**
 * Make a real chat completion call to an LLM provider.
 */
export async function chatCompletion(
  provider: string,
  key: string,
  messages: ChatMessage[],
  options: { model?: string; maxTokens?: number; endpoint?: string } = {}
): Promise<ChatCompletionResult> {
  switch (provider.toLowerCase()) {
    case 'openai':
      return chatOpenAI(key, messages, options)
    case 'anthropic':
      return chatAnthropic(key, messages, options)
    case 'gemini':
    case 'google':
      return chatGemini(key, messages, options)
    case 'openai_compatible':
    case 'local':
      return chatOpenAI(key, messages, { ...options, endpoint: options.endpoint || 'http://localhost:11434/v1' })
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

async function chatOpenAI(
  key: string,
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number; endpoint?: string }
): Promise<ChatCompletionResult> {
  const baseUrl = opts.endpoint || 'https://api.openai.com/v1'
  const model = opts.model || 'gpt-4o-mini'
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens || 1024 }),
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const usage = data.usage || {}
  return {
    content: data.choices?.[0]?.message?.content || '',
    model,
    tokensIn: usage.prompt_tokens || 0,
    tokensOut: usage.completion_tokens || 0,
    costUsd: estimateCost(model, usage.prompt_tokens || 0, usage.completion_tokens || 0),
  }
}

async function chatAnthropic(
  key: string,
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number }
): Promise<ChatCompletionResult> {
  const model = opts.model || 'claude-3-haiku-20240307'
  const systemMsg = messages.find((m) => m.role === 'system')
  const nonSystem = messages.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens || 1024,
    messages: nonSystem,
  }
  if (systemMsg) body.system = systemMsg.content

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const tokensIn = data.usage?.input_tokens || 0
  const tokensOut = data.usage?.output_tokens || 0
  return {
    content: data.content?.[0]?.text || '',
    model,
    tokensIn,
    tokensOut,
    costUsd: estimateCost(model, tokensIn, tokensOut),
  }
}

async function chatGemini(
  key: string,
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number }
): Promise<ChatCompletionResult> {
  const model = opts.model || 'gemini-1.5-flash'
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const systemInstruction = messages.find((m) => m.role === 'system')
  const body: Record<string, unknown> = { contents }
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] }
  }
  if (opts.maxTokens) {
    body.generationConfig = { maxOutputTokens: opts.maxTokens }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const usage = data.usageMetadata || {}
  return {
    content: text,
    model,
    tokensIn: usage.promptTokenCount || 0,
    tokensOut: usage.candidatesTokenCount || 0,
    costUsd: estimateCost(model, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0),
  }
}
