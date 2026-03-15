import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = request.cookies.get('blog_session')?.value
  const fullSecret = process.env.SESSION_SECRET || process.env.APP_PASSWORD || ''
  const demoPassword = process.env.DEMO_PASSWORD || ''

  if (fullSecret && session === fullSecret) {
    return NextResponse.json({ type: 'full' })
  }
  if (demoPassword && session === `demo:${demoPassword}`) {
    return NextResponse.json({ type: 'demo' })
  }
  return NextResponse.json({ type: 'none' })
}
