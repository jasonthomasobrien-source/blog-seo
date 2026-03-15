import { readFileBytes } from '@/lib/storage'

export async function GET() {
  try {
    const buffer = await readFileBytes('hero_image.jpg')
    if (!buffer) return new Response('Image not found', { status: 404 })
    return new Response(buffer, {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' },
    })
  } catch (e: unknown) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 })
  }
}
