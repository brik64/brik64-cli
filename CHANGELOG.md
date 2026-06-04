# Changelog

All notable BRIK64 CLI changes are recorded here. This file is required for
every beta, release candidate, or public release train.

## 0.1.0-beta.5 - Candidate

Status: `candidate_non_release`.

### Added

- Added `brik doctor` to validate local `.brik/manifest.json`, engine-tier
  policy and PCD inventory.
- Added beta5 engine-tier policy:
  - `L4+N5` as free offline local runtime target;
  - `L5+N5` as registered/paid managed runtime target;
  - `L6+N5` as internal artifact factory.
- Added fail-closed L6 factory bridge preflight:
  `scripts/beta5-l6-factory-bridge.js`.
- Added L6 route-2 generation lane:
  `scripts/beta5-l6-route2-generate.js`.
- Added L6-generated route-2 artifacts under
  `evidence/beta5-l6-route2/generated/`.
- Added beta5 release surface sync matrix:
  `docs/BETA5_RELEASE_SURFACE_SYNC.md`.
- Added beta5 release surface gate:
  `scripts/beta5-release-surface-gate.js`.
- Added portable offline `L4+N5` runtime bundle packaging:
  `scripts/package-l4-runtime.js` and `brik engine status`.
- Added beta5 SDK sync gate:
  `scripts/beta5-sdk-sync-gate.js`.
- Added beta5 public skills sync gate:
  `scripts/beta5-skills-sync-gate.js`.
- Added beta5 docs/web sync gate:
  `scripts/beta5-docs-web-sync-gate.js`.
- Added beta5 publication preflight:
  `scripts/beta5-publication-preflight.js`.
- Added beta5 local adversarial audit:
  `scripts/beta5-adversarial-audit.js`.
- Added beta5 local package builder and package smoke:
  `scripts/build-beta5-package.js` and `scripts/beta5-package-smoke.js`.
- Added beta5 marketplace package gate:
  `scripts/beta5-marketplace-package-gate.js`.
- Added beta5 cross-platform package smoke:
  `scripts/beta5-cross-platform-smoke.js`.
- Added beta5 signed release checksum gate:
  `scripts/beta5-release-checksums.js`.
- Added beta5 local completion gate:
  `scripts/beta5-local-completion-gate.js`.
- Added beta5+ adversarial release audit methodology:
  `docs/BETA5_ADVERSARIAL_RELEASE_AUDIT.md`.

### Changed

- Updated local PCD seed metadata from stale beta3 references to beta5.
- Updated README and docs language from beta4-current wording to beta5
  candidate wording where appropriate.
- Bound L6 preflight and L6 route-2 generation evidence into the beta5
  build-chain manifest.
- Bound release surface gate evidence into the beta5 build-chain manifest.
- Bound the portable L4+N5 runtime bundle manifest into the beta5 build-chain
  manifest.
- Bound local JS/TS, Python and Rust SDK beta5 sync evidence into the beta5
  build-chain manifest.
- Bound public skill beta5 sync evidence into the beta5 build-chain manifest.
- Bound docs/web beta5 candidate sync evidence into the beta5 build-chain
  manifest.
- Bound publication preflight manifest into the beta5 build-chain manifest.
- Bound local adversarial audit evidence into the beta5 build-chain manifest.
- Bound local package manifest and package smoke evidence into the beta5
  build-chain manifest.
- Bound local marketplace package evidence for JS/TS, Python and Rust SDKs
  into the beta5 build-chain manifest.
- Bound local macOS and Linux x86_64 package smoke evidence into the beta5
  build-chain manifest.
- Bound signed beta5 release checksum evidence into the beta5 build-chain
  manifest.
- Bound local completion evidence into the beta5 build-chain manifest.
- Bound adversarial release audit methodology into the beta5 build-chain
  manifest and release surface gate.

### Evidence

- `npm test` passes for local beta5 candidate behavior.
- `node scripts/beta5-l6-factory-bridge.js --live` validates Hetzner L6 serial,
  binary hash, closed claim boundary and route-2 readiness.
- `node scripts/beta5-l6-route2-generate.js` emits route-2 JS, generated test,
  generated test manifest and candidate certificate from the L6 host.
- `node scripts/build-beta5-candidate.js` emits a hash-bound local hardened
  candidate and build-chain manifest.
- `node scripts/beta5-release-surface-gate.js` verifies changelog/matrix
  binding and blocks public release while required surfaces remain blocked.
- `node scripts/package-l4-runtime.js` packages the authoritative L4+N5
  PCD/BIR/certificate bundle and `brik engine status` verifies local hashes.
- `node scripts/beta5-sdk-sync-gate.js` verifies local SDK repos are aligned to
  beta5 and contain no beta4 metadata residue.
- `node scripts/beta5-skills-sync-gate.js` verifies public skills are beta5
  candidate-aligned and do not expose internal engine-tier nomenclature.
- `node scripts/beta5-docs-web-sync-gate.js` verifies docs and web source have
  beta5 candidate sync points without claiming production publication.
- `node scripts/beta5-publication-preflight.js` records exact GitHub Release
  and marketplace blockers and fails closed in release mode.
- `node scripts/beta5-adversarial-audit.js` exercises release gates, sync gates,
  CLI fail-closed behavior, engine bundle tamper detection and docs/web boundary
  tamper detection.
- `node scripts/build-beta5-package.js` creates a local beta5 tarball with
  SHA-256 sums, and `node scripts/beta5-package-smoke.js` extracts it and runs
  version, engine, doctor, certify, emit and stale-certificate fail-closed smoke.
- `node scripts/beta5-marketplace-package-gate.js` verifies local beta5 npm,
  PyPI and Cargo package artifacts exist, match beta5 versions and are
  hash-bound before any marketplace publication decision.
- `node scripts/beta5-cross-platform-smoke.js` verifies the local beta5 CLI
  tarball on macOS local and a Linux x86_64 Hetzner host.
- `node scripts/beta5-release-checksums.js` writes `SHA256SUMS`, signs it with
  the local BRIK64 SSH signing key and verifies the signature against the local
  allowed-signers file.
- `node scripts/beta5-local-completion-gate.js` proves the local beta5
  functional/adversarial objective while leaving publication blockers explicit.

### Release Boundary

- `0.1.0-beta.5` is not a public release yet.
- The L6 route-2 artifact is bounded evidence only; it does not generate the
  full CLI/polymer package.
- A portable offline `L4+N5` PCD/BIR bundle is now packaged; native executable
  runtime packaging remains out of scope for this candidate.
- Windows and Linux ARM audit, final release manifest, GitHub Release and curl
  installer publication remain blocked.
- SDK repositories, public skills, docs source and web source are locally
  aligned for beta5. GitHub Release, curl publication, production deploy and
  marketplace publication remain blocked until final release authorization.

## 0.1.0-beta.4 - Published Beta Reference

Status: latest prior public release reference.

Use GitHub Releases, curl installer metadata and published docs as the authority
for what beta4 made publicly installable.
