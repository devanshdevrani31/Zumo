/**
 * OpenClaw Agent — the actual AI agent that runs inside a Docker container.
 *
 * This agent:
 * 1. Starts an HTTP server on port 3100 to receive tasks from Zumo
 * 2. Calls real LLM APIs using the key provided via environment
 * 3. Routes all tool calls through Zumo's policy gateway
 * 4. Reports heartbeats and status
 */

const http = require('http')
const { tools, executeToolCall } = require('./tools')

// --- Config from environment ---
const EMPLOYEE_ID = process.env.EMPLOYEE_ID || 'unknown'
const EMPLOYEE_NAME = process.env.EMPLOYEE_NAME || 'Agent'
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai'
const LLM_API_KEY = process.env.LLM_API_KEY || ''
const LLM_MODEL = process.env.LLM_MODEL || ''
const LLM_ENDPOINT = process.env.LLM_ENDPOINT || ''
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://host.docker.internal:3000/api/gateway'
const AUTONOMY_MODE = process.env.AUTONOMY_MODE || 'assist'
const AGENT_INSTRUCTIONS = process.env.AGENT_INSTRUCTIONS || 'You are a helpful AI assistant.'
const AGENT_TOOLS = JSON.parse(process.env.AGENT_TOOLS || '[]')

let taskQueue = []
let currentTask = null
let taskHistory = []
let startTime = Date.now()

// --- LLM Providers ---

async function callLLM(messages, maxTokens = 1024) {
  switch (LLM_PROVIDER.toLowerCase()) {
    case 'openai':
    case 'openai_compatible':
    case 'local':
      return callOpenAI(messages, maxTokens)
    case 'anthropic':
      return callAnthropic(messages, maxTokens)
    case 'gemini':
    case 'google':
      return callGemini(messages, maxTokens)
    default:
      throw new Error(`Unknown provider: ${LLM_PROVIDER}`)
  }
}

async function callOpenAI(messages, maxTokens) {
  const baseUrl = LLM_ENDPOINT || 'https://api.openai.com/v1'
  const model = LLM_MODEL || 'gpt-4o-mini'
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      tools: getToolDefinitions(),
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    toolCalls: data.choices?.[0]?.message?.tool_calls || [],
    usage: data.usage || {},
  }
}

async function callAnthropic(messages, maxTokens) {
  const model = LLM_MODEL || 'claude-3-haiku-20240307'
  const systemMsg = messages.find(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')

  const body = {
    model,
    max_tokens: maxTokens,
    messages: nonSystem,
    tools: getToolDefinitions().map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    })),
  }
  if (systemMsg) body.system = systemMsg.content

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': LLM_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()

  const textBlocks = (data.content || []).filter(b => b.type === 'text')
  const toolBlocks = (data.content || []).filter(b => b.type === 'tool_use')

  return {
    content: textBlocks.map(b => b.text).join('\n'),
    toolCalls: toolBlocks.map(b => ({
      id: b.id,
      type: 'function',
      function: { name: b.name, arguments: JSON.stringify(b.input) },
    })),
    usage: data.usage || {},
  }
}

async function callGemini(messages, maxTokens) {
  const model = LLM_MODEL || 'gemini-1.5-flash'
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const systemInstruction = messages.find(m => m.role === 'system')
  const body = { contents, generationConfig: { maxOutputTokens: maxTokens } }
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${LLM_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    toolCalls: [],
    usage: data.usageMetadata || {},
  }
}

function getToolDefinitions() {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

// --- Policy Gateway ---

async function checkPolicy(action, details) {
  try {
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: EMPLOYEE_ID,
        action,
        details,
      }),
    })
    if (!res.ok) return { allowed: false, reason: `Gateway error: ${res.status}` }
    return await res.json()
  } catch (err) {
    console.error('[Agent] Gateway unreachable:', err.message)
    // If gateway is down, deny by default (secure by default)
    return { allowed: false, reason: 'Policy gateway unreachable' }
  }
}

// --- Task Execution ---

async function executeTask(task) {
  const startTime = Date.now()
  console.log(`[Agent] Starting task ${task.id}: ${task.description}`)

  const messages = [
    { role: 'system', content: `${AGENT_INSTRUCTIONS}\n\nYou are ${EMPLOYEE_NAME}. Your autonomy mode is: ${AUTONOMY_MODE}. Always be helpful and complete tasks thoroughly.` },
    { role: 'user', content: task.description },
  ]

  let output = ''
  let totalTokensIn = 0
  let totalTokensOut = 0
  let iterations = 0
  const maxIterations = AUTONOMY_MODE === 'observe' ? 1 : AUTONOMY_MODE === 'assist' ? 3 : 10

  while (iterations < maxIterations) {
    iterations++
    console.log(`[Agent] Iteration ${iterations}/${maxIterations}`)

    const response = await callLLM(messages)
    totalTokensIn += response.usage.prompt_tokens || response.usage.input_tokens || 0
    totalTokensOut += response.usage.completion_tokens || response.usage.output_tokens || 0

    if (response.content) {
      output += response.content + '\n'
    }

    // Handle tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      messages.push({ role: 'assistant', content: response.content || '', tool_calls: response.toolCalls })

      for (const call of response.toolCalls) {
        const fnName = call.function.name
        const fnArgs = JSON.parse(call.function.arguments || '{}')

        // Check policy before executing
        const policy = await checkPolicy(fnName, JSON.stringify(fnArgs))
        if (!policy.allowed) {
          console.log(`[Agent] Tool ${fnName} BLOCKED by policy: ${policy.reason}`)
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: `Action blocked by policy: ${policy.reason}`,
          })
          continue
        }

        console.log(`[Agent] Executing tool: ${fnName}`)
        const result = await executeToolCall(fnName, fnArgs)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        })
      }
      continue // Go to next iteration for the LLM to process tool results
    }

    // No tool calls = task complete
    break
  }

  const duration = Date.now() - startTime
  console.log(`[Agent] Task ${task.id} complete in ${duration}ms (${iterations} iterations)`)

  return {
    taskId: task.id,
    status: 'completed',
    output: output.trim(),
    durationMs: duration,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    iterations,
  }
}

// --- HTTP Server ---

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'healthy',
      employeeId: EMPLOYEE_ID,
      employeeName: EMPLOYEE_NAME,
      uptime: Date.now() - startTime,
      tasksCompleted: taskHistory.length,
      currentTask: currentTask ? currentTask.id : null,
    }))
    return
  }

  // Submit task
  if (url.pathname === '/task' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const task = JSON.parse(body)
        if (!task.id || !task.description) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Task must have id and description' }))
          return
        }

        currentTask = task
        const result = await executeTask(task)
        currentTask = null
        taskHistory.push(result)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (err) {
        currentTask = null
        console.error('[Agent] Task error:', err.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message, status: 'failed' }))
      }
    })
    return
  }

  // Task history
  if (url.pathname === '/history' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(taskHistory.slice(-20)))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

const PORT = 3100
server.listen(PORT, () => {
  console.log(`[OpenClaw Agent] ${EMPLOYEE_NAME} (${EMPLOYEE_ID}) listening on port ${PORT}`)
  console.log(`[OpenClaw Agent] Provider: ${LLM_PROVIDER}, Model: ${LLM_MODEL || 'default'}`)
  console.log(`[OpenClaw Agent] Autonomy: ${AUTONOMY_MODE}, Gateway: ${GATEWAY_URL}`)
})
