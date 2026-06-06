# Changelog

All notable BRIK64 CLI changes are recorded here. This file is required for
every beta, release candidate, or public release train.

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
