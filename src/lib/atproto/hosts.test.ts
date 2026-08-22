import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configuredHosts } from './hosts.ts'

test('configuredHosts is empty without env', () => {
  const prevW = process.env.WSOCIAL_PDS_HOST
  const prevE = process.env.EUROSKY_PDS_HOST
  const prevX = process.env.EXTRA_PDS_HOSTS
  delete process.env.WSOCIAL_PDS_HOST
  delete process.env.EUROSKY_PDS_HOST
  delete process.env.EXTRA_PDS_HOSTS
  try {
    assert.deepEqual(configuredHosts(), [])
  } finally {
    if (prevW !== undefined) process.env.WSOCIAL_PDS_HOST = prevW
    else delete process.env.WSOCIAL_PDS_HOST
    if (prevE !== undefined) process.env.EUROSKY_PDS_HOST = prevE
    else delete process.env.EUROSKY_PDS_HOST
    if (prevX !== undefined) process.env.EXTRA_PDS_HOSTS = prevX
    else delete process.env.EXTRA_PDS_HOSTS
  }
})

test('configuredHosts pins W, EuroSky and extras, dropping duplicates', () => {
  const prevW = process.env.WSOCIAL_PDS_HOST
  const prevE = process.env.EUROSKY_PDS_HOST
  const prevX = process.env.EXTRA_PDS_HOSTS
  process.env.WSOCIAL_PDS_HOST = 'pds.wsocial.network'
  process.env.EUROSKY_PDS_HOST = 'eurosky.social'
  process.env.EXTRA_PDS_HOSTS = 'Spark|pds.sprk.so,W|pds.wsocial.network,BadOnlyLabel|'
  try {
    const hosts = configuredHosts()
    assert.equal(hosts[0]?.label, 'W')
    assert.equal(hosts[0]?.home, true)
    assert.equal(hosts[1]?.label, 'EuroSky')
    assert.equal(hosts.some((h) => h.host === 'pds.sprk.so'), true)
    assert.equal(hosts.filter((h) => h.host === 'pds.wsocial.network').length, 1)
    assert.equal(hosts.some((h) => h.label === 'BadOnlyLabel'), false)
  } finally {
    if (prevW !== undefined) process.env.WSOCIAL_PDS_HOST = prevW
    else delete process.env.WSOCIAL_PDS_HOST
    if (prevE !== undefined) process.env.EUROSKY_PDS_HOST = prevE
    else delete process.env.EUROSKY_PDS_HOST
    if (prevX !== undefined) process.env.EXTRA_PDS_HOSTS = prevX
    else delete process.env.EXTRA_PDS_HOSTS
  }
})
