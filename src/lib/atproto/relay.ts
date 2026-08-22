import { isBlueskyShard, isListable, labelFor } from './registry'

/**
 * The live directory of atproto hosts, read from a relay.
 *
 * A relay has to know every PDS it indexes, which makes
 * `com.atproto.sync.listHosts` the closest thing the network has to a census —
 * far better than a list maintained by hand, which would be stale the week
 * after it was written. Roughly 1,800 independent servers show up here.
 */

export const DEFAULT_RELAY = 'relay1.us-west.bsky.network'
export const FALLBACK_RELAY = 'relay1.us-east.bsky.network'
const PAGE = 1000
const MAX_PAGES = 20
const TTL_MS = 30 * 60 * 1000
/** Bluesky's signup host, as opposed to the shards its users actually sit on. */
const BLUESKY_HOST = 'bsky.social'

export type DirectoryEntry = {
  label: string
  host: string
  /** Accounts the relay has seen on this host. Its only real popularity signal. */
  accountCount: number
  /** True when the host has a recognised product name rather than just a hostname. */
  named: boolean
}

export type RelayHost = { hostname: string; accountCount?: number; status?: string }

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

let cache: { at: number; entries: DirectoryEntry[]; blueskyAccounts: number } | null = null
let inFlight: Promise<void> | null = null
let fetchImpl: FetchLike = fetch

export function setDirectoryFetch(fn: FetchLike) {
  fetchImpl = fn
}

export function resetDirectoryCache() {
  cache = null
  inFlight = null
}

export function primaryRelay(): string {
  return process.env.ATPROTO_RELAY_HOST?.trim() || DEFAULT_RELAY
}

export function fallbackRelay(): string {
  return process.env.ATPROTO_RELAY_FALLBACK?.trim() || FALLBACK_RELAY
}

/** Page through `com.atproto.sync.listHosts` on one relay. */
export async function listHostsFromRelay(relay: string, fetchFn: FetchLike = fetchImpl): Promise<RelayHost[]> {
  const hosts: RelayHost[] = []
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`https://${relay}/xrpc/com.atproto.sync.listHosts`)
    url.searchParams.set('limit', String(PAGE))
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetchFn(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`relay ${relay} returned ${res.status}`)
    const data = (await res.json()) as { hosts?: RelayHost[]; cursor?: string }
    hosts.push(...(data.hosts ?? []))
    cursor = data.cursor
    if (!cursor) break
  }
  return hosts
}

/**
 * Turn a raw relay census into the picker directory: drop bridges, shards and
 * throwaways; credit Bluesky's shards back to `bsky.social`; sort by size.
 */
export function assembleDirectory(hosts: RelayHost[]): { entries: DirectoryEntry[]; blueskyAccounts: number } {
  const active = hosts.filter((h) => h.status === 'active')
  const seen = new Set<string>()
  const entries: DirectoryEntry[] = []

  for (const h of active) {
    if (seen.has(h.hostname) || !isListable(h.hostname)) continue
    seen.add(h.hostname)
    entries.push({
      label: labelFor(h.hostname),
      host: h.hostname,
      accountCount: h.accountCount ?? 0,
      named: labelFor(h.hostname) !== h.hostname,
    })
  }

  const blueskyAccounts = active
    .filter((h) => isBlueskyShard(h.hostname))
    .reduce((sum, h) => sum + (h.accountCount ?? 0), 0)

  if (blueskyAccounts > 0 && !seen.has(BLUESKY_HOST)) {
    entries.push({
      label: labelFor(BLUESKY_HOST),
      host: BLUESKY_HOST,
      accountCount: blueskyAccounts,
      named: true,
    })
  }

  entries.sort((a, b) => b.accountCount - a.accountCount)
  return { entries, blueskyAccounts }
}

async function fetchAll(): Promise<void> {
  const primary = primaryRelay()
  const fallback = fallbackRelay()
  const hosts = await listHostsFromRelay(primary).catch((err: unknown) => {
    if (primary === fallback) throw err
    return listHostsFromRelay(fallback)
  })
  const assembled = assembleDirectory(hosts)
  cache = { at: Date.now(), ...assembled }
}

/** Cached directory. Refreshes on a TTL; a failed refresh keeps serving stale data. */
export async function directory(): Promise<{ entries: DirectoryEntry[]; blueskyAccounts: number }> {
  const fresh = cache && Date.now() - cache.at < TTL_MS
  if (!fresh) {
    // Collapse concurrent misses onto one relay fetch.
    inFlight ??= fetchAll().finally(() => {
      inFlight = null
    })
    try {
      await inFlight
    } catch (err) {
      if (!cache) throw err
      console.warn(`[relay] refresh failed, serving cached directory: ${(err as Error).message}`)
    }
  }
  return { entries: cache?.entries ?? [], blueskyAccounts: cache?.blueskyAccounts ?? 0 }
}

/** Substring search across the whole directory, best-known and biggest first. */
export function search(entries: DirectoryEntry[], query: string, limit: number): DirectoryEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries.slice(0, limit)
  return entries
    .filter((e) => e.host.toLowerCase().includes(q) || e.label.toLowerCase().includes(q))
    .sort((a, b) => Number(b.named) - Number(a.named) || b.accountCount - a.accountCount)
    .slice(0, limit)
}
