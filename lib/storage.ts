import { put, list } from '@vercel/blob'
import { kv } from '@vercel/kv'

// ── Vercel Blob (file storage) ─────────────────────────────────────────────

export async function readFile(path: string): Promise<string> {
  const { blobs } = await list({ prefix: path })
  const blob = blobs.find(b => b.pathname === path)
  if (!blob) return ''
  const resp = await fetch(blob.url)
  if (!resp.ok) return ''
  return await resp.text()
}

export async function readFileBytes(path: string): Promise<Buffer | null> {
  const { blobs } = await list({ prefix: path })
  const blob = blobs.find(b => b.pathname === path)
  if (!blob) return null
  const resp = await fetch(blob.url)
  if (!resp.ok) return null
  return Buffer.from(await resp.arrayBuffer())
}

export async function writeFile(path: string, content: string): Promise<string> {
  const { url } = await put(path, content, { access: 'public', addRandomSuffix: false })
  return url
}

export async function writeFileBytes(path: string, buffer: Buffer, contentType: string): Promise<string> {
  const { url } = await put(path, buffer, { access: 'public', addRandomSuffix: false, contentType })
  return url
}

export async function fileExists(path: string): Promise<{ exists: boolean; updatedAt: string; url: string }> {
  const { blobs } = await list({ prefix: path })
  const blob = blobs.find(b => b.pathname === path)
  return { exists: !!blob, updatedAt: blob?.uploadedAt?.toString() || '', url: blob?.url || '' }
}

export async function getFileUrl(path: string): Promise<string> {
  const { blobs } = await list({ prefix: path })
  const blob = blobs.find(b => b.pathname === path)
  return blob?.url || ''
}

// ── Vercel KV (config + published keywords) ────────────────────────────────

export async function getConfig(key: string): Promise<string> {
  return (await kv.get<string>(`config:${key}`)) || ''
}

export async function setConfig(key: string, value: string): Promise<void> {
  await kv.set(`config:${key}`, value)
}

export type PublishedKeyword = {
  keyword: string; url: string; date: string; title: string; cluster: string
}

export async function getPublishedKeywords(): Promise<PublishedKeyword[]> {
  return (await kv.get<PublishedKeyword[]>('published_keywords')) || []
}

export async function addPublishedKeyword(entry: PublishedKeyword): Promise<void> {
  const existing = await getPublishedKeywords()
  if (existing.some(k => k.keyword.toLowerCase() === entry.keyword.toLowerCase())) return
  await kv.set('published_keywords', [...existing, entry])
}
