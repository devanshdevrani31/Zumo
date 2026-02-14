import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPassword, createSessionToken, buildSetCookieHeader } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const validPassword = await verifyPassword(password, user.passwordHash)
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const token = await createSessionToken({
      userId: user.id,
      orgId: user.orgId,
      email: user.email,
    })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        dataRegion: user.organization.dataRegion,
        onboardingCompleted: user.organization.onboardingCompleted,
      },
    })

    response.headers.set('Set-Cookie', buildSetCookieHeader(token))
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
