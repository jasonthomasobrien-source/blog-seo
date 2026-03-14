import { NextResponse } from 'next/server'
import { readFile, addPublishedKeyword } from '@/lib/storage'

function parseFrontMatter(text: string): Record<string, string> {
  if (!text.trimStart().startsWith('---')) return {}
  const parts = text.trimStart().split('---')
  if (parts.length < 3) return {}
  const meta: Record<string, string> = {}
  for (const line of parts[1].trim().split('\n')) {
    if (line.includes(':')) {
      const colonIdx = line.indexOf(':')
      const key = line.substring(0, colonIdx).trim()
      const value = line.substring(colonIdx + 1).trim()
      meta[key] = value
    }
  }
  return meta
}

export async function POST() {
  try {
    const rawText = await readFile('draft.md')
    if (!rawText) {
      return NextResponse.json({ error: 'draft.md not found. Run Steps 1 & 2 first.' }, { status: 400 })
    }

    const meta = parseFrontMatter(rawText)
    const keyword = (meta['keyword'] || meta['primary_keyword'] || '').trim()
    const title = (meta['title'] || meta['seo_title'] || '').trim()
    const slug = (meta['slug'] || '').trim()
    const cluster = (meta['cluster'] || '').trim()

    if (!keyword) {
      return NextResponse.json({ error: 'No keyword found in draft front matter.' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    const url = slug ? `/blog/${slug}` : ''

    await addPublishedKeyword({ keyword, url, date: today, title, cluster })

    return NextResponse.json({ success: true, keyword, url, date: today, title })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
