# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

First public shape of the wizard. Not yet tagged.

### Added

- Account migration wizard for moving an atproto account between any PDS,
  keeping the same DID, handle, posts, media, follows and followers.
- Source PDS discovery from a handle (DID document), not a hardcoded list.
- Destination directory from `com.atproto.sync.listHosts`, with Bluesky shards
  collapsed, bridges excluded, and ephemeral deploys hidden.
- MIT license, Contributor Covenant, DCO, CI, and contributor documentation.
