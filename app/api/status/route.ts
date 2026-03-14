import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const BUCKET = 'blog'

async function checkFile(name: string): Promise<{ exists: boolean; updatedAt: string }> {
  try {
    const { data } = await supabase.storage.from(BUCKET).list('', { search: name })
    const file = data?.find(f => f.name === name)
    if (!file) return { exists: false, updatedAt: '' }
    const updated = file.updated_at || ''
    let mtime = ''
    if (updated) {
      try {
        const d = new Date(updated)
        mtime = d.toLocaleString('en-US', {
          month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      } catch {
        mtime = updated
      }
    }
    return { exists: true, updatedAt: mtime }
  } catch {
    return { exists: false, updatedAt: '' }
  }
}

export async function GET() {
  const [sources, draft, image] = await Promise.all([
    checkFile('sources.md'),
    checkFile('draft.md'),
    checkFile('hero_image.jpg'),
  ])

  return NextResponse.json({
    sources: sources.exists,
    draft: draft.exists,
    image: image.exists,
    sources_mtime: sources.updatedAt,
    draft_mtime: draft.updatedAt,
    image_mtime: image.updatedAt,
    anthropic_key_set: !!(process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-YOUR')),
  })
}
