# BRIK64 CLI

BRIK64 CLI is the public beta command-line surface for local BRIK64 project
workflows. It helps developers initialize `.brik` metadata, work with PCD files,
create local candidate evidence, emit supported language targets, and prepare
artifacts for managed platform workflows.

Current public beta: `0.1.0-beta.14.6`
Current beta candidate: `0.1.0-beta.15`

## Install

The public CLI install path remains curl-only until the Beta15 release train is
promoted and live-verified:

```sh
curl -fsSL https://brik64.com/cli/install.sh | bash
```

After installation:

```sh
brik64 --version
brik64 help
```

The npm package namespace is reserved for SDK libraries, not CLI installation.

## Beta15 Production Candidate Boundary

`0.1.0-beta.15` is staged as a production-candidate release train precondition.
It imports a PCD/polymer-bound CLI artifact candidate. Public release claims remain closed until atomic public-surface verification passes. Public fixpoint claims remain closed. Self-hosting claims remain closed. Formal N5 claims remain closed. Rust-independence claims remain closed.

## Beta15 Candidate Command Surface

The candidate keeps the local workflow focused on bounded PCD review and
claim-safe evidence:

- `brik64 init` creates `.brik/manifest.json` and does not create `AGENTS.md`.
- `brik64 doctor` reports local workspace status; `--json` is for CI.
- `brik64 pcd generate <name>` creates a starter PCD candidate.
- `brik64 certify` writes local candidate evidence only.
- `brik64 polymerize` writes a local polymer candidate.
- `brik64 compile all` emits supported local targets for candidate workflows.
- `brik64 test all` runs local candidate checks.

Managed cloud paths remain entitlement-gated. Without a managed session, those
paths fail closed and keep local artifacts unchanged.

## Platform Support

| Platform | Status | Notes |
| --- | --- | --- |
| macOS | Available in current public beta | Portable package; requires the documented runtime for the active public installer. |
| Linux | Available in current public beta | Portable package; requires the documented runtime for the active public installer. |
| Windows x64 native | Not available in current public beta | No Windows executable is published. |

## SDK Boundary

SDKs are distributed separately from the CLI. Beta15 candidate coordinates are
staged for release-train synchronization:

```sh
npm install @brik64/core@0.1.0-beta.15
pip install brik64==0.1.0b15
cargo add brik64-core@0.1.0-beta.15
```

SDK packages are language libraries. They do not install the CLI, issue managed
claims, or replace the CLI workspace workflow.

## Claim Boundary

This beta provides local candidate evidence and managed-workflow routing
boundaries. It does not by itself establish formal certification for arbitrary user code. It does not establish universal correctness. It does not establish independent toolchain closure. Public fixpoint claims remain closed. Self-hosting claims remain closed. Formal N5 claims remain closed. Rust-independence claims remain closed. It does not establish native Windows compatibility.

## CLI And Agent Skill

Use the CLI for local project actions and the official `brik64` skill for agent
behavior, claim-safe reporting, `.brik` traceability, PCD workflow, and
consent-based `AGENTS.md` handling.

`brik64 init` prepares local BRIK64 metadata. It does not create or modify
`AGENTS.md`.

## Repository Map

| Path | What it contains |
| --- | --- |
| `src/brik.js` | Node.js entry point for current public beta command behavior. |
| `tests/smoke.sh` | Local smoke test for current beta command behavior. |
| `pcd/` | Candidate PCD seed material for command structure. |
| `evidence/` | Public beta evidence notes and generated-review placeholders. |
| `packaging/` | Platform packaging notes and release-lane material. |
| `docs/` | Release, distribution, governance, platform, and testing docs. |
| `.brik/manifest.json` | Local traceability metadata. It is not a certificate. |

## Release Evidence

Use GitHub Release assets, release manifest, and `SHA256SUMS` to review the
latest published package.

https://github.com/brik64/brik64-cli/releases

## Copyright And License

Copyright (c) 2026 BRIK64 INC. All rights reserved.

See [LICENSE](LICENSE) and [NOTICE](NOTICE). BRIK64 CLI public beta is
proprietary evaluation software from BRIK64 INC.
