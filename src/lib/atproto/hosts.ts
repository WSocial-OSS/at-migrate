import { AtpAgent } from '@atproto/api'
import type { PdsHost } from '@/lib/migration/types'
import { serviceUrl } from './url'

export { serviceUrl }

/**
 * Hosts offered in the direction picker.
 *
 * These are starting points, not a source of truth: every host is probed with
 * com.atproto.server.describeServer before the wizard will use it, and the user
 * can type any hostname. A stale entry therefore degrades to "unreachable"
 * rather than to a broken migration.
 */
export function configuredHosts(): PdsHost[] {
  const wsocialHost = process.env.WSOCIAL_PDS_HOST?.trim()

  const hosts: PdsHost[] = [
    { label: 'Bluesky', host: 'bsky.social' },
    { label: 'EuroSky', host: process.env.EUROSKY_PDS_HOST?.trim() || 'eurosky.social' },
  ]

  if (wsocialHost) {
    // The product is "W" in their own copy; WSocial is the company.
    hosts.unshift({ label: 'W', host: wsocialHost, home: true })
  }

  for (const entry of (process.env.EXTRA_PDS_HOSTS ?? '').split(',')) {
    const [label, host] = entry.split('|').map((s) => s?.trim())
    if (label && host) hosts.push({ label, host })
  }

  // A host configured as WSocial may also be one of the defaults; the first
  // entry wins so the home server keeps its label.
  const seen = new Set<string>()
  return hosts.filter((h) => {
    const key = h.host.toLowerCase().replace(/^https?:\/\//, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Ask a host to describe itself. This doubles as the "is this actually a PDS?"
 * check and as the source of the signup requirements we need to show the user
 * (invite code, phone verification, which handle domains are on offer).
 */
export async function describeHost(host: PdsHost): Promise<PdsHost> {
  try {
    const agent = new AtpAgent({ service: serviceUrl(host.host) })
    const { data } = await agent.com.atproto.server.describeServer()
    return {
      ...host,
      did: data.did,
      inviteCodeRequired: data.inviteCodeRequired ?? false,
      phoneVerificationRequired: data.phoneVerificationRequired ?? false,
      availableUserDomains: data.availableUserDomains ?? [],
      reachable: true,
    }
  } catch (err) {
    return {
      ...host,
      reachable: false,
      unreachableReason: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
