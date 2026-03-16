import { NextRequest, NextResponse } from 'next/server'
import { getConfig, setConfig } from '@/lib/storage'

const DEFAULT_SERVICE_AREA = {
  tier1: ['Kalamazoo', 'Portage', 'Grand Rapids', 'Battle Creek', 'South Haven', 'Kalamazoo County'],
  tier2: ['Plainwell', 'Otsego', 'Allegan', 'Paw Paw', 'Mattawan', 'Vicksburg', 'Schoolcraft', 'Richland', 'Wayland', 'Kentwood', 'Wyoming MI', 'Grandville'],
  tier3: ['Parchment', 'Comstock', 'Oshtemo', 'Texas Township', 'Saugatuck', 'Douglas', 'Three Rivers', 'Sturgis', 'Galesburg', 'Augusta', 'Delton', 'Lawton', 'Hartford', 'Gobles'],
}

export async function GET() {
  const raw = await getConfig('service_area')
  if (!raw) {
    return NextResponse.json({ serviceArea: DEFAULT_SERVICE_AREA, isDefault: true })
  }
  try {
    const serviceArea = JSON.parse(raw)
    return NextResponse.json({ serviceArea, isDefault: false })
  } catch {
    return NextResponse.json({ serviceArea: DEFAULT_SERVICE_AREA, isDefault: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { serviceArea } = body as { serviceArea?: { tier1: string[]; tier2: string[]; tier3: string[] } }

    if (!serviceArea || !Array.isArray(serviceArea.tier1) || !Array.isArray(serviceArea.tier2) || !Array.isArray(serviceArea.tier3)) {
      return NextResponse.json({ error: 'Invalid service area shape. Expected { tier1, tier2, tier3 } arrays.' }, { status: 400 })
    }

    const cleaned = {
      tier1: serviceArea.tier1.map((c: string) => c.trim()).filter(Boolean),
      tier2: serviceArea.tier2.map((c: string) => c.trim()).filter(Boolean),
      tier3: serviceArea.tier3.map((c: string) => c.trim()).filter(Boolean),
    }

    await setConfig('service_area', JSON.stringify(cleaned))
    return NextResponse.json({ success: true, serviceArea: cleaned })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
