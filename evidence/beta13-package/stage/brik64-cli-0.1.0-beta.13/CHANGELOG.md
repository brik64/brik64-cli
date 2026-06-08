# Changelog

All notable BRIK64 CLI changes are recorded here. This file is required for
every beta, release candidate, or public release.

## 0.1.0-beta.13

### Added

- Adds `brik64 lift <js|ts|python> <path> --preview` for local source scanning
  into PCD candidate files.
- Adds `brik64 adoption report` for local lift preview counts, warning counts,
  privacy flags, and PCD inventory summaries.
- Adds support for multiple local functions inside one PCD `PC` block, including
  helper calls emitted to TypeScript, Rust, and Python.

### Changed

- Adds `--force` and `-f` to `brik64 migrate` for explicit overwrite of an
  existing migration output.
- Keeps source lift preview local-only: it does not create certificates, does
  not send source, and records redacted source metadata.
- Aligns CLI, JavaScript, Python, and Rust SDK package coordinates to Beta13.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code,
  universal correctness, or independent toolchain closure.

## 0.1.0-beta.12

### Added

- Adds opt-in telemetry transport commands with local export, purge, and
  explicit send behavior.
- Adds redacted user feedback capture that stores a local preview by default
  and only sends when telemetry is enabled and `--send` is requested.
- Adds redacted local error-report inspection and explicit send support.
- Adds adversarial release gating for symlinked PCD inputs that resolve outside
  the workspace.
- Adds package-export checks for the JavaScript SDK so published beta packages
  work from both native ESM and CommonJS projects.

### Changed

- Rejects PCD inputs, imports, certificate paths, and emit/polymer output paths
  that resolve outside the current workspace through symlinks or existing
  parent directories.
- Improves empty-workspace `doctor` guidance when PCD files exist in the root
  directory but not under `./pcd`.
- Aligns CLI, JavaScript, Python, and Rust SDK package coordinates to Beta12.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code,
  universal correctness, or independent toolchain closure.

## 0.1.0-beta.11

### Added

- Adds semantic local `brik64 polymerize` coverage for import DAGs, including
  root/mid/leaf equivalence checks.
- Adds materialized import dependencies beside generated polymer outputs so
  polymers emitted outside the source directory remain certifiable.
- Adds a dedicated adversarial Beta11 gate covering malformed PCD inputs, path
  traversal, stale certificates, missing imports, and polymer import behavior.
- Adds a Rust emitter cleanup gate that requires warning-free generated Rust
  scaffolds under `cargo test --quiet`.
- Adds an empty-workspace `doctor` gate that verifies fail-closed human and JSON
  diagnostics.

### Changed

- Improves generated fallbacks so emitted target code avoids unreachable
  statements when all paths already return.
- Keeps public release notes limited to observed CLI behavior and package
  behavior verified by the Beta11 gates.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code,
  universal correctness, or independent toolchain closure.

## 0.1.0-beta.10

### Added

- Adds typed `i64` function parameters and return annotations for supported PCD
  programs.
- Adds bounded list and map expressions for supported local PCD emission.
- Adds bounded `repeat` loops with a fixed maximum iteration count.
- Adds direct same-directory PCD imports using `use <name>;` and generated
  helper functions in emitted TypeScript, Rust, and Python outputs.
- Adds package scaffolds for generated TypeScript, Rust, and Python projects
  when `brik64 emit --tests` is used.
- Adds actionable `brik64 doctor` diagnostics with stable JSON output for CI.

### Changed

- Improves beta parser failures for unsupported calls, invalid imports,
  malformed collection expressions, and unsupported loop forms.
- Keeps cloud verification and cloud polymerization entitlement-gated while
  local workflows remain available by default.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code,
  universal correctness, or independent toolchain closure.

## 0.1.0-beta.8

### Added

- Adds bounded source-to-source PCD emission for executable TypeScript, Rust,
  and Python programs.
- Adds generated target tests that execute emitted programs and check expected
  behavior across supported target languages.
- Adds parser support for arithmetic expressions, comparisons, boolean
  conditions, nested branches, and expression returns.
- Adds adversarial parser coverage for malformed input, binary data, oversized
  PCD files, unsupported statements, and path traversal attempts.
- Adds a local package smoke check that extracts the beta8 tarball and runs the
  packaged CLI outside the repository checkout.

### Changed

- Updates `brik64 emit` from static candidate output toward executable output
  for the supported beta PCD syntax.
- Keeps unsupported syntax fail-closed with actionable parser errors.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code,
  universal correctness, or independent toolchain closure.

## 0.1.0-beta.7

### Added

- Adds `brik64 polymerize` for local PCD composition into a deterministic
  polymer file and companion manifest.
- Adds `brik64 verify` for local certificate, source hash, and AST hash checks.
- Adds `brik64 migrate` to update legacy lowercase `pc` files to the current
  `PC` syntax.
- Adds `brik64 login`, `brik64 logout`, and `brik64 account status` as the CLI
  account boundary for future platform-connected workflows.
- Adds `brik64 doctor --json` while keeping human-readable `doctor` output as
  the default terminal experience.

### Changed

- Extends workspace manifests with preferred engine routing and polymerization
  strategy metadata for local-first operation.
- Improves parser errors for legacy PCD syntax by pointing users to
  `brik64 migrate`.
- Keeps cloud verification and cloud polymerization fail-closed unless a
  platform entitlement is present.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code,
  universal correctness, or independent toolchain closure.

## 0.1.0-beta.6

### Added

- Adds a portable `brik64` CLI package installable through the public curl
  installer on supported macOS and Linux environments.
- Adds local workspace initialization, certificate creation, TypeScript output,
  and stale-certificate protection to the distributed beta package.
- Adds visible package metadata so users can verify the installed CLI version
  and SHA-256 checksum.

### Changed

- Updates `brik64 --version`, README, and install guidance to
  `0.1.0-beta.6`.
- Clarifies that the CLI is installed with curl, while SDKs are installed with
  the package manager for each language.

### Compatibility

- macOS and Linux use the portable Node.js CLI package and require Node.js 20 or
  newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code or
  independent toolchain closure.

## 0.1.0-beta.5

### Added

- Added local workspace validation with `brik64 doctor`.
- Added `brik64 engine status` so users can inspect the packaged offline
  runtime bundle installed with the CLI.
- Added hash-bound candidate output generation for TypeScript, Rust, and
  Python through `brik64 emit --target <ts|rust|python>`.
- Added package checksums and local install smoke coverage for the public beta
  package.
- Added matching beta SDK package coordinates for TypeScript, Python, and Rust.
- Added public release-train validation so CLI, SDK, docs, web, skills,
  release notes, and installer metadata can be checked from one manifest.

### Changed

- Updates public install guidance from beta4 to beta5.
- Clarifies that npm is used for SDK packages, while the CLI install path is
  the curl installer and GitHub Release assets.
- Improves failure boundaries for stale certificates, tampered runtime metadata,
  and mismatched generated outputs.
- Aligns public docs, website install surfaces, skills, SDK references, and
  release notes to beta5.

### Fixed

- Fixes stale beta references in local seed metadata and public install
  surfaces.
- Fixes release notes that previously mixed public functionality with internal
  operating details.
- Fixes docs and skills drift where older beta package coordinates could remain
  visible.

### Compatibility

- macOS and Linux are the current installable CLI lanes for beta5.
- Node.js 20 or newer is required.
- Windows native executables are not published in this beta.

## 0.1.0-beta.4 - Published Beta Reference

Status: latest prior public release reference.

Use GitHub Releases, curl installer metadata and published docs as the authority
for what beta4 made publicly installable.
