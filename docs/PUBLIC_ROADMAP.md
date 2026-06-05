# BRIK64 CLI Public Roadmap

This roadmap describes the public beta direction for BRIK64 CLI. It is written
for developers, AI agents, package reviewers, and operators who need to
understand what the public CLI is moving toward without depending on internal
GitHub Projects or private planning boards.

GitHub Projects are used for internal execution tracking. Public status is
reported through this file, GitHub Releases, curl installer metadata, docs, and
issues when a reproducible public bug or metadata mismatch needs discussion.

## Current Public Beta

Current public beta: `0.1.0-beta.5`.

The latest public release remains defined by the curl installer, GitHub
Releases, checksums, and release manifests.

Current public install path:

```sh
curl -fsSL https://brik64.com/cli/install.sh | bash
```

The beta5 release targets local CLI evaluation, `.brik` project metadata,
PCD-oriented local evidence, `brik doctor`, local candidate certification, and
hash-bound candidate output generation for targets shown by the installed
`brik help` output.

Next planning target: `0.1.0-beta.6`. See `docs/BETA6_RELEASE_PLAN.md`.

## Milestone 1: Platform CLI Beta Coverage

Goal: make the BRIK64 CLI beta operational across the primary developer
platforms with platform-specific packages, install smoke tests, checksums, and
release notes.

| Platform | Public target | Status | Promotion evidence |
| --- | --- | --- | --- |
| macOS Apple Silicon | curl installer plus GitHub Release asset | Current beta lane | package smoke, checksum, release manifest |
| Linux x64 | curl installer plus GitHub Release asset | Current beta lane | Ubuntu x64 install smoke, checksum, release manifest |
| macOS Intel | GitHub Release asset; installer fail-closed until runner passes | Pending runner | Intel install smoke, checksum, release manifest |
| Linux ARM64 | GitHub Release asset; installer fail-closed until runner passes | Pending runner | Linux ARM64 install smoke, checksum, release manifest |
| Windows PC native | no public asset | Blocked | verified Windows executable, checksum, release manifest |

This milestone is complete only when each listed platform has a public package
or documented install path, a versioned release reference, and a platform-specific
smoke result. Distribution channels such as Homebrew or hosted package mirrors
support this milestone only after they point to the same curl/GitHub evidence.

## Milestone 2: Distribution Channel Hardening

Goal: make public installation and update paths easier to verify without
weakening the beta evidence boundary.

Planned lanes:

- Curl installer on brik64.com as the official CLI install path.
- Cloud Run counted download endpoint that records beta platform downloads and
  redirects to verified GitHub Release assets.
- Homebrew tap formula for macOS only after formula audit, smoke, and checksum gates.
- brik64.com and docs.brik64.com install pages aligned to the same current beta
  version and release evidence.

Each channel must point back to the same package version, release notes, and
artifact evidence. A new channel is not promoted publicly until its install
smoke and metadata checks pass.

## Milestone 3: Agent Workflow Alignment

Goal: make the CLI, docs, and public BRIK64 agent skills agree on how agents
should work from the logic layer.

Public targets:

- `brik help` lists only commands supported by the installed beta.
- docs.brik64.com documents the current command surface.
- `brik64-tools-skills` points agents to the CLI, PCD 1.0 standard, `.brik`
  traceability rules, and claim-safe reporting.
- `AGENTS.md` writes remain explicit, reviewable, and consent-based.

## Milestone 4: SDK And Language Surface Alignment

Goal: align SDK references with released package surfaces and avoid presenting
reference examples as published SDK install channels before release notes list
them.

Public targets:

- JavaScript/TypeScript SDK beta4 was distributed through npm as
  `@brik64/core@0.1.0-beta.4`.
- Beta5 SDKs must be regenerated through the L6+N5 internal artifact-factory
  policy before marketplace publication.
- Python and Rust references remain marked as reference surfaces until a future
  release explicitly opens those marketplace paths.
- Docs and release notes identify exact SDK package versions before recommending
  install commands outside the CLI.

## Claim Boundary

This roadmap is public planning. Current availability is defined by released
packages, GitHub Releases, docs, installed CLI output, and platform-specific
evidence. Stronger statements require matching artifacts, hashes, release notes,
tests, and evidence gates.

Use the current GitHub Release, curl installer, installed `brik64 --version`,
and docs.brik64.com as the public source for what is available now.
