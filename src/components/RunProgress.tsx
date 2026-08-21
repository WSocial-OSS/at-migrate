'use client'

import { formatBytes } from '@/lib/migration/format'
import type { RunView, StepId, StepState, StepStatus } from '@/lib/migration/types'

/** Eight engine steps, five things a person cares about. */
const GROUPS: { title: string; steps: StepId[] }[] = [
  { title: 'Check your account', steps: ['preflight'] },
  { title: 'Claim your new home', steps: ['create-account'] },
  { title: 'Move your data', steps: ['transfer-repo', 'transfer-blobs', 'transfer-preferences'] },
  { title: 'Hand over your identity', steps: ['identity'] },
  { title: 'Go live', steps: ['go-live', 'verify'] },
]

const SUBSTEP_LABELS: Record<StepId, string> = {
  preflight: 'Reading your account',
  'create-account': 'Reserving your new account',
  'transfer-repo': 'Posts, follows and likes',
  'transfer-blobs': 'Images and video',
  'transfer-preferences': 'Feeds and settings',
  identity: 'Identity record',
  'go-live': 'Switching over',
  verify: 'Checking the result',
}

export default function RunProgress({ run }: { run: RunView }) {
  const byId = new Map(run.steps.map((s) => [s.id, s]))

  return (
    <div className="card flush">
      <ol className="steps">
        {GROUPS.map((group, i) => {
          const steps = group.steps.map((id) => byId.get(id)).filter((s): s is StepState => !!s)
          const status = groupStatus(steps)
          const active = steps.find((s) => s.status === 'running' || s.status === 'blocked' || s.status === 'failed')
          const showSubsteps = group.steps.length > 1 && status !== 'pending'

          return (
            <li key={group.title} data-status={status}>
              <span className="bullet" data-status={status} aria-hidden>
                {status === 'done' ? '✓' : status === 'failed' ? '!' : status === 'blocked' ? '?' : i + 1}
              </span>
              <div className="stepBody">
                <div className="stepTitle">
                  <span>{group.title}</span>
                  {status === 'done' && <span className="when">{duration(steps)}</span>}
                </div>

                {active?.detail && <div className="stepDetail">{active.detail}…</div>}
                {status === 'blocked' && !active?.detail && <div className="stepDetail">Waiting for you</div>}
                {active?.error && <div className="stepError">{active.error}</div>}

                {showSubsteps && (
                  <ul className="substeps">
                    {steps.map((s) => (
                      <li key={s.id}>
                        <span className="dot" aria-hidden>
                          {s.status === 'done' ? '✓' : s.status === 'skipped' ? '–' : s.status === 'failed' ? '!' : '·'}
                        </span>
                        <span style={{ flex: 1 }}>
                          {SUBSTEP_LABELS[s.id]}
                          {s.status === 'skipped' && ' — skipped'}
                        </span>
                        {s.progress && s.progress.total > 0 && (
                          <span className="faint">
                            {s.progress.done}/{s.progress.total}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {active?.progress && active.progress.total > 0 && (
                  <div className="bar">
                    <i style={{ width: `${Math.min(100, (active.progress.done / active.progress.total) * 100)}%` }} />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function Inventory({ run }: { run: RunView }) {
  const inv = run.inventory
  if (!inv) return null
  return (
    <div className="card">
      <h2>What is moving</h2>
      <dl className="kv">
        <dt>Account</dt>
        <dd>
          {inv.handle} <span className="mono dim">{inv.did}</span>
        </dd>
        <dt>Records</dt>
        <dd>{inv.indexedRecords?.toLocaleString() ?? 'unknown'}</dd>
        <dt>Media files</dt>
        <dd>{inv.expectedBlobs?.toLocaleString() ?? 'unknown'}</dd>
        {inv.repoCarBytes !== undefined && (
          <>
            <dt>Repository size</dt>
            <dd>{formatBytes(inv.repoCarBytes)}</dd>
          </>
        )}
        <dt>Identity type</dt>
        <dd>{inv.didMethod === 'plc' ? 'did:plc — this tool can move it for you' : 'did:web — you publish the change'}</dd>
      </dl>
    </div>
  )
}

export function RunLog({ run }: { run: RunView }) {
  if (!run.log.length) return null
  return (
    <details className="log">
      <summary>Details ({run.log.length})</summary>
      <ol>
        {run.log.map((entry, i) => (
          <li key={i} data-level={entry.level}>
            <time>{new Date(entry.at).toLocaleTimeString()}</time>
            <span>{entry.message}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}

function groupStatus(steps: StepState[]): StepStatus {
  if (steps.some((s) => s.status === 'failed')) return 'failed'
  if (steps.some((s) => s.status === 'blocked')) return 'blocked'
  if (steps.some((s) => s.status === 'running')) return 'running'
  if (steps.every((s) => s.status === 'done' || s.status === 'skipped')) return 'done'
  if (steps.some((s) => s.status === 'done' || s.status === 'skipped')) return 'running'
  return 'pending'
}

function duration(steps: StepState[]): string {
  const start = Math.min(...steps.map((s) => s.startedAt ?? Infinity))
  const end = Math.max(...steps.map((s) => s.endedAt ?? 0))
  if (!Number.isFinite(start) || !end || end <= start) return ''
  const secs = Math.round((end - start) / 1000)
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`
}
