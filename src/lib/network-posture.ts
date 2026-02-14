import prisma from '@/lib/db'

export interface NetworkPosture {
  vpnEnabled: boolean
  provider: string
  maxAutonomy: string
  warnings: string[]
  privateIp: string | null
}

export async function getNetworkPosture(orgId: string): Promise<NetworkPosture> {
  const vpnConfig = await prisma.providerConfig.findFirst({
    where: { orgId, type: 'vpn' },
  })

  const isSecure = vpnConfig != null && vpnConfig.provider !== 'none'

  return {
    vpnEnabled: isSecure,
    provider: vpnConfig?.provider || 'none',
    maxAutonomy: isSecure ? 'autopilot' : 'observe',
    warnings: isSecure
      ? []
      : [
          'No VPN configured — agents communicate over public internet',
          'Autonomy restricted to Observe mode',
          'Write access to connectors disabled',
        ],
    privateIp: isSecure ? '100.64.0.1/24' : null,
  }
}
