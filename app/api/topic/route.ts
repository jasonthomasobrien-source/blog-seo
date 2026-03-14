import { NextRequest, NextResponse } from 'next/server'
import { getConfig, setConfig } from '@/lib/storage'

export async function GET() {
  const [topic, keyword] = await Promise.all([
    getConfig('topic'),
    getConfig('keyword'),
  ])
  return NextResponse.json({ topic, keyword })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, keyword } = body as { topic?: string; keyword?: string }

    if (topic !== undefined) await setConfig('topic', topic.trim())
    if (keyword !== undefined) await setConfig('keyword', keyword.trim())

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
