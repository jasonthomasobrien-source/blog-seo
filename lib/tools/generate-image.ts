import sharp from 'sharp'
import { readFile, writeFileBytes, writeFile } from '../storage'

const LEONARDO_API_BASE = 'https://cloud.leonardo.ai/api/rest/v1'
const DEFAULT_MODEL_ID = 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3' // Leonardo Phoenix 1.0
const DEFAULT_STYLE = 'PHOTOGRAPHY'
const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 800
const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 40

function parseFrontMatterPrompt(text: string): string {
  if (!text.trimStart().startsWith('---')) return ''
  const parts = text.trimStart().split('---')
  if (parts.length < 3) return ''
  for (const line of parts[1].trim().split('\n')) {
    if (line.trim().toLowerCase().startsWith('image_prompt')) {
      const idx = line.indexOf(':')
      if (idx !== -1) return line.substring(idx + 1).trim()
    }
  }
  return ''
}

function buildUnsplashQuery(prompt: string): string {
  const stopWords = new Set([
    'professional', 'photography', 'style', 'warm', 'natural', 'golden',
    'hour', 'lighting', 'sharp', 'focus', 'high', 'resolution', 'welcoming',
    'residential', 'neighborhood', 'atmosphere', 'text', 'watermarks',
    'people', 'aerial', 'view', 'quiet', 'overcast', 'midwest', 'sky',
    'modest', 'single', 'family', 'homes', 'with', 'two', 'car', 'garages',
  ])
  const words = prompt.toLowerCase().replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/)
  const keywords = words.filter(w => !stopWords.has(w) && w.length > 3).slice(0, 6)
  const base = ['michigan', 'neighborhood', 'house']
  const extras = keywords.filter(k => !base.includes(k))
  return [...base, ...extras].slice(0, 6).join(' ')
}

