import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POST } from './route.ts'

test('POST /api/runs rejects a non-JSON body', async () => {
  const res = await POST(new Request('http://localhost/api/runs', { method: 'POST', body: 'nope' }))
  assert.equal(res.status, 400)
  const body = (await res.json()) as { error: string }
  assert.match(body.error, /JSON/)
})

test('POST /api/runs requires both hosts, a handle and a password', async () => {
  const res = await POST(
    new Request('http://localhost/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: { host: 'old.example' } }),
    }),
  )
  assert.equal(res.status, 400)
  const body = (await res.json()) as { error: string }
  assert.match(body.error, /destination/)
})

test('POST /api/runs requires the current handle', async () => {
  const res = await POST(
    new Request('http://localhost/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        from: { host: 'old.example', label: 'Old' },
        to: { host: 'new.example', label: 'New' },
        password: 'x',
      }),
    }),
  )
  assert.equal(res.status, 400)
  const body = (await res.json()) as { error: string }
  assert.match(body.error, /handle/)
})
