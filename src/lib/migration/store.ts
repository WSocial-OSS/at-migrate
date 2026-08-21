import { MigrationRun } from './engine'
import type { StartRunInput } from './types'

/**
 * Runs live in process memory and nowhere else.
 *
 * That is a deliberate constraint, not a shortcut: a run holds the user's real
 * account password for as long as it is in flight, and writing that to a
 * database or a disk-backed session store would be the wrong trade. The cost is
 * that this app must be deployed as a single long-lived Node process rather than
 * spread across serverless instances. If WSocial later needs horizontal scaling,
 * replace this module — the engine itself keeps no global state.
 */

const RUN_TTL_MS = 60 * 60 * 1000

type Entry = { run: MigrationRun; touchedAt: number }

const runs = new Map<string, Entry>()

function sweep() {
  const now = Date.now()
  for (const [id, entry] of runs) {
    if (now - entry.touchedAt > RUN_TTL_MS) {
      entry.run.cancel()
      entry.run.forgetCredentials()
      runs.delete(id)
    }
  }
}

export function createRun(input: StartRunInput): MigrationRun {
  sweep()
  const id = crypto.randomUUID()
  const run = new MigrationRun(id, input)
  runs.set(id, { run, touchedAt: Date.now() })
  return run
}

export function getRun(id: string): MigrationRun | undefined {
  const entry = runs.get(id)
  if (!entry) return undefined
  entry.touchedAt = Date.now()
  return entry.run
}

export function dropRun(id: string) {
  const entry = runs.get(id)
  if (!entry) return
  entry.run.cancel()
  entry.run.forgetCredentials()
  runs.delete(id)
}
