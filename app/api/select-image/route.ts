import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { writeFileBytes } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { url?: string }
    const url = body.url
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    }

    // Download the image
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!resp.ok) {
      return NextResponse.json({ error: `Failed to fetch image: HTTP ${resp.status}` }, { status: 400 })
    }
    const arrayBuffer = await resp.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Resize and convert to JPEG
    const outputBuffer = await sharp(inputBuffer)
      .resize(1200, 800, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82 })
      .toBuffer()

    await writeFileBytes('hero_image.jpg', outputBuffer, 'image/jpeg')

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
