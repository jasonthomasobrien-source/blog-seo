import { NextResponse } from 'next/server'
import { readFile } from '@/lib/storage'

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

export async function GET() {
  try {
    const rawText = await readFile('draft.md')
    if (!rawText) {
      return NextResponse.json({})
    }

    const meta = parseFrontMatter(rawText)

    return NextResponse.json({
      title: meta['title'] || meta['seo_title'] || '',
      slug: meta['slug'] || '',
      keyword: meta['keyword'] || '',
      description: meta['seo_description'] || meta['meta_description'] || '',
      alt_text: meta['image_alt'] || meta['alt_text'] || '',
      dek: meta['dek'] || '',
      cluster: meta['cluster'] || '',
      image_url: meta['image_url'] || '',
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
