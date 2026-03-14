import { NextResponse } from 'next/server'
import { fileExists, readFile } from '@/lib/storage'

function parseFrontMatterImageUrl(text: string): string {
  if (!text.trimStart().startsWith('---')) return ''
  const parts = text.trimStart().split('---')
  if (parts.length < 3) return ''
  for (const line of parts[1].trim().split('\n')) {
    if (line.toLowerCase().startsWith('image_url')) {
      const idx = line.indexOf(':')
      if (idx !== -1) return line.substring(idx + 1).trim()
    }
  }
  return ''
}

export async function GET() {
  try {
    // Check if hero_image.jpg exists in storage
    const { exists } = await fileExists('hero_image.jpg')

    // Also check draft front matter for image_url
    let imageUrl = ''
    try {
      const draftText = await readFile('draft.md')
      if (draftText) {
        imageUrl = parseFrontMatterImageUrl(draftText)
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      local_exists: exists,
      image_url: imageUrl,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg, local_exists: false, image_url: '' }, { status: 500 })
  }
}
