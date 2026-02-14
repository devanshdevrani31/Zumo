import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { checkDockerAvailable, ensureAgentImage } from '@/lib/docker'

/**
 * Check Docker availability and agent image status.
 */
export async function GET(request: Request) {
  return withAuth(request, async () => {
    const dockerStatus = await checkDockerAvailable()

    let imageReady = false
    if (dockerStatus.available) {
      const imageStatus = await ensureAgentImage()
      imageReady = imageStatus.exists
    }

    return NextResponse.json({
      docker: dockerStatus,
      agentImage: { ready: imageReady },
    })
  })
}
