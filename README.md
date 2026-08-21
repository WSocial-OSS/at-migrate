# Move your account

A migration wizard for atproto accounts. It moves a Bluesky, EuroSky, WSocial or
any other PDS account to a different PDS — and back — keeping the same DID,
handle, posts, media, follows and followers.

Standalone Next.js app for now, built so the moving parts can be lifted into the
WSocial signup flow later (see [Merging into WSocial](#merging-into-wsocial)).

## Why "and back" is free

Migration is symmetric. A run is a source host, a destination host, and one
account; reversing it means swapping the two hosts. There is no separate
"leaving" flow to build or keep correct — the swap button in the direction picker
*is* the return trip, and the receipt a completed run produces records the
reverse direction so the wizard can be seeded from it.

## What it actually does

The standard atproto account migration, in the order that keeps the account
recoverable for as long as possible:

| Step | Calls |
| --- | --- |
| Check the account | `login` on the source, DID document resolution, `com.atproto.server.checkAccountStatus`, `com.atproto.server.describeServer` on the destination |
| Claim the new account | `com.atproto.server.getServiceAuth` (aud = destination DID, lxm = `createAccount`) → `com.atproto.server.createAccount` on the destination with the existing DID |
| Move the data | `com.atproto.sync.getRepo` → `com.atproto.repo.importRepo`; `com.atproto.repo.listMissingBlobs` → `com.atproto.sync.getBlob` → `com.atproto.repo.uploadBlob`; `app.bsky.actor.getPreferences` → `putPreferences` |
| Hand over the identity | `com.atproto.identity.getRecommendedDidCredentials` → `requestPlcOperationSignature` → *(user enters emailed code)* → `signPlcOperation` on the source → `submitPlcOperation` on the destination. For `did:web`, the user publishes the document themselves and the app verifies it resolved. |
| Go live | `com.atproto.server.activateAccount` on the destination, `deactivateAccount` on the source |
| Verify | `checkAccountStatus` on the destination compared against the pre-migration inventory, plus a fresh DID resolution |

Nothing about the account changes until the identity step. Everything before it
leaves the old account live and serving, which is why the UI can honestly say
"still reversible" up to that point — `RunView.safeToAbandon` is the flag it
keys off, and it flips the moment the PLC operation is submitted.

### Deliberate behaviours worth knowing

- **A blob the old server cannot serve does not fail the run.** It is skipped,
  counted, logged, and listed in the receipt. Real repositories have dead blobs;
  stranding a migration over one would be worse than losing the attachment.
- **Preferences are best-effort.** They are convenience state, not identity, so a
  failure there marks the substep skipped rather than failing the move.
- **A half-finished run is resumable.** Blob transfer re-lists what is still
  missing each round instead of tracking its own cursor, and `create-account`
  adopts an account a previous attempt already created if the DID matches. Retry
  continues from the first step that has not completed.
- **App passwords are refused by design.** Migration needs real account auth. The
  form says so before the user hits the error, and the error says so again.
- **Two-factor is a pause, not a dead end.** `AuthFactorTokenRequired` turns into
  a blocker asking for the code, then retries the login.

## Configuration

```bash
cp .env.example .env.local
```

| Variable | Notes |
| --- | --- |
| `WSOCIAL_PDS_HOST` | **You must set this.** The WSocial PDS hostname. It is the one value that cannot be guessed; every other default in this repo was probed against the live network. If it is wrong, the direction picker shows WSocial as "not answering" rather than failing mid-migration. |
| `WSOCIAL_INVITE_CODE` | Optional. Only relevant if the WSocial PDS is invite-only. |
| `EUROSKY_PDS_HOST` | Optional override. Defaults to `eurosky.social`, verified as a live PDS (`did:web:eurosky.social`). |
| `EXTRA_PDS_HOSTS` | Optional, `Label|hostname` comma separated. |

Every host — configured or typed in by the user — is probed with
`com.atproto.server.describeServer` before the wizard will use it, so a stale
hostname degrades to a disabled menu entry instead of a broken run.

## Running it

```bash
npm install && npm run dev
```

Then open http://localhost:3210. `npm test` runs the unit tests, `npm run
typecheck` and `npm run build` the rest.

### Deployment constraint

Runs live in process memory (`src/lib/migration/store.ts`) and nowhere else,
because a run in flight holds the user's real account password. That rules out
spreading this across serverless instances: deploy it as a single long-lived
Node process. If WSocial later needs horizontal scaling, replace that one module
— the engine keeps no global state of its own.

Credentials are dropped when a run finishes, is canceled, or ages out (one hour),
and never appear in `RunView`, the SSE stream, the receipt, or the logs.

## Deploying (Railway)

`railway.json` builds with Nixpacks, starts with `npm run start` (which honours
Railway's injected `PORT`), and healthchecks `/api/health`. That endpoint reports
whether `WSOCIAL_PDS_HOST` is set, because a deploy can be green and still be a
broken environment if it is missing.

`numReplicas` is pinned to **1** on purpose. See the deployment constraint below:
runs live in the process that started them, so a second replica would answer a
blocker request for a run it has never heard of.

Set per-environment variables on the service (`WSOCIAL_PDS_HOST` at minimum),
then `railway up` — or connect the GitHub repo for push-to-deploy.

## Architecture

```
src/lib/migration/engine.ts   MigrationRun — the whole migration, framework-free
src/lib/migration/types.ts    Domain types, including the Blocker union
src/lib/migration/store.ts    In-memory run registry (the swappable part)
src/lib/migration/receipt.ts  Downloadable record + the reverse direction
src/lib/atproto/*             Host probing, identity resolution, URL handling
src/app/api/*                 Thin HTTP layer: start, observe (SSE), answer, retry, cancel
src/components/*              The wizard — a renderer of run state
```

The design that keeps the UI small: **whenever the engine needs something only
the user has, it does not fail — it publishes a `Blocker` and waits.** Sign-in
codes, destination account details, PLC tokens and `did:web` publication are all
the same mechanism. The client renders whatever blocker is current and posts an
answer back, so the wizard holds no step-ordering logic and the engine stays the
single source of truth about where a run is.

Progress reaches the browser as whole `RunView` snapshots over SSE. The client
replaces state rather than merging it, so a dropped frame cannot desynchronise
the UI.

## Merging into WSocial

The seam is deliberate:

1. `src/lib/migration/` and `src/lib/atproto/` have no Next.js imports and no
   React. Copy them in as-is.
2. Replace `store.ts` with whatever session mechanism WSocial already has.
3. The API routes under `src/app/api/` are thin enough to rewrite against
   WSocial's own router; the contract is *start a run, stream snapshots, answer
   blockers, retry, cancel, fetch receipt*.
4. `src/components/` is the part expected to be replaced by WSocial's own design
   system. `RunProgress` groups the eight engine steps into the five a person
   cares about, which is the piece worth keeping conceptually even if the markup
   changes.

For the signup-flow version, the natural shape is "already have an account
elsewhere?" as a branch on the signup screen, which skips the direction picker
(destination is always WSocial) and reuses everything else.

## Limits

- Only `did:plc` and `did:web` accounts. Anything else is refused in preflight.
- Direct messages and notification history are not part of an atproto
  repository, so they do not move. The UI says this before sign-in rather than
  after.
- A source handle issued by the old server (`you.bsky.social`) does not come
  with you; a handle on a domain you own does.
- The destination PDS must allow account creation with an existing DID via a
  service-auth token, which is the standard path but can be disabled.
