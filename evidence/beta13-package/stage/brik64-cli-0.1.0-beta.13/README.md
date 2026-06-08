# BRIK64 CLI

BRIK64 CLI is the public beta command-line surface for local BRIK64 project
workflows. It helps developers initialize `.brik` metadata, work with PCD files,
create local candidate evidence, emit supported language targets, and prepare
artifacts for managed platform workflows.

Current public beta: `0.1.0-beta.13`

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

The npm package namespace is reserved for SDK libraries, not CLI installation.

## Beta13 Command Surface

`0.1.0-beta.13` adds local source lift preview and adoption reporting while
keeping the existing security, telemetry, SDK parity, and fail-closed path
boundaries.

- `brik64 init` creates `.brik/manifest.json` and does not create `AGENTS.md`.
- `brik64 doctor` prints a human-readable workspace summary with diagnostics
  and suggested actions.
- `brik64 doctor --json` emits `brik64.cli_doctor_report.v1` for CI.
- `brik64 account status` shows whether the CLI is using local default routing
  or a managed session.
- `brik64 login --token-env <VAR>` records a managed-session token hash without
  printing the token.
- `brik64 logout` returns routing to local default.
- `brik64 certify <file.pcd>` writes a local candidate certificate.
- `brik64 verify <file.pcd>` checks local certificate and AST/hash coherence.
- `brik64 emit <file.pcd> --target <ts|rust|python> --out <dir> --tests`
  emits executable target files, generated tests, and package scaffolds for
  supported beta PCD expressions, branches, collections, loops, and direct local
  imports.
- `brik64 polymerize <files.pcd...> --out polymer.pcd` combines compatible PCD
  files into a deterministic local polymer candidate and materializes referenced
  import files beside the output when needed.
- `brik64 migrate <file.pcd>` converts supported legacy PCD syntax into the
  current strict syntax. `--force` or `-f` is required to overwrite an existing
  output file.
- `brik64 lift <js|ts|python> <path> --preview` scans simple local source
  functions and writes PCD candidates under `.brik/lift-preview/`. It does not
  create certificates and does not send source over the network.
- `brik64 adoption report` summarizes local lift preview runs, candidate
  counts, warning counts, and local PCD inventory. `--json` emits
  `brik64.cli_adoption_report.v1`.
- `brik64 explain <file.pcd>` prints parser, import, constant and type
  diagnostics; `--json` emits `brik64.cli_explain_report.v1`.
- `brik64 lock` writes `brik64.lock.json` with local PCD, AST, import graph,
  and constant hashes for review.
- `brik64 telemetry status`, `enable`, `disable`, `export`, `purge-local`,
  `send`, and `explain` manage opt-in local telemetry. Telemetry is disabled by
  default and `send` is explicit.
- `brik64 feedback --category <bug|idea|docs|other> --message <text>` creates
  a redacted local feedback preview. `--send` requires enabled telemetry.
- `brik64 errors status`, `explain-last`, `send-last`, and `purge-local`
  inspect, redact, send, or remove local error-report state.

Managed `--cloud` paths are entitlement-gated in this beta. Without a managed
session, those paths fail closed and keep local artifacts unchanged.

## Platform Support

| Platform | Status | Notes |
| --- | --- | --- |
| macOS | Available in current public beta | Portable Node.js CLI package; requires Node.js 20 or newer. |
| Linux | Available in current public beta | Portable Node.js CLI package; requires Node.js 20 or newer. |
| Windows x64 native | Not available in current public beta | No Windows executable is published. |

The public installer verifies the package SHA-256 before activation. The
authoritative checksum is published with release assets in `package.manifest.json`
and `SHA256SUMS`.

## SDK Boundary

SDKs are distributed separately from the CLI. Current beta SDK package
coordinates:

```sh
npm install @brik64/core@0.1.0-beta.13
pip install brik64==0.1.0b13
cargo add brik64-core@0.1.0-beta.13
```

SDK packages are language libraries. They do not install the CLI, issue managed
claims, or replace the CLI workspace workflow.

## Claim Boundary

This beta provides local candidate evidence and managed-workflow routing
boundaries. It does not by itself establish formal certification for arbitrary
user code, universal correctness, independent toolchain closure, or native
Windows compatibility.

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
