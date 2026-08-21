import { NextResponse } from 'next/server'
import { getRun } from '@/lib/migration/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = getRun(id)
  if (!run) return NextResponse.json({ error: 'That migration is no longer in progress.' }, { status: 404 })
  run.cancel()
  run.forgetCredentials()
  return NextResponse.json({ run: run.snapshot() })
}
