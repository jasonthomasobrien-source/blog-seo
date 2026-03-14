import { readFile } from '@/lib/storage'

export async function GET() {
  const content = await readFile('sources.md')
  return new Response(content || 'No research data yet. Run Step 1 to pull research.', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
