# BRIK64 CLI

BRIK64 CLI is the public beta command-line surface for local BRIK64 project
workflows. It gives developers a practical way to start working with
PCD-oriented structure, local evidence review, and claim-safe project
scaffolding from their own machine.

Current public beta: `0.1.0-beta.5`.

`0.1.0-beta.5` is published through the curl installer, GitHub Release assets,
public docs, public skills, and beta SDK package surfaces. Use the installer and
release manifests to verify the active public version.

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

The npm package `@brik64/cli` is not the public CLI install path. Use the curl
installer and GitHub Release assets for the latest public CLI release.

## Official Channels

- Website: [brik64.com](https://brik64.com)
- Docs: [docs.brik64.com](https://docs.brik64.com)
- Installer: [brik64.com/cli/install.sh](https://brik64.com/cli/install.sh)
- GitHub Releases: [brik64/brik64-cli releases](https://github.com/brik64/brik64-cli/releases)
- Agent skills: [brik64-tools-skills](https://github.com/brik64/brik64-tools-skills)
- Public roadmap: [BRIK64 CLI Public Roadmap](docs/PUBLIC_ROADMAP.md)

## Beta5 Public Scope

`0.1.0-beta.5` provides a local PCD workflow for project metadata, workspace
inspection, local candidate certificates, and generated candidate outputs.

Current beta5 capabilities:

- `brik64 init` creates `.brik/manifest.json` and does not create `AGENTS.md`.
- `brik64 doctor` validates the local beta5 workspace contract.
- `brik64 engine status` inspects the packaged offline runtime bundle.
- `brik64 certify <file.pcd>` parses a bounded PCD subset and writes a local
  candidate certificate.
- `brik64 emit <file.pcd>` requires a matching certificate and fails closed on
  stale hashes.
- `brik64 emit --target <ts|rust|python> --out <dir> --tests` emits hash-bound
  candidate outputs from parsed PCD structure.
- `brik64 --version` prints the installed version and public beta status.

Current public release availability remains defined by GitHub Releases, the
curl installer, release manifests, checksums, and published docs.

Current installable platform lanes:

| Platform | Status | Evidence boundary |
| --- | --- | --- |
| macOS | Available in beta5 | Portable Node.js CLI package; requires Node.js 20 or newer. |
| Linux | Available in beta5 | Portable Node.js CLI package; requires Node.js 20 or newer. |
| Windows x64 native | Not available in the current public beta | No Windows executable is published. |

The public installer verifies the beta5 package SHA-256 before activation:

```text
8448215f146b017edb3e5b64d853590ccf63c4d58276c4edbd406156c8b063b6
```

Formal certification, self-hosting, fixpoint, universal platform support, and
Windows-native compatibility are not implied by this beta.

## SDK Boundary

SDKs are distributed separately from the CLI. npm is reserved for SDK packages,
not CLI distribution. Current beta5 SDK package coordinates:

```sh
npm install @brik64/core@0.1.0-beta.5
pip install brik64==0.1.0b5
cargo add brik64-core@0.1.0-beta.5
```

SDK packages are language libraries. They do not install the CLI and do not
establish certification by themselves.

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

`brik64 init` prepares local BRIK64 metadata. It does not create or modify
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
latest published package.

https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.5

## Copyright And License

Copyright (c) 2026 BRIK64 INC. All rights reserved.

See [LICENSE](LICENSE) and [NOTICE](NOTICE). BRIK64 CLI public beta is
proprietary evaluation software from BRIK64 INC. Production, commercial,
hosted, redistribution, partner, enterprise, regulated, or
certification-oriented use requires written commercial terms from BRIK64 INC.
