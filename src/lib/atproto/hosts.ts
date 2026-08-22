import { AtpAgent } from '@atproto/api'
import type { PdsHost } from '@/lib/migration/types'
import { serviceUrl } from './url'

export { serviceUrl }

/**
 * Hosts this deployment always offers, ahead of the live directory: its own
 * server first, then any operator-pinned extras. Everything else the network
 * runs comes from the relay directory.
 */
export function configuredHosts(): PdsHost[] {
  const wsocialHost = process.env.WSOCIAL_PDS_HOST?.trim()
  const hosts: PdsHost[] = []

  if (wsocialHost) {
    // The product is "W" in their own copy; WSocial is the company.
    hosts.push({ label: 'W', host: wsocialHost, home: true })
  }

  const euroskyHost = process.env.EUROSKY_PDS_HOST?.trim()
  if (euroskyHost) {
    hosts.push({ label: 'EuroSky', host: euroskyHost })
  }

  for (const entry of (process.env.EXTRA_PDS_HOSTS ?? '').split(',')) {
    const [label, host] = entry.split('|').map((s) => s?.trim())
    if (label && host) hosts.push({ label, host })
  }

  const seen = new Set<string>()
  return hosts.filter((h) => {
    const key = h.host.toLowerCase().replace(/^https?:\/\//, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

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
