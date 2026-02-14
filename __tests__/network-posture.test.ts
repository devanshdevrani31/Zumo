jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    employee: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    policy: { findMany: jest.fn(), findFirst: jest.fn() },
    approvalRequest: { create: jest.fn() },
    auditLog: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    organization: { findUnique: jest.fn() },
    providerConfig: { findFirst: jest.fn() },
  },
}))

import { getNetworkPosture } from '@/lib/network-posture'
import prisma from '@/lib/db'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('Network Posture', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('VPN configured (tailscale) returns vpnEnabled:true, maxAutonomy:autopilot, empty warnings', async () => {
    ;(mockPrisma.providerConfig.findFirst as jest.Mock).mockResolvedValue({
      id: 'vpc-1',
      orgId: 'org-1',
      type: 'vpn',
      provider: 'tailscale',
      mode: 'auto',
      status: 'active',
    })

    const posture = await getNetworkPosture('org-1')

    expect(posture.vpnEnabled).toBe(true)
    expect(posture.provider).toBe('tailscale')
    expect(posture.maxAutonomy).toBe('autopilot')
    expect(posture.warnings).toEqual([])
    expect(posture.privateIp).toBe('100.64.0.1/24')
  })

  it('VPN is "none" returns vpnEnabled:false, maxAutonomy:observe, warnings array', async () => {
    ;(mockPrisma.providerConfig.findFirst as jest.Mock).mockResolvedValue({
      id: 'vpc-2',
      orgId: 'org-2',
      type: 'vpn',
      provider: 'none',
      mode: 'manual',
      status: 'inactive',
    })

    const posture = await getNetworkPosture('org-2')

    expect(posture.vpnEnabled).toBe(false)
    expect(posture.provider).toBe('none')
    expect(posture.maxAutonomy).toBe('observe')
    expect(posture.warnings.length).toBeGreaterThan(0)
    expect(posture.warnings).toContain('No VPN configured — agents communicate over public internet')
    expect(posture.privateIp).toBeNull()
  })

  it('No VPN config returns vpnEnabled:false with warnings', async () => {
    ;(mockPrisma.providerConfig.findFirst as jest.Mock).mockResolvedValue(null)

    const posture = await getNetworkPosture('org-no-vpn')

    expect(posture.vpnEnabled).toBe(false)
    expect(posture.provider).toBe('none')
    expect(posture.maxAutonomy).toBe('observe')
    expect(posture.warnings.length).toBeGreaterThan(0)
    expect(posture.warnings).toContain('Autonomy restricted to Observe mode')
    expect(posture.warnings).toContain('Write access to connectors disabled')
    expect(posture.privateIp).toBeNull()
  })
})
