import { NextResponse } from 'next/server'
import { resolveIdentity } from '@/lib/atproto/identity'
import { normalizeHost } from '@/lib/atproto/url'
import { labelFor } from '@/lib/atproto/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Find where an account actually lives, from its handle or DID.
 *
 * This is what lets every server on the network work as a source without being
 * in any list: the DID document names the PDS, so the user never has to know
 * which host their account is on — or whether we have heard of it.
 */
export async function GET(req: Request) {
  const identifier = new URL(req.url).searchParams.get('identifier')?.trim().replace(/^@/, '')
  if (!identifier) return NextResponse.json({ error: 'identifier is required' }, { status: 400 })

  try {
    const identity = await resolveIdentity(identifier)
    if (!identity.pdsUrl) {
      return NextResponse.json(
        { error: 'That account resolves, but its identity record names no server.' },
        { status: 422 },
      )
    }
    const host = normalizeHost(identity.pdsUrl)
    return NextResponse.json({
      did: identity.did,
      handle: identity.handle,
      didMethod: identity.didMethod,
      host,
      label: labelFor(host),
    })
  } catch {
    // Not found is the normal case while someone is still typing.
    return NextResponse.json({ error: `Could not find an account for "${identifier}".` }, { status: 404 })
  }
}
