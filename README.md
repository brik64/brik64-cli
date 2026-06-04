# BRIK64 CLI

BRIK64 CLI is the public beta command-line surface for local BRIK64 project
workflows. It gives developers a practical way to start working with
PCD-oriented structure, local evidence review, and claim-safe project
scaffolding from their own machine.

Current development target: `0.1.0-beta.5`.

`0.1.0-beta.5` is not published until the PCD-generated artifact, offline
L4+N5 engine bundle, adversarial audit, distribution hardening, checksums, and
release manifest gates pass.

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
for the latest public CLI release. `0.1.0-beta.5` remains a candidate until its
release manifest authorizes publication.

## Official Channels

- Website: [brik64.com](https://brik64.com)
- Docs: [docs.brik64.com](https://docs.brik64.com)
- Installer: [brik64.com/cli/install.sh](https://brik64.com/cli/install.sh)
- GitHub Releases: [brik64/brik64-cli releases](https://github.com/brik64/brik64-cli/releases)
- Agent skills: [brik64-tools-skills](https://github.com/brik64/brik64-tools-skills)
- Public roadmap: [BRIK64 CLI Public Roadmap](docs/PUBLIC_ROADMAP.md)

## Beta5 Candidate Scope

`0.1.0-beta.5` is intended to move the CLI from scaffold behavior toward a
functional local PCD workflow. It must remain claim-bounded until generated
artifact, offline engine, hardening, checksum, and cross-platform gates pass.

Current beta5 candidate capabilities:

- `brik init` creates `.brik/manifest.json` and does not create `AGENTS.md`.
- `brik doctor` validates the local beta5 workspace contract and engine tier
  boundary.
- `brik certify <file.pcd>` parses a bounded PCD subset and writes a local
  candidate certificate.
- `brik emit <file.pcd>` requires a matching certificate and fails closed on
  stale hashes.
- `brik emit --target <ts|rust|python> --out <dir> --tests` emits hash-bound
  candidate outputs from parsed PCD structure.

Current public release availability remains defined by GitHub Releases, the
curl installer, release manifests, checksums, and published docs.

Current installable platform lanes:

| Platform | Status | Evidence boundary |
| --- | --- | --- |
| macOS Apple Silicon (`darwin-arm64`) | Available in beta4 | Package emitted, checksumed, and smoke checked. |
| Linux x64 (`linux-x64`) | Available in beta4 | Package emitted, checksumed, and smoke checked on Ubuntu x64. |
| macOS Intel (`darwin-x64`) | Pending runner | Package emitted; install remains fail-closed until runner smoke passes. |
| Linux ARM64 (`linux-arm64`) | Pending runner | Package emitted; install remains fail-closed until runner smoke passes. |
| Windows x64 native | Not available in the current public release | No verified native executable is published. |

Windows npm shim smoke exists as internal compatibility evidence only; it is not
the public CLI distribution channel.

Stronger certification, N5/L5+N5, fixpoint, self-hosting, universal Linux, and
Windows-native compatibility claims remain gated by `brik64-prod` evidence and
are not implied by this candidate.

## SDK Boundary

SDKs are distributed separately from the CLI. npm is reserved for SDK packages,
not CLI distribution. The prior SDK beta4 install command was:

```sh
npm install @brik64/core@0.1.0-beta.4
```

Python and Rust SDKs are not public marketplace install paths unless a release
note explicitly says otherwise. Future beta5 SDKs must be generated through the
same L6+N5 internal artifact-factory policy and published only after their own
package gates pass.

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
latest published package candidates. Beta5 candidate evidence in this repository
is not a public release by itself.

https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.4

## Copyright And License

Copyright (c) 2026 BRIK64 INC. All rights reserved.

See [LICENSE](LICENSE) and [NOTICE](NOTICE). BRIK64 CLI public beta is
proprietary evaluation software from BRIK64 INC. Production, commercial,
hosted, redistribution, partner, enterprise, regulated, or
certification-oriented use requires written commercial terms from BRIK64 INC.
