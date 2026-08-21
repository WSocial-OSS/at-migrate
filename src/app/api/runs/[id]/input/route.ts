import { NextResponse } from 'next/server'
import { getRun } from '@/lib/migration/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Answer whatever the run is blocked on: a 2FA code, destination details, a PLC token. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = getRun(id)
  if (!run) return NextResponse.json({ error: 'That migration is no longer in progress.' }, { status: 404 })

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const strings: Record<string, string> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === 'string') strings[k] = v
  }

  if (!run.provideUserInput(strings)) {
    return NextResponse.json({ error: 'This migration is not waiting for anything right now.' }, { status: 409 })
  }
  return NextResponse.json({ run: run.snapshot() })
}
