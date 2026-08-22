import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MigrationRun } from './engine.ts'
import { buildReceipt } from './receipt.ts'

test('buildReceipt seeds the reverse direction and never includes the password', () => {
  const run = new MigrationRun('recv-1', {
    direction: {
      from: { label: 'Old', host: 'old.example' },
      to: { label: 'New', host: 'new.example' },
    },
    source: { identifier: 'alice.old.example', password: 'not-in-receipt' },
  })
  const receipt = buildReceipt(run, 'alice.new.example')
  assert.equal(receipt.kind, 'wsocial.migration.receipt')
  assert.equal(receipt.version, 1)
  assert.equal(receipt.runId, 'recv-1')
  assert.equal(receipt.reverse.from.host, 'new.example')
  assert.equal(receipt.reverse.to.host, 'old.example')
  assert.equal(receipt.moved.preferences, 'not reached')
  assert.equal(JSON.stringify(receipt).includes('not-in-receipt'), false)
})
