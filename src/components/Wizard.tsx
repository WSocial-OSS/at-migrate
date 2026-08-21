'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import SetupForm, { type SetupValues } from './SetupForm'
import RunProgress, { Inventory, RunLog } from './RunProgress'
import BlockerForm from './BlockerForm'
import Outcome from './Outcome'
import type { Direction, PdsHost, RunView } from '@/lib/migration/types'

const FALLBACK: PdsHost[] = [{ label: 'Bluesky', host: 'bsky.social' }]

export default function Wizard() {
  const [hosts, setHosts] = useState<PdsHost[] | null>(null)
  const [direction, setDirection] = useState<Direction | null>(null)
  const [run, setRun] = useState<RunView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const streamRef = useRef<EventSource | null>(null)

  // Probe the offered servers once; the picker only shows hosts that answered.
  useEffect(() => {
    let live = true
    fetch('/api/hosts')
      .then((r) => r.json())
      .then((data: { hosts: PdsHost[] }) => {
        if (!live) return
        const list = data.hosts?.length ? data.hosts : FALLBACK
        setHosts(list)
        setDirection((prev) => prev ?? defaultDirection(list))
      })
      .catch(() => {
        if (!live) return
        setHosts(FALLBACK)
        setDirection((prev) => prev ?? defaultDirection(FALLBACK))
      })
    return () => {
      live = false
    }
  }, [])

  // One stream per run; the server pushes whole snapshots, so state is never stitched together here.
  useEffect(() => {
    if (!run?.id) return
    if (streamRef.current) streamRef.current.close()
    const es = new EventSource(`/api/runs/${run.id}/events`)
    streamRef.current = es
    es.addEventListener('run', (e) => {
      try {
        setRun(JSON.parse((e as MessageEvent).data) as RunView)
      } catch {
        /* ignore a malformed frame; the next snapshot supersedes it */
      }
    })
    es.onerror = () => es.close()
    return () => es.close()
    // Re-subscribing on every snapshot would thrash the connection; the id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id])

  const start = useCallback(
    async (values: SetupValues) => {
      if (!direction) return
      setBusy(true)
      setError(undefined)
      try {
        const res = await fetch('/api/runs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ from: direction.from, to: direction.to, ...values }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Could not start the migration.')
        setRun(data.run as RunView)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start the migration.')
      } finally {
        setBusy(false)
      }
    },
    [direction],
  )

  const post = useCallback(
    async (path: string, body?: unknown) => {
      if (!run) return
      setBusy(true)
      try {
        const res = await fetch(`/api/runs/${run.id}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error ?? 'That did not go through.')
        }
      } finally {
        setBusy(false)
      }
    },
    [run],
  )

  const startOver = useCallback(() => {
    streamRef.current?.close()
    if (run) void fetch(`/api/runs/${run.id}`, { method: 'DELETE' })
    setRun(null)
    setError(undefined)
  }, [run])

  // "Take me back" is the same wizard with the arrow reversed.
  const reverse = useCallback(() => {
    if (!run) return
    setDirection({ from: run.direction.to, to: run.direction.from })
    startOver()
  }, [run, startOver])

  if (!hosts || !direction) {
    return (
      <div className="card">
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>Checking which servers are available…</p>
      </div>
    )
  }

  if (!run) {
    return (
      <SetupForm
        hosts={hosts}
        direction={direction}
        onDirectionChange={setDirection}
        onSubmit={start}
        busy={busy}
        error={error}
      />
    )
  }

  const finished = run.status === 'done' || run.status === 'failed' || run.status === 'canceled'

  return (
    <>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <strong>{run.direction.from.label}</strong>
        <span style={{ color: 'var(--text-faint)' }}>→</span>
        <strong>{run.direction.to.label}</strong>
        <span className="spacer" style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{statusLabel(run)}</span>
      </div>

      {!finished && (
        <div className="note" data-tone={run.safeToAbandon ? 'ok' : 'accent'} style={{ marginBottom: 16 }}>
          {run.safeToAbandon ? (
            <>
              Still reversible — your <strong>{run.direction.from.label}</strong> account is live and unchanged until
              the identity step.
            </>
          ) : (
            <>
              Your identity now points at <strong>{run.direction.to.label}</strong>. Let the last steps finish.
            </>
          )}
        </div>
      )}

      {run.blocker && (
        <BlockerForm
          blocker={run.blocker}
          direction={run.direction}
          onSubmit={(payload) => void post('/input', payload)}
          busy={busy}
        />
      )}

      <RunProgress run={run} />
      {run.inventory && <Inventory run={run} />}

      <Outcome
        run={run}
        onRetry={() => void post('/retry')}
        onStartOver={startOver}
        onReverse={reverse}
        busy={busy}
      />

      <RunLog run={run} />

      {!finished && (
        <div className="actions">
          <button type="button" className="secondary" onClick={() => void post('/cancel')} disabled={busy}>
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="note" data-tone="err" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </>
  )
}

function defaultDirection(hosts: PdsHost[]): Direction {
  const home = hosts.find((h) => h.home)
  const other = hosts.find((h) => h !== home && h.reachable !== false) ?? hosts.find((h) => h !== home)
  // Default to arriving at this deployment's own server; the swap button covers leaving.
  if (home && other) return { from: other, to: home }
  return { from: hosts[0], to: home ?? hosts[1] ?? hosts[0] }
}

function statusLabel(run: RunView): string {
  switch (run.status) {
    case 'running':
      return 'in progress'
    case 'blocked':
      return 'waiting for you'
    case 'done':
      return 'complete'
    case 'failed':
      return 'stopped'
    case 'canceled':
      return 'canceled'
    default:
      return 'ready'
  }
}
