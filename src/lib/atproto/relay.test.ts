import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assembleDirectory,
  FALLBACK_RELAY,
  listHostsFromRelay,
  resetDirectoryCache,
  search,
  setDirectoryFetch,
  type FetchLike,
} from './relay.ts'

test('assembleDirectory drops shards, bridges and throwaways and credits Bluesky', () => {
  const { entries, blueskyAccounts } = assembleDirectory([
    { hostname: 'morel.us-east.host.bsky.network', accountCount: 10_000_000, status: 'active' },
    { hostname: 'lepista.us-west.host.bsky.network', accountCount: 12_800_000, status: 'active' },
    { hostname: 'atproto.brid.gy', accountCount: 4_000_000, status: 'active' },
    { hostname: 'preview.up.railway.app', accountCount: 3, status: 'active' },
    { hostname: 'eurosky.social', accountCount: 50_000, status: 'active' },
    { hostname: 'idle.example', accountCount: 9, status: 'idle' },
    { hostname: 'pds.wsocial.network', accountCount: 27_000, status: 'active' },
  ])

  assert.equal(blueskyAccounts, 22_800_000)
  const hosts = entries.map((e) => e.host)
  assert.ok(hosts.includes('bsky.social'))
  assert.ok(hosts.includes('eurosky.social'))
  assert.ok(hosts.includes('pds.wsocial.network'))
  assert.ok(!hosts.includes('atproto.brid.gy'))
  assert.ok(!hosts.includes('morel.us-east.host.bsky.network'))
  assert.ok(!hosts.includes('preview.up.railway.app'))
  assert.ok(!hosts.includes('idle.example'))
  assert.equal(entries[0]?.host, 'bsky.social')
  assert.equal(entries.find((e) => e.host === 'bsky.social')?.accountCount, 22_800_000)
  assert.equal(entries.find((e) => e.host === 'pds.wsocial.network')?.named, true)
  assert.equal(entries.find((e) => e.host === 'eurosky.social')?.label, 'EuroSky')
})

test('search is case-insensitive, named-first, and empty query is a prefix of the list', () => {
  const entries = [
    { label: 'tiny', host: 'tiny.example', accountCount: 1, named: false },
    { label: 'W', host: 'pds.wsocial.network', accountCount: 10, named: true },
    { label: 'EuroSky', host: 'eurosky.social', accountCount: 5, named: true },
  ]
  assert.equal(search(entries, '', 2).length, 2)
  assert.equal(search(entries, '  WSOCIAL  ', 10)[0]?.host, 'pds.wsocial.network')
  assert.equal(search(entries, 'euro', 10)[0]?.label, 'EuroSky')
  const named = search(entries, 'example', 10)
  assert.equal(named.length, 1)
})

test('listHostsFromRelay pages until the cursor runs out', async () => {
  const calls: string[] = []
  const fetchFn: FetchLike = async (input) => {
    const url = String(input)
    calls.push(url)
    if (!url.includes('cursor=')) {
      return Response.json({
        hosts: [{ hostname: 'one.example', accountCount: 1, status: 'active' }],
        cursor: 'page2',
      })
    }
    return Response.json({
      hosts: [{ hostname: 'two.example', accountCount: 2, status: 'active' }],
    })
  }
  const hosts = await listHostsFromRelay('relay.example', fetchFn)
  assert.equal(hosts.length, 2)
  assert.equal(calls.length, 2)
  assert.ok(calls[1]?.includes('cursor=page2'))
})

test('listHostsFromRelay throws on a non-OK relay', async () => {
  const fetchFn: FetchLike = async () => new Response('nope', { status: 502 })
  await assert.rejects(() => listHostsFromRelay('down.example', fetchFn), /returned 502/)
})

test('directory falls back to the east relay when the primary fails and there is no cache', async () => {
  resetDirectoryCache()
  const seen: string[] = []
  const fetchFn: FetchLike = async (input) => {
    const url = String(input)
    seen.push(url)
    if (url.includes(FALLBACK_RELAY)) {
      return Response.json({
        hosts: [{ hostname: 'eurosky.social', accountCount: 4, status: 'active' }],
      })
    }
    return new Response('down', { status: 503 })
  }
  setDirectoryFetch(fetchFn)
  const { directory } = await import('./relay.ts')
  try {
    const result = await directory()
    assert.ok(seen.some((u) => u.includes('relay1.us-west')))
    assert.ok(seen.some((u) => u.includes('relay1.us-east')))
    assert.ok(result.entries.some((e) => e.host === 'eurosky.social'))
  } finally {
    resetDirectoryCache()
    setDirectoryFetch(fetch)
  }
})
