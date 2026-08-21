'use client'

import { useMemo, useState } from 'react'
import type { Blocker, Direction } from '@/lib/migration/types'

/**
 * The only interactive surface during a run. Whatever the engine is waiting for
 * shows up here as a small, single-purpose form, so the user is never asked to
 * work out which step they are on.
 */
export default function BlockerForm({
  blocker,
  direction,
  onSubmit,
  busy,
}: {
  blocker: Blocker
  direction: Direction
  onSubmit: (payload: Record<string, string>) => void
  busy: boolean
}) {
  switch (blocker.kind) {
    case 'source-2fa':
      return <CodeForm blocker={blocker} label="Sign-in code" cta="Continue" onSubmit={onSubmit} busy={busy} />
    case 'plc-token':
      return (
        <CodeForm
          blocker={blocker}
          label={`Confirmation code${blocker.sentTo ? ` sent to ${blocker.sentTo}` : ''}`}
          cta="Point my identity at the new server"
          onSubmit={onSubmit}
          busy={busy}
          footer={
            <div className="note" data-tone="warn">
              This is the step that actually moves you. After it, the network resolves your handle to{' '}
              <strong>{direction.to.label}</strong>. You can always come back later — it is the same operation in
              reverse, not a rebuild.
            </div>
          }
        />
      )
    case 'destination-details':
      return <DestinationForm blocker={blocker} direction={direction} onSubmit={onSubmit} busy={busy} />
    case 'did-web-update':
      return <DidWebForm blocker={blocker} onSubmit={onSubmit} busy={busy} />
  }
}

function Shell({ title, message, children }: { title: string; message: string; children: React.ReactNode }) {
  return (
    <div className="card attention">
      <h2>{title}</h2>
      <p>{message}</p>
      {children}
    </div>
  )
}

function CodeForm({
  blocker,
  label,
  cta,
  onSubmit,
  busy,
  footer,
}: {
  blocker: Extract<Blocker, { kind: 'source-2fa' | 'plc-token' }>
  label: string
  cta: string
  onSubmit: (p: Record<string, string>) => void
  busy: boolean
  footer?: React.ReactNode
}) {
  const [code, setCode] = useState('')
  return (
    <Shell title="Your turn" message={blocker.message}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim() && !busy) onSubmit({ code })
        }}
      >
        <div className="field">
          <label htmlFor="code">{label}</label>
          <input
            id="code"
            className="mono"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            placeholder="XXXXX-XXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
          />
        </div>
        {footer}
        <div className="actions">
          <button type="submit" className="primary" disabled={!code.trim() || busy}>
            {busy ? 'Working…' : cta}
          </button>
        </div>
      </form>
    </Shell>
  )
}

function DestinationForm({
  blocker,
  direction,
  onSubmit,
  busy,
}: {
  blocker: Extract<Blocker, { kind: 'destination-details' }>
  direction: Direction
  onSubmit: (p: Record<string, string>) => void
  busy: boolean
}) {
  const [handle, setHandle] = useState(blocker.suggestedHandle ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const ready =
    handle.trim().includes('.') && email.trim().includes('@') && password.length >= 8 && (!blocker.inviteCodeRequired || inviteCode.trim())

  return (
    <Shell title={`Your account on ${direction.to.label}`} message={blocker.message}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (ready && !busy) onSubmit({ handle, email, password, inviteCode })
        }}
      >
        <div className="field">
          <label htmlFor="newHandle">Handle on {direction.to.label}</label>
          <input
            id="newHandle"
            type="text"
            autoFocus
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            disabled={busy}
            placeholder={blocker.availableUserDomains[0] ? `you${blocker.availableUserDomains[0]}` : 'you.example.com'}
          />
          <p className="help">
            {blocker.availableUserDomains.length
              ? `${direction.to.label} hands out ${blocker.availableUserDomains.join(', ')}. A domain you own works too.`
              : 'Use a domain you control, or a handle this server offers.'}{' '}
            Your old handle keeps working as long as you own its domain; a {direction.from.label} handle does not
            come with you.
          </p>
        </div>
        <div className="field">
          <label htmlFor="newEmail">Email for the new account</label>
          <input
            id="newEmail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="newPassword">Password for the new account</label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          <p className="help">At least 8 characters. This is separate from your old account’s password.</p>
        </div>
        {blocker.inviteCodeRequired && (
          <div className="field">
            <label htmlFor="invite">Invite code</label>
            <input
              id="invite"
              className="mono"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              disabled={busy}
            />
            <p className="help">{direction.to.label} is invite-only right now.</p>
          </div>
        )}
        <div className="actions">
          <button type="submit" className="primary" disabled={!ready || busy}>
            {busy ? 'Working…' : 'Create it and move my data'}
          </button>
          <span className="faint" style={{ fontSize: 13 }}>Still reversible after this.</span>
        </div>
      </form>
    </Shell>
  )
}

function DidWebForm({
  blocker,
  onSubmit,
  busy,
}: {
  blocker: Extract<Blocker, { kind: 'did-web-update' }>
  onSubmit: (p: Record<string, string>) => void
  busy: boolean
}) {
  const json = useMemo(() => JSON.stringify(blocker.didDocument, null, 2), [blocker.didDocument])
  return (
    <Shell title="Publish your identity document" message={blocker.message}>
      <pre className="mono codeblock">{json}</pre>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => navigator.clipboard?.writeText(json)}>
          Copy document
        </button>
        <span className="spacer" />
        <button type="button" className="primary" disabled={busy} onClick={() => onSubmit({ ack: 'published' })}>
          {busy ? 'Checking…' : 'I have published it'}
        </button>
      </div>
    </Shell>
  )
}
