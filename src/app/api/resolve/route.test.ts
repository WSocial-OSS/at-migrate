import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET } from './route.ts'

test('resolve requires an identifier', async () => {
  const res = await GET(new Request('http://localhost/api/resolve'))
  assert.equal(res.status, 400)
  const body = (await res.json()) as { error: string }
  assert.match(body.error, /identifier/)
})

test('resolve 404s an identifier that is not a handle or DID', async () => {
  const res = await GET(new Request('http://localhost/api/resolve?identifier=not-a-handle'))
  assert.equal(res.status, 404)
})

const live = process.env.LIVE === '1'

test('resolve finds the public bsky.app account', { skip: !live }, async () => {
  const res = await GET(new Request('http://localhost/api/resolve?identifier=bsky.app'))
  assert.equal(res.status, 200)
  const body = (await res.json()) as { did: string; host: string; didMethod: string }
  assert.match(body.did, /^did:plc:/)
  assert.equal(body.didMethod, 'plc')
  assert.ok(body.host.includes('bsky.network') || body.host.length > 0)
})
