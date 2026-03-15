import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json() as { password?: string }
    const expected = process.env.APP_PASSWORD || ''

    if (!expected) {
      return NextResponse.json({ error: 'APP_PASSWORD not configured on server.' }, { status: 500 })
    }

    if (!password || password !== expected) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
    }

    const sessionToken = process.env.SESSION_SECRET || expected

    const response = NextResponse.json({ success: true })
    response.cookies.set('blog_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
