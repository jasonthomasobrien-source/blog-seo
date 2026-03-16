import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const loginUrl = '/login'

  // User denied access on Google's screen
  if (errorParam) {
    return NextResponse.redirect(new URL(`${loginUrl}?error=Google+sign-in+was+cancelled.`, request.url))
  }

  // Validate state to prevent CSRF
  const storedState = request.cookies.get('oauth_state')?.value
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL(`${loginUrl}?error=Invalid+auth+state.+Please+try+again.`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL(`${loginUrl}?error=No+auth+code+received.`, request.url))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const allowedEmail = process.env.ALLOWED_EMAIL
  const sessionSecret = process.env.SESSION_SECRET || process.env.APP_PASSWORD || ''

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL(`${loginUrl}?error=Google+login+not+configured.`, request.url))
  }

  if (!sessionSecret) {
    return NextResponse.redirect(new URL(`${loginUrl}?error=Server+auth+not+configured.`, request.url))
  }

  const appUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/auth/google/callback`

  try {
    // Exchange authorization code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      console.error('[google-callback] Token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(new URL(`${loginUrl}?error=Google+token+exchange+failed.`, request.url))
    }

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string }

    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL(`${loginUrl}?error=No+access+token+from+Google.`, request.url))
    }

    // Get user email from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userRes.ok) {
      return NextResponse.redirect(new URL(`${loginUrl}?error=Could+not+fetch+Google+profile.`, request.url))
    }

    const user = await userRes.json() as { email?: string; email_verified?: boolean }

    if (!user.email) {
      return NextResponse.redirect(new URL(`${loginUrl}?error=No+email+returned+from+Google.`, request.url))
    }

    // Check against allowed email
    if (allowedEmail && user.email.toLowerCase() !== allowedEmail.toLowerCase()) {
      return NextResponse.redirect(new URL(`${loginUrl}?error=This+Google+account+is+not+authorized.`, request.url))
    }

    // Set the same session cookie as password auth
    const response = NextResponse.redirect(new URL('/dashboard', request.url))

    response.cookies.set('blog_session', sessionSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    // Clear the state cookie
    response.cookies.set('oauth_state', '', { maxAge: 0, path: '/' })

    return response
  } catch (e) {
    console.error('[google-callback] Unexpected error:', e)
    return NextResponse.redirect(new URL(`${loginUrl}?error=An+unexpected+error+occurred.`, request.url))
  }
}
