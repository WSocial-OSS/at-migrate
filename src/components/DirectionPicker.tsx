'use client'

import { useState } from 'react'
import type { Direction, PdsHost } from '@/lib/migration/types'

/**
 * The whole "and back if they wish" story is this component: direction is a pair
 * of hosts and a swap button, so the return trip is the same screen with the
 * arrow pointing the other way rather than a second flow to build and maintain.
 */
export default function DirectionPicker({
  hosts,
  direction,
  onChange,
  disabled,
}: {
  hosts: PdsHost[]
  direction: Direction
  onChange: (next: Direction) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState<'from' | 'to' | null>(null)
  const [custom, setCustom] = useState('')

  const pick = (side: 'from' | 'to', host: PdsHost) => {
    const other = side === 'from' ? direction.to : direction.from
    // Picking the host that is already on the other side swaps rather than
    // creating an impossible same-server move.
    const next: Direction =
      other.host === host.host
        ? { from: direction.to, to: direction.from }
        : side === 'from'
          ? { ...direction, from: host }
          : { ...direction, to: host }
    onChange(next)
    setOpen(null)
    setCustom('')
  }

  const addCustom = (side: 'from' | 'to') => {
    const host = custom.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!host) return
    pick(side, { label: host, host })
  }

  return (
    <div className="card">
      <h2>Direction</h2>
      <div className="direction">
        <Tile side="from" host={direction.from} disabled={disabled} onClick={() => setOpen(open === 'from' ? null : 'from')} />
        <button
          type="button"
          className="swap"
          disabled={disabled}
          aria-label={`Swap: move from ${direction.to.label} to ${direction.from.label} instead`}
          title="Reverse the direction"
          onClick={() => onChange({ from: direction.to, to: direction.from })}
        >
          ⇄
        </button>
        <Tile side="to" host={direction.to} disabled={disabled} onClick={() => setOpen(open === 'to' ? null : 'to')} />
      </div>

      {open && (
        <div className="hostMenu" role="listbox" aria-label={open === 'from' ? 'Server to move from' : 'Server to move to'}>
          {hosts.map((h) => (
            <button
              key={h.host}
              type="button"
              role="option"
              aria-selected={direction[open].host === h.host}
              disabled={h.reachable === false}
              onClick={() => pick(open, h)}
            >
              <span style={{ fontWeight: 550 }}>{h.label}</span>{' '}
              <span className="meta">
                {h.host}
                {h.reachable === false && ' — not reachable'}
                {h.inviteCodeRequired && ' — invite only'}
              </span>
            </button>
          ))}
          <div style={{ padding: 10, display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="another server, e.g. pds.example.com"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom(open)
                }
              }}
            />
            <button type="button" className="secondary" onClick={() => addCustom(open)}>
              Use
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({
  side,
  host,
  onClick,
  disabled,
}: {
  side: 'from' | 'to'
  host: PdsHost
  onClick: () => void
  disabled?: boolean
}) {
  return (
    // The accent marks the destination, so the arrow and the colour say the same thing.
    <button type="button" className="hostTile" data-dest={side === 'to'} onClick={onClick} disabled={disabled}>
      <div className="role">{side === 'from' ? 'Moving from' : 'Moving to'}</div>
      <div className="name">{host.label}</div>
      {host.reachable === false ? (
        <div className="bad">{host.host} — not answering</div>
      ) : (
        <div className="host">{host.host}</div>
      )}
    </button>
  )
}
