'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Blocker, Direction } from '@/lib/migration/types'
import { copy } from '@/lib/ui/copy'

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
      return <CodeForm blocker={blocker} label="Sign-in code" cta={copy.blocker.codeCta} onSubmit={onSubmit} busy={busy} />
    case 'plc-token':
      return (
        <CodeForm
          blocker={blocker}
          label={`Confirmation code${blocker.sentTo ? ` sent to ${blocker.sentTo}` : ''}`}
          cta={copy.blocker.plcCta}
          onSubmit={onSubmit}
          busy={busy}
          footer={
            <div className="note" data-tone="warn">
              {copy.blocker.plcFooter(direction.to.label)}
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
    // The card mounts when the engine blocks, so a live region here announces
    // the new demand to screen readers without stealing focus from the form.
    <div className="card attention">
      <h2>{title}</h2>
      <p aria-live="polite">{message}</p>
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
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => {
    first.current?.focus()
  }, [])
  return (
    <Shell title={copy.blocker.yourTurn} message={blocker.message}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim() && !busy) onSubmit({ code })
        }}
      >
        <div className="field">
          <label htmlFor="code">{label}</label>
          <input
            ref={first}
            id="code"
            className="mono"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            placeholder="XXXXX-XXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
          />
        </div>
        {footer}
        <div className="actions">
          <button type="submit" className="primary" disabled={!code.trim() || busy}>
            {busy ? copy.blocker.working : cta}
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

  const first = useRef<HTMLInputElement>(null)
  useEffect(() => {
    first.current?.focus()
  }, [])
  return (
    <Shell title={copy.blocker.destTitle(direction.to.label)} message={blocker.message}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (ready && !busy) onSubmit({ handle, email, password, inviteCode })
        }}
      >
        <div className="field">
          <label htmlFor="newHandle">{copy.blocker.destHandle(direction.to.label)}</label>
          <input
            ref={first}
            id="newHandle"
            type="text"
            autoComplete="username"
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
          <label htmlFor="newEmail">{copy.blocker.destEmail}</label>
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
          <label htmlFor="newPassword">{copy.blocker.destPassword}</label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          <p className="help">{copy.blocker.destPasswordHelp}</p>
        </div>
        {blocker.inviteCodeRequired && (
          <div className="field">
            <label htmlFor="invite">{copy.blocker.destInvite}</label>
            <input
              id="invite"
              className="mono"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              disabled={busy}
            />
            <p className="help">{copy.blocker.destInviteHelp(direction.to.label)}</p>
          </div>
        )}
        <div className="actions">
          <button type="submit" className="primary" disabled={!ready || busy}>
            {busy ? copy.blocker.working : copy.blocker.destSubmit}
          </button>
          <span className="faint" style={{ fontSize: 13 }}>{copy.blocker.destStillReversible}</span>
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
    <Shell title={copy.blocker.didWebTitle} message={blocker.message}>
      <pre className="mono codeblock">{json}</pre>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => navigator.clipboard?.writeText(json)}>
          {copy.blocker.copyDocument}
        </button>
        <span className="spacer" />
        <button type="button" className="primary" disabled={busy} onClick={() => onSubmit({ ack: 'published' })}>
          {busy ? copy.blocker.checking : copy.blocker.published}
        </button>
      </div>
    </Shell>
  )
}
