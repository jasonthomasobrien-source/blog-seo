import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { readFileBytes, writeFileBytes } from '@/lib/storage'

export async function GET() {
  try {
    const buffer = await readFileBytes('hero_image.jpg')
    if (!buffer) return new Response('Image not found', { status: 404 })
    return new Response(new Uint8Array(buffer), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' },
    })
  } catch (e: unknown) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

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
