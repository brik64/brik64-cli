# Changelog

All notable public BRIK64 CLI changes are recorded here.

## 0.1.0-beta.5 - Public Beta

### Added

- Added `brik doctor` to inspect a local `.brik` workspace and report whether
  the beta workspace contract is valid.
- Added `brik engine status` to show the packaged offline `L4+N5` runtime
  bundle, artifact count, runtime mode and public claim boundary.
- Added local PCD certification with `brik certify <file.pcd>`.
- Added local code emission with `brik emit <file.pcd> --target ts|rust|python
  --out <dir> --tests`.
- Added generated test files for TypeScript, Rust and Python emission targets.
- Added a packaged beta5 CLI artifact with SHA-256 checksums and signature
  files for release distribution.
- Added public beta documentation for the beta5 release surface and
  distribution readiness.

### Changed

- Updated the CLI version and project metadata to `0.1.0-beta.5`.
- Updated beta install and distribution documentation to keep curl/GitHub as
  the CLI distribution path.
- Updated SDK alignment references for JS/TS, Python and Rust beta5 packages.
- Updated public skills and docs references so beta5 surfaces use consistent
  command names and candidate boundaries.
- Improved emitted TypeScript, Rust and Python files so outputs include the
  source PCD hash and local beta claim boundary.

### Fixed

- `brik emit` now fails closed when the source PCD changes after certification.
- `brik emit` now rejects unsupported targets instead of generating placeholder
  output.
- `brik emit --out` now rejects output directories that resolve outside the
  current workspace.
- Expected filesystem errors during output generation now return controlled CLI
  errors instead of Node.js stack traces.
- Empty, corrupt, binary and over-limit PCD inputs now fail closed with explicit
  errors.
- Corrupt or policy-invalid `.brik/manifest.json` files now fail closed before
  certification or emission.

### Public Boundary

- The beta5 CLI supports local workspace inspection, PCD certification and
  local emission for TypeScript, Rust and Python.
- The packaged runtime is an offline portable `L4+N5` bundle. It is not a
  native executable runtime.
- GitHub/curl are the CLI distribution channels. npm/PyPI/Cargo are reserved
  for SDK packages.
- Windows and Linux ARM distribution are not included in this beta5 public
  package.

## 0.1.0-beta.4 - Published Beta

- Published curl/GitHub distribution for the previous public beta line.
