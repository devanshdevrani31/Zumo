import { RuntimeRegistry, OpenClawRuntime, AutoGPTRuntime, runtimeRegistry } from '@/lib/runtime'

// Mock prisma since runtime.ts imports it (for switchRuntime/getRuntimeForEmployee)
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    employee: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

describe('Runtime Module', () => {
  describe('RuntimeRegistry', () => {
    it('has 4 runtimes registered (openclaw, autogpt, customplanner, external)', () => {
      const registry = new RuntimeRegistry()
      const runtimes = registry.list()

      expect(runtimes).toHaveLength(4)
      expect(runtimes).toContain('openclaw')
      expect(runtimes).toContain('autogpt')
      expect(runtimes).toContain('customplanner')
      expect(runtimes).toContain('external')
    })
  })

  describe('OpenClawRuntime', () => {
    it('execute returns completed status with metadata', async () => {
      const runtime = new OpenClawRuntime()
      const result = await runtime.execute({
        id: 'task-1',
        description: 'Analyze deployment logs',
      })

      expect(result.taskId).toBe('task-1')
      expect(result.status).toBe('completed')
      expect(result.output).toContain('OpenClaw')
      expect(result.durationMs).toBeGreaterThan(0)
      expect(result.metadata).toHaveProperty('runtime', 'openclaw')
      expect(result.metadata).toHaveProperty('stepsExecuted', 3)
      expect(result.metadata).toHaveProperty('safetyScore')
      expect(result.metadata).toHaveProperty('tokensUsed')
    })
  })

  describe('AutoGPTRuntime', () => {
    it('execute returns completed with iterations', async () => {
      const runtime = new AutoGPTRuntime()
      const result = await runtime.execute({
        id: 'task-2',
        description: 'Investigate production alert',
      })

      expect(result.taskId).toBe('task-2')
      expect(result.status).toBe('completed')
      expect(result.output).toContain('AutoGPT')
      expect(result.metadata).toHaveProperty('runtime', 'autogpt')
      expect(result.metadata).toHaveProperty('iterations')
      expect(typeof result.metadata.iterations).toBe('number')
      expect(result.metadata.iterations as number).toBeGreaterThanOrEqual(2)
    })
  })

  describe('runtimeRegistry singleton', () => {
    it('runtimeRegistry.get returns correct runtime instance', () => {
      const openclaw = runtimeRegistry.get('openclaw')
      const autogpt = runtimeRegistry.get('autogpt')
      const unknown = runtimeRegistry.get('nonexistent')

      expect(openclaw).toBeDefined()
      expect(openclaw!.name).toBe('openclaw')
      expect(autogpt).toBeDefined()
      expect(autogpt!.name).toBe('autogpt')
      expect(unknown).toBeUndefined()
    })
  })
})
