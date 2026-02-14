import { generateEvents, generateCostSummary } from '@/lib/simulation'

describe('Simulation Module', () => {
  it('generateEvents returns correct count of events', () => {
    const events = generateEvents('emp-sim-1', 20)
    expect(events).toHaveLength(20)

    const events2 = generateEvents('emp-sim-1', 5)
    expect(events2).toHaveLength(5)

    const events3 = generateEvents('emp-sim-1', 0)
    expect(events3).toHaveLength(0)
  })

  it('generateEvents is deterministic (same input = same output)', () => {
    const run1 = generateEvents('emp-deterministic', 10)
    const run2 = generateEvents('emp-deterministic', 10)

    // Verify deterministic properties match (id, type, message, timestamp, source)
    for (let i = 0; i < run1.length; i++) {
      expect(run1[i].id).toBe(run2[i].id)
      expect(run1[i].type).toBe(run2[i].type)
      expect(run1[i].message).toBe(run2[i].message)
      expect(run1[i].timestamp).toBe(run2[i].timestamp)
      expect(run1[i].source).toBe(run2[i].source)
    }

    // Different employeeId should produce different results
    const run3 = generateEvents('emp-different', 10)
    const ids1 = run1.map(e => e.id)
    const ids3 = run3.map(e => e.id)
    expect(ids1).not.toEqual(ids3)
  })

  it('generateCostSummary returns breakdown with all categories', () => {
    const summary = generateCostSummary('emp-cost-1')

    expect(summary).toHaveProperty('totalDaily')
    expect(summary).toHaveProperty('totalMonthly')
    expect(summary).toHaveProperty('breakdown')

    expect(typeof summary.totalDaily).toBe('number')
    expect(typeof summary.totalMonthly).toBe('number')
    expect(summary.totalDaily).toBeGreaterThan(0)
    expect(summary.totalMonthly).toBeGreaterThan(0)

    // Should have all 6 cost categories
    const expectedCategories = ['compute', 'llm-tokens', 'storage', 'network', 'api-calls', 'third-party']
    for (const category of expectedCategories) {
      expect(summary.breakdown).toHaveProperty(category)
      expect(typeof summary.breakdown[category]).toBe('number')
      expect(summary.breakdown[category]).toBeGreaterThan(0)
    }

    // Monthly should be approximately 30x daily
    expect(summary.totalMonthly).toBeCloseTo(summary.totalDaily * 30, 0)
  })
})
