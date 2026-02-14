import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { spendingLimits } from '@/lib/spending'

export async function GET(request: Request) {
  return withAuth(request, async (_req, auth) => {
    try {
      const summary = await spendingLimits.getSpendingSummary(auth.orgId)
      return NextResponse.json(summary)
    } catch (error) {
      console.error('Spending summary error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

export async function POST(request: Request) {
  return withAuth(request, async (req, auth) => {
    try {
      const { employeeId, amount } = await req.json()

      if (!employeeId || amount === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: employeeId, amount' },
          { status: 400 }
        )
      }

      const result = await spendingLimits.checkBudget(auth.orgId, employeeId, amount)
      return NextResponse.json(result)
    } catch (error) {
      console.error('Spending check error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
