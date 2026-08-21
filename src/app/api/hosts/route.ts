import { NextResponse } from 'next/server'
import { configuredHosts, describeHost } from '@/lib/atproto/hosts'
import { directory, search } from '@/lib/atproto/relay'
import { hasKnownName } from '@/lib/atproto/registry'
import type { PdsHost } from '@/lib/migration/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FEATURED_LIMIT = 6
const DIRECTORY_LIMIT = 40

/**
 * Serves the host picker.
 *
 * Three modes, because the directory is far too large to probe or to ship whole:
 *   (no params)   featured hosts (probed) + the head of the directory
 *   ?q=…          search the full directory, server side
 *   ?probe=host   verify one host, on selection
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams

  const probeTarget = params.get('probe')?.trim()
  if (probeTarget) {
    const described = await describeHost({ label: probeTarget, host: probeTarget })
    return NextResponse.json({ host: described })
  }

  let entries: Awaited<ReturnType<typeof directory>>['entries'] = []
  let relayError: string | undefined
  try {
    entries = (await directory()).entries
  } catch (err) {
    // The wizard still works off pinned hosts and typed hostnames without the relay.
    relayError = err instanceof Error ? err.message : 'directory unavailable'
  }

  const query = params.get('q')
  if (query !== null) {
    return NextResponse.json({ directory: search(entries, query, DIRECTORY_LIMIT), relayError })
  }

  const pinned = configuredHosts()
  const pinnedHosts = new Set(pinned.map((h) => h.host.toLowerCase()))

  // Featured = this deployment's own server, then the biggest hosts that have a
  // name people would recognise. Only these get probed on page load.
  const named = entries
    .filter((e) => hasKnownName(e.host) && !pinnedHosts.has(e.host.toLowerCase()))
    .slice(0, FEATURED_LIMIT - pinned.length)

  const featured: PdsHost[] = await Promise.all(
    [...pinned, ...named.map((e) => ({ label: e.label, host: e.host }))].map(describeHost),
  )

  const accountsByHost = new Map(entries.map((e) => [e.host, e.accountCount]))
  const withCounts = featured.map((h) => ({ ...h, accountCount: accountsByHost.get(h.host) }))

  return NextResponse.json({
    featured: withCounts,
    directory: search(entries, '', DIRECTORY_LIMIT),
    totalHosts: entries.length,
    relayError,
  })
}
