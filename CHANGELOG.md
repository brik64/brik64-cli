# Changelog

All notable BRIK64 CLI changes are recorded here. This file is required for
every beta, release candidate, or public release.

## 0.1.0-beta.15.4

### Added

- Adds a Rust app-polymer regression gate covering core polymer, extended
  polymer, and app-system emission across generated local targets.
- Adds package smoke coverage for ledger verification, explicit polymer roots,
  generated Python tests, and local claim-report contradiction handling.
- Adds a release-manifest freshness check so candidate release metadata cannot
  point at an older CLI package while the candidate package version advances.

### Fixed

- Fixes generated Rust app-polymer output so domain assertions do not reference
  domain variables outside their generated function scope.
- Aligns the candidate package path used by the generation request with the
  actual Beta15.4 package archive.

### Compatibility

- This beta remains a pre-public candidate. Public release is blocked until
  GitHub release assets, curl installer, web, docs, SDKs, skills, changelog,
  public claim scan, and live verification are synchronized.
- This beta does not claim universal correctness, public self-hosting, formal
  certification, or independent toolchain closure.

## 0.1.0-beta.15.3

### Added

- Adds a Beta15.3 generated-application-integrity gate covering TypeScript
  condition syntax, DIV8 tuple emission, Rust f64 emission, Python math-domain
  fixtures, and certifiable `.polymer.pcd` output.
- Adds a Beta15.3 pre-public RC gate that aggregates the generated-integrity
  gate, 128-monomer regression, domain-contract regression, Beta15.2 regression,
  smoke tests, and monomer registry checks.
- Adds Beta15.3 local package and package-smoke scripts with release eligibility
  kept closed until public surfaces are synchronized.

### Changed

- `MC_03.DIV8` is executable as `tuple_u8_u8` in generated TypeScript, Python,
  and Rust tests.
- Generated Rust f64 branch and method-call output now avoids invalid casts and
  warning-producing condition formatting in the Beta15.3 gate.
- Inline polymer generation now creates parent output directories and preserves
  domain and boundary declarations before functions in certifiable polymer PCDs.
- Regression gates now discover the current generated Python test layout instead
  of assuming legacy root-level `test_program.py` files.

### Compatibility

- This beta remains a pre-public candidate. Public release is blocked until
  GitHub release assets, curl installer, web, docs, SDKs, skills, changelog,
  public claim scan, and live verification are synchronized.
- The L6+N5 check included with this candidate is a non-claim preflight only; it
  does not prove Beta15.3 artifact materialization by L6+N5.
- This beta does not claim universal correctness, public self-hosting, formal
  certification, or independent toolchain closure.

## 0.1.0-beta.15.2

### Added

- Adds generated boundary tests for both lower-bound and upper-bound domain
  failures in emitted local targets.
- Adds a pre-public candidate gate that checks bounded-domain enforcement,
  generated helper safety, claim-safe reports, and local ledger tamper
  detection.

### Changed

- Generated helper and imported functions now apply domain checks for their own
  parameters before executing local logic.
- `doctor` now fails when local audit reports declare public release readiness
  while the workspace manifest is still marked local-candidate only.

### Compatibility

- This beta remains a local candidate evidence workflow until public release
  surfaces are synchronized and verified.
- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim universal correctness, public self-hosting, formal
  certification, or independent toolchain closure.

## 0.1.0-beta.15.1

### Added

- Adds a local `.brik/ledger/` command surface for append-only workspace event
  history, ledger verification, redacted export, snapshots, tombstones, and
  dry-run repair guidance.
- Adds ledger events for `init`, `certify`, `emit`, `polymerize`, and `lock` so
  normal local candidate workflows leave a tamper-evident trace.
- Adds a Beta15.1 ledger and real-case gate that checks polymer root handling,
  generated Python package isolation, pytest execution, redacted ledger export,
  and ledger tamper detection.

### Changed

- Requires an explicit `--root <fn>` when materializing a multi-input inline
  polymer, avoiding ambiguous entrypoint selection.
- Improves inline polymer generation by deduplicating compatible domain
  declarations and failing closed on conflicting domain declarations.
- Emits Python directory targets into package-specific modules so multiple
  generated outputs can be tested in one workspace without import collisions.
- Makes `doctor` include ledger verification status and fail closed when the
  local ledger has been edited, deleted, reordered, or left incomplete.

### Compatibility

- The local ledger is a tamper-evident workspace history. It is not a
  distributed blockchain and is not a formal certificate.
- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim universal correctness, public self-hosting, formal
  certification, or independent toolchain closure.

## 0.1.0-beta.15

### Added

- Adds the Beta15 local runtime bundle metadata used by `brik64 engine status`
  so users can inspect the active local engine boundary from the CLI.
- Adds bounded-domain workflow coverage to the public release train, including
  domain templates, domain inspection, domain validation, and domain-aware
  verification output.
- Adds release-surface synchronization for CLI, installer, SDK metadata, docs,
  web download pages, and public agent skills.

### Changed

- Keeps bounded PCD domain contracts required for claim-bearing local
  `certify`, `verify`, and `polymerize` workflows.
- Aligns package metadata and CLI help text to `0.1.0-beta.15`.
- Keeps public runtime claims closed for unsupported surfaces; the CLI reports
  local workflow evidence without claiming formal certification for arbitrary
  user programs.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim universal correctness, public self-hosting, formal
  certification, or independent toolchain closure.

