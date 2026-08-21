'use client'

import { useState } from 'react'
import DirectionPicker from './DirectionPicker'
import type { Direction, PdsHost } from '@/lib/migration/types'

export type SetupValues = {
  identifier: string
  password: string
  keepSourceActive: boolean
}

/**
 * Step one asks for the old account only. Details for the new account are
 * collected later, once we have proved the old one can actually move — nobody
 * should pick a new handle for a migration that was never going to start.
 */
export default function SetupForm({
  hosts,
  direction,
  onDirectionChange,
  onSubmit,
  busy,
  error,
}: {
  hosts: PdsHost[]
  direction: Direction
  onDirectionChange: (d: Direction) => void
  onSubmit: (values: SetupValues) => void
  busy: boolean
  error?: string
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [keepSourceActive, setKeepSourceActive] = useState(false)
  const [advanced, setAdvanced] = useState(false)

  const ready = identifier.trim().length > 2 && password.length > 0 && direction.from.host !== direction.to.host

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !busy) onSubmit({ identifier, password, keepSourceActive })
      }}
    >
      <DirectionPicker hosts={hosts} direction={direction} onChange={onDirectionChange} disabled={busy} />

      <div className="card">
        <h2>What comes with you</h2>
        <ul className="manifest">
          <Row yes>
            Your <b>handle and identity</b> — the same DID, so nobody has to refollow you
          </Row>
          <Row yes>
            Your <b>followers</b>, because their follows point at your identity, not at {direction.from.label}
          </Row>
          <Row yes>
            <b>Posts, replies, reposts, likes, follows, lists, blocks and mutes</b>
          </Row>
          <Row yes>
            <b>Images and video</b> attached to your posts
          </Row>
          <Row yes>
            <b>Feed, mute and app settings</b>
          </Row>
          <Row yes={false}>
            <b>Direct messages</b> stay put — they live on the app’s chat service, not in your account
          </Row>
          <Row yes={false}>
            <b>Notification history</b> is not part of your account and starts fresh
          </Row>
        </ul>
      </div>

      <div className="card">
        <h2>Sign in to {direction.from.label}</h2>
        <div className="field">
          <label htmlFor="identifier">Handle or email on {direction.from.label}</label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            placeholder={`you${direction.from.availableUserDomains?.[0] ?? `.${direction.from.host}`}`}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Account password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          <p className="help">
            This has to be your real account password. App passwords are not allowed to move an account, so
            {' '}{direction.from.label} will refuse one.
          </p>
        </div>

        <div className="note" data-tone="accent">
          Signing in only <strong>reads</strong> your account at this stage. You will see exactly what is about to move,
          and can walk away, before anything changes.
        </div>

        <details style={{ marginTop: 14 }} open={advanced} onToggle={(e) => setAdvanced(e.currentTarget.open)}>
          <summary className="dim" style={{ cursor: 'pointer', fontSize: 13.5 }}>Advanced</summary>
          <div style={{ marginTop: 12 }}>
            <label className="check">
              <input
                type="checkbox"
                checked={keepSourceActive}
                onChange={(e) => setKeepSourceActive(e.target.checked)}
                disabled={busy}
              />
              <span>
                Leave my {direction.from.label} account active
                <span className="help">
                  Normally the old account is deactivated once the move succeeds — its data is kept, it just stops
                  serving. Only two servers claiming the same account at once causes confusion, so leave this off
                  unless you know why you want it.
                </span>
              </span>
            </label>
          </div>
        </details>

        {error && (
          <div className="note" data-tone="err" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}

        <div className="actions">
          <button type="submit" className="primary" disabled={!ready || busy}>
            {busy ? 'Checking…' : 'Check my account'}
          </button>
          <span className="faint" style={{ fontSize: 13 }}>
            Nothing moves yet.
          </span>
        </div>
      </div>
    </form>
  )
}

function Row({ yes, children }: { yes: boolean; children: React.ReactNode }) {
  return (
    <li>
      <span className="mark" data-yes={yes} aria-hidden>
        {yes ? '✓' : '—'}
      </span>
      <span>{children}</span>
    </li>
  )
}
