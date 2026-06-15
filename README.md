# BRIK64 CLI

BRIK64 CLI is the public beta command-line surface for local BRIK64 project
workflows. It helps developers initialize `.brik` metadata, work with PCD files,
create local candidate evidence, emit supported language targets, and prepare
artifacts for managed platform workflows.

Current beta candidate: `0.1.0-beta.15.3`
Previous/live public baseline until promotion: `0.1.0-beta.15`

## Install

The public CLI install path remains curl-only. Until the Beta15 release train is
promoted and live-verified, the live installer may still serve the previous
public beta:

```sh
curl -fsSL https://brik64.com/cli/install.sh | bash
```

After installation:

```sh
brik64 --version
brik64 help
```

The npm package namespace is reserved for SDK libraries, not CLI installation.

## Beta15.3 Pre-Public Candidate Boundary

`0.1.0-beta.15.3` is staged as a pre-public maintenance candidate for generated
application integrity: tuple monomer emission, cleaner generated Rust, generated
test execution, certifiable polymer PCD output, local traceability, and
claim-safe project reports. Public release claims remain closed until atomic
public-surface verification passes.

## Beta15.3 Candidate Command Surface

The candidate keeps the local workflow focused on explicit bounded-domain PCD
review and claim-safe evidence:

- `brik64 init` creates `.brik/manifest.json` plus `.brik/ledger/` local trace
  files. It does not create `AGENTS.md`.
- `brik64 ledger status|verify|snapshot|tombstone|export|repair --dry-run`
  inspects the local append-only ledger chain.
- `brik64 doctor` reports local workspace and ledger status; `--json` is for CI.
  It fails when local audit reports claim release readiness while the workspace
  manifest is still local-candidate only.
- `brik64 pcd generate <name>` creates a starter PCD candidate.
- `brik64 certify` writes local candidate evidence only.
- `brik64 polymerize` writes a local polymer candidate. Multi-input inline
  polymers require `--root <fn>` so the entrypoint is explicit. Source polymers
  intended for review should use the `.polymer.pcd` suffix.
- `brik64 compile all` emits supported local targets for candidate workflows.
- `brik64 test all` runs local candidate checks.
- `brik64 monomers test --all --json` reports the 128-entry registry status for
  local candidate validation.

Managed cloud paths remain entitlement-gated. Without a managed session, those
paths fail closed and keep local artifacts unchanged.

## Platform Support

| Platform | Status | Notes |
| --- | --- | --- |
| macOS | Available in current public beta | Portable package; requires the documented runtime for the active public installer. |
| Linux | Available in current public beta | Portable package; requires the documented runtime for the active public installer. |
| Windows x64 native | Not available in current public beta | No Windows executable is published. |

## SDK Boundary

SDKs are distributed separately from the CLI. Beta15.3 SDK marketplace
coordinates are pending release-train synchronization. Until that gate passes,
use the last published SDK baseline documented by the public release surface:

```sh
npm install @brik64/core@0.1.0-beta.15.2
pip install brik64==0.1.0b15.post2
cargo add brik64-core@0.1.0-beta.15.2
```

SDK packages are language libraries. They do not install the CLI, issue managed
claims, or replace the CLI workspace workflow.

## Claim Boundary

This beta provides local candidate evidence and managed-workflow routing
boundaries. The local ledger is a tamper-evident workspace history, not a
distributed blockchain and not a formal certificate. This beta does not by
itself establish formal certification for arbitrary user code. It does not
establish universal correctness or independent toolchain closure. It does not
establish native Windows compatibility.

## Local Ledger

Beta15.3 records selected workspace actions in `.brik/ledger/events.jsonl` with
a hash chain and `.brik/ledger/head.json` head pointer. Event payloads are
redacted by default: raw source, raw PCD content, absolute paths, and secrets are
not written to the ledger event body.

Useful commands:

```sh
brik64 ledger status
brik64 ledger verify --json
brik64 ledger export --redacted
brik64 ledger tombstone <event-hash> --reason "superseded by follow-up evidence"
```

Ledger verification fails closed when events are edited, deleted, reordered, or
when required ledger files are missing from an initialized workspace.

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
