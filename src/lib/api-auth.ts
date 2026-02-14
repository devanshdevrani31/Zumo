import { NextResponse } from 'next/server'
import { getSessionFromRequest, SessionPayload } from '@/lib/auth'

export interface AuthContext {
  userId: string
  orgId: string
  email: string
}

export async function withAuth(
  request: Request,
  handler: (req: Request, auth: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handler(request, session)
}
