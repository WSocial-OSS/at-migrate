# Good first issues

These are sized for a first-time atproto contributor. Each one is local, does
not need a W account or a live PDS login, and can ship as its own pull request.

English is the working language; pull requests in other languages are welcome.

Before you start: follow [CONTRIBUTING.md](../CONTRIBUTING.md) (Node 22, `npm
install`, `git commit -s`). Pick **one** item. Open an issue pointing here if
you want it assigned, then a pull request against `main`.

## 1. More product names in `registry.ts`

The live directory is thousands of hostnames. Only a handful have a name people
recognise, and those live in `KNOWN_NAMES` in
[`src/lib/atproto/registry.ts`](../src/lib/atproto/registry.ts). Everything else
is shown as its hostname, which is honest but cold.

**Do this:**

1. Find a PDS that already appears in the relay directory and has a public
   product name (Blacksky-adjacent hosts, university servers, named community
   PDS). Confirm the hostname is the account home, not a bridge or a
   `*.host.bsky.network` shard.
2. Add one line to `KNOWN_NAMES`.
3. Add a `labelFor(...)` assertion in
   [`src/lib/atproto/registry.test.ts`](../src/lib/atproto/registry.test.ts).

**Done when:** `npm test` is green and the new name is the one the community
actually uses, not a guess. Do not mark a bridge as listable.

## 2. Unit tests for `isListable`, `forgetCredentials`, and inventory formatting

[`registry.test.ts`](../src/lib/atproto/registry.test.ts) already covers a Bluesky
shard, `atproto.brid.gy`, and one Railway preview host.
[`format.test.ts`](../src/lib/migration/format.test.ts) covers a few
`formatBytes` sizes. Two gaps are still easy:

**`isListable` edge cases** in `registry.test.ts`:

- `bsky.brid.gy` (the second bridge in `BRIDGES`)
- a few more ephemeral suffixes already listed in `EPHEMERAL_SUFFIXES`
  (`.fly.dev`, `.ngrok-free.app`, `.ts.net`, …)
- a named product host stays listable (`eurosky.social`, `bsky.social`)

**`forgetCredentials`** in a new `src/lib/migration/engine.test.ts` (or
`store.test.ts`):

- Construct a `MigrationRun` with a dummy `StartRunInput` — the constructor
  does not touch the network.
- Assert `JSON.stringify(run.snapshot())` never contains the password
  (passwords must not enter `RunView`).
- Call `run.forgetCredentials()`. `input` is private; a tiny test hook is
  acceptable (for example a package-private flag, or asserting the original
  password string is gone from `JSON.stringify(run)`). Do not log, print, or
  serialize credentials in production code.
- Optional: `createRun` / `dropRun` from
  [`store.ts`](../src/lib/migration/store.ts) so a dropped run is no longer in
  `getRun`.

**Inventory formatting:** add cases to `format.test.ts` for `0`, `1023`,
`1024`, and a terabyte-scale number so receipt sizes stay readable.

Do **not** add a live-PDS test and do **not** rewrite engine control flow.

## 3. Extract UI copy toward i18n

Wizard copy is inline English in [`src/components/`](../src/components/) and
[`src/app/page.tsx`](../src/app/page.tsx). A full translation framework is
out of scope for a first PR.

**Do this:**

1. Collect user-visible strings from `page.tsx`, `SetupForm.tsx`,
   `DirectionPicker.tsx`, `BlockerForm.tsx`, `RunProgress.tsx`, and
   `Outcome.tsx` into something like `src/lib/ui/copy.ts` (a typed English
   dictionary) or `messages/en.json`.
2. Switch those components to read from the dictionary.
3. Leave engine log lines and `MigrationError` messages alone — those are
   operator-facing and can follow later.

**Done when:** the English UI is unchanged, grep of those components shows
almost no remaining string literals, and `npm run typecheck` is green. A second
locale is optional, not required.

## 4. Accessibility pass on the forms

The wizard is a sequence of forms: host picker, sign-in, 2FA / PLC code,
destination details, `did:web` paste.

**Do this**, in [`src/components/SetupForm.tsx`](../src/components/SetupForm.tsx),
[`BlockerForm.tsx`](../src/components/BlockerForm.tsx), and
[`DirectionPicker.tsx`](../src/components/DirectionPicker.tsx):

- Every input has a `<label>` (or `aria-label`) wired with `htmlFor`.
- Password field uses `autocomplete="current-password"`; identifier uses
  `autocomplete="username"`.
- Errors are associated with the field (`aria-invalid`, `aria-describedby`)
  and announced (`role="alert"` or `aria-live`).
- The host-picker popover is keyboard operable (Escape closes, focus returns
  to the opener, list items are buttons or have `role="option"`).
- When a `Blocker` appears, focus moves into its first field.

**Done when:** you can complete the setup screen and a mocked blocker with
the keyboard only, and you list the checks you ran in the pull request. No
visual redesign.

## 5. Document — and optionally wire — a second relay fallback

[`src/lib/atproto/relay.ts`](../src/lib/atproto/relay.ts) talks to
`ATPROTO_RELAY_HOST` or `relay1.us-west.bsky.network`. A single relay outage
empties the destination directory until cache exists.

**Do this:**

1. Document known public relays in the README configuration table (Bluesky
   currently also operates `relay1.us-east.bsky.network`; others exist on
   the network — cite what you verified).
2. Optional small code change: if `fetchAll()` throws and there is no cache,
   retry once against a documented fallback host. Keep the 30-minute cache
   and the "serve stale on refresh failure" behaviour.
3. Unit-test the fallback by injecting the host list or stubbing `fetch` —
   do not hit a live relay in CI.

**Done when:** a contributor can set `ATPROTO_RELAY_HOST` from the README
alone, and a primary-relay failure no longer requires a code edit to recover
(docs-only is acceptable if the code change is too much for one PR).
