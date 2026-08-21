import { AtpAgent } from '@atproto/api'
import { describeHost } from '@/lib/atproto/hosts'
import { normalizeHost, serviceUrl } from '@/lib/atproto/url'
import { resolveIdentity } from '@/lib/atproto/identity'
import { formatBytes } from './format'

/**
 * The rotation keys, handles and service endpoints the destination wants written
 * into the identity record. Shaped to be passed straight to signPlcOperation.
 */
type RecommendedDidCredentials = {
  rotationKeys?: string[]
  alsoKnownAs?: string[]
  verificationMethods?: Record<string, unknown>
  services?: Record<string, unknown>
}
import {
  MigrationError,
  STEP_IDS,
  type AccountInventory,
  type Blocker,
  type Direction,
  type LogEntry,
  type RunView,
  type StartRunInput,
  type StepId,
  type StepState,
  type TargetDetails,
  type VerificationReport,
} from './types'

const BLOB_PAGE = 500
/** How long a run may sit waiting on the user before we drop its credentials. */
export const BLOCKED_TIMEOUT_MS = 30 * 60 * 1000

type Listener = (view: RunView) => void

/**
 * One account's trip from one PDS to another.
 *
 * Ordering is deliberate and matches the atproto migration guide: the new
 * account is created and filled while still deactivated, and the DID document
 * is only repointed once the data is in place. Everything before the identity
 * step is reversible by simply walking away — `safeToAbandon` tracks that, and
 * the UI leans on it to tell the user when they cross the line.
 */
export class MigrationRun {
  readonly id: string
  private view: RunView
  private input: StartRunInput
  private target_: TargetDetails | undefined
  private source: AtpAgent
  private target: AtpAgent
  private listeners = new Set<Listener>()
  private resolveUserInput?: (value: Record<string, string>) => void
  private canceled = false
  private failedBlobs = new Set<string>()

  constructor(id: string, input: StartRunInput) {
    this.id = id
    this.input = input
    this.source = new AtpAgent({ service: serviceUrl(input.direction.from.host) })
    this.target = new AtpAgent({ service: serviceUrl(input.direction.to.host) })
    this.view = {
      id,
      status: 'idle',
      direction: input.direction,
      steps: STEP_IDS.map((sid) => ({ id: sid, status: 'pending' })),
      log: [],
      startedAt: Date.now(),
      safeToAbandon: true,
    }
  }

  // ---------------------------------------------------------------- observation

