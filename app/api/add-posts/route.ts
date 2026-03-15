import { NextRequest, NextResponse } from 'next/server'
import { addPublishedKeyword, getPublishedKeywords } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { titles?: string[] }
    const titles = (body.titles || []).map((t: string) => t.trim()).filter(Boolean)

    if (!titles.length) {
      return NextResponse.json({ error: 'No titles provided' }, { status: 400 })
    }

    const existing = await getPublishedKeywords()
    const existingTitles = new Set(existing.map(e => (e.title || e.keyword).toLowerCase()))

    let added = 0
    const skipped: string[] = []

    for (const title of titles) {
      if (existingTitles.has(title.toLowerCase())) {
        skipped.push(title)
        continue
      }
      const keyword = title.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
      await addPublishedKeyword({
        keyword,
        title,
        url: '',
        date: new Date().toISOString().split('T')[0],
        cluster: 'community-guides',
      })
      added++
    }

    return NextResponse.json({ success: true, added, skipped: skipped.length, total: titles.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
