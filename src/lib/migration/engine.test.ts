import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MigrationRun } from './engine.ts'
import { createRun, dropRun, getRun } from './store.ts'
import type { StartRunInput } from './types.ts'

const SECRET = 'super-secret-password-not-for-logs'

function input(from = 'old.example', to = 'new.example'): StartRunInput {
  return {
    direction: {
      from: { label: 'Old', host: from },
      to: { label: 'New', host: to },
    },
    source: { identifier: 'alice.old.example', password: SECRET },
  }
}

test('snapshot never contains the account password', () => {
  const run = new MigrationRun('run-1', input())
  const snap = run.snapshot()
  assert.equal(snap.status, 'idle')
  assert.equal(snap.safeToAbandon, true)
  assert.equal(JSON.stringify(snap).includes(SECRET), false)
  assert.equal(JSON.stringify(snap).includes('password'), false)
})

test('enumerable fields on the run instance do not include the password', () => {
  const run = new MigrationRun('run-2', input())
  assert.equal(Object.hasOwn(run, 'input'), false)
  assert.equal(Object.hasOwn(run, '#input'), false)
  const json = JSON.stringify(run, (_k, v) => {
    if (v && typeof v === 'object' && v.constructor?.name === 'AtpAgent') return '[agent]'
    return v
  })
  assert.equal(json.includes(SECRET), false)
  run.forgetCredentials()
  const after = JSON.stringify(run, (_k, v) => {
    if (v && typeof v === 'object' && v.constructor?.name === 'AtpAgent') return '[agent]'
    return v
  })
  assert.equal(after.includes(SECRET), false)
})

test('the same source and destination fails in preflight without touching the network', async () => {
  const run = new MigrationRun('run-3', input('same.example', 'same.example'))
  const view = await run.run()
  assert.equal(view.status, 'failed')
  assert.equal(view.steps[0]?.id, 'preflight')
  assert.equal(view.steps[0]?.status, 'failed')
  assert.match(view.steps[0]?.error ?? '', /same/)
  assert.equal(JSON.stringify(view).includes(SECRET), false)
})

test('cancel before run marks the view canceled and run() does not start', async () => {
  const run = new MigrationRun('run-4', input())
  run.cancel()
  assert.equal(run.snapshot().status, 'canceled')
  const view = await run.run()
  assert.equal(view.status, 'canceled')
  assert.equal(view.steps.every((s) => s.status === 'pending'), true)
})

test('subscribe receives a snapshot and unsubscribe stops further emits', () => {
  const run = new MigrationRun('run-5', input())
  const seen: string[] = []
  const stop = run.subscribe((v) => seen.push(v.status))
  assert.equal(seen[0], 'idle')
  stop()
  run.forgetCredentials()
  assert.equal(seen.length, 1)
})

test('store create/get/drop and credentials are forgotten on drop', () => {
  const run = createRun(input())
  assert.ok(getRun(run.id))
  assert.equal(JSON.stringify(run.snapshot()).includes(SECRET), false)
  dropRun(run.id)
  assert.equal(getRun(run.id), undefined)
})
