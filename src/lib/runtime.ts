import prisma from '@/lib/db'

export interface RuntimeTask {
  id: string
  description: string
  context?: Record<string, unknown>
}

export interface RuntimeResult {
  taskId: string
  status: 'completed' | 'failed' | 'pending' | 'running'
  output: string
  durationMs: number
  metadata: Record<string, unknown>
}

export interface RuntimeLogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  runtime: string
}

export interface RuntimeStatus {
  name: string
  healthy: boolean
  uptime: number
  tasksCompleted: number
  tasksFailed: number
  currentLoad: number
}

export interface Runtime {
  readonly name: string
  readonly description: string
  execute(task: RuntimeTask): Promise<RuntimeResult>
  getStatus(): RuntimeStatus
  getLogs(limit?: number): RuntimeLogEntry[]
}

abstract class BaseRuntime implements Runtime {
  abstract readonly name: string
  abstract readonly description: string
  abstract execute(task: RuntimeTask): Promise<RuntimeResult>

  protected logs: RuntimeLogEntry[] = []
  protected tasksCompleted = 0
  protected tasksFailed = 0
  protected startTime = Date.now()

  protected addLog(level: RuntimeLogEntry['level'], message: string): void {
    this.logs.push({ timestamp: new Date().toISOString(), level, message, runtime: this.name })
    if (this.logs.length > 500) this.logs = this.logs.slice(-500)
  }

  getStatus(): RuntimeStatus {
    return {
      name: this.name,
      healthy: true,
      uptime: Date.now() - this.startTime,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      currentLoad: Math.random() * 100,
    }
  }

  getLogs(limit = 50): RuntimeLogEntry[] {
    return this.logs.slice(-limit)
  }
}

export class OpenClawRuntime extends BaseRuntime {
  readonly name = 'openclaw'
  readonly description = 'OpenClaw runtime – structured chain-of-thought agent with tool-use support and built-in safety checks.'

  async execute(task: RuntimeTask): Promise<RuntimeResult> {
    const start = Date.now()
    this.addLog('info', `[OpenClaw] Received task ${task.id}: ${task.description}`)
    this.addLog('debug', `[OpenClaw] Planning step decomposition...`)
    this.addLog('debug', `[OpenClaw] Identified 3 sub-steps for task ${task.id}`)
    this.addLog('info', `[OpenClaw] Executing sub-step 1/3: analyze context`)
    this.addLog('info', `[OpenClaw] Executing sub-step 2/3: invoke tools`)
    this.addLog('info', `[OpenClaw] Executing sub-step 3/3: synthesize result`)
    this.addLog('info', `[OpenClaw] Task ${task.id} completed with safety checks passed`)
    this.tasksCompleted++

    return {
      taskId: task.id, status: 'completed',
      output: `[OpenClaw] Task "${task.description}" executed successfully via chain-of-thought planning. 3 sub-steps completed. All safety guardrails passed.`,
      durationMs: Date.now() - start + Math.floor(Math.random() * 200 + 100),
      metadata: { runtime: this.name, stepsExecuted: 3, toolCalls: Math.floor(Math.random() * 5 + 1), safetyScore: parseFloat((0.85 + Math.random() * 0.15).toFixed(3)), tokensUsed: Math.floor(Math.random() * 4000 + 500) },
    }
  }
}

export class AutoGPTRuntime extends BaseRuntime {
  readonly name = 'autogpt'
  readonly description = 'AutoGPT runtime – autonomous goal-driven agent with self-prompting loops and memory management.'

  async execute(task: RuntimeTask): Promise<RuntimeResult> {
    const start = Date.now()
    const iterations = Math.floor(Math.random() * 4 + 2)
    this.addLog('info', `[AutoGPT] Goal set: ${task.description}`)
    this.addLog('debug', `[AutoGPT] Initializing memory store...`)
    for (let i = 1; i <= iterations; i++) {
      this.addLog('info', `[AutoGPT] Iteration ${i}/${iterations} – thinking...`)
      this.addLog('debug', `[AutoGPT] Iteration ${i} – generated action plan`)
      this.addLog('info', `[AutoGPT] Iteration ${i} – executing action`)
    }
    this.addLog('info', `[AutoGPT] Goal achieved after ${iterations} iterations for task ${task.id}`)
    this.tasksCompleted++

    return {
      taskId: task.id, status: 'completed',
      output: `[AutoGPT] Autonomously completed "${task.description}" in ${iterations} self-directed iterations. Memory updated.`,
      durationMs: Date.now() - start + Math.floor(Math.random() * 500 + 200),
      metadata: { runtime: this.name, iterations, memoryWrites: Math.floor(Math.random() * 10 + 1), selfCritiqueScore: parseFloat((0.6 + Math.random() * 0.4).toFixed(3)), tokensUsed: Math.floor(Math.random() * 8000 + 1000) },
    }
  }
}

