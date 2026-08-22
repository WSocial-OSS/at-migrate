import assert from 'node:assert/strict'
import { test } from 'node:test'
import { didMethodOf, resolveIdentity } from './identity.ts'

test('didMethodOf classifies plc, web and everything else', () => {
  assert.equal(didMethodOf('did:plc:z72i7hdynmk6r22z27h6tvur'), 'plc')
  assert.equal(didMethodOf('did:web:eurosky.social'), 'web')
  assert.equal(didMethodOf('did:key:z6Mk'), 'other')
})

test('resolveIdentity throws when the identifier cannot be resolved', async () => {
  await assert.rejects(
    () => resolveIdentity('this-handle-does-not-exist-on-any-pds.invalid'),
    /Could not resolve/,
  )
})

const live = process.env.LIVE === '1'

test('resolveIdentity of bsky.app returns a plc DID and a PDS URL', { skip: !live }, async () => {
  const id = await resolveIdentity('bsky.app')
  assert.equal(id.didMethod, 'plc')
  assert.match(id.did, /^did:plc:/)
  assert.ok(id.pdsUrl)
  assert.ok(id.pdsUrl.startsWith('https://'))
})
