import { NextResponse } from 'next/server'
import { getPublishedKeywords } from '@/lib/storage'

export async function GET() {
  try {
    const keywords = await getPublishedKeywords()
    return NextResponse.json({ keywords, count: keywords.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg, keywords: [] }, { status: 500 })
  }
}
