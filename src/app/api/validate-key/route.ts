import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { validateApiKey } from '@/lib/llm-providers'

/**
 * Validates an LLM API key by making a real test call to the provider.
 */
export async function POST(request: Request) {
  return withAuth(request, async (req) => {
    try {
      const { provider, key, endpoint } = await req.json()

      if (!provider || !key) {
        return NextResponse.json(
          { valid: false, error: 'Missing provider or key' },
          { status: 400 }
        )
      }

      const result = await validateApiKey(provider, key, endpoint)
      return NextResponse.json(result)
    } catch (error) {
      console.error('Validate key error:', error)
      return NextResponse.json(
        { valid: false, error: 'Validation failed' },
        { status: 500 }
      )
    }
  })
}
