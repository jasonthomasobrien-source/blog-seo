import { NextRequest, NextResponse } from 'next/server'
import { getConfig, setConfig } from '@/lib/storage'

const SETTINGS_KEYS = [
  'ghl_api_key',
  'ghl_location_id',
  'ghl_blog_id',
  'lofty_api_key',
  'wp_site_url',
  'wp_username',
  'wp_app_password',
  'blog_rss_url',
] as const

type SettingsKey = typeof SETTINGS_KEYS[number]

export async function GET() {
  const values = await Promise.all(SETTINGS_KEYS.map(k => getConfig(k)))
  const result = Object.fromEntries(SETTINGS_KEYS.map((k, i) => [k, values[i]])) as Record<SettingsKey, string>
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Record<SettingsKey, string>>

    const saves: Promise<void>[] = []
    for (const key of SETTINGS_KEYS) {
      if (key in body && body[key] !== null && body[key] !== undefined) {
        saves.push(setConfig(key, String(body[key])))
      }
    }
    await Promise.all(saves)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
