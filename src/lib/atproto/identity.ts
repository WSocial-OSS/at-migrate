import { IdResolver } from '@atproto/identity'

const resolver = new IdResolver()

export type ResolvedIdentity = {
  did: string
  handle?: string
  didMethod: 'plc' | 'web' | 'other'
  /** PDS endpoint recorded in the DID document, if any. */
  pdsUrl?: string
  /** Handles the DID document claims (at:// aka values). */
  alsoKnownAs: string[]
}

export function didMethodOf(did: string): 'plc' | 'web' | 'other' {
  if (did.startsWith('did:plc:')) return 'plc'
  if (did.startsWith('did:web:')) return 'web'
  return 'other'
}

/** Resolve a handle or DID to its DID document facts, straight from the network. */
export async function resolveIdentity(identifier: string): Promise<ResolvedIdentity> {
  const did = identifier.startsWith('did:')
    ? identifier
    : await resolver.handle.resolve(identifier.replace(/^@/, ''))

  if (!did) throw new Error(`Could not resolve "${identifier}" to a DID`)

  const doc = await resolver.did.resolve(did)
  if (!doc) throw new Error(`Could not resolve DID document for ${did}`)

  const services = Array.isArray(doc.service) ? doc.service : doc.service ? [doc.service] : []
  const pds = services.find(
    (s) => typeof s === 'object' && s !== null && (s as { type?: string }).type === 'AtprotoPersonalDataServer',
  ) as { serviceEndpoint?: string } | undefined

  const aka = (doc.alsoKnownAs ?? []).filter((v): v is string => typeof v === 'string')

  return {
    did,
    handle: aka[0]?.replace(/^at:\/\//, ''),
    didMethod: didMethodOf(did),
    pdsUrl: typeof pds?.serviceEndpoint === 'string' ? pds.serviceEndpoint : undefined,
    alsoKnownAs: aka,
  }
}
