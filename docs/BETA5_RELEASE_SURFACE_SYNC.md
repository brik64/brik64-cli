# BRIK64 CLI Beta5 Release Surface Sync Matrix

Version: `0.1.0-beta.5`

Status: `candidate_non_release`

This matrix is required by the BRIK64 compiler methodology for every new
version or beta iteration. It prevents the CLI from moving ahead while SDKs,
skills, docs, web, release metadata or changelog drift behind.

## Matrix

| Surface | Status | Evidence | Notes |
| --- | --- | --- | --- |
| CLI repo | updated | `package.json`, `src/brik.js`, `.brik/manifest.json`, `pcd/`, `tests/smoke.sh` | Local beta5 candidate only. |
| CLI changelog | updated | `CHANGELOG.md` | Required for every beta; beta5 entry is candidate/non-release. |
| Adversarial release audit methodology | updated | `docs/BETA5_ADVERSARIAL_RELEASE_AUDIT.md` | Mandatory clean-room audit before any beta5+ public publication. |
| Release surface gate | updated | `evidence/beta5-release-surface-gate/report.json` | Enforces changelog/matrix binding and blocks release while required surfaces are blocked. |
| L6 factory bridge | updated | `evidence/beta5-l6-factory-bridge/preflight-report.json` | Live preflight validates L6 serial/hash/boundary/route2. |
| L6 route-2 generation | updated | `evidence/beta5-l6-route2/generation-report.json` | Bounded route-2 artifact generated; full CLI/polymer not generated yet. |
| L4 offline runtime | updated | `engines/l4plus-n5/runtime-bundle.manifest.json`, `brik engine status` | Portable PCD/BIR bundle packaged and hash-verified; native executable not included. |
| JavaScript/TypeScript SDK | updated | `evidence/beta5-sdk-sync/report.json`, `brik64-lib-js/BETA5_SYNC.md` | Local repo aligned to beta5; npm publication still blocked. |
| Python SDK | updated | `evidence/beta5-sdk-sync/report.json`, `brik64-lib-python/BETA5_SYNC.md` | Local repo aligned to beta5; PyPI publication still blocked. |
| Rust SDK | updated | `evidence/beta5-sdk-sync/report.json`, `brik64-lib-rust/BETA5_SYNC.md` | Local repo aligned to beta5; crates.io publication still blocked. |
| Public skills | updated | `evidence/beta5-skills-sync/report.json`, `brik64-tools-skills/skills/brik64/SKILL.md` | Public skills aligned to beta5 candidate and scanned for private nomenclature. |
| Local methodology skill | updated | `/Users/carlosjperez/.codex/skills/brik64-compiler-methodology/SKILL.md` | Release sync/changelog rule added. |
| Docs site | updated | `evidence/beta5-docs-web-sync/report.json`, `brik64-docs-site/BETA5_SYNC.md` | Docs source has beta5 candidate sync; production deploy still blocked. |
| Web/curl surface | updated | `evidence/beta5-docs-web-sync/report.json`, `brik64.com/docs/BRIK64_CLI_BETA5_SURFACE_SYNC.md` | Web source has beta5 candidate sync; curl publication still blocked. |
| GitHub Release | blocked | no beta5 release manifest/signature/checksums | Required before publication. |
| Marketplace publishing | blocked | no npm/PyPI/Cargo beta5 package evidence | SDK-only marketplaces; CLI remains curl/GitHub. |

## Release Rule

`0.1.0-beta.5` cannot be published while any required public surface is
`blocked`, unless the release manifest explicitly scopes that surface as
`not_applicable` with evidence.

Current release decision: `BLOCKED_PUBLIC_RELEASE_NOT_READY`.

## Next Required Closures

1. Run clean-room adversarial audit for the exact release candidate.
2. Prepare a clean release commit/tag boundary.
3. Create GitHub Release from the signed artifact set.
4. Publish SDK marketplaces only after explicit authorization.
5. Deploy docs/web/curl after the final release manifest exists.
