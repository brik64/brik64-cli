# BRIK64 CLI

BRIK64 CLI is the public beta command-line surface for local BRIK64 project
workflows. It gives developers a practical way to start working with
PCD-oriented structure, local evidence review, and claim-safe project
scaffolding from their own machine.

Current public beta: [`0.1.0-beta.4`](https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.4)

## Install

The public CLI install path is curl-only:

```sh
curl -fsSL https://brik64.com/cli/install.sh | bash
```

After installation:

```sh
brik64 --version
brik64 help
```

The npm package `@brik64/cli` is a legacy beta channel and is no longer the
recommended installation path. Use the curl installer and GitHub Release assets
for beta4.

## Official Channels

- Website: [brik64.com](https://brik64.com)
- Docs: [docs.brik64.com](https://docs.brik64.com)
- Installer: [brik64.com/cli/install.sh](https://brik64.com/cli/install.sh)
- GitHub Releases: [brik64/brik64-cli releases](https://github.com/brik64/brik64-cli/releases)
- Agent skills: [brik64-tools-skills](https://github.com/brik64/brik64-tools-skills)
- Public roadmap: [BRIK64 CLI Public Roadmap](docs/PUBLIC_ROADMAP.md)

## Beta4 Scope

This beta is intended for evaluation, local workflow trials, platform package
smoke testing, and bounded PCD/evidence review.

Current installable platform lanes:

| Platform | Status | Evidence boundary |
| --- | --- | --- |
| macOS Apple Silicon (`darwin-arm64`) | Available in beta4 | Package emitted, checksumed, and smoke checked. |
| Linux x64 (`linux-x64`) | Available in beta4 | Package emitted, checksumed, and smoke checked on Ubuntu x64. |
| macOS Intel (`darwin-x64`) | Pending runner | Package emitted; install remains fail-closed until runner smoke passes. |
| Linux ARM64 (`linux-arm64`) | Pending runner | Package emitted; install remains fail-closed until runner smoke passes. |
| Windows x64 native | Not available in beta4 | No verified native executable is published. |

Windows npm shim smoke exists as internal compatibility evidence only; it is not
the public CLI distribution channel.

Stronger certification, N5/L5+N5, fixpoint, self-hosting, universal Linux, and
Windows-native compatibility claims remain gated by `brik64-prod` evidence and
are not implied by this public beta.

## SDK Boundary

SDKs are distributed separately from the CLI. For beta4, npm is reserved for the
JavaScript/TypeScript SDK:

```sh
npm install @brik64/core@0.1.0-beta.4
```

Python and Rust SDKs are not public beta4 marketplace install paths unless a
release note explicitly says otherwise.

## Public Interaction Policy

This repository is public for release inspection, install metadata, bounded
evidence review, and issue reporting.

Allowed:

- Open issues for reproducible CLI beta bugs.
- Open issues for docs, release, curl installer, checksum, or install metadata mismatches.
- Report security concerns through `SECURITY.md`.

Not accepted:

- External pull requests.
- External direct commits.
- Public edits to release evidence, license text, package metadata, workflows,
  install paths, or public claim surfaces.

BRIK64 lands changes through authorized maintainers so public claims, checksums,
licenses, release notes, and docs remain aligned.

## CLI And Agent Skill

BRIK64 is designed for humans and AI agents working together. Use the CLI for
local project actions and the official `brik64` skill for agent behavior,
claim-safe reporting, `.brik` traceability, PCD workflow, and `AGENTS.md`
managed-instruction rules.

`brik init` prepares local BRIK64 metadata. It does not create or modify
`AGENTS.md`. Agent instruction installation must remain explicit, reviewable,
and consent-based.

## Repository Map

| Path | What it contains |
| --- | --- |
| `src/brik.js` | Node.js entry point for the public beta command behavior. |
| `tests/smoke.sh` | Local smoke test for current beta command behavior. |
| `pcd/` | Candidate PCD seed material for the intended command structure. |
| `evidence/` | Public beta evidence notes and generated-review placeholders. |
| `packaging/` | Platform packaging notes and release-lane material. |
| `docs/` | Release, distribution, governance, platform, testing, and methodology docs. |
| `.github/` | Repository governance, CI, issue templates, and maintainer workflows. |
| `.brik/manifest.json` | Local traceability metadata. It is not a certificate. |

For a fuller file-by-file description, read
[`docs/REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md).

## Release Evidence

Use the GitHub Release assets, release manifest, and `SHA256SUMS` to review the
exact beta4 package candidates:

https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.4

## Copyright And License

Copyright (c) 2026 BRIK64 INC. All rights reserved.

See [LICENSE](LICENSE) and [NOTICE](NOTICE). BRIK64 CLI public beta is
proprietary evaluation software from BRIK64 INC. Production, commercial,
hosted, redistribution, partner, enterprise, regulated, or
certification-oriented use requires written commercial terms from BRIK64 INC.
