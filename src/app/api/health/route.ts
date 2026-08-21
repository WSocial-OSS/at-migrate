import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Railway healthcheck target.
 *
 * It reports whether the destination PDS is configured because that is the one
 * setting a deploy can be missing while still serving pages perfectly — a green
 * deploy with `configured: false` is a broken staging environment.
 */
export async function GET() {
  const host = process.env.WSOCIAL_PDS_HOST?.trim()
  return NextResponse.json({
    ok: true,
    service: 'at-migrate',
    wsocialPds: { configured: !!host, host: host ?? null },
  })
}
