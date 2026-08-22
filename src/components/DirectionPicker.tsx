'use client'

import { useEffect, useRef, useState, type Ref } from 'react'
import type { Direction, PdsHost } from '@/lib/migration/types'
import { copy } from '@/lib/ui/copy'

export type DirectoryEntry = { label: string; host: string; accountCount: number; named: boolean }

/**
 * The whole "and back if they wish" story is the swap button: direction is a
 * pair of hosts, so the return trip is this screen with the arrow reversed
 * rather than a second flow to build and maintain.
 *
 * The list behind each tile is the network's live directory, not a hardcoded
 * set — roughly 1,800 servers — so it is searched on the server and only the
 * host someone actually picks gets verified.
 */
export default function DirectionPicker({
  featured,
  directory,
  totalHosts,
  direction,
  onChange,
  disabled,
}: {
  featured: PdsHost[]
  directory: DirectoryEntry[]
  totalHosts: number
  direction: Direction
  onChange: (next: Direction) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState<'from' | 'to' | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DirectoryEntry[]>(directory)
  const [searching, setSearching] = useState(false)
  const [checking, setChecking] = useState<string | null>(null)
  const fromRef = useRef<HTMLButtonElement>(null)
  const toRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const opener = open === 'from' ? fromRef.current : toRef.current
      setOpen(null)
      setQuery('')
      opener?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Search runs server side against the whole directory; 1,800 entries is more
  // than is worth shipping to the browser just to filter.
  useEffect(() => {
    if (open === null) return
    const q = query.trim()
    if (!q) {
      setResults(directory)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hosts?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.directory ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 220)
    return () => clearTimeout(timer)
  }, [query, open, directory])

  const commit = (side: 'from' | 'to', host: PdsHost) => {
    const other = side === 'from' ? direction.to : direction.from
    // Choosing the host already on the other side swaps, rather than creating an
    // impossible same-server move.
    onChange(
      other.host === host.host
        ? { from: direction.to, to: direction.from }
        : side === 'from'
          ? { ...direction, from: host }
          : { ...direction, to: host },
    )
    setOpen(null)
    setQuery('')
  }

  /** Verify a host on selection — the directory says it exists, not that it can take you. */
  const pick = async (side: 'from' | 'to', entry: { label: string; host: string }) => {
    const known = featured.find((f) => f.host === entry.host)
    if (known) return commit(side, known)

    setChecking(entry.host)
    try {
      const res = await fetch(`/api/hosts?probe=${encodeURIComponent(entry.host)}`)
      const data = await res.json()
      const probed: PdsHost = data.host ?? { label: entry.label, host: entry.host }
      commit(side, { ...probed, label: entry.label })
    } catch {
      commit(side, { label: entry.label, host: entry.host })
    } finally {
      setChecking(null)
    }
  }

  const typed = query.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const typedIsHostname = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(typed)
  const showTyped = typedIsHostname && !results.some((r) => r.host.toLowerCase() === typed.toLowerCase())

  return (
    <div className="card">
      <h2>{copy.direction.heading}</h2>
      <div className="direction">
        <Tile
          ref={fromRef}
          side="from"
          host={direction.from}
          disabled={disabled}
          expanded={open === 'from'}
          onClick={() => setOpen(open === 'from' ? null : 'from')}
        />
        <button
          type="button"
          className="swap"
          disabled={disabled}
          aria-label={copy.direction.swap(direction.to.label, direction.from.label)}
          title={copy.direction.swapTitle}
          onClick={() => onChange({ from: direction.to, to: direction.from })}
        >
          ⇄
        </button>
        <Tile
          ref={toRef}
          side="to"
          host={direction.to}
          disabled={disabled}
          expanded={open === 'to'}
          onClick={() => setOpen(open === 'to' ? null : 'to')}
        />
      </div>

      {open && (
        <div className="hostMenu">
          <div className="hostSearch">
            <input
              ref={searchRef}
              type="text"
              placeholder={copy.direction.search(totalHosts)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={copy.direction.searchAria}
            />
          </div>

          <div className="hostList" role="listbox" aria-label={open === 'from' ? copy.direction.listFrom : copy.direction.listTo}>
            {!query.trim() &&
              featured.map((h) => (
                <HostRow
                  key={`f-${h.host}`}
                  label={h.label}
                  host={h.host}
                  accountCount={h.accountCount}
                  selected={direction[open].host === h.host}
                  unreachable={h.reachable === false}
                  inviteOnly={h.inviteCodeRequired}
                  onClick={() => pick(open, h)}
                />
              ))}

            {results
              .filter((e) => query.trim() || !featured.some((f) => f.host === e.host))
              .map((e) => (
                <HostRow
                  key={e.host}
                  label={e.label}
                  host={e.host}
                  accountCount={e.accountCount}
                  selected={direction[open].host === e.host}
                  busy={checking === e.host}
                  onClick={() => pick(open, e)}
                />
              ))}

            {showTyped && (
              <HostRow
                label={typed}
                host={typed}
                hint={copy.direction.typedHint}
                busy={checking === typed}
                onClick={() => pick(open, { label: typed, host: typed })}
              />
            )}

            {!results.length && !showTyped && (
              <p className="hostEmpty">{searching ? copy.direction.searching : copy.direction.empty}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function HostRow({
  label,
  host,
  accountCount,
  selected,
  unreachable,
  inviteOnly,
  busy,
  hint,
  onClick,
}: {
  label: string
  host: string
  accountCount?: number
  selected?: boolean
  unreachable?: boolean
  inviteOnly?: boolean
  busy?: boolean
  hint?: string
  onClick: () => void
}) {
  const named = label !== host
  return (
    <button type="button" role="option" aria-selected={!!selected} disabled={unreachable || busy} onClick={onClick}>
      <span className="hostRowMain">
        <span className="hostRowName">{label}</span>
        {named && <span className="meta">{host}</span>}
      </span>
      <span className="meta hostRowTail">{tailFor({ busy, unreachable, inviteOnly, hint, accountCount })}</span>
    </button>
  )
}

function Tile({
  side,
  host,
  onClick,
  disabled,
  expanded,
  ref,
}: {
  side: 'from' | 'to'
  host: PdsHost
  onClick: () => void
  disabled?: boolean
  expanded?: boolean
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    // The accent marks the destination, so the arrow and the colour agree.
    <button
      ref={ref}
      type="button"
      className="hostTile"
      data-dest={side === 'to'}
      onClick={onClick}
      disabled={disabled}
      aria-expanded={!!expanded}
      aria-haspopup="listbox"
    >
      <div className="role">{side === 'from' ? copy.direction.fromRole : copy.direction.toRole}</div>
      <div className="name">{host.label}</div>
      {host.reachable === false ? (
        <div className="bad">{copy.direction.notAnsweringHost(host.host)}</div>
      ) : (
        <div className="host">{host.label === host.host ? ' ' : host.host}</div>
      )}
    </button>
  )
}

/** Size and signup state are both worth knowing, so show both when we have them. */
function tailFor(o: {
  busy?: boolean
  unreachable?: boolean
  inviteOnly?: boolean
  hint?: string
  accountCount?: number
}): string {
  if (o.busy) return copy.direction.checking
  if (o.unreachable) return copy.direction.notAnswering
  if (o.hint) return o.hint
  const bits: string[] = []
  if (o.accountCount) bits.push(formatAccounts(o.accountCount))
  if (o.inviteOnly) bits.push(copy.direction.inviteOnly)
  return bits.join(' · ')
}

function formatAccounts(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M accounts`
  if (n >= 1_000) return `${Math.round(n / 1000)}k accounts`
  return `${n} accounts`
}
