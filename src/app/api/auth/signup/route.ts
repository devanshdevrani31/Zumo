import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { hashPassword, createSessionToken, buildSetCookieHeader } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { email, password, name, orgName } = await request.json()

    if (!email || !password || !name || !orgName) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, name, orgName' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)
    const dataRegion = process.env.DATA_REGION || 'EU'

    const organization = await prisma.organization.create({
      data: {
        name: orgName,
        dataRegion,
      },
    })

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        orgId: organization.id,
      },
    })

    const token = await createSessionToken({
      userId: user.id,
      orgId: organization.id,
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
        id: organization.id,
        name: organization.name,
        dataRegion: organization.dataRegion,
        onboardingCompleted: organization.onboardingCompleted,
      },
    })

    response.headers.set('Set-Cookie', buildSetCookieHeader(token))
    return response
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
