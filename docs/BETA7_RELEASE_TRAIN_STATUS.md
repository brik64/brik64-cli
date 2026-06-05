# BRIK64 CLI 0.1.0-beta.7 Release Train Status

Date: 2026-06-05

Branch: `codex/beta7-feature-parity`

## RESUME

- lane: `cli_0_1_beta / beta7 release-train`
- iter_id: `BRIK64-CLI-0.1.0-beta.7-RELEASE-TRAIN-R1`
- source_sha: `24dd99f6851e1b028d1a45bfc169bb6996b9d0e2`
- stage1_sha: not applicable to Carril A CLI beta
- current gate: local release train dry-run
- last verdict: `PASS_RELEASE_TRAIN_DRY_RUN`
- primary blocker: beta7 is not public until curl/GCP, GitHub, web, docs,
  skills and SDK marketplace surfaces are synchronized atomically
- next exact command: update public surfaces from
  `evidence/release-train-sync/sync-payload.json`, flip
  `release/manifest.json` to `state=public`, rerun live verification, then run
  publication workflow with the exact manifest digest confirmation
- assumptions: beta7 remains `assisted_generation_non_claim`; no self-hosting,
  formal certification, universal correctness, or independent toolchain closure
  claim is authorized by this release

## Executive Checklist

- 🟩 100% | 🟩 🟩 🟩 🟩 | Beta7 command surface candidate
  - `polymerize`, `verify`, `migrate`, `doctor --json`, `login`, `logout` and
    `account status` exist and pass local smoke.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Beta7 local package candidate
  - `PASS_BETA7_PACKAGE_BUILT`
  - `PASS_BETA7_LOCAL_PACKAGE_SMOKE`
- 🟩 100% | 🟩 🟩 🟩 🟩 | Beta7 release manifest draft validation
  - `PASS_RELEASE_MANIFEST_VALIDATE`
  - `state=draft`
  - `releaseEligible=false`
- 🟩 100% | 🟩 🟩 🟩 🟩 | Beta7 sync payload generation
  - `PASS_RELEASE_TRAIN_SYNC_SURFACES`
  - Payload generated but not dispatched.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Beta7 dry-run route
  - `PASS_RELEASE_TRAIN_DRY_RUN`
  - Commands executed: manifest validation, smoke tests, feature parity,
    local package, package smoke, SDK sync and marketplace package readiness.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Beta7 docs, web and skills source sync
  - `PASS_DOCS_WEB_BETA7_SYNC`
  - `PASS_SKILLS_BETA7_SYNC`
  - Local docs `llms-full.txt` no longer contains forbidden claim terms after
    regeneration.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Beta7 SDK package inputs
  - JavaScript/TypeScript SDK builds, tests and packs
    `brik64-core-0.1.0-beta.7.tgz`.
  - Python SDK tests and builds `brik64-0.1.0b7` wheel/sdist with Python 3.13.
  - Rust SDK tests and packages `brik64-core-0.1.0-beta.7.crate`.
- ⛔ 70% | 🟩 🟩 🟩 ⛔ | Beta7 public release train
  - CLI, SDK, docs, web and skills source are ready locally. Still blocked
    until marketplace/public-surface mutation and post-publication live
    verification.

## Current Evidence

```text
evidence/beta7-feature-parity/report.json
evidence/beta7-package/package.manifest.json
evidence/beta7-package-smoke/report.json
evidence/beta7-sdk-sync/report.json
evidence/beta7-marketplace-packages/report.json
evidence/beta7-skills-sync/report.json
evidence/beta7-docs-web-sync/report.json
evidence/release-manifest-validate/report.json
evidence/release-train-sync/report.json
evidence/release-train-dry-run/report.json
```

Current passing commands:

```bash
npm test
BRIK64_RELEASE_GATES=1 npm test
node scripts/release-train-sync-surfaces.js
node scripts/beta7-sdk-sync-gate.js
node scripts/beta7-marketplace-package-gate.js
node scripts/beta7-skills-sync-gate.js
node scripts/beta7-docs-web-sync-gate.js
node scripts/release-train-dry-run.js --allow-dirty
```

## Public Release Blockers

| Blocker | Evidence needed | Current status |
| --- | --- | --- |
| GitHub Release `v0.1.0-beta.7` | Release exists with beta7 package, package manifest and `SHA256SUMS` | Missing |
| Curl/GCP installer | `https://brik64.com/cli/install.sh` installs beta7 and `beta.json` points to beta7 | Missing |
| Web | `brik64.com` surfaces show beta7 command set and changelog | Source ready; live deploy missing |
| Docs | docs install/version/changelog pages show beta7 | Source ready; live deploy missing |
| Skills | public `brik64` skill is version-independent or beta7-aware without private tier names | Source ready; repo publication missing |
| SDKs | npm/PyPI/crates either publish beta7 or record `no_change_required` evidence | Local packages ready; marketplace mutation missing |
| Live verification | `PASS_RELEASE_TRAIN_LIVE_VERIFY` against public surfaces after publish | Missing |

## Claim Boundary

Beta7 is a product-functionality beta. It may describe:

- local PCD polymerization;
- local verification of certificate and hash coherence;
- legacy PCD migration;
- account/session command boundary;
- human and JSON doctor output;
- portable Node.js package support on macOS and Linux.

Beta7 must not claim:

- formal certification for arbitrary user code;
- universal correctness;
- self-hosting;
- fixpoint;
- independent toolchain closure;
- Windows native executable support;
- public authorization from internal factory evidence.

## Next Patch Order

1. Update or create beta7 SDK package branches and package evidence.
2. Update docs and web from `evidence/release-train-sync/sync-payload.json`.
3. Update public skills to be beta7-aware and version-independent.
4. Re-run local dry-run with manifest still `draft`.
5. Flip manifest to `public` only when all surfaces are ready to mutate.
6. Run publication workflow dry-run.
7. Run publication workflow mutation with exact digest confirmation.
8. Run live verification and keep the report as release evidence.
