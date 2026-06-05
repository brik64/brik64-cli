# BRIK64 CLI Beta6 Release Plan

Date: 2026-06-05

Target version: `0.1.0-beta.6`

Status: planning from beta5 adversarial audit intake

## Executive Checklist

- 🟥 25% | 🟩 ⬜ ⬜ ⬜ | Beta5 audit intake converted into release requirements.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Beta5 release-train CI live verifier unblocked from GitHub Actions.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Beta6 command contract implemented behind fresh tests.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Beta6 package, checksum, docs, web, skills, SDK, and installer train verified live.

## Source Inputs

- External beta5 audit file: `/Users/carlosjperez/Downloads/auditroia beta5.md`
- External beta6 proposal file: `/Users/carlosjperez/Downloads/proposals_beta6.md`
- Current repo evidence: `docs/BETA5_ADVERSARIAL_RELEASE_AUDIT.md`
- Current release train plan: `docs/RELEASE_TRAIN_CI_CD_PLAN.md`
- Current manifest: `release/manifest.json`

The attached beta5 audit is a planning input, not final claim evidence. Any
positive finding must be reproduced through committed tests, package smoke, and
release-train gates before it can support a public beta6 claim.

## Beta5 Carryover Gate

Beta6 work must not normalize a broken publication train. Before beta6 can be
called public, the current release automation must prove the active public
surface from GitHub Actions, not only from a local operator machine.

Current carryover blocker:

- `release-train-live-verify` receives HTTP 403 from Cloudflare when executed
  from GitHub Actions against `https://brik64.com/`, `/changelog`,
  `/cli/install.sh`, and `/cli/beta.json`.
- Local public verification returns HTTP 200 and shows `0.1.0-beta.5`.

Closure criteria:

- GitHub Actions live verifier passes for the active manifest digest.
- Publication plan dry mode passes on the same digest.
- The WAF or bot-control rule that allows the verifier is documented in the
  infrastructure repo and does not weaken probe blocking for secret paths.

## Beta6 Scope

Beta6 is a functional hardening release. It may add commands only when their
failure behavior, evidence contract, docs, and public wording are implemented in
the same release train.

### 1. Certificate Integrity Hardening

Goal: `emit` must fail closed when the certificate file is corrupted or no
longer matches the parsed PCD semantics.

Required behavior:

- verify the PCD hash recorded in the certificate;
- verify certificate metadata against a freshly parsed AST;
- reject manually altered certificate fields that affect emitted metadata;
- return stable error codes:
  - `certificate_corrupted_signature`
  - `certificate_ast_mismatch`
  - `certificate_hash_mismatch`

Evidence required:

- unit tests for valid certificate, corrupted JSON, stale hash, changed
  branch-count metadata, and changed AST metadata;
- adversarial package-smoke case from the built package;
- docs update for `certify` and `emit`.

### 2. Workspace Doctor Diagnostics

Goal: `brik64 doctor` must report actionable workspace health before release or
handoff.

Required diagnostics:

| Diagnostic | Severity | Code |
| --- | --- | --- |
| `.pcd` exists without matching `.cert.json` | warning | `w_pcd_not_certified` |
| `.cert.json` exists without source `.pcd` | warning | `w_orphan_certificate` |
| source PCD hash differs from certificate hash | error | `e_pcd_hash_mismatch` |

Evidence required:

- fixture workspace for clean, warning, and error states;
- JSON and human-readable output checks if both formats exist;
- docs update for `doctor` and troubleshooting.

### 3. Polymerize Command Contract

Goal: introduce composition only as a bounded beta command, not as an inflated
formal-composition claim.

Proposed command:

```sh
brik64 polymerize <polymer_definition.polymer.pcd> --target ts|rust|python --out <dir> [--strict]
```

Required behavior:

- parse a polymer definition file;
- resolve only source paths inside the workspace;
- require current certificates for referenced PCD files;
- fail closed on missing certificate, stale certificate, cycle, unresolved
  reference, unsupported target, and path traversal;
- propagate certificate class:
  - `core` when all referenced PCDs are core;
  - `extended` when any referenced PCD is extended.

Evidence required:

- parser fixtures for sequential, conditional, and parallel definitions;
- adversarial cycle and path traversal tests;
- package smoke for TS, Rust, and Python output stubs;
- docs page and changelog entry with beta limitations.

### 4. MCP Command Design Gate

