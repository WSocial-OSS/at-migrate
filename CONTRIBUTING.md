# Contributing

English is the working language of this repository. Issues and pull requests in
other languages are welcome — we will translate as needed.

By contributing you agree to the [Developer Certificate of Origin](https://developercertificate.org/)
(DCO). There is no CLA.

Please also follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Five-minute local setup

Requires [Node.js 22+](https://nodejs.org/). No W account, invite, passport, or
production credentials.

```bash
git clone https://github.com/WSocial-OSS/at-migrate.git
cd at-migrate
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3210. Copying `.env.example` is enough: it already points
the featured W host at the public PDS hostname. The destination list is loaded
from a public relay.

Alternatively, open the repo in the [Dev Container](.devcontainer/devcontainer.json)
(VS Code or GitHub Codespaces). Port 3210 is forwarded and `npm install` runs on
create.

Do not commit `.env`, `.env.local`, `node_modules/`, `.next/`, `decision-briefs/`,
or `.gstack/`.

## Checks

Run these before you open a pull request:

```bash
npm test
npm run typecheck
npm run build
```

`npm test` runs `tsx --test` over `src/**/*.test.ts`. Tests that hit the public
network (handle resolution) are skipped unless you set `LIVE=1`. There are no
tests that need a real account password, and we will not add any.

## Developer Certificate of Origin

Every commit must include a `Signed-off-by` trailer. Create commits with `-s`:

```bash
git commit -s -m "test: cover isListable for bsky.brid.gy"
```

That appends a line like `Signed-off-by: Your Name <you@example.com>` using
your `user.name` and `user.email`. If you forgot:

```bash
git commit --amend -s --no-edit
```

The trailer certifies the [DCO 1.1](https://developercertificate.org/) — you
wrote the change or have the right to submit it under the MIT license. The
pull request template has a matching checkbox; the trailer on the commits is
what counts.

Prefer the git CLI over the GitHub web editor, which does not add the trailer
for you.

## Code map

The migration engine is the source of truth. The UI renders it. Do not teach
the wizard to order steps on its own.

| Path | What it is |
| --- | --- |
| `src/lib/migration/engine.ts` | `MigrationRun` — the eight-step move, framework-free |
| `src/lib/migration/types.ts` | Domain types, including the `Blocker` union |
| `src/lib/migration/store.ts` | In-memory run registry. Holds the real account password in process memory only; `forgetCredentials()` on cancel / TTL / complete. Deploy as a single Node process, not serverless. |
| `src/lib/migration/receipt.ts` | Downloadable record plus the reverse direction |
| `src/lib/migration/format.ts` | Human-readable sizes for inventories and receipts |
| `src/lib/atproto/relay.ts` | Live host directory from `com.atproto.sync.listHosts`, cached |
| `src/lib/atproto/registry.ts` | Product names, Bluesky shard collapsing, bridges, ephemeral hosts |
| `src/lib/atproto/identity.ts` | Handle → DID document → source PDS |
| `src/app/api/*` | Thin HTTP: resolve, hosts, start, SSE, answer, retry, cancel, receipt |
| `src/components/*` | The wizard — a renderer of `RunView` |

Engine behaviour that should stay put unless a bug forces a change:

- Source PDS comes from the DID document, not a hardcoded list.
- App passwords are refused. Migration needs real account auth.
- `safeToAbandon` stays true until the PLC / `did:web` identity step.
- Dead blobs are skipped and listed on the receipt; they do not fail the run.
- Preferences are best-effort.

## What makes a good first issue

Tight, local, and testable without an atproto account. Start from
[docs/good-first-issues.md](docs/good-first-issues.md):

- another product name in `registry.ts` plus a unit test
- more `isListable` edge cases, or tests around `forgetCredentials` / inventory
  formatting
- extracting UI copy toward i18n
- an accessibility pass on the forms
- documenting (or wiring) a second relay fallback

A good first pull request touches one of those files, adds or updates a test
when behaviour changes, and leaves `engine.ts` control flow alone.

## Pull requests

- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `ci:`, `chore:`).
- Sign off every commit (`git commit -s`).
- Keep the diff to the problem. Do not reformat unrelated files.
- CI must be green: `test`, `typecheck`, `build`.
- Behaviour changes need tests. UI copy changes do not, but mention the
  strings you touched in the PR body.
- Do not add live-PDS tests that need credentials.
- Fill in the pull request template (summary, test plan, DCO checkbox).

Reviews look for: does it match the code map, are credentials still kept out of
`RunView` / logs / receipts, and is the five-minute local path still true.

## Security

Vulnerabilities go through GitHub private reporting only. See [SECURITY.md](SECURITY.md).
Do not file a public issue for an undisclosed security problem.