## 0.1.0-beta.14.6

### Added

- Adds bounded PCD domain declarations for parameter ranges, invariants,
  conditional domains, and technical-sheet parameters.
- Adds `brik64 domain inspect`, `brik64 domain validate`, `brik64 domain sheet`,
  and `brik64 domain add` for domain contract workflows.
- Adds `template --type domain-gate` as a bounded starter PCD.
- Adds domain contract hashes to local candidate certificates and verification
  reports.
- Adds generated TS/Python/Rust domain precondition checks and generated tests
  for fail-closed out-of-domain inputs.

### Changed

- `certify` now requires a complete bounded domain contract by default. Use
  `--syntax-only` or `--prototype-non-claim` for exploratory local work.
- `doctor --json` reports domain status for each PCD in the workspace.
- `polymerize` carries source domain hashes into the polymer manifest and fails
  when inputs are not domain-complete.

## 0.1.0-beta.14.5

### Added

- Adds a Beta14.5 functional-closure gate covering TypeScript `Math.*` lift,
  Python `min(max(abs()))` lift, Rust directory lift, generated Python test
  discovery, and fail-closed missing-source behavior.
- Adds Beta14.5 package and package-smoke gates so local release artifacts are
  built and verified with the current beta version.

### Changed

- Improves TypeScript lift preview for supported clamp patterns that combine
  `Math.floor`, `Math.min`, `Math.max`, and `Math.abs`.
- Improves Rust lift preview for simple `if` plus fallback return bodies by
  preserving the conditional branch in generated PCD candidates.
- Updates generated Python tests so they can run directly and be discovered by
  pytest-compatible runners.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code,
  universal correctness, self-hosting, or independent toolchain closure.

## 0.1.0-beta.14.4

### Added

- Adds fixture coverage for every CORE and EXTENDED registry monomer through
  local execution or explicit deterministic boundary contracts.
- Adds Rust lift preview for simple `fn` and `pub fn` sources.
- Adds directory lift handling for supported JavaScript, Python, and Rust source
  trees.

### Changed

- Fixes generated Rust output for bitwise NOT and floating-point monomer calls.
- Improves lift normalization for `Math.*`, `abs`, `min`, `max`, and clamp-style
  patterns.
- Updates generated lift headers and package evidence to the Beta14.4 version
  surface.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code,
  universal correctness, self-hosting, or independent toolchain closure.

## 0.1.0-beta.14.3

### Added

- Adds a 128-monomer inspection surface with 64 CORE entries and 64 EXTENDED
  entries for registry listing, explanation, and local test reporting.
- Adds Beta14.3 PCD source contracts for CLI command groups, monomer coverage,
  lift workflows, harness checks, and release synchronization.

### Changed

- Improves monomer explain and monomer test output so local automation can
  verify core and extended registry coverage from the CLI.
- Packages Beta14.3 with hash-bound materialization evidence, package checksums,
  and local smoke verification for the distributed beta artifact.
- Aligns CLI, JavaScript, Python, and Rust SDK package coordinates to Beta14.3.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code,
  universal correctness, self-hosting, or independent toolchain closure.

## 0.1.0-beta.14.2

### Added

- Adds `brik64 template` for gate, utility, and numeric-monomer PCD starting
  points.
- Adds command-specific help, `brik64 help exit-codes`, and script-friendly
  quiet/no-banner output controls.
- Adds `brik64 skill check-version` for installed skill/version drift checks.
- Adds `brik64 monomers list` and `brik64 monomers explain` for parser-visible
  CORE monomer registry inspection.

### Changed

- Recognizes the CORE monomer catalog in the parser, executes local
  arithmetic/logic monomers where the PCD runtime has scalar support, and fails
  closed for effectful, non-scalar, or extended monomers without a boundary.
- Improves parser errors for missing `PC` blocks, legacy syntax, and unsupported
  monomer calls with examples and suggested next commands.
- Hardens `lock`, `migrate`, `doctor`, `polymerize`, `lift`, and `update`
  behavior for local workflow use.
- Fixes local multi-input `polymerize` output so generated PCD content preserves
  all merged source functions or fails closed on collisions.
- Fixes packaged `engine status` by including the local runtime claim-boundary
  artifact required by the runtime manifest.
- Aligns CLI, JavaScript, Python, and Rust SDK package coordinates to Beta14.2.

### Compatibility

- macOS and Linux continue to use the portable Node.js CLI package and require
  Node.js 20 or newer.
- Windows native executables are not published in this beta.
- This beta does not claim formal certification for arbitrary user code,
  universal correctness, or independent toolchain closure.

## 0.1.0-beta.14

### Added

- Adds `brik64 lift <js|ts|python> <path> --preview` for local source scanning
  into PCD candidate files.
- Adds `brik64 adoption report` for local lift preview counts, warning counts,
  privacy flags, and PCD inventory summaries.
- Adds support for multiple local functions inside one PCD `PC` block, including
  helper calls emitted to TypeScript, Rust, and Python.
- Restores utility-style multi-function PCDs that do not define a function with
  the same name as the `PC` block by selecting the first function as the local
  entrypoint.

### Changed

- Adds `--force` and `-f` to `brik64 migrate` for explicit overwrite of an
  existing migration output.
- Keeps source lift preview local-only: it does not create certificates, does
  not send source, and records redacted source metadata.
- Aligns CLI, JavaScript, Python, and Rust SDK package coordinates to Beta14.

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
