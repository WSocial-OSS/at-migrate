import { NextResponse } from 'next/server'
import { createRun } from '@/lib/migration/store'
import { describeHost } from '@/lib/atproto/hosts'
import type { PdsHost, StartRunInput } from '@/lib/migration/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  from?: Partial<PdsHost>
  to?: Partial<PdsHost>
  identifier?: string
  password?: string
  keepSourceActive?: boolean
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const from = asHost(body.from)
  const to = asHost(body.to)
  if (!from || !to) return NextResponse.json({ error: 'Both a source and a destination server are required.' }, { status: 400 })
  if (!body.identifier?.trim()) return NextResponse.json({ error: 'Your current handle is required.' }, { status: 400 })
  if (!body.password) return NextResponse.json({ error: 'Your current account password is required.' }, { status: 400 })

  // Resolve the destination's DID up front; the createAccount handoff is signed
  // for it, and an unreachable destination is worth saying before we try to sign
  // the user in anywhere.
  const described = await describeHost(to)
  if (!described.reachable || !described.did) {
    return NextResponse.json(
      {
        error: `${to.label} (${to.host}) did not answer as an atproto server${
          described.unreachableReason ? `: ${described.unreachableReason}` : '.'
        }`,
      },
      { status: 502 },
    )
  }

  const input: StartRunInput = {
    direction: { from, to: described },
    source: { identifier: body.identifier.trim(), password: body.password },
    keepSourceActive: body.keepSourceActive ?? false,
  }

  const run = createRun(input)
  // Fire and forget: progress is observed over the SSE stream, and a failure is
  // recorded on the run itself rather than thrown at this request.
  void run.run().catch(() => {})

  return NextResponse.json({ id: run.id, run: run.snapshot() }, { status: 201 })
}

function asHost(h: Partial<PdsHost> | undefined): PdsHost | undefined {
  if (!h?.host?.trim()) return undefined
  return { label: h.label?.trim() || h.host.trim(), host: h.host.trim(), home: h.home }
}
