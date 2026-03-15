import { NextRequest, NextResponse } from 'next/server'

// Logs in as demo without exposing the DEMO_PASSWORD to the client
export async function POST(request: NextRequest) {
  const demoPassword = process.env.DEMO_PASSWORD || ''

  if (!demoPassword) {
    return NextResponse.json({ error: 'Demo access is not enabled.' }, { status: 403 })
  }

  const sessionToken = `demo:${demoPassword}`

  const response = NextResponse.json({ success: true, demo: true })
  response.cookies.set('blog_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 day for demo
    path: '/',
  })
  return response
}
