import { NextRequest, NextResponse } from 'next/server'
import { suggestTopics } from '@/lib/tools/suggest-topics'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const count = (body as { count?: number }).count || 6
    const result = await suggestTopics(count)
    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg, success: false }, { status: 500 })
  }
}
