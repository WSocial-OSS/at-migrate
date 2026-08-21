'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import SetupForm, { type SetupValues } from './SetupForm'
import { type DirectoryEntry } from './DirectionPicker'
import RunProgress, { Inventory, RunLog } from './RunProgress'
import BlockerForm from './BlockerForm'
import Outcome from './Outcome'
import type { Direction, PdsHost, RunView } from '@/lib/migration/types'

const FALLBACK: PdsHost[] = [{ label: 'Bluesky', host: 'bsky.social' }]

type HostsResponse = {
  featured?: PdsHost[]
  directory?: DirectoryEntry[]
  totalHosts?: number
  relayError?: string
}

export default function Wizard() {
  const [featured, setFeatured] = useState<PdsHost[] | null>(null)
  const [dir, setDir] = useState<{ directory: DirectoryEntry[]; total: number }>({ directory: [], total: 0 })
  const [direction, setDirection] = useState<Direction | null>(null)
  const [run, setRun] = useState<RunView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const streamRef = useRef<EventSource | null>(null)

  // Featured hosts are probed server side on load; the rest of the network's
  // ~1,800 servers stay in the searchable directory and are verified on pick.
  useEffect(() => {
    let live = true
    fetch('/api/hosts')
      .then((r) => r.json())
      .then((data: HostsResponse) => {
        if (!live) return
        const list = data.featured?.length ? data.featured : FALLBACK
        setFeatured(list)
        setDir({ directory: data.directory ?? [], total: data.totalHosts ?? list.length })
        setDirection((prev) => prev ?? defaultDirection(list, data.directory ?? []))
      })
      .catch(() => {
        if (!live) return
        setFeatured(FALLBACK)
        setDirection((prev) => prev ?? defaultDirection(FALLBACK, []))
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

  if (!featured || !direction) {
    return (
      <div className="card">
        <p className="dim" style={{ margin: 0 }}>Checking which servers are available…</p>
      </div>
    )
  }

  if (!run) {
    return (
      <SetupForm
        featured={featured}
        directory={dir.directory}
        totalHosts={dir.total}
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
      <div className="card railTop">
        <strong>{run.direction.from.label}</strong>
        <span className="arrow">→</span>
        <strong>{run.direction.to.label}</strong>
        <span className="status">{statusLabel(run)}</span>
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

function defaultDirection(featured: PdsHost[], directory: DirectoryEntry[]): Direction {
  const home = featured.find((h) => h.home)
  const other =
    featured.find((h) => h !== home && h.reachable !== false) ??
    featured.find((h) => h !== home) ??
    directory.find((e) => e.host !== home?.host)
  // Default to arriving at this deployment's own server; the swap button covers
  // leaving, and typing a handle re-points the source to wherever it really is.
  if (home && other) return { from: { label: other.label, host: other.host }, to: home }
  return { from: featured[0], to: home ?? featured[1] ?? featured[0] }
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
