import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  const response = NextResponse.redirect(loginUrl)
  response.cookies.set('blog_session', '', { maxAge: 0, path: '/' })
  return response
}
