import { supabase } from '@/lib/supabase'

const BUCKET = 'blog'

export async function GET() {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download('hero_image.jpg')
    if (error || !data) {
      return new Response('Image not found', { status: 404 })
    }

    const arrayBuffer = await data.arrayBuffer()
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(`Error: ${msg}`, { status: 500 })
  }
}
