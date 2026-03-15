import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('blog_session')?.value
  const fullSecret = process.env.SESSION_SECRET || process.env.APP_PASSWORD || ''
  const demoPassword = process.env.DEMO_PASSWORD || ''

  const isFullSession = fullSecret && session === fullSecret
  const isDemoSession = demoPassword && session === `demo:${demoPassword}`
  const isAuthenticated = isFullSession || isDemoSession

  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
