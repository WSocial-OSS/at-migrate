'use client'

import type { RunView } from '@/lib/migration/types'

export default function Outcome({
  run,
  onRetry,
  onStartOver,
  onReverse,
  busy,
}: {
  run: RunView
  onRetry: () => void
  onStartOver: () => void
  onReverse: () => void
  busy: boolean
}) {
  if (run.status === 'failed') return <Failure run={run} onRetry={onRetry} onStartOver={onStartOver} busy={busy} />
  if (run.status === 'canceled') {
    return (
      <div className="card">
        <h2>Stopped</h2>
        <p style={{ marginTop: 0 }}>
          The migration was canceled.{' '}
          {run.safeToAbandon
            ? 'Your account never left ' + run.direction.from.label + ', so there is nothing to undo.'
            : 'Your identity had already moved, so check the state of both accounts before trying again.'}
        </p>
        <div className="actions">
          <button type="button" className="secondary" onClick={onStartOver}>
            Start over
          </button>
        </div>
      </div>
    )
  }
  if (run.status !== 'done') return null

  const ok = run.verification?.ok !== false
  return (
    <>
      <div className="card">
        <h2>{ok ? 'Done' : 'Moved, with notes'}</h2>
        <p style={{ marginTop: 0, fontSize: 17, fontWeight: 550 }}>
          {run.inventory?.handle ? `${run.inventory.handle} now lives on ` : 'Your account now lives on '}
          {run.direction.to.label}.
        </p>
        <p style={{ marginTop: 0, color: 'var(--text-dim)' }}>
          Sign in to {run.direction.to.label} with your new handle and password. Your followers do not need to do
          anything — they were following your identity, and it came with you.
        </p>

        {run.verification && (
          <ul className="checks" style={{ marginTop: 14 }}>
            {run.verification.checks.map((c) => (
              <li key={c.name}>
                <span className="mark" style={{ color: c.ok ? 'var(--ok)' : 'var(--warn)' }} aria-hidden>
                  {c.ok ? '✓' : '!'}
                </span>
                <span className="name">{c.name}</span>
                <span className="val">{c.actual}</span>
              </li>
            ))}
          </ul>
        )}

        {!ok && (
          <div className="note" data-tone="warn" style={{ marginTop: 14 }}>
            Everything important moved, but the checks above did not all line up. Keep the receipt and give the
            servers a few minutes — identity records and record counts can lag — then re-check before deleting
            anything.
          </div>
        )}

        <div className="actions">
          <a className="secondary" href={`/api/runs/${run.id}/receipt`} download>
            Download receipt
          </a>
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onReverse} disabled={busy}>
            Move back to {run.direction.from.label}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>If you want to come back</h2>
        <p style={{ marginTop: 0, color: 'var(--text-dim)' }}>
          Nothing here is one-way. Your old account on {run.direction.from.label} still holds its data — it was
          deactivated, not deleted — and moving back is this same tool with the arrow reversed. You keep the same
          identity either way, so no move costs you your followers.
        </p>
      </div>
    </>
  )
}

function Failure({
  run,
  onRetry,
  onStartOver,
  busy,
}: {
  run: RunView
  onRetry: () => void
  onStartOver: () => void
  busy: boolean
}) {
  const failed = run.steps.find((s) => s.status === 'failed')
  return (
    <div className="card" style={{ borderColor: 'var(--err)' }}>
      <h2 style={{ color: 'var(--err)' }}>Stopped part way</h2>
      <p style={{ marginTop: 0 }}>{failed?.error ?? 'Something went wrong.'}</p>
      <div className="note" data-tone={run.safeToAbandon ? 'ok' : 'warn'}>
        {run.safeToAbandon ? (
          <>
            Your <strong>{run.direction.from.label}</strong> account is untouched and still working. Retrying picks up
            where this left off; walking away costs you nothing.
          </>
        ) : (
          <>
            Your identity has already moved to <strong>{run.direction.to.label}</strong>, so finish the run rather than
            abandoning it — retrying continues from the failed step.
          </>
        )}
      </div>
      <div className="actions">
        {failed?.retryable !== false && (
          <button type="button" className="primary" onClick={onRetry} disabled={busy}>
            {busy ? 'Retrying…' : 'Try again from here'}
          </button>
        )}
        <button type="button" className="secondary" onClick={onStartOver} disabled={busy}>
          Start over
        </button>
        <span className="spacer" />
        <a className="secondary" href={`/api/runs/${run.id}/receipt`} download>
          Download details
        </a>
      </div>
    </div>
  )
}
