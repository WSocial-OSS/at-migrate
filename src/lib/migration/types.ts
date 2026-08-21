/**
 * Domain types for atproto account migration.
 *
 * Migration is symmetric: it always moves one account from a source PDS to a
 * target PDS. "Coming back" is the same operation with `from` and `to` swapped,
 * which is why nothing in here names Bluesky or WSocial specifically.
 */

export type PdsHost = {
  /** Human label shown in the UI, e.g. "Bluesky". */
  label: string
  /** Hostname only, no scheme, e.g. "bsky.social". */
  host: string
  /** True for the host this deployment is built around (WSocial). */
  home?: boolean
  /** Filled in by describeServer at runtime. */
  did?: string
  inviteCodeRequired?: boolean
  phoneVerificationRequired?: boolean
  availableUserDomains?: string[]
  reachable?: boolean
  unreachableReason?: string
  /** Accounts the relay has seen here — the directory's only popularity signal. */
  accountCount?: number
}

export type Direction = { from: PdsHost; to: PdsHost }

export const STEP_IDS = [
  'preflight',
  'create-account',
  'transfer-repo',
  'transfer-blobs',
  'transfer-preferences',
  'identity',
  'go-live',
  'verify',
] as const

export type StepId = (typeof STEP_IDS)[number]

export type StepStatus =
  | 'pending'
  | 'running'
  /** Waiting on something only the user can provide (an email token, a DNS edit). */
  | 'blocked'
  | 'done'
  | 'failed'
  | 'skipped'

export type StepState = {
  id: StepId
  status: StepStatus
  /** Short present-tense description of what is happening right now. */
  detail?: string
  progress?: { done: number; total: number; unit: string }
  error?: string
  /** True when the failure is worth another attempt without restarting the run. */
  retryable?: boolean
  startedAt?: number
  endedAt?: number
}

/** What the source account looked like before we touched anything. */
export type AccountInventory = {
  did: string
  handle: string
  didMethod: 'plc' | 'web' | 'other'
  sourcePdsUrl: string
  /** Does the DID doc actually point at the source PDS we logged in to? */
  didDocMatchesSource: boolean
  repoCommit?: string
  repoRev?: string
  repoBlocks?: number
  indexedRecords?: number
  privateStateValues?: number
  expectedBlobs?: number
  importedBlobs?: number
  /** Bytes of the exported CAR, once we have downloaded it. */
  repoCarBytes?: number
}

/** Everything the destination needs to mint the new account. */
export type TargetDetails = {
  handle: string
  email: string
  password: string
  inviteCode?: string
}

/**
 * A run pauses rather than fails whenever the next move needs something only the
 * user has. Each blocker carries enough context for the UI to render its own form,
 * which is why the wizard has no step-ordering logic of its own.
 */
export type Blocker =
  | {
      kind: 'source-2fa'
      message: string
    }
  | {
      kind: 'destination-details'
      message: string
      /** Handle suffixes the destination hands out, e.g. [".wsocial.example"]. */
      availableUserDomains: string[]
      inviteCodeRequired: boolean
      /** Suggested handle carried over from the old account. */
      suggestedHandle?: string
    }
  | {
      kind: 'plc-token'
      /** Address the confirmation code was sent to, masked. */
      sentTo?: string
      message: string
    }
  | {
      kind: 'did-web-update'
      message: string
      /** The did.json the user must publish for a did:web account. */
      didDocument: unknown
    }

export type LogEntry = {
  at: number
  level: 'info' | 'warn' | 'error'
  step: StepId | 'run'
  message: string
}

export type RunStatus = 'idle' | 'running' | 'blocked' | 'done' | 'failed' | 'canceled'

/** The client-safe view of a run. Never contains credentials. */
export type RunView = {
  id: string
  status: RunStatus
  direction: Direction
  steps: StepState[]
  inventory?: AccountInventory
  blocker?: Blocker
  log: LogEntry[]
  /** Set once go-live succeeds; the shape of the reverse trip. */
  reverse?: Direction
  verification?: VerificationReport
  startedAt: number
  endedAt?: number
  /** True while the old account is still active and nothing is irreversible yet. */
  safeToAbandon: boolean
}

export type VerificationReport = {
  ok: boolean
  checks: { name: string; ok: boolean; expected: string; actual: string }[]
}

export type StartRunInput = {
  direction: Direction
  source: { identifier: string; password: string }
  /** Leave the source account active instead of deactivating it at go-live. */
  keepSourceActive?: boolean
}

export class MigrationError extends Error {
  readonly retryable: boolean
  readonly hint?: string
  constructor(message: string, opts: { retryable?: boolean; hint?: string; cause?: unknown } = {}) {
    super(message, { cause: opts.cause })
    this.name = 'MigrationError'
    this.retryable = opts.retryable ?? false
    this.hint = opts.hint
  }
}
