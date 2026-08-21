import { NextResponse } from 'next/server'
import { configuredHosts, describeHost } from '@/lib/atproto/hosts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Probe every offered host so the picker can only ever show real, working PDSes. */
export async function GET() {
  const hosts = await Promise.all(configuredHosts().map(describeHost))
  return NextResponse.json({ hosts })
}
