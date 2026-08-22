import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isBlueskyShard, isBridge, isEphemeral, isListable, labelFor } from './registry.ts'

test('Bluesky shards are recognised but never listed', () => {
  // A Bluesky account's DID document points at a shard, so these hostnames turn
  // up from handle resolution even though nobody can sign up on one.
  assert.equal(isBlueskyShard('morel.us-east.host.bsky.network'), true)
  assert.equal(isBlueskyShard('bsky.social'), false)
  assert.equal(isListable('morel.us-east.host.bsky.network'), false)
  assert.equal(isListable('bsky.social'), true)
})

test('a shard still reads as Bluesky', () => {
  assert.equal(labelFor('morel.us-east.host.bsky.network'), 'Bluesky')
  assert.equal(labelFor('lepista.us-west.host.bsky.network'), 'Bluesky')
})

test('known networks get their product name, everyone else their hostname', () => {
  assert.equal(labelFor('pds.wsocial.network'), 'W')
  assert.equal(labelFor('eurosky.social'), 'EuroSky')
  assert.equal(labelFor('blacksky.app'), 'Blacksky')
  // A self-hosted server is honestly labelled rather than guessed at.
  assert.equal(labelFor('pds.robocracy.org'), 'pds.robocracy.org')
})

test('community PDS products keep their public names in the directory', () => {
  // Wafrn: federated social network (open source, official mobile app) whose AT Proto
  // entry point lives at at.app.wafrn.net — 1.7k accounts seen by the relay, active.
  assert.equal(labelFor('at.app.wafrn.net'), 'Wafrn')
  // Gems: consumer app with its own PDS at gems.xyz — 7.2k accounts, active.
  assert.equal(labelFor('gems.xyz'), 'Gems')
})

test('bridges and throwaway deploys stay out of the directory', () => {
  assert.equal(isBridge('atproto.brid.gy'), true)
  assert.equal(isListable('atproto.brid.gy'), false)
  assert.equal(isBridge('bsky.brid.gy'), true)
  assert.equal(isListable('bsky.brid.gy'), false)
  assert.equal(isEphemeral('certified-apppds-core-pr-base.up.railway.app'), true)
  assert.equal(isEphemeral('app.fly.dev'), true)
  assert.equal(isEphemeral('abc.ngrok-free.app'), true)
  assert.equal(isEphemeral('machine.tail.ts.net'), true)
  assert.equal(isEphemeral('pds.example.com'), false)
  assert.equal(isListable('pds.example.com'), true)
  assert.equal(isListable('eurosky.social'), true)
  assert.equal(isListable('bsky.social'), true)
})
