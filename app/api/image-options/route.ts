import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/storage'

const MICHIGAN_CITIES = [
  'kalamazoo', 'portage', 'grand rapids', 'battle creek', 'south haven',
  'plainwell', 'otsego', 'allegan', 'paw paw', 'mattawan', 'saugatuck',
  'muskegon', 'holland', 'lansing', 'ann arbor', 'detroit', 'michigan',
]

function buildRegionalQueries(serviceAreaRaw: string): string[] {
  // Detect if service area is Michigan-based
  const lower = serviceAreaRaw.toLowerCase()
  const isMichigan = MICHIGAN_CITIES.some(c => lower.includes(c))

  if (isMichigan) {
    return [
      'michigan home exterior neighborhood',
      'midwest suburban neighborhood house',
      'michigan real estate residential street',
    ]
  }

  // Generic fallback for other regions
  return [
    'residential neighborhood house exterior',
    'suburban neighborhood street homes',
    'american neighborhood residential house',
  ]
}

export async function GET() {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY || ''
  if (!apiKey) {
    return NextResponse.json({ options: [], error: 'UNSPLASH_ACCESS_KEY not configured' })
  }

  // Load service area from Redis to pick regional search terms
  const serviceAreaRaw = await getConfig('service_area')
  const queries = buildRegionalQueries(serviceAreaRaw)

  const options: { url: string; thumb: string; credit: string; alt: string }[] = []

  for (const query of queries) {
    if (options.length >= 3) break
    try {
      const resp = await fetch(
        `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
        {
          headers: { Authorization: `Client-ID ${apiKey}` },
          cache: 'no-store',
        }
      )
      if (!resp.ok) continue
      const data = await resp.json() as {
        urls?: { regular?: string; small?: string }
        user?: { name?: string }
        alt_description?: string
        links?: { html?: string }
      }
      const url = data?.urls?.regular
      const thumb = data?.urls?.small
      if (!url || !thumb) continue
      options.push({
        url,
        thumb,
        credit: data?.user?.name || 'Unsplash',
        alt: data?.alt_description || query,
      })
    } catch {
      // skip failed query
    }
  }

  return NextResponse.json({ options })
}
