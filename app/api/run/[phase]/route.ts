export const maxDuration = 300

import { NextRequest } from 'next/server'
import { runResearch } from '@/lib/tools/research'
import { generateDraft, autoFixDraft } from '@/lib/tools/generate-draft'
import { generateImage } from '@/lib/tools/generate-image'
import { runSeoCheck } from '@/lib/tools/seo-check'
import { runSpellcheck } from '@/lib/tools/spellcheck'
import { runVoiceCheck, runVoiceChecks } from '@/lib/tools/voice-check'
import { sendToGhl } from '@/lib/tools/send-ghl'
import { getConfig, readFile } from '@/lib/storage'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ phase: string }> }
) {
  const { phase } = await params

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
        let result: { success: boolean; error?: string }

        if (phase === 'research') {
          // Get topic from config for context
          const topic = await getConfig('topic').catch(() => '')
          result = await runResearch('Kalamazoo', topic, send)

        } else if (phase === 'write_draft') {
          result = await generateDraft(send)

          if (result.success) {
            // ── Auto voice check + fix ────────────────────────────
            send('▶ Running voice check…')
            const draftText = await readFile('draft.md')
            const flags = runVoiceChecks(draftText)
            if (flags.length === 0) {
              send('✓ Voice check passed.')
            } else {
              send(`⚠ Voice check: ${flags.length} issue(s) found — auto-fixing…`)
              const descriptions = flags.map(f =>
                f.phrase
                  ? `Banned phrase "${f.phrase}" found: ${f.context || ''}`
                  : f.message || f.type
              )
              await autoFixDraft(descriptions, send)
              // Re-check after fix
              const fixedText = await readFile('draft.md')
              const remaining = runVoiceChecks(fixedText)
              if (remaining.length === 0) {
                send('✓ Voice check passed after auto-fix.')
              } else {
                send(`⚠ ${remaining.length} voice issue(s) remain — review the draft manually if needed.`)
              }
            }

            // ── Auto spell check ──────────────────────────────────
            send('▶ Running spell check…')
            await runSpellcheck(send)
          }

        } else if (phase === 'image') {
          result = await generateImage(send)

        } else if (phase === 'seo_check') {
          const seoResult = await runSeoCheck(send)
          result = { success: seoResult.success, error: seoResult.error }

        } else if (phase === 'publish') {
          result = await sendToGhl(send)

        } else if (phase === 'spellcheck') {
          result = await runSpellcheck(send)

        } else if (phase === 'voice_check') {
          result = await runVoiceCheck(send)

        } else {
          send(`Unknown phase: ${phase}`)
          controller.enqueue(new TextEncoder().encode('data: __EXIT__1\n\n'))
          controller.close()
          return
        }

        if (!result.success && result.error) {
          send(`ERROR: ${result.error}`)
        }
        controller.enqueue(
          new TextEncoder().encode(`data: __EXIT__${result.success ? 0 : 1}\n\n`)
        )
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        try {
          controller.enqueue(new TextEncoder().encode(`data: ERROR: ${msg}\n\n`))
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
