import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET } from './route.ts'

test('health reports whether the W PDS host is configured', async () => {
  const prev = process.env.WSOCIAL_PDS_HOST
  process.env.WSOCIAL_PDS_HOST = 'pds.wsocial.network'
  try {
    const res = await GET()
    assert.equal(res.status, 200)
    const body = (await res.json()) as {
      ok: boolean
      service: string
      wsocialPds: { configured: boolean; host: string | null }
    }
    assert.equal(body.ok, true)
    assert.equal(body.service, 'at-migrate')
    assert.equal(body.wsocialPds.configured, true)
    assert.equal(body.wsocialPds.host, 'pds.wsocial.network')
  } finally {
    if (prev === undefined) delete process.env.WSOCIAL_PDS_HOST
    else process.env.WSOCIAL_PDS_HOST = prev
  }
})

test('health stays 200 when the W PDS host is missing, and says so', async () => {
  const prev = process.env.WSOCIAL_PDS_HOST
  delete process.env.WSOCIAL_PDS_HOST
  try {
    const res = await GET()
    assert.equal(res.status, 200)
    const body = (await res.json()) as { wsocialPds: { configured: boolean; host: string | null } }
    assert.equal(body.wsocialPds.configured, false)
    assert.equal(body.wsocialPds.host, null)
  } finally {
    if (prev !== undefined) process.env.WSOCIAL_PDS_HOST = prev
  }
})
