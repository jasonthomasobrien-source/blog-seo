import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json() as { password?: string }
    const fullPassword = process.env.APP_PASSWORD || ''
    const demoPassword = process.env.DEMO_PASSWORD || ''

    if (!fullPassword) {
      return NextResponse.json({ error: 'APP_PASSWORD not configured on server.' }, { status: 500 })
    }

    if (!password) {
      return NextResponse.json({ error: 'Password required.' }, { status: 400 })
    }

    let sessionToken: string
    let isDemo = false

    if (password === fullPassword) {
      sessionToken = process.env.SESSION_SECRET || fullPassword
    } else if (demoPassword && password === demoPassword) {
      sessionToken = `demo:${demoPassword}`
      isDemo = true
    } else {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true, demo: isDemo })
    response.cookies.set('blog_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * (isDemo ? 1 : 30),
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
