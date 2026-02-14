/**
 * Docker container management for OpenClaw agent instances.
 * Each AI employee runs in an isolated Docker container.
 */
import Docker from 'dockerode'

const AGENT_IMAGE = 'zumo-openclaw-agent'
const AGENT_NETWORK = 'zumo-agents'

let _docker: Docker | null = null

function getDocker(): Docker {
  if (!_docker) {
    // On Windows, Docker Desktop exposes named pipe; on Linux/Mac, unix socket
    _docker = process.platform === 'win32'
      ? new Docker({ socketPath: '//./pipe/docker_engine' })
      : new Docker({ socketPath: '/var/run/docker.sock' })
  }
  return _docker
}

export interface DockerStatus {
  available: boolean
  version?: string
  error?: string
}

export interface ContainerInfo {
  containerId: string
  status: string
  running: boolean
  uptime?: number
  cpuPercent?: number
  memoryMb?: number
}

/**
 * Check if Docker is available and running.
 */
export async function checkDockerAvailable(): Promise<DockerStatus> {
  try {
    const docker = getDocker()
    const info = await docker.version()
    return { available: true, version: info.Version }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { available: false, error: `Docker is not running. ${msg}` }
  }
}

/**
 * Ensure the agent Docker network exists (for container isolation).
 */
async function ensureNetwork(): Promise<void> {
  const docker = getDocker()
  const networks = await docker.listNetworks({ filters: { name: [AGENT_NETWORK] } })
  if (networks.length === 0) {
    await docker.createNetwork({ Name: AGENT_NETWORK, Driver: 'bridge', Internal: false })
  }
}

/**
 * Check if the agent image exists locally. If not, build it.
 */
export async function ensureAgentImage(): Promise<{ exists: boolean; built?: boolean }> {
  const docker = getDocker()
  const images = await docker.listImages({ filters: { reference: [AGENT_IMAGE] } })
  if (images.length > 0) return { exists: true }

  // Image doesn't exist — it needs to be built from agent/Dockerfile
  // The caller should build it with: docker build -t zumo-openclaw-agent ./agent
  return { exists: false, built: false }
}

/**
 * Build the agent Docker image from the agent/ directory.
 */
export async function buildAgentImage(agentDir: string): Promise<void> {
  const docker = getDocker()
  const stream = await docker.buildImage(
    { context: agentDir, src: ['Dockerfile', 'package.json', 'agent.js', 'tools.js'] },
    { t: AGENT_IMAGE }
  )
  // Wait for build to complete
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (err: Error | null) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

/**
 * Create and start a container for an AI employee.
 */
export async function createAgentContainer(config: {
  employeeId: string
  employeeName: string
  llmProvider: string
  llmApiKey: string
  llmModel?: string
  llmEndpoint?: string
  gatewayUrl: string
  autonomyMode: string
  instructions: string
  tools: string
  memoryLimitMb?: number
  cpuShares?: number
}): Promise<string> {
  const docker = getDocker()
  await ensureNetwork()

  const env = [
    `EMPLOYEE_ID=${config.employeeId}`,
    `EMPLOYEE_NAME=${config.employeeName}`,
    `LLM_PROVIDER=${config.llmProvider}`,
    `LLM_API_KEY=${config.llmApiKey}`,
    `LLM_MODEL=${config.llmModel || ''}`,
    `LLM_ENDPOINT=${config.llmEndpoint || ''}`,
    `GATEWAY_URL=${config.gatewayUrl}`,
    `AUTONOMY_MODE=${config.autonomyMode}`,
    `AGENT_INSTRUCTIONS=${config.instructions}`,
    `AGENT_TOOLS=${config.tools}`,
  ]

  const container = await docker.createContainer({
    Image: AGENT_IMAGE,
    name: `zumo-agent-${config.employeeId.slice(0, 12)}`,
    Env: env,
    HostConfig: {
      Memory: (config.memoryLimitMb || 512) * 1024 * 1024,
      CpuShares: config.cpuShares || 256,
      NetworkMode: AGENT_NETWORK,
      RestartPolicy: { Name: 'unless-stopped', MaximumRetryCount: 0 },
      // Drop capabilities for security
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges'],
    },
    // Expose the agent's HTTP server for task submission
    ExposedPorts: { '3100/tcp': {} },
  })

  await container.start()
  return container.id
}

/**
 * Get the status of a container.
 */
export async function getContainerStatus(containerId: string): Promise<ContainerInfo> {
  try {
    const docker = getDocker()
    const container = docker.getContainer(containerId)
    const data = await container.inspect()
    const running = data.State.Running

    let cpuPercent = 0
    let memoryMb = 0

    if (running) {
      try {
        const stats = await container.stats({ stream: false })
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
        const numCpus = stats.cpu_stats.online_cpus || 1
        cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0
        memoryMb = (stats.memory_stats.usage || 0) / (1024 * 1024)
      } catch {
        // stats might not be available
      }
    }

    const startedAt = data.State.StartedAt ? new Date(data.State.StartedAt).getTime() : 0
    const uptime = running && startedAt ? Date.now() - startedAt : 0

    return {
      containerId,
      status: data.State.Status,
      running,
      uptime,
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryMb: Math.round(memoryMb * 10) / 10,
    }
  } catch {
    return { containerId, status: 'not_found', running: false }
  }
}

/**
 * Get logs from a container.
 */
export async function getContainerLogs(containerId: string, tail = 100): Promise<string[]> {
  try {
    const docker = getDocker()
    const container = docker.getContainer(containerId)
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    })
    // Docker logs come as a Buffer with header bytes; convert to lines
    const text = typeof logs === 'string' ? logs : logs.toString('utf8')
    return text
      .split('\n')
      .map((line: string) => line.replace(/^.{8}/, '').trim()) // strip docker log header
      .filter((line: string) => line.length > 0)
  } catch {
    return []
  }
}

/**
 * Stop a running container.
 */
export async function stopContainer(containerId: string): Promise<void> {
  const docker = getDocker()
  const container = docker.getContainer(containerId)
  await container.stop().catch(() => { /* already stopped */ })
}

/**
 * Start a stopped container.
 */
export async function startContainer(containerId: string): Promise<void> {
  const docker = getDocker()
  const container = docker.getContainer(containerId)
  await container.start()
}

/**
 * Remove a container (stops it first if running).
 */
export async function removeContainer(containerId: string): Promise<void> {
  const docker = getDocker()
  const container = docker.getContainer(containerId)
  await container.remove({ force: true })
}

/**
 * Send a task to a running agent container via its HTTP endpoint.
 */
export async function sendTaskToAgent(containerId: string, task: { id: string; description: string; context?: Record<string, unknown> }): Promise<{ output: string; status: string }> {
  const docker = getDocker()
  const container = docker.getContainer(containerId)
  const data = await container.inspect()

  // Get the container's IP on the agent network
  const networks = data.NetworkSettings.Networks
  const agentNet = networks[AGENT_NETWORK] || Object.values(networks)[0]
  if (!agentNet?.IPAddress) {
    throw new Error('Agent container has no network address')
  }

  const res = await fetch(`http://${agentNet.IPAddress}:3100/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
    signal: AbortSignal.timeout(120000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Agent returned ${res.status}: ${text}`)
  }

  return res.json()
}
