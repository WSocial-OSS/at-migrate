/**
 * Naming and classification for the atproto host directory.
 *
 * The directory itself is live (see relay.ts) — this file only holds the
 * judgements a machine cannot make: which hosts have a product name people
 * recognise, and which ones are not places you can move an account to.
 */

/** Hosts whose community or product has a name worth showing instead of a hostname. */
const KNOWN_NAMES: Record<string, string> = {
  'bsky.social': 'Bluesky',
  'pds.wsocial.network': 'W',
  'eurosky.social': 'EuroSky',
  'blacksky.app': 'Blacksky',
  'northsky.social': 'Northsky',
  'pds.sprk.so': 'Spark',
  'tngl.sh': 'Tangled',
  'roomy.chat': 'Roomy',
  'surf.social': 'Surf',
  'pds.witchcraft.systems': 'Witchcraft Systems',
  'selfhosted.social': 'Selfhosted.social',
  'zio.blue': 'Zio',
  'at.app.wafrn.net': 'Wafrn',
  'gems.xyz': 'Gems',
}

/**
 * Bluesky shards its users across internal hosts. They appear in the relay's
 * list and hold most of the network's accounts, but you cannot sign up on one —
 * bsky.social is the door. Collapsing them keeps "Bluesky" a single choice.
 */
export function isBlueskyShard(hostname: string): boolean {
  return hostname.endsWith('.host.bsky.network')
}

/**
 * Bridges federate other protocols in; they are not account homes, so offering
 * one as a migration destination would only produce a confusing failure.
 */
const BRIDGES = new Set(['atproto.brid.gy', 'bsky.brid.gy'])

/**
 * Preview and tunnel deployments come and go. They stay reachable via the
 * "another server" field, but listing them in a directory of places to live
 * would be misleading.
 */
const EPHEMERAL_SUFFIXES = [
  '.up.railway.app',
  '.fly.dev',
  '.onrender.com',
  '.vercel.app',
  '.ngrok.io',
  '.ngrok-free.app',
  '.ngrok.app',
  '.trycloudflare.com',
  '.loca.lt',
  '.serveo.net',
  '.tail.dev',
  '.ts.net',
]

export function isBridge(hostname: string): boolean {
  return BRIDGES.has(hostname)
}

export function isEphemeral(hostname: string): boolean {
  return EPHEMERAL_SUFFIXES.some((s) => hostname.endsWith(s))
}

/** Should this host be offered in the browsable directory? */
export function isListable(hostname: string): boolean {
  return !isBlueskyShard(hostname) && !isBridge(hostname) && !isEphemeral(hostname)
}

/** A display name for a host: its product name if it has one, else the hostname. */
export function labelFor(hostname: string): string {
  // A Bluesky account's DID document points at one of the shards, so resolving a
  // handle lands on a hostname nobody recognises. It is still the right endpoint
  // to talk to — it just needs to be called Bluesky.
  if (isBlueskyShard(hostname)) return 'Bluesky'
  return KNOWN_NAMES[hostname] ?? hostname
}

export function hasKnownName(hostname: string): boolean {
  return hostname in KNOWN_NAMES
}
