# Beta15.4 Ralph Loop Log

## Iteration 1

- Loaded clean branch `codex/beta15-4-rust-polymer-l6` at `e7b1d4b7ab27e0c651c798470bab3d063796fae0`.
- Confirmed package version was `0.1.0-beta.15.3`.
- Located Rust defect in `renderDomainAssertions`: generated `assert_domain(...)` referenced every domain in a polymer contract, including domains not present in the Rust function scope.
- Applied causal fix so Rust `assert_domain(...)` validates only entrypoint parameters and delegates broad helper checks to `assert_domain_value(...)`.
- Added Beta15.4 PCD contracts under `pcd/beta15_4/`.
- Added `scripts/beta15_4-rust-polymer-domain-gate.js`.
- First gate run failed because Rust generated unused helper warnings for non-root polymer functions.
- Added `#[allow(dead_code)]` to generated Rust local/import helper functions.
- Second gate run passed: `PASS_BRIK64_CLI_BETA15_4_RUST_POLYMER_DOMAIN_GATE`.
- Certified Beta15.4 PCD contracts.

Evidence:

- `evidence/beta15_4-rust-polymer-domain/report.json`

## Iteration 2

- Added Beta15.4 pre-public, stale-surface, package, and package-smoke scripts.
- `npm run gate:beta15.4:pre-public-rc` passed.
- `npm run package:beta15.4:local` passed with `releaseEligible=false`.
- `npm run smoke:beta15.4:package` passed from the generated tarball.
- Added Beta15.4 candidate branch handling to `scripts/release-train-dry-run.js`.
- `npm run gate:cli:l6-generation-required` blocked as expected because `evidence/beta15_4-l6-generation/` does not exist.
- `npm run release:train:dry-run -- --allow-dirty` failed closed only on `cli_l6_generation_required`.

Active blocker:

- `missing_l6_generation_evidence_dir:evidence/beta15_4-l6-generation`

## Iteration 3

- PR #184 was blocked by the GitHub `Validate manifest and release train` check.
- Root cause: PR-mode L6 generation was deferred, but the Beta15.4 candidate evidence matrix still required `PASS_CLI_L6_GENERATION_REQUIRED_GATE`.
- Patched `scripts/release-train-dry-run.js` so pull-request dry-runs accept only the explicit L6 deferred/blocked state for Beta15.4 while keeping `publicationAllowed=false`.
- Verified PR-mode dry-run:
  - `GITHUB_ACTIONS=true GITHUB_EVENT_NAME=pull_request npm run release:train:dry-run -- --allow-dirty`
  - Result: `PASS_RELEASE_TRAIN_DRY_RUN`, `publicationAllowed=false`.
- Verified local release dry-run still blocks:
  - `npm run release:train:dry-run -- --allow-dirty`
  - Result: `FAIL_RELEASE_TRAIN_DRY_RUN`, blocker `BLOCKED_CLI_L6_GENERATION_REQUIRED_GATE`.

Active blocker remains:

- L6+N5 must expose/implement a Beta15.4 materializer that produces hash-bound evidence for `PCD/polymer -> generated artifact -> package -> release manifest`.

## Iteration 4

- Added Beta15.4 cross-repo materializer gap consumption to
  `scripts/release-train-dry-run.js`.
- The dry-run now reads
  `../brik64-prod/reports/beta15_4-cli-l6-materializer-gap/gap_report.json`
  by default, or `BRIK64_BETA15_4_L6_GAP_REPORT` when set.
- PR dry-runs defer the cross-repo gate and keep `publicationAllowed=false`.
- Local/public dry-runs require
  `BETA15_4_CLI_L6_MATERIALIZER_GAP_PASS`.
- Added regression
  `scripts/tests/test_beta15_4_release_train_l6_gap.sh`.

Evidence:

- `bash scripts/tests/test_beta15_4_release_train_l6_gap.sh` passed.
- `GITHUB_ACTIONS=true GITHUB_EVENT_NAME=pull_request npm run release:train:dry-run -- --allow-dirty` passed with `publicationAllowed=false`.

Active blocker remains:

- `../brik64-prod/reports/beta15_4-cli-l6-materializer-gap/gap_report.json`
  currently reports `BETA15_4_CLI_L6_MATERIALIZER_GAP_BLOCKED`, so local/public
  release dry-runs fail closed until fresh Beta15.4 L6+N5 materialization
  evidence exists.

## Iteration 5

- GitHub PR validation failed because the external `brik64-prod` gap report is
  not present inside the isolated `brik64-cli` Actions checkout.
- Patched `scripts/release-train-dry-run.js` so missing external gap evidence is
  accepted only in pull-request dry-run mode, while publication/local dry-runs
  still require the report and a PASS decision.
- Verified sequentially:
  - `bash scripts/tests/test_beta15_4_release_train_l6_gap.sh` passed.
  - `GITHUB_ACTIONS=true GITHUB_EVENT_NAME=pull_request BRIK64_BETA15_4_L6_GAP_REPORT=/tmp/brik64_missing_gap_report_seq.json npm run release:train:dry-run -- --allow-dirty` passed with `publicationAllowed=false`.

Boundary:

- Missing external gap evidence remains fatal outside PR mode.
- The public release path still requires
  `BETA15_4_CLI_L6_MATERIALIZER_GAP_PASS`.