async function fetchUnsplash(prompt: string, apiKey: string, onLog: (l: string) => void): Promise<string> {
  const queries = [
    buildUnsplashQuery(prompt),
    'michigan neighborhood house residential',
    'house neighborhood suburban street',
  ]
  for (const query of queries) {
    onLog(`Unsplash search: "${query}"`)
    try {
      const resp = await fetch(
        `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
        { headers: { Authorization: `Client-ID ${apiKey}` } }
      )
      if (resp.status === 404) {
        onLog(`Unsplash: no photos for "${query}", trying broader query…`)
        continue
      }
      if (!resp.ok) {
        onLog(`Unsplash failed: HTTP ${resp.status}`)
        return ''
      }
      const data = await resp.json()
      const url = data?.urls?.regular || ''
      if (url) {
        onLog(`Unsplash photo by ${data?.user?.name || '?'}`)
        return url
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      onLog(`Unsplash error: ${msg}`)
      return ''
    }
  }
  return ''
}

function buildLeonardoPrompt(userPrompt: string): string {
  const base = userPrompt.trim().length < 20
    ? `${userPrompt.trim()}, Kalamazoo Michigan real estate`
    : userPrompt.trim()
  return `${base}. professional real estate photography style, warm natural golden-hour lighting, sharp focus, high resolution, welcoming residential neighborhood atmosphere, no text, no watermarks, no people`
}

async function leonardoGenerate(prompt: string, apiKey: string): Promise<string> {
  const modelId = process.env.LEONARDO_MODEL_ID || DEFAULT_MODEL_ID
  const resp = await fetch(`${LEONARDO_API_BASE}/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      modelId: modelId,
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      num_images: 1,
      public: false,
      presetStyle: DEFAULT_STYLE,
      guidance_scale: 7,
    }),
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Leonardo generate HTTP ${resp.status}: ${body.substring(0, 200)}`)
  }
  const data = await resp.json()
  const generationId =
    data?.sdGenerationJob?.generationId || data?.generationId
  if (!generationId) throw new Error(`No generation ID in response: ${JSON.stringify(data)}`)
  return generationId
}

async function leonardoPoll(generationId: string, apiKey: string, onLog: (l: string) => void): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    const resp = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!resp.ok) throw new Error(`Leonardo poll HTTP ${resp.status}`)
    const data = await resp.json()
    const generation = data?.generations_by_pk || data?.generation || {}
    const status = (generation.status || '').toUpperCase()

    if (status === 'COMPLETE') {
      const images = generation.generated_images || []
      if (images.length > 0) return images[0].url || ''
      throw new Error('Generation complete but no images returned.')
    }
    if (status === 'FAILED' || status === 'DELETED') {
      throw new Error(`Generation ${status.toLowerCase()}`)
    }
    onLog(`  [${attempt + 1}/${MAX_POLL_ATTEMPTS}] Status: ${status} — waiting…`)
  }
  throw new Error(`Generation did not complete after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`)
}

export async function generateImage(
  onLog: (line: string) => void
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    // Read prompt from draft front matter
    const draftText = await readFile('draft.md')
    let prompt = parseFrontMatterPrompt(draftText)

    if (!prompt) {
      prompt = 'Residential neighborhood in West Michigan, craftsman-style homes, tree-lined street, spring morning'
      onLog(`No image_prompt in draft — using default: ${prompt}`)
    } else {
      onLog(`Image prompt from draft: ${prompt}`)
    }

    let imageUrl = ''
    let source = ''

    // Option 1: Unsplash
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY || ''
    if (unsplashKey && unsplashKey !== 'your_unsplash_key') {
      onLog('Trying Unsplash for a real photo…')
      imageUrl = await fetchUnsplash(prompt, unsplashKey, onLog)
      if (imageUrl) source = 'unsplash'
    }

    // Option 2: Leonardo AI
    if (!imageUrl) {
      const leonardoKey = process.env.LEONARDO_API_KEY || ''
      if (!leonardoKey || leonardoKey === 'your_leonardo_key') {
        return {
          success: false,
          error: 'No image source configured. Set UNSPLASH_ACCESS_KEY or LEONARDO_API_KEY.',
        }
      }
      const fullPrompt = buildLeonardoPrompt(prompt)
      onLog(`Generating image via Leonardo…`)
      onLog(`Prompt: ${fullPrompt}`)
      const generationId = await leonardoGenerate(fullPrompt, leonardoKey)
      onLog(`Generation ID: ${generationId}`)
      imageUrl = await leonardoPoll(generationId, leonardoKey, onLog)
      source = 'leonardo'
    }

    if (!imageUrl) {
      onLog('⚠ No image found from any source. Skipping image — you can add one manually when publishing.')
      return { success: true }
    }

    onLog(`✓ Image URL from ${source}: ${imageUrl}`)

    // Download image bytes
    onLog('Downloading image…')
    const imgResp = await fetch(imageUrl)
    if (!imgResp.ok) throw new Error(`Failed to download image: HTTP ${imgResp.status}`)
    const arrayBuffer = await imgResp.arrayBuffer()
    const rawBuffer = Buffer.from(arrayBuffer)

    // Resize to 600×400 cover crop, max ~180KB
    onLog('Resizing image to 600×400…')
    const resized = await sharp(rawBuffer)
      .resize(600, 400, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    onLog(`Image size: ${Math.round(resized.length / 1024)}KB`)

    // Upload to Blob Storage
    onLog('Uploading hero_image.jpg to storage…')
    const storedUrl = await writeFileBytes('hero_image.jpg', resized, 'image/jpeg')

    // Build alt text from prompt or default
    const altText = prompt.length > 20
      ? prompt.replace(/[,.].*$/, '').trim().substring(0, 120)
      : 'West Michigan neighborhood homes — Kalamazoo area real estate'

    // Update draft front matter with image_url and image_alt
    if (draftText) {
      let updatedDraft = draftText.replace(
        /^(---[\s\S]*?)(image_url:.*?\n)?(---)/m,
        (_match, p1, _p2, p3) => `${p1}image_url: ${storedUrl}\nimage_alt: ${altText}\n${p3}`
      )
      if (updatedDraft === draftText) {
        // front matter didn't match pattern — skip silently
      } else {
        await writeFile('draft.md', updatedDraft)
        onLog('Updated draft front matter with image_url and image_alt.')
      }
    }

    onLog(`✓ Image saved as hero_image.jpg`)
    return { success: true, imageUrl }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`✗ generate_image failed: ${msg}`)
    return { success: false, error: msg }
  }
}
