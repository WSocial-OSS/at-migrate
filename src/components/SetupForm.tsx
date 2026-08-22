'use client'

import { useEffect, useRef, useState } from 'react'
import DirectionPicker, { type DirectoryEntry } from './DirectionPicker'
import type { Direction, PdsHost } from '@/lib/migration/types'
import { copy } from '@/lib/ui/copy'

type Detected = { did: string; handle?: string; didMethod: string; host: string; label: string }

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
  featured,
  directory,
  totalHosts,
  direction,
  onDirectionChange,
  onSubmit,
  busy,
  error,
}: {
  featured: PdsHost[]
  directory: DirectoryEntry[]
  totalHosts: number
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
  const [detected, setDetected] = useState<Detected | null>(null)
  const [detecting, setDetecting] = useState(false)
  const directionRef = useRef(direction)
  directionRef.current = direction

  /**
   * Look up where the account actually lives as soon as there is enough handle
   * to try. The DID document names the PDS, so any of the network's servers
   * works as a source without being in a list — and nobody has to know which
   * host they are on.
   */
  useEffect(() => {
    const id = identifier.trim().replace(/^@/, '')
    if (id.length < 4 || (!id.includes('.') && !id.startsWith('did:'))) {
      setDetected(null)
      return
    }
    setDetecting(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/resolve?identifier=${encodeURIComponent(id)}`)
        if (!res.ok) {
          setDetected(null)
          return
        }
        const found = (await res.json()) as Detected
        setDetected(found)
        const current = directionRef.current
        // Correct the source to wherever the account really is, unless that is
        // the destination — then the direction itself is what needs fixing.
        if (found.host !== current.from.host && found.host !== current.to.host) {
          onDirectionChange({ ...current, from: { label: found.label, host: found.host } })
        }
      } catch {
        setDetected(null)
      } finally {
        setDetecting(false)
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [identifier, onDirectionChange])

  const alreadyThere = !!detected && detected.host === direction.to.host
  const ready =
    identifier.trim().length > 2 && password.length > 0 && direction.from.host !== direction.to.host && !alreadyThere

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !busy) onSubmit({ identifier, password, keepSourceActive })
      }}
    >
      <DirectionPicker
        featured={featured}
        directory={directory}
        totalHosts={totalHosts}
        direction={direction}
        onChange={onDirectionChange}
        disabled={busy}
      />

      <div className="card">
        <h2>{copy.setup.whatComes}</h2>
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
        <h2>{copy.setup.signIn(direction.from.label)}</h2>
        <div className="field">
          <label htmlFor="identifier">{copy.setup.identifier(direction.from.label)}</label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            aria-invalid={alreadyThere}
            aria-describedby={alreadyThere ? 'identifier-error' : detecting ? 'identifier-status' : undefined}
            placeholder={`you${direction.from.availableUserDomains?.[0] ?? `.${direction.from.host}`}`}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={busy}
          />
          {detecting && !detected && (
            <p className="help" id="identifier-status" aria-live="polite">
              {copy.setup.lookingUp}
            </p>
          )}
          {detected && !alreadyThere && (
            <p className="help">
              {copy.setup.foundOn(detected.label, detected.host, detected.label !== detected.host)}
              {detected.didMethod === 'web' && copy.setup.didWebNote}
            </p>
          )}
          {alreadyThere && (
            <p className="help" id="identifier-error" role="alert" style={{ color: 'var(--warn)' }}>
              {copy.setup.alreadyThere(direction.to.label)}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="password">{copy.setup.password}</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'setup-error' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          <p className="help">{copy.setup.passwordHelp(direction.from.label)}</p>
        </div>

        <div className="note" data-tone="accent">
          {copy.setup.readOnly}
        </div>

        <details style={{ marginTop: 14 }} open={advanced} onToggle={(e) => setAdvanced(e.currentTarget.open)}>
          <summary className="dim" style={{ cursor: 'pointer', fontSize: 13.5 }}>{copy.setup.advanced}</summary>
          <div style={{ marginTop: 12 }}>
            <label className="check">
              <input
                type="checkbox"
                checked={keepSourceActive}
                onChange={(e) => setKeepSourceActive(e.target.checked)}
                disabled={busy}
              />
              <span>
                {copy.setup.keepActive(direction.from.label)}
                <span className="help">{copy.setup.keepActiveHelp}</span>
              </span>
            </label>
          </div>
        </details>

        {error && (
          <div className="note" data-tone="err" role="alert" id="setup-error" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}

        <div className="actions">
          <button type="submit" className="primary" disabled={!ready || busy}>
            {busy ? copy.setup.submitting : copy.setup.submit}
          </button>
          <span className="faint" style={{ fontSize: 13 }}>
            {copy.setup.nothingMoves}
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
