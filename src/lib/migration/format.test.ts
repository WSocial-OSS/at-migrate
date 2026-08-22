import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatBytes } from './format.ts'

test('formatBytes keeps repository sizes readable', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1023), '1023 B')
  assert.equal(formatBytes(1024), '1.0 KB')
  assert.equal(formatBytes(2048), '2.0 KB')
  assert.equal(formatBytes(15 * 1024), '15 KB')
  assert.equal(formatBytes(3.5 * 1024 * 1024), '3.5 MB')
  assert.equal(formatBytes(2 * 1024 ** 3), '2.0 GB')
  assert.equal(formatBytes(1024 ** 4), '1.0 TB')
})

test('formatBytes rejects non-finite and negative counts', () => {
  assert.throws(() => formatBytes(-1), RangeError)
  assert.throws(() => formatBytes(Number.NaN), RangeError)
  assert.throws(() => formatBytes(Number.POSITIVE_INFINITY), RangeError)
})

test('formatBytes beyond the terabyte tier keeps scaling in TB', () => {
  assert.equal(formatBytes(1.5 * 1024 ** 4), '1.5 TB')
  assert.equal(formatBytes(3 * 1024 ** 4), '3.0 TB')
})
