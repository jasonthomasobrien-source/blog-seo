export const maxDuration = 60

import { NextRequest } from 'next/server'
import { suggestTopics } from '@/lib/tools/suggest-topics'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const count = (body as { count?: number }).count || 6

  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: string) => {
        try {
          controller.enqueue(new TextEncoder().encode(`data: ${line}\n\n`))
        } catch {
          // Controller may already be closed
        }
      }

      try {
        const result = await suggestTopics(count, send)
        send(`__RESULT__${JSON.stringify(result)}`)
        controller.enqueue(new TextEncoder().encode('data: __EXIT__0\n\n'))
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        try {
          send(`ERROR: ${msg}`)
          controller.enqueue(new TextEncoder().encode('data: __EXIT__1\n\n'))
        } catch {
          // ignore
        }
      }

      try {
        controller.close()
      } catch {
        // ignore if already closed
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
