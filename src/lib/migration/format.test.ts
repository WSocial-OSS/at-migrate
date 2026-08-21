import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatBytes } from './format.ts'

test('formatBytes keeps repository sizes readable', () => {
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(2048), '2.0 KB')
  assert.equal(formatBytes(15 * 1024), '15 KB')
  assert.equal(formatBytes(3.5 * 1024 * 1024), '3.5 MB')
  assert.equal(formatBytes(2 * 1024 ** 3), '2.0 GB')
})