Goal: define `brik64 mcp start` as a platform integration surface without
forcing paid/cloud claims into the free offline CLI.

Beta6 implementation rule:

- If implemented, `brik64 mcp start` must be local, explicit, and fail closed
  when platform credentials are absent.
- It must expose only the same local command capabilities that the CLI can
  execute offline.
- Premium L5 cloud behavior must remain disabled until entitlement,
  authentication, billing, endpoint, and signed evidence contracts exist.

Minimum local tools:

- `brik64_init`
- `brik64_certify`
- `brik64_emit`
- `brik64_doctor`

Minimum resources:

- `brik64://workspace/status`
- `brik64://pcd/ast/{name}`

Evidence required:

- server start/stop smoke;
- tool invocation tests using scratch workspaces;
- no secret read or environment-token leakage in logs;
- docs that separate local MCP from future platform integration.

### 5. Cloud Verification Stub

Goal: enable integration testing for a future cloud verification path without
claiming active L5 verification.

Allowed beta6 shape:

```sh
brik64 verify <pcd_file> --cloud --dry-run
```

Rules:

- dry-run only unless a real endpoint, entitlement model, signed response
  contract, and live evidence exist;
- output must be named as simulated or draft evidence, not a production claim;
- public docs must not call the result mathematical proof or formal cloud
  certification.

Evidence required:

- local dry-run test;
- fail-closed test when `--cloud` is used without `--dry-run`;
- docs and changelog with explicit beta limitation.

### 6. Windows Installer Discovery

Goal: prepare native Windows distribution without claiming support before smoke
evidence exists.

Target command:

```powershell
irm https://brik64.com/cli/install.ps1 | iex
```

Beta6 closure options:

- ship `install.ps1` only if Windows x64 package smoke passes from a clean
  Windows host or runner; or
- keep Windows as runner-pending with a tracked evidence gap.

Evidence required:

- Windows x64 install smoke from package artifact;
- checksum verification in PowerShell installer;
- docs and manifest matrix updated from evidence.

### 7. Download Observability

Goal: make CLI and SDK downloads measurable without depending on GitHub Release
aggregate counts alone.

Required design:

- add a `brik64.com/cli/download` edge endpoint or equivalent backend;
- log version, asset, country/colo, referrer, user-agent class, and a
  privacy-bounded client identifier;
- redirect or stream the verified GitHub Release asset;
- preserve SHA-256 verification in the installer;
- expose internal dashboard counts for CLI and SDK downloads.

Rules:

- Do not store secrets in logs.
- Do not expose raw IP addresses in public dashboards.
- If raw IP retention is needed for abuse prevention, document retention and
  access limits in the infrastructure repo.

Evidence required:

- local or staging Worker test;
- production smoke that download redirects and checksum validation still pass;
- dashboard query for daily downloads by version, asset, referrer domain, and
  country.

## Release Train Requirements

Every beta6 publication attempt must update and verify, in one train:

- CLI package and GitHub Release assets;
- curl installer and channel manifest;
- README command list and minimum requirements;
- docs install, commands, doctor, certify, emit, and release pages;
- web install surface and public changelog;
- public skills with version-independent CLI discovery;
- SDK package references, either published or explicitly scoped out;
- release manifest, sync payload, checksums, and evidence reports.

The release is public only after live verification passes for the same manifest
digest across required surfaces.

## Public Changelog Policy

The beta6 public changelog may describe:

- new user-visible commands;
- stricter certificate validation;
- new doctor diagnostics;
- installer/platform changes;
- SDK/package availability;
- security and compatibility fixes.

It must not describe:

- internal engine tiers as product claims;
- private generation methodology;
- approval debates;
- WAF, secret, or maintainer-token operations;
- unsupported formal proof or mathematical guarantee claims.

## Beta6 Completion Gate

Beta6 is releasable only when all items below are true:

- [ ] beta5 carryover live-verifier blocker closed.
- [ ] all beta6 command contracts have tests.
- [ ] fresh adversarial audit passes from a clean scratch workspace.
- [ ] package smoke passes from the built artifact.
- [ ] cross-platform smoke matches the platform matrix.
- [ ] docs, web, skills, README, release manifest, changelog, and installer
      reference the same version.
- [ ] download observability either ships or is explicitly deferred in the
      release manifest.
- [ ] publication plan and live verification pass from GitHub Actions.

