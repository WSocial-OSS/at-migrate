# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

First public shape of the wizard. Not yet tagged.

### Added
- Relay fallback: if the primary `listHosts` relay is down and there is no
  cache, the directory is fetched from `relay1.us-east.bsky.network`.
- English UI copy dictionary (`src/lib/ui/copy.ts`) so later locales do not
  hunt through JSX.
- Keyboard handling on the host picker (Escape closes and restores focus).

### Fixed
- Account passwords can no longer appear in `JSON.stringify(run)` (JS-private
  fields).
- Canceling an idle run now marks it canceled instead of leaving it idle.
- `formatBytes` covers terabytes and rejects negative or non-finite input.

### Also in this release
- Account migration wizard for moving an atproto account between any PDS,
  keeping the same DID, handle, posts, media, follows and followers.
- Source PDS discovery from a handle (DID document), not a hardcoded list.
- Destination directory from `com.atproto.sync.listHosts`, with Bluesky shards
  collapsed, bridges excluded, and ephemeral deploys hidden.
- MIT license, Contributor Covenant, DCO, CI, and contributor documentation.
