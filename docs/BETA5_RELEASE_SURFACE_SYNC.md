# BRIK64 CLI Beta5 Release Surface Sync Matrix

Version: `0.1.0-beta.5`

Status: `public`

This matrix is required by the BRIK64 compiler methodology for every new
version or beta iteration. It prevents the CLI from moving ahead while SDKs,
skills, docs, web, release metadata or changelog drift behind.

## Matrix

| Surface | Status | Evidence | Notes |
| --- | --- | --- | --- |
| CLI repo | updated | `package.json`, `src/brik.js`, `.brik/manifest.json`, `pcd/`, `tests/smoke.sh` | Public beta5 source. |
| CLI changelog | updated | `CHANGELOG.md` | Public functional release notes only. |
| Adversarial release audit methodology | updated | `docs/BETA5_ADVERSARIAL_RELEASE_AUDIT.md` | Mandatory clean-room audit before any beta5+ public publication. |
| Release surface gate | updated | `evidence/beta5-release-surface-gate/report.json` | Enforces changelog/matrix binding and blocks release while required surfaces are blocked. |
| L6 factory bridge | updated | `evidence/beta5-l6-factory-bridge/preflight-report.json` | Live preflight validates L6 serial/hash/boundary/route2. |
| L6 route-2 generation | updated | `evidence/beta5-l6-route2/generation-report.json` | Bounded route-2 artifact generated; full CLI/polymer not generated yet. |
| L4 offline runtime | updated | `engines/l4plus-n5/runtime-bundle.manifest.json`, `brik engine status` | Portable PCD/BIR bundle packaged and hash-verified; native executable not included. |
| JavaScript/TypeScript SDK | updated | `evidence/beta5-sdk-sync/report.json`, `brik64-lib-js/BETA5_SYNC.md` | Local repo aligned to beta5; npm publication still blocked. |
| Python SDK | updated | `evidence/beta5-sdk-sync/report.json`, `brik64-lib-python/BETA5_SYNC.md` | Local repo aligned to beta5; PyPI publication still blocked. |
| Rust SDK | updated | `evidence/beta5-sdk-sync/report.json`, `brik64-lib-rust/BETA5_SYNC.md` | Local repo aligned to beta5; crates.io publication still blocked. |
| Public skills | updated | `evidence/beta5-skills-sync/report.json`, `brik64-tools-skills/skills/brik64/SKILL.md` | Public skills aligned to beta5 and scanned for private nomenclature. |
| Local methodology skill | updated | `/Users/carlosjperez/.codex/skills/brik64-compiler-methodology/SKILL.md` | Release sync/changelog rule added. |
| Docs site | updated | `evidence/beta5-docs-web-sync/report.json`, `brik64-docs-site/BETA5_SYNC.md` | Docs source aligned to beta5. |
| Web/curl surface | updated | `evidence/beta5-docs-web-sync/report.json`, `brik64.com/docs/BRIK64_CLI_BETA5_SURFACE_SYNC.md` | Web source and curl surface aligned to beta5. |
| GitHub Release | updated | `https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.5` | Public beta5 release assets. |
| Marketplace publishing | updated | npm, PyPI and crates.io beta package pages | SDK-only marketplaces; CLI remains curl/GitHub. |

## Release Rule

`0.1.0-beta.5` is public only while every required public surface remains
aligned to the same release manifest version.

Current release decision: `PASS_RELEASE_SURFACE_GATE`.

## Next Required Closures

1. Keep the release manifest, docs, web, SDKs, skills and installer metadata in
   sync.
2. Run the release-train dry-run before the next beta.
3. Do not publish a future beta until every required surface verifies live.