  snapshot(): RunView {
    return structuredClone(this.view)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  private emit() {
    const snap = this.snapshot()
    for (const l of this.listeners) l(snap)
  }

  private log(level: LogEntry['level'], step: StepId | 'run', message: string) {
    this.view.log.push({ at: Date.now(), level, step, message })
    if (this.view.log.length > 500) this.view.log.splice(0, this.view.log.length - 500)
  }

  private step(id: StepId): StepState {
    const s = this.view.steps.find((x) => x.id === id)
    if (!s) throw new Error(`unknown step ${id}`)
    return s
  }

  private setStep(id: StepId, patch: Partial<StepState>) {
    Object.assign(this.step(id), patch)
    this.emit()
  }

  // ------------------------------------------------------------------ user input

  /** Answer whatever the run is currently blocked on. Returns false if it is not waiting. */
  provideUserInput(payload: Record<string, string>): boolean {
    if (!this.resolveUserInput) return false
    const resolve = this.resolveUserInput
    this.resolveUserInput = undefined
    this.view.blocker = undefined
    this.view.status = 'running'
    resolve(payload)
    this.emit()
    return true
  }

  private async waitForUser(blocker: Blocker): Promise<Record<string, string>> {
    this.view.blocker = blocker
    this.view.status = 'blocked'
    this.emit()
    return new Promise<Record<string, string>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.resolveUserInput = undefined
        reject(
          new MigrationError('Timed out waiting for you.', {
            retryable: true,
            hint: 'Nothing was lost — pick the run back up and it continues from this step.',
          }),
        )
      }, BLOCKED_TIMEOUT_MS)
      this.resolveUserInput = (v) => {
        clearTimeout(timer)
        resolve(v)
      }
    })
  }

  cancel() {
    this.canceled = true
    if (this.view.status === 'running' || this.view.status === 'blocked') {
      this.view.status = 'canceled'
      this.view.endedAt = Date.now()
      this.log('warn', 'run', 'Canceled by the user.')
      this.emit()
    }
  }

  /** Credentials live only as long as the run needs them. */
  forgetCredentials() {
    this.input = { ...this.input, source: { identifier: this.input.source.identifier, password: '' } }
    if (this.target_) this.target_ = { ...this.target_, password: '', inviteCode: undefined }
  }

  /** The handle the account ended up with, for the receipt. */
  get targetHandle(): string | undefined {
    return this.target_?.handle
  }

  private assertLive() {
    if (this.canceled) throw new MigrationError('Migration canceled.')
  }

  // ----------------------------------------------------------------------- driver

  async run(): Promise<RunView> {
    this.view.status = 'running'
    this.emit()

    const sequence: [StepId, () => Promise<void>][] = [
      ['preflight', () => this.preflight()],
      ['create-account', () => this.createAccount()],
      ['transfer-repo', () => this.transferRepo()],
      ['transfer-blobs', () => this.transferBlobs()],
      ['transfer-preferences', () => this.transferPreferences()],
      ['identity', () => this.migrateIdentity()],
      ['go-live', () => this.goLive()],
      ['verify', () => this.verify()],
    ]

    for (const [id, fn] of sequence) {
      if (this.canceled) break
      if (this.step(id).status === 'done' || this.step(id).status === 'skipped') continue
      this.setStep(id, { status: 'running', startedAt: Date.now(), error: undefined })
      try {
        await fn()
        this.assertLive()
        if (this.step(id).status === 'running') {
          this.setStep(id, { status: 'done', endedAt: Date.now(), detail: undefined })
        }
      } catch (err) {
        const e = normalizeError(err)
        this.setStep(id, {
          status: 'failed',
          endedAt: Date.now(),
          // The error replaces the in-progress detail rather than sitting under it.
          detail: undefined,
          error: e.hint ? `${e.message} — ${e.hint}` : e.message,
          retryable: e.retryable,
        })
        this.log('error', id, e.message)
        this.view.status = this.canceled ? 'canceled' : 'failed'
        this.view.endedAt = Date.now()
        this.emit()
        return this.snapshot()
      }
    }

    if (!this.canceled) {
      this.view.status = this.view.verification?.ok === false ? 'failed' : 'done'
      this.view.endedAt = Date.now()
      this.view.reverse = { from: this.view.direction.to, to: this.view.direction.from }
      this.forgetCredentials()
      this.emit()
    }
    return this.snapshot()
  }

  /** Re-run from the first step that is not already done. Used by the Retry button. */
  async resume(): Promise<RunView> {
    for (const s of this.view.steps) {
      if (s.status === 'failed') s.status = 'pending'
    }
    this.canceled = false
    return this.run()
  }

  // ------------------------------------------------------------------------ steps

  private async preflight() {
    const { from, to } = this.input.direction

    if (normalizeHost(from.host) === normalizeHost(to.host)) {
      throw new MigrationError('The source and destination servers are the same.', {
        hint: 'Pick a different destination, or use the swap button to reverse the direction.',
      })
    }

    this.setStep('preflight', { detail: `Signing in to ${from.label}` })
    await this.loginToSource(from.label)
    const session = this.source.session
    if (!session) throw new MigrationError(`Signed in to ${from.label} but got no session back.`)

    this.setStep('preflight', { detail: 'Reading your identity record' })
    const identity = await resolveIdentity(session.did)

    if (identity.didMethod === 'other') {
      throw new MigrationError(`Accounts using ${session.did.split(':').slice(0, 2).join(':')} cannot be migrated by this tool.`, {
        hint: 'Only did:plc and did:web accounts are supported.',
      })
    }

    const currentPds = identity.pdsUrl ? normalizeHost(identity.pdsUrl) : undefined
    if (currentPds && currentPds === normalizeHost(to.host)) {
      throw new MigrationError(`This account already lives on ${to.label}.`, {
        hint: 'Swap the direction if you meant to move it away.',
      })
    }

    this.setStep('preflight', { detail: `Checking that ${to.label} can take the account` })
    const described = await describeHost(to)
    if (!described.reachable || !described.did) {
      throw new MigrationError(`${to.label} (${to.host}) did not answer as an atproto PDS.`, {
        retryable: true,
        hint: described.unreachableReason,
      })
    }
    this.view.direction = { from, to: described }

    this.setStep('preflight', { detail: 'Taking inventory of what will move' })
    const status = await this.source.com.atproto.server.checkAccountStatus().catch(() => undefined)

    const inventory: AccountInventory = {
      did: session.did,
      handle: session.handle,
      didMethod: identity.didMethod,
      sourcePdsUrl: serviceUrl(from.host),
      didDocMatchesSource: currentPds === normalizeHost(from.host),
      repoCommit: status?.data.repoCommit,
      repoRev: status?.data.repoRev,
      repoBlocks: status?.data.repoBlocks,
      indexedRecords: status?.data.indexedRecords,
      privateStateValues: status?.data.privateStateValues,
      expectedBlobs: status?.data.expectedBlobs,
      importedBlobs: status?.data.importedBlobs,
    }
    this.view.inventory = inventory

    if (!inventory.didDocMatchesSource) {
      this.log(
        'warn',
        'preflight',
        `Your identity record points at ${identity.pdsUrl ?? 'nowhere'}, not ${from.host}. ` +
          'Migration will still export from the server you signed in to.',
      )
    }
    this.log(
      'info',
      'preflight',
      `${inventory.handle} (${inventory.did}) — ${inventory.indexedRecords ?? '?'} records, ${inventory.expectedBlobs ?? '?'} blobs.`,
    )
  }

  /** Sign in, pausing for a two-factor code instead of dead-ending on one. */
  private async loginToSource(label: string, authFactorToken?: string) {
    const identifier = this.input.source.identifier.replace(/^@/, '')
    try {
      await this.source.login({ identifier, password: this.input.source.password, authFactorToken })
    } catch (err) {
      if (!authFactorToken && /AuthFactorTokenRequired/i.test(errMessage(err))) {
        const answer = await this.waitForUser({
          kind: 'source-2fa',
          message: `${label} protects this account with a sign-in code. Check the email on your ${label} account and enter the code.`,
        })
        await this.loginToSource(label, (answer.code ?? '').trim())
        return
      }
      throw loginError(err, label)
    }
  }

  private async createAccount() {
    const inv = this.requireInventory()
    const to = this.view.direction.to
    if (!to.did) throw new MigrationError('Destination server DID is unknown; re-run preflight.')

    const details = await this.collectTargetDetails(inv.handle, to)

    this.setStep('create-account', { detail: `Asking ${this.view.direction.from.label} to vouch for you` })
    let serviceJwt: string
    try {
      const res = await this.source.com.atproto.server.getServiceAuth({
        aud: to.did,
        lxm: 'com.atproto.server.createAccount',
        exp: Math.floor(Date.now() / 1000) + 60 * 10,
      })
      serviceJwt = res.data.token
    } catch (err) {
      throw privilegeError(err, 'ask your current server for a migration token')
    }

    const handle = details.handle.replace(/^@/, '')
    this.setStep('create-account', { detail: `Reserving ${handle} on ${to.label}` })
    try {
      await this.target.com.atproto.server.createAccount(
        {
          did: inv.did,
          handle,
          email: details.email,
          password: details.password,
          inviteCode: details.inviteCode || undefined,
        },
        { headers: { authorization: `Bearer ${serviceJwt}` }, encoding: 'application/json' },
      )
    } catch (err) {
      // A previous attempt may already have created it; adopt it if the DID matches.
      const adopted = await this.adoptExistingTargetAccount(inv.did, handle, details.password)
      if (!adopted) throw createAccountError(err, to.label)
      this.log('info', 'create-account', `Reusing the account already created on ${to.label}.`)
      return
    }

    await this.target.login({ identifier: handle, password: details.password })
    this.log('info', 'create-account', `Created a deactivated account for ${inv.did} on ${to.label}.`)
  }

  /**
   * Ask for the destination account details only once the old account has been
   * verified and inventoried, so nobody fills in a form for a move that was
   * never going to work.
   */
  private async collectTargetDetails(currentHandle: string, to: typeof this.view.direction.to): Promise<TargetDetails> {
    if (this.target_?.password) return this.target_

    const domains = to.availableUserDomains ?? []
    const localPart = currentHandle.split('.')[0]
    const suggested = domains.length ? `${localPart}${domains[0]}` : undefined

    const answer = await this.waitForUser({
      kind: 'destination-details',
      message: `Choose how your account will be known on ${to.label}. Your posts, follows and DID stay the same.`,
      availableUserDomains: domains,
      inviteCodeRequired: to.inviteCodeRequired ?? false,
      suggestedHandle: suggested,
    })

    const details: TargetDetails = {
      handle: (answer.handle ?? '').trim(),
      email: (answer.email ?? '').trim(),
      password: answer.password ?? '',
      inviteCode: answer.inviteCode?.trim() || undefined,
    }

    if (!details.handle) throw new MigrationError('A handle is required for the new account.', { retryable: true })
    if (!details.email) throw new MigrationError('An email address is required for the new account.', { retryable: true })
    if (details.password.length < 8) {
      throw new MigrationError('Pick a password of at least 8 characters for the new account.', { retryable: true })
    }
    if ((to.inviteCodeRequired ?? false) && !details.inviteCode) {
      throw new MigrationError(`${to.label} requires an invite code.`, { retryable: true })
    }

    this.target_ = details
    return details
  }

  private async adoptExistingTargetAccount(did: string, handle: string, password: string): Promise<boolean> {
    try {
      await this.target.login({ identifier: handle, password })
      return this.target.session?.did === did
    } catch {
      return false
    }
  }

  private async transferRepo() {
    const inv = this.requireInventory()
    this.setStep('transfer-repo', { detail: 'Exporting your repository' })
    const car = await this.source.com.atproto.sync.getRepo({ did: inv.did })
    const bytes = toBytes(car.data)
    inv.repoCarBytes = bytes.byteLength
    this.setStep('transfer-repo', {
      detail: `Importing ${formatBytes(bytes.byteLength)} into ${this.view.direction.to.label}`,
    })
    await this.target.com.atproto.repo.importRepo(bytes, { encoding: 'application/vnd.ipld.car' })
    this.log('info', 'transfer-repo', `Moved ${formatBytes(bytes.byteLength)} of records.`)
  }

  private async transferBlobs() {
    const inv = this.requireInventory()
    const total = inv.expectedBlobs ?? 0
    let moved = 0

    // Each round re-lists what is still missing, so an interrupted run simply
    // picks up the remainder next time instead of tracking its own cursor state.
    for (let round = 0; round < 50; round++) {
      this.assertLive()
      const missing = await this.listMissingBlobs()
      const todo = missing.filter((cid) => !this.failedBlobs.has(cid))
      if (todo.length === 0) break

      for (const cid of todo) {
        this.assertLive()
        try {
          const blob = await this.source.com.atproto.sync.getBlob({ did: inv.did, cid })
          await this.target.com.atproto.repo.uploadBlob(toBytes(blob.data), {
            encoding: blob.headers['content-type'] || 'application/octet-stream',
          })
          moved++
        } catch (err) {
          // A blob the old server can no longer serve must not strand the move;
          // the record referencing it survives, the attachment does not.
          this.failedBlobs.add(cid)
          this.log('warn', 'transfer-blobs', `Skipped blob ${cid}: ${errMessage(err)}`)
        }
        this.setStep('transfer-blobs', {
          progress: { done: moved, total: Math.max(total, moved + todo.length), unit: 'files' },
          detail: `Copying media (${moved} moved${this.failedBlobs.size ? `, ${this.failedBlobs.size} unavailable` : ''})`,
        })
      }
    }

    if (this.failedBlobs.size) {
      this.log(
        'warn',
        'transfer-blobs',
        `${this.failedBlobs.size} attachment(s) could not be copied and are listed in the receipt.`,
      )
    }
    this.setStep('transfer-blobs', {
      progress: { done: moved, total: Math.max(total, moved), unit: 'files' },
      detail: undefined,
    })
  }

  private async listMissingBlobs(): Promise<string[]> {
    const out: string[] = []
    let cursor: string | undefined
    do {
      const res = await this.target.com.atproto.repo.listMissingBlobs({ limit: BLOB_PAGE, cursor })
      out.push(...res.data.blobs.map((b) => b.cid))
      cursor = res.data.cursor
    } while (cursor)
    return out
  }

  private async transferPreferences() {
    this.setStep('transfer-preferences', { detail: 'Copying feeds, mutes and settings' })
    try {
      const prefs = await this.source.app.bsky.actor.getPreferences()
      await this.target.app.bsky.actor.putPreferences({ preferences: prefs.data.preferences })
      this.log('info', 'transfer-preferences', `Copied ${prefs.data.preferences.length} preference entries.`)
    } catch (err) {
      // Preferences are convenience state, not identity. Losing them is a note, not a failure.
      this.setStep('transfer-preferences', { status: 'skipped', endedAt: Date.now() })
      this.log('warn', 'transfer-preferences', `Could not copy preferences: ${errMessage(err)}`)
    }
  }

  private async migrateIdentity() {
    const inv = this.requireInventory()
    this.setStep('identity', { detail: 'Reading the destination’s signing keys' })
    const recommended = await this.target.com.atproto.identity.getRecommendedDidCredentials()

    if (inv.didMethod === 'web') {
      await this.migrateDidWeb(inv, recommended.data)
    } else {
      await this.migrateDidPlc(recommended.data)
    }

    // From here the network resolves the account to its new home.
    this.view.safeToAbandon = false
    this.emit()
  }

  private async migrateDidPlc(recommended: RecommendedDidCredentials) {
    this.setStep('identity', { detail: 'Requesting a confirmation code from your old server' })
    try {
      await this.source.com.atproto.identity.requestPlcOperationSignature()
    } catch (err) {
      throw privilegeError(err, 'request an identity-change code')
    }

    const answer = await this.waitForUser({
      kind: 'plc-token',
      sentTo: maskEmail(this.input.source.identifier),
      message: `${this.view.direction.from.label} just emailed a confirmation code to the address on your old account. Enter it to point your identity at ${this.view.direction.to.label}.`,
    })

    this.setStep('identity', { detail: 'Signing the identity update' })
    const signed = await this.source.com.atproto.identity.signPlcOperation({
      token: (answer.code ?? '').trim(),
      ...recommended,
    })

    this.setStep('identity', { detail: 'Publishing the identity update' })
    await this.target.com.atproto.identity.submitPlcOperation({ operation: signed.data.operation })
    this.log('info', 'identity', 'Identity record now points at the new server.')
  }

  private async migrateDidWeb(inv: AccountInventory, recommended: RecommendedDidCredentials) {
    await this.waitForUser({
      kind: 'did-web-update',
      message:
        `${inv.did} is a did:web identity, so only you can move it. Publish the document below at ` +
        `https://${inv.did.slice('did:web:'.length)}/.well-known/did.json, then continue.`,
      didDocument: {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: inv.did,
        ...recommended,
      },
    })

    this.setStep('identity', { detail: 'Checking your published identity document' })
    const resolved = await resolveIdentity(inv.did)
    if (!resolved.pdsUrl || normalizeHost(resolved.pdsUrl) !== normalizeHost(this.view.direction.to.host)) {
      throw new MigrationError('Your identity document still does not point at the new server.', {
        retryable: true,
        hint: `It currently resolves to ${resolved.pdsUrl ?? 'nothing'}. DNS and CDN caches can take a few minutes.`,
      })
    }
  }

  private async goLive() {
    this.setStep('go-live', { detail: `Activating your account on ${this.view.direction.to.label}` })
    await this.target.com.atproto.server.activateAccount()

    if (this.input.keepSourceActive) {
      this.log('info', 'go-live', `Left the ${this.view.direction.from.label} account active at your request.`)
      return
    }

    this.setStep('go-live', { detail: `Standing down your ${this.view.direction.from.label} account` })
    try {
      await this.source.com.atproto.server.deactivateAccount({})
      this.log('info', 'go-live', `Deactivated the old account on ${this.view.direction.from.label}. Its data is untouched.`)
    } catch (err) {
      // The move already succeeded; a stubborn old host is a cleanup task.
      this.log('warn', 'go-live', `Could not deactivate the old account: ${errMessage(err)}`)
    }
  }

  private async verify() {
    const inv = this.requireInventory()
    this.setStep('verify', { detail: 'Comparing the new account against the old one' })

    const status = await this.target.com.atproto.server.checkAccountStatus()
    const identity = await resolveIdentity(inv.did).catch(() => undefined)
    const d = status.data

    const checks: VerificationReport['checks'] = [
      {
        name: 'Account is active',
        ok: d.activated === true,
        expected: 'active',
        actual: d.activated ? 'active' : 'not active',
      },
      {
        name: 'Identity resolves to the new server',
        ok: !!identity?.pdsUrl && normalizeHost(identity.pdsUrl) === normalizeHost(this.view.direction.to.host),
        expected: this.view.direction.to.host,
        actual: identity?.pdsUrl ? normalizeHost(identity.pdsUrl) : 'unresolved',
      },
      {
        name: 'Server accepts the identity as valid',
        ok: d.validDid === true,
        expected: 'valid',
        actual: d.validDid ? 'valid' : 'invalid',
      },
      {
        name: 'Records',
        ok: inv.indexedRecords === undefined || d.indexedRecords >= inv.indexedRecords,
        expected: `${inv.indexedRecords ?? '?'}`,
        actual: `${d.indexedRecords}`,
      },
      {
        name: 'Media files',
        ok: d.importedBlobs + this.failedBlobs.size >= (d.expectedBlobs ?? 0),
        expected: `${d.expectedBlobs ?? 0}`,
        actual: `${d.importedBlobs}${this.failedBlobs.size ? ` (+${this.failedBlobs.size} unavailable at source)` : ''}`,
      },
    ]

    const report: VerificationReport = { ok: checks.every((c) => c.ok), checks }
    this.view.verification = report
    if (!report.ok) {
      const failed = checks.filter((c) => !c.ok).map((c) => c.name)
      this.log('warn', 'verify', `Checks needing attention: ${failed.join(', ')}.`)
    } else {
      this.log('info', 'verify', 'Everything checks out.')
    }
  }

  // ------------------------------------------------------------------- accessors

  get unavailableBlobs(): string[] {
    return [...this.failedBlobs]
  }

  private requireInventory(): AccountInventory {
    if (!this.view.inventory) throw new MigrationError('Preflight has not run yet.')
    return this.view.inventory
  }
}

