import assert from 'node:assert/strict'
import { test } from 'node:test'
import { copy } from './copy.ts'

test('copy interpolates host labels without dropping them', () => {
  assert.match(copy.setup.signIn('EuroSky'), /EuroSky/)
  assert.match(copy.setup.alreadyThere('W'), /W/)
  assert.match(copy.direction.swap('W', 'Bluesky'), /W/)
  assert.match(copy.direction.search(1770), /1,770/)
  assert.match(copy.blocker.plcFooter('W'), /W/)
  assert.match(copy.outcome.canceledSafe('Bluesky'), /Bluesky/)
})
