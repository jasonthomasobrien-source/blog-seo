import { NextResponse } from 'next/server'

// Temporary debug endpoint — delete after confirming env vars are set
export async function GET() {
  return NextResponse.json({
    APP_PASSWORD_set: !!process.env.APP_PASSWORD,
    DEMO_PASSWORD_set: !!process.env.DEMO_PASSWORD,
    SESSION_SECRET_set: !!process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  })
}
