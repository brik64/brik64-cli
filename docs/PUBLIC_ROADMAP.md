# BRIK64 CLI Public Roadmap

This roadmap describes the public beta direction for BRIK64 CLI. It is written
for developers, AI agents, package reviewers, and operators who need to
understand what the public CLI is moving toward without depending on internal
GitHub Projects or private planning boards.

GitHub Projects are used for internal execution tracking. Public status is
reported through this file, GitHub Releases, npm package metadata, docs, and
issues when a reproducible public bug or metadata mismatch needs discussion.

## Current Public Beta

Current beta: [`0.1.0-beta.3`](https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.3)

Current public install path:

```sh
npm install -g @brik64/cli@beta
```

The current beta supports local CLI evaluation, `.brik` project metadata,
PCD-oriented local evidence, and candidate output generation for targets shown
by the installed `brik help` output.

## Milestone 1: Platform CLI Beta Coverage

Goal: make the BRIK64 CLI beta operational across the primary developer
platforms with platform-specific packages, install smoke tests, checksums, and
release notes.

| Platform | Public target | Status | Promotion evidence |
| --- | --- | --- | --- |
| macOS Apple Silicon | npm beta plus GitHub Release asset | Current beta lane | package smoke, checksum, release manifest |
| macOS Intel | GitHub Release asset and documented install path | Planned | Intel install smoke, checksum, release manifest |
| Debian Linux | `.deb` package and documented install path | Planned | Debian build, install smoke, checksum, release manifest |
| Ubuntu Linux | `.deb` package and documented install path | Planned | Ubuntu build, install smoke, checksum, release manifest |
| Windows PC | installer or zip package and documented install path | Planned | Windows runner smoke, checksum, release manifest |

This milestone is complete only when each listed platform has a public package
or documented install path, a versioned release reference, and a platform-specific
smoke result. Distribution channels such as Homebrew, curl installers, apt
repositories, or hosted package mirrors support this milestone, but they are not
the milestone by themselves.

## Milestone 2: Distribution Channel Hardening

Goal: make public installation and update paths easier to verify without
weakening the beta evidence boundary.

Planned lanes:

- Homebrew tap formula for macOS once macOS platform packages pass install
  smoke and checksum gates.
- GCP-hosted curl installer only after the script verifies checksums and points
  to versioned release artifacts.
- GitHub Packages mirror for organization package inventory and release
  inspection.
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

- JavaScript/TypeScript examples stay aligned with CLI candidate output behavior.
- Python and Rust references remain marked as reference surfaces until public
  package release notes list install commands.
- Docs and release notes identify exact package versions before recommending
  install commands outside the CLI.

## Claim Boundary

This roadmap is public planning. Current availability is defined by released
packages, GitHub Releases, docs, installed CLI output, and platform-specific
evidence. Stronger statements require matching artifacts, hashes, release notes,
tests, and evidence gates.

Use the current GitHub Release, npm package metadata, installed `brik --version`,
and docs.brik64.com as the public source for what is available now.
