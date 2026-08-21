import type { MigrationRun } from './engine'
import type { RunView } from './types'

/**
 * A downloadable record of the move.
 *
 * Its second job is to make the return trip cheap: `reverse` is a ready-made
 * direction the wizard can be seeded with, so "take me back" is a file drop
 * rather than a from-scratch setup.
 */
export type Receipt = {
  kind: 'wsocial.migration.receipt'
  version: 1
  runId: string
  completedAt: string | null
  status: RunView['status']
  account: { did: string; handleBefore?: string; handleAfter?: string }
  movedFrom: { label: string; host: string }
  movedTo: { label: string; host: string }
  /** Seed for migrating back: feed this to the wizard to reverse the move. */
  reverse: { from: { label: string; host: string }; to: { label: string; host: string } }
  moved: {
    records?: number
    repositoryBytes?: number
    preferences: 'copied' | 'skipped' | 'not reached'
  }
  unavailableAttachments: string[]
  verification: RunView['verification']
  notes: string[]
}

export function buildReceipt(run: MigrationRun, targetHandle?: string): Receipt {
  const view = run.snapshot()
  const prefs = view.steps.find((s) => s.id === 'transfer-preferences')
  const bare = (h: { label: string; host: string }) => ({ label: h.label, host: h.host })

  const notes: string[] = []
  if (run.unavailableBlobs.length) {
    notes.push(
      `${run.unavailableBlobs.length} attachment(s) could not be read from the old server. ` +
        'The posts that referenced them moved, but those files did not.',
    )
  }
  if (view.steps.find((s) => s.id === 'go-live')?.status === 'done') {
    notes.push(
      'Your old account was left in place but deactivated. Nothing was deleted, ' +
        'and migrating back re-points your identity rather than copying you again.',
    )
  }

  return {
    kind: 'wsocial.migration.receipt',
    version: 1,
    runId: view.id,
    completedAt: view.endedAt ? new Date(view.endedAt).toISOString() : null,
    status: view.status,
    account: {
      did: view.inventory?.did ?? 'unknown',
      handleBefore: view.inventory?.handle,
      handleAfter: targetHandle,
    },
    movedFrom: bare(view.direction.from),
    movedTo: bare(view.direction.to),
    reverse: { from: bare(view.direction.to), to: bare(view.direction.from) },
    moved: {
      records: view.inventory?.indexedRecords,
      repositoryBytes: view.inventory?.repoCarBytes,
      preferences: prefs?.status === 'done' ? 'copied' : prefs?.status === 'skipped' ? 'skipped' : 'not reached',
    },
    unavailableAttachments: run.unavailableBlobs,
    verification: view.verification,
    notes,
  }
}
