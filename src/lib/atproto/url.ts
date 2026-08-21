/** Host and URL handling, kept dependency-free so it can be unit tested directly. */

export function serviceUrl(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, '')
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  // Localhost PDS instances are the only ones expected to be plaintext.
  const scheme = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(trimmed) ? 'http' : 'https'
  return `${scheme}://${trimmed}`
}

/** Reduce a hostname or a full service URL to a comparable host. */
export function normalizeHost(hostOrUrl: string): string {
  const withScheme = /^https?:\/\//.test(hostOrUrl) ? hostOrUrl : `https://${hostOrUrl}`
  try {
    return new URL(withScheme).host.toLowerCase()
  } catch {
    return hostOrUrl.trim().toLowerCase()
  }
}
