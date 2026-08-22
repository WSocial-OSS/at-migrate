import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeHost, serviceUrl } from './url.ts'

test('serviceUrl assumes https for real hosts', () => {
  assert.equal(serviceUrl('bsky.social'), 'https://bsky.social')
  assert.equal(serviceUrl('  eurosky.social/  '), 'https://eurosky.social')
  assert.equal(serviceUrl('https://pds.example.com'), 'https://pds.example.com')
})

test('serviceUrl allows plaintext only for localhost', () => {
  assert.equal(serviceUrl('localhost:2583'), 'http://localhost:2583')
  assert.equal(serviceUrl('127.0.0.1:3000'), 'http://127.0.0.1:3000')
  assert.equal(serviceUrl('notlocalhost.dev'), 'https://notlocalhost.dev')
})

test('normalizeHost makes hosts and service URLs comparable', () => {
  // This is what stops a run from "migrating" an account to the server it is already on.
  assert.equal(normalizeHost('https://BSKY.social/xrpc'), normalizeHost('bsky.social'))
  assert.equal(normalizeHost('https://pds.example.com:443'), 'pds.example.com')
  assert.notEqual(normalizeHost('eurosky.social'), normalizeHost('bsky.social'))
})

test('serviceUrl strips trailing slashes and keeps an explicit https URL', () => {
  assert.equal(serviceUrl('https://pds.example.com/'), 'https://pds.example.com')
  assert.equal(serviceUrl('http://127.0.0.1:2583'), 'http://127.0.0.1:2583')
})
