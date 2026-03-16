import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    const loginUrl = new URL('/login', 'http://localhost')
    loginUrl.searchParams.set('error', 'Google login is not configured.')
    return NextResponse.redirect(loginUrl.toString().replace('http://localhost', ''))
  }

  const appUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/auth/google/callback`

  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )

  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
