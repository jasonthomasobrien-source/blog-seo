import { NextResponse } from 'next/server'
import { fileExists } from '@/lib/storage'

async function checkFile(name: string): Promise<{ exists: boolean; updatedAt: string }> {
  try {
    const { exists, updatedAt } = await fileExists(name)
    let mtime = ''
    if (updatedAt) {
      try {
        mtime = new Date(updatedAt).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })
      } catch { mtime = updatedAt }
    }
    return { exists, updatedAt: mtime }
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
    sources: sources.exists, draft: draft.exists, image: image.exists,
    sources_mtime: sources.updatedAt, draft_mtime: draft.updatedAt, image_mtime: image.updatedAt,
    anthropic_key_set: !!(process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-YOUR')),
  })
}
