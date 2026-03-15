import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('blog_session')?.value
  const secret = process.env.SESSION_SECRET || process.env.APP_PASSWORD || ''

  const isAuthenticated = secret && session === secret

  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
