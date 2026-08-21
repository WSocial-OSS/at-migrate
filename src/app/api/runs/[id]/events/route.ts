import { getRun } from '@/lib/migration/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Server-sent snapshots of the whole run. The client re-renders; it never diffs. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = getRun(id)
  if (!run) return new Response('event: gone\ndata: {}\n\n', { status: 404, headers: sseHeaders() })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      const unsubscribe = run.subscribe((view) => {
        send('run', view)
        if (view.status === 'done' || view.status === 'failed' || view.status === 'canceled') {
          // Let the final snapshot flush before hanging up.
          setTimeout(() => finish(), 50)
        }
      })

      // Proxies drop idle streams; a comment line is cheaper than a reconnect.
      const heartbeat = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'))
          } catch {
            finish()
          }
        }
      }, 15_000)

      const finish = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
  })

  return new Response(stream, { headers: sseHeaders() })
}

function sseHeaders() {
  return {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  }
}