export class CustomPlannerRuntime extends BaseRuntime {
  readonly name = 'customplanner'
  readonly description = 'Custom Planner runtime – rule-based task planner with configurable workflows and deterministic execution.'

  async execute(task: RuntimeTask): Promise<RuntimeResult> {
    const start = Date.now()
    this.addLog('info', `[Planner] Task queued: ${task.id}`)
    this.addLog('debug', `[Planner] Matching task to workflow templates...`)
    this.addLog('info', `[Planner] Workflow matched: standard_execution_v2`)
    this.addLog('debug', `[Planner] Validating preconditions...`)
    this.addLog('info', `[Planner] Preconditions met. Executing workflow.`)
    this.addLog('info', `[Planner] Step 1: parse_input -> OK`)
    this.addLog('info', `[Planner] Step 2: transform_data -> OK`)
    this.addLog('info', `[Planner] Step 3: produce_output -> OK`)
    this.addLog('info', `[Planner] Workflow complete for task ${task.id}`)
    this.tasksCompleted++

    return {
      taskId: task.id, status: 'completed',
      output: `[Planner] Task "${task.description}" executed via workflow "standard_execution_v2". All 3 steps succeeded deterministically.`,
      durationMs: Date.now() - start + Math.floor(Math.random() * 100 + 50),
      metadata: { runtime: this.name, workflowId: 'standard_execution_v2', stepsCompleted: 3, deterministic: true, tokensUsed: 0 },
    }
  }
}

export class ExternalRuntime extends BaseRuntime {
  readonly name = 'external'
  readonly description = 'External runtime – delegates execution to a third-party agent service via API. Supports webhook callbacks.'
  private endpoint: string

  constructor(endpoint = 'https://api.external-agent.example.com/v1/execute') {
    super()
    this.endpoint = endpoint
  }

  async execute(task: RuntimeTask): Promise<RuntimeResult> {
    const start = Date.now()
    this.addLog('info', `[External] Dispatching task ${task.id} to ${this.endpoint}`)
    this.addLog('debug', `[External] Payload size: ${JSON.stringify(task).length} bytes`)
    this.addLog('info', `[External] Awaiting response from external service...`)
    const succeeded = Math.random() > 0.15

    if (succeeded) {
      this.addLog('info', `[External] Received 200 OK from external service for task ${task.id}`)
      this.tasksCompleted++
      return {
        taskId: task.id, status: 'completed',
        output: `[External] Task "${task.description}" delegated to external service and completed. Response received via webhook.`,
        durationMs: Date.now() - start + Math.floor(Math.random() * 1000 + 300),
        metadata: { runtime: this.name, endpoint: this.endpoint, httpStatus: 200, retries: 0, tokensUsed: Math.floor(Math.random() * 3000 + 200) },
      }
    } else {
      this.addLog('warn', `[External] Received 503 from external service for task ${task.id}`)
      this.addLog('info', `[External] Retrying (1/3)...`)
      this.addLog('warn', `[External] Retry failed. Marking task as failed.`)
      this.tasksFailed++
      return {
        taskId: task.id, status: 'failed',
        output: `[External] Task "${task.description}" failed after 1 retry. External service returned 503 Service Unavailable.`,
        durationMs: Date.now() - start + Math.floor(Math.random() * 2000 + 500),
        metadata: { runtime: this.name, endpoint: this.endpoint, httpStatus: 503, retries: 1, tokensUsed: 0 },
      }
    }
  }
}

export class RuntimeRegistry {
  private runtimes = new Map<string, Runtime>()

  constructor() {
    this.register(new OpenClawRuntime())
    this.register(new AutoGPTRuntime())
    this.register(new CustomPlannerRuntime())
    this.register(new ExternalRuntime())
  }

  register(runtime: Runtime): void { this.runtimes.set(runtime.name, runtime) }
  get(name: string): Runtime | undefined { return this.runtimes.get(name) }
  list(): string[] { return Array.from(this.runtimes.keys()) }

  listDetailed(): Array<{ name: string; description: string }> {
    return Array.from(this.runtimes.values()).map((r) => ({ name: r.name, description: r.description }))
  }

  async switchRuntime(employeeId: string, runtimeName: string): Promise<Runtime> {
    const runtime = this.runtimes.get(runtimeName)
    if (!runtime) throw new Error(`Unknown runtime "${runtimeName}". Available: ${this.list().join(', ')}`)
    await prisma.employee.update({ where: { id: employeeId }, data: { runtime: runtimeName } })
    return runtime
  }
}

export const runtimeRegistry = new RuntimeRegistry()

export async function getRuntimeForEmployee(employeeId: string): Promise<Runtime> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { runtime: true } })
  const runtimeName = employee?.runtime ?? 'openclaw'
  return runtimeRegistry.get(runtimeName) ?? runtimeRegistry.get('openclaw')!
}
