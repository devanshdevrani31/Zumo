import { NextResponse } from 'next/server'
import { buildClearCookieHeader } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.headers.set('Set-Cookie', buildClearCookieHeader())
  return response
}
