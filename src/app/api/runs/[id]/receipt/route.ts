import { NextResponse } from 'next/server'
import { getRun } from '@/lib/migration/store'
import { buildReceipt } from '@/lib/migration/receipt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = getRun(id)
  if (!run) return NextResponse.json({ error: 'That migration is no longer in progress.' }, { status: 404 })

  const receipt = buildReceipt(run, run.targetHandle)
  return new NextResponse(JSON.stringify(receipt, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="migration-${id.slice(0, 8)}.json"`,
    },
  })
}
