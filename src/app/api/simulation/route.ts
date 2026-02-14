import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { generateEvents, generateEventsByType } from '@/lib/simulation'
import type { EventType } from '@/lib/simulation'

export async function GET(request: Request) {
  return withAuth(request, async (_req, _auth) => {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const countParam = searchParams.get('count')
    const count = countParam ? parseInt(countParam, 10) : 10

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: employeeId' },
        { status: 400 }
      )
    }

    const events = generateEvents(employeeId, count)
    return NextResponse.json(events)
  })
}

export async function POST(request: Request) {
  return withAuth(request, async (req, _auth) => {
    try {
      const { eventType, employeeId } = await req.json()

      if (!eventType || !employeeId) {
        return NextResponse.json(
          { error: 'Missing required fields: eventType, employeeId' },
          { status: 400 }
        )
      }

      const events = generateEventsByType(employeeId, eventType as EventType, 1)
      return NextResponse.json(events[0])
    } catch (error) {
      console.error('Simulation error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