// ------------------------------------------------------------------------ helpers

function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  throw new MigrationError('Server returned an unexpected response body.')
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function normalizeError(err: unknown): MigrationError {
  if (err instanceof MigrationError) return err
  return new MigrationError(errMessage(err) || 'Something went wrong.', { retryable: true })
}

function maskEmail(identifier: string): string | undefined {
  const at = identifier.indexOf('@')
  if (at <= 0 || !identifier.includes('.', at)) return undefined
  return `${identifier[0]}${'•'.repeat(Math.max(at - 1, 1))}${identifier.slice(at)}`
}

function loginError(err: unknown, label: string): MigrationError {
  const msg = errMessage(err)
  if (/AuthFactorTokenRequired/i.test(msg)) {
    return new MigrationError(`${label} wants your two-factor code.`, {
      retryable: true,
      hint: 'Check your email for a sign-in code and add it to the two-factor field.',
    })
  }
  if (/Invalid identifier or password/i.test(msg)) {
    return new MigrationError(`${label} rejected that handle or password.`, {
      retryable: true,
      hint: 'Double-check the password — and note that app passwords are not allowed to move an account, only your real one.',
    })
  }
  if (/rate ?limit/i.test(msg)) {
    return new MigrationError(`${label} is rate limiting sign-in attempts.`, {
      retryable: true,
      hint: 'Wait a few minutes and try again.',
    })
  }
  return new MigrationError(`Could not sign in to ${label}: ${msg}`, { retryable: true })
}

function privilegeError(err: unknown, action: string): MigrationError {
  const msg = errMessage(err)
  if (/app ?password|AuthRequired|Insufficient|privileg/i.test(msg)) {
    return new MigrationError(`Your current server would not let this session ${action}.`, {
      retryable: true,
      hint: 'Sign in with your main account password — app passwords are not allowed to move an account.',
    })
  }
  return new MigrationError(`Could not ${action}: ${msg}`, { retryable: true })
}

function createAccountError(err: unknown, label: string): MigrationError {
  const msg = errMessage(err)
  if (/Handle already taken|HandleNotAvailable/i.test(msg)) {
    return new MigrationError(`That handle is already taken on ${label}.`, {
      retryable: true,
      hint: 'Pick a different handle for your new home.',
    })
  }
  if (/invite/i.test(msg)) {
    return new MigrationError(`${label} did not accept that invite code.`, { retryable: true })
  }
  if (/email/i.test(msg)) {
    return new MigrationError(`${label} did not accept that email address: ${msg}`, { retryable: true })
  }
  return new MigrationError(`${label} refused to create the account: ${msg}`, { retryable: true })
}

export type { Direction, RunView, StartRunInput }
