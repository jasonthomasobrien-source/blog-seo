import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from '@/lib/storage'

export async function GET() {
  const content = await readFile('draft.md')
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: NextRequest) {
  try {
    const content = await request.text()
    await writeFile('draft.md', content)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
