# Security policy

## Supported versions

This repository is **Tier 1 — supported**. The `main` branch is the only
supported line.

## Reporting a vulnerability

Report vulnerabilities **privately** through GitHub's private vulnerability
reporting:

<https://github.com/WSocial-OSS/at-migrate/security/advisories/new>

Do not file a public issue. Do not discuss an undisclosed vulnerability in a
pull request or discussion.

This project does not use a security email address. GitHub private reporting is
the only intake.

### What to include

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept if you have one
- Affected commit SHA or deploy, if known

Do not attach real account passwords, PLC tokens, invite codes, or other users'
data. Use a throwaway account and redacted logs.

### Credential handling (for reporters)

A run holds the user's real account password in process memory only
(`src/lib/migration/store.ts`). Credentials are dropped on cancel, TTL expiry,
or completion via `forgetCredentials()`. Reports that a password, invite code,
or PLC token leaks into `RunView`, the SSE stream, a receipt, logs, or disk are
especially welcome.

App passwords are refused on purpose. The identity step (`safeToAbandon`
flipping to false) is the point of no return.

This app must be deployed as a single long-lived Node process, not serverless:
runs are not shared across instances.

### Response

Maintainers listed in [CODEOWNERS](.github/CODEOWNERS) will acknowledge the
report and keep you informed of the fix timeline. Please give us a reasonable
window before any public disclosure.
