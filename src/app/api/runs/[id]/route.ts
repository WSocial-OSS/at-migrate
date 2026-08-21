import { NextResponse } from 'next/server'
import { dropRun, getRun } from '@/lib/migration/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = getRun(id)
  if (!run) return NextResponse.json({ error: 'That migration is no longer in progress.' }, { status: 404 })
  return NextResponse.json({ run: run.snapshot() })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  dropRun(id)
  return NextResponse.json({ ok: true })
}
