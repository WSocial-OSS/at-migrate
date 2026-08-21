import { NextResponse } from 'next/server'
import { getRun } from '@/lib/migration/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pick a failed run back up from the first step that has not completed. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = getRun(id)
  if (!run) return NextResponse.json({ error: 'That migration is no longer in progress.' }, { status: 404 })
  if (run.snapshot().status === 'running') {
    return NextResponse.json({ error: 'It is already running.' }, { status: 409 })
  }
  void run.resume().catch(() => {})
  return NextResponse.json({ run: run.snapshot() })
}
