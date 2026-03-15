export const maxDuration = 60

import { NextResponse } from 'next/server'
import { addPublishedKeyword, getPublishedKeywords } from '@/lib/storage'

interface GhlPost {
  title?: string
  name?: string
  slug?: string
  urlSlug?: string
  status?: string
  updatedAt?: string
  createdAt?: string
  id?: string
}

function extractPosts(data: unknown): GhlPost[] {
  if (!data || typeof data !== 'object') return []
  const d = data as Record<string, unknown>
  const list = (
    Array.isArray(d.posts) ? d.posts :
    Array.isArray(d.data) ? d.data :
    Array.isArray(d.items) ? d.items :
    Array.isArray(data) ? data as unknown[] : []
  ) as GhlPost[]
  return list
}

export async function POST() {
  const apiKey = process.env.GHL_API_KEY || ''
  const locationId = process.env.GHL_LOCATION_ID || ''
  const blogId = process.env.GHL_BLOG_ID || ''

  if (!apiKey || !locationId || !blogId) {
    return NextResponse.json({ error: 'GHL env vars not set' }, { status: 400 })
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  }

  const allPosts: GhlPost[] = []
  const debug: string[] = []

  for (const status of ['', 'PUBLISHED', 'SCHEDULED', 'DRAFT', 'ACTIVE']) {
    const statusParam = status ? `&status=${status}` : ''
    const url = `https://services.leadconnectorhq.com/blogs/posts?locationId=${locationId}&blogId=${blogId}&limit=100${statusParam}`
    try {
      const resp = await fetch(url, { headers })
      const rawBody = await resp.text()
      debug.push(`${status || 'no-filter'}: HTTP ${resp.status} — ${rawBody.substring(0, 200)}`)
      if (!resp.ok) continue
      const data = JSON.parse(rawBody)
      const posts = extractPosts(data)
      for (const p of posts) {
        if (p.title && !allPosts.some(x => x.title === p.title)) {
          allPosts.push(p)
        }
      }
    } catch (e) {
      debug.push(`${status || 'no-filter'}: exception — ${e}`)
    }
  }

  // Save all found posts to Redis
  const existing = await getPublishedKeywords()
  const existingTitles = new Set(existing.map(e => e.title?.toLowerCase() || e.keyword.toLowerCase()))

  let added = 0
  for (const post of allPosts) {
    const title = post.title || ''
    if (!title) continue
    if (existingTitles.has(title.toLowerCase())) continue

    const slug = post.urlSlug || post.slug || ''
    // Derive a keyword from the title
    const keyword = title.toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    await addPublishedKeyword({
      keyword,
      title,
      url: slug ? `/blog/${slug}` : '',
      date: new Date().toISOString().split('T')[0],
      cluster: 'community-guides',
    })
    added++
  }

  return NextResponse.json({
    success: true,
    ghl_posts_found: allPosts.length,
    added_to_redis: added,
    titles: allPosts.map(p => p.title || ''),
    debug,
  })
}
