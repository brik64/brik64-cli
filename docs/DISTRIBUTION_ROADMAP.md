# BRIK64 CLI Distribution Roadmap

This roadmap tracks public beta distribution channels for BRIK64 CLI. For the
public product milestones, read [`PUBLIC_ROADMAP.md`](PUBLIC_ROADMAP.md).
Distribution channels support platform coverage; they are not the public
milestones by themselves.

## Current Public Channels

- brik64.com curl installer: primary public CLI install path.
- Cloud Run counted download endpoint: records beta4 platform requests and
  redirects to verified release assets.
- GitHub Releases: release notes, source archive, and platform assets.
- npmjs: SDK registry only; `@brik64/cli` is a legacy CLI channel and is not the
  beta4 install path.

## Required Next Channels

| Channel | Target | Status | Evidence Required |
| --- | --- | --- | --- |
| macOS Apple Silicon | curl, GitHub release asset | Current beta lane | package smoke, checksum, release manifest |
| Linux x64 | curl, GitHub release asset | Current beta lane | Ubuntu x64 smoke, checksum, release manifest |
| macOS Intel | GitHub release asset, curl fail-closed, Homebrew later | Pending runner | Intel runner/install smoke, checksum, release manifest |
| Linux ARM64 | GitHub release asset, curl fail-closed | Pending runner | ARM64 runner/install smoke, checksum, release manifest |
| Windows PC native | no beta4 public asset | Blocked | verified executable, checksum, release manifest |
| Homebrew | tap formula | Planned | formula audit, install smoke, checksum binding |
| npm SDK | `@brik64/core@0.1.0-beta.4` | Required for beta4 SDK | npm pack, install smoke, registry verification |

## Automation Boundary

Each channel must publish only after platform-specific package, install,
checksum, and release-evidence gates pass. Docs, GitHub Releases, Cloud Run,
curl, SDK npm metadata, Homebrew, and brik64.com should reference the same
version and artifact evidence. npm is not a CLI distribution channel in beta4.

## Internal Tracking Boundary

Internal GitHub Projects may track execution details, owners, scheduling, and
private blockers. Public roadmap readers should not depend on those boards.

Public channel readiness should be reflected through this repository's public
roadmap, GitHub Releases, docs, package metadata, and issues for reproducible
public bugs or metadata mismatches.

Internal tracking should still capture:

- target platform;
- distribution channel;
- required artifact;
- smoke command;
- checksum or signature requirement;
- docs/Mintlify update requirement;
- release blocker status.
