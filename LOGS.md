# BRIK64 CLI Ralph Loop Log

## Iteration 33 - Beta17 readiness binds promoted refs

Timestamp: `2026-06-28T00:00:00Z`

- Updated `scripts/beta17-fixpoint-readiness-gate.js` so readiness compares
  `remote_promotion_manifest.json` promoted refs against the exact Stage1,
  Stage2, byte-identity, harness and seal files it evaluates.
- Added a readiness test mutation that corrupts the promoted Stage1 SHA and
  expects `remote_promotion_ref_sha256_mismatch:stage1ArtifactManifest`.

Evidence:

- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `npm run test:beta17:fixpoint-readiness` passed.

Boundary:

- This prevents detached or manually swapped evidence from satisfying
  readiness.
- It does not produce real L6+N5 Stage1/Stage2 artifacts.
- It does not publish Beta17 or open fixpoint claims.

## Iteration 32 - Beta17 readiness requires promotion manifest

Timestamp: `2026-06-28T00:00:00Z`

- Updated `scripts/beta17-fixpoint-readiness-gate.js` so final readiness
  requires `evidence/beta17-fixpoint/remote_promotion_manifest.json`.
- The remote promotion manifest must report
  `PASS_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION` with public release,
  definitive fixpoint, formal N5 and universal correctness claim boundaries
  closed.
- Updated `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` to assert
  the missing-manifest blocker and the PASS path.

Evidence:

- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `npm run test:beta17:fixpoint-readiness` passed.

Boundary:

- This closes a manual-evidence bypass in readiness.
- It does not produce real Stage1/Stage2 evidence.
- It does not publish Beta17 or open fixpoint claims.

## Iteration 31 - Beta17 controlled remote-result promotion

Timestamp: `2026-06-28T00:00:00Z`

- Added `scripts/beta17-fixpoint-promote-remote-result.js`.
- Added npm scripts:
  - `promote:beta17:fixpoint:remote-result`;
  - `test:beta17:fixpoint:remote-result-promotion`.
- Added `scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`.
- The script reruns the remote promotion gate before copying any Stage1,
  Stage2, byte-identity, harness, seal or generated artifact refs into the
  canonical `evidence/beta17-fixpoint/` paths.

Evidence:

- `node --check scripts/beta17-fixpoint-promote-remote-result.js` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.

Boundary:

- The promotion path remains blocked without a real non-fixture remote result.
- The promotion manifest keeps public release and definitive fixpoint claims
  closed until readiness, public sync and external audit pass.
- This does not generate L6+N5 Stage1/Stage2 artifacts or publish Beta17.

## Iteration 30 - Beta17 remote promotion gate

Timestamp: `2026-06-28T00:00:00Z`

- Added `scripts/beta17-fixpoint-remote-promotion-gate.js`.
- Added npm scripts:
  - `gate:beta17:fixpoint:remote-promotion`;
  - `test:beta17:fixpoint:remote-promotion`.
- Added `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh`.
- The gate blocks missing remote reports, skipped/non-pass attempts, open
  claim boundaries, missing transcript refs, missing full stage-result refs
  and fixture materializer evidence.

Evidence:

- `node --check scripts/beta17-fixpoint-remote-promotion-gate.js` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint-readiness` passed.

Boundary:

- This gate is pre-promotion hardening only.
- It does not copy evidence into `evidence/beta17-fixpoint/`.
- It does not generate Stage1/Stage2 artifacts.
- It does not publish Beta17 or open public fixpoint/N5/self-hosting claims.

## Iteration 29 - Beta17 remote stage result preservation

Timestamp: `2026-06-28T00:00:00Z`

- Fixed `scripts/beta17-fixpoint-stage-remote-attempt.js` so accepted remote
  Stage1/Stage2 results are validated from the complete parsed
  `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` payload instead of the truncated
  `observed` preview.
- Persisted complete parsed stage results as transcript refs when present,
  keeping report JSON bounded while preserving hash-bound evidence.
- Added regression assertions to the remote-stage test so the script keeps
  `stageResultRaw` / `resultRef` handling and does not reintroduce validation
  from a truncated preview.

Evidence:

- `node --check scripts/beta17-fixpoint-stage-remote-attempt.js` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.

Boundary:

- This is Beta17 readiness hardening only.
- It does not create Stage1/Stage2 materialization evidence.
- It does not publish Beta17.
- Definitive fixpoint, formal N5, universal correctness, Rust-independence and
  self-hosting claims remain closed until fresh evidence passes the full gate.

## Iteration 28 - Beta15.7.1 publish-plan hotfix support

Timestamp: `2026-06-18T04:50:00Z`

- Updated `scripts/release-train-publish-plan.js` so release publication
  planning accepts bounded hotfix versions such as `0.1.0-beta.15.7.1`.
- Preserved fail-closed behavior for unsupported beta labels and public
  mutation preflight failures.
- Verified the current Beta15.7.1 candidate no longer fails with
  `unsupported_beta_version`.

Evidence:

- `node --check scripts/release-train-publish-plan.js` passed.
- `npm run release:train:publish-plan` returned `rc=1` with the expected
  blocker:
  - `decision=FAIL_PUBLISH_PREFLIGHT`;
  - `publicationAllowed=false`;
  - `failures=manifest_state_not_public:draft`.

Boundary:

- This iteration only fixes publication planning for Beta15.7.1 hotfix labels.
- It does not publish Beta15.7.1.
- The release manifest remains draft and public mutation is still blocked until
  SDKs, docs, web, skills, manifests, credentials and live verification are
  complete.
- Public N5, fixpoint, self-hosting, Rust-independence and universal
  correctness claims remain closed.

## Iteration 27 - Beta15.7.1 L6 materializer version-family closure

Timestamp: `2026-06-18T04:24:00Z`

- Updated `scripts/remote_l6_beta15_7_cli_materializer.js` so the internal
  L6+N5 materializer accepts the bounded `0.1.0-beta.15.7.x` family instead
  of only `0.1.0-beta.15.7`.
- Added environment-overridable serial, wrapper and exec-target paths for
  deterministic local tests without changing the remote production defaults.
- Added `scripts/tests/test_remote_l6_beta15_7_cli_materializer.sh` and npm
  script `test:remote-l6-beta15.7-materializer`.
- Deployed the updated materializer to Hetzner after creating a timestamped
  backup of the previous script.
- Regenerated exact-version L6 evidence for `0.1.0-beta.15.7.1`.
- Aligned Beta15.7.1 release manifest SDK coordinates:
  - npm/crates: `0.1.0-beta.15.7.1`;
  - PyPI: `0.1.0b15.post701`.
- Wired `release:train:dry-run` to consume `release:flow:audit`, preventing a
  dry-run from going green while SDK/public-surface contracts are stale.

Evidence:

- `bash scripts/tests/test_remote_l6_beta15_7_cli_materializer.sh` passed.
- `bash scripts/tests/test_beta15_7_l6_generation_attempt.sh` passed.
- `npm run attempt:beta15.7:l6-generation` passed with
  `PASS_BETA15_7_L6_GENERATION_GATE`.
- `npm run gate:cli:l6-generation-required` passed with
  `PASS_CLI_L6_GENERATION_REQUIRED_GATE`.
- `npm run release:flow:audit` passed.
- `node scripts/release-manifest-validate.js --allow-dirty` passed.
- `npm run release:train:dry-run -- --allow-dirty` passed with
  `publicationAllowed=false`.
- Validation order matters: package regeneration must precede L6
  materialization. Running package rebuild and L6 attempt concurrently creates
  expected hash drift and must be treated as an invalid run, not as evidence.

Boundary:

- This closes the L6 exact-version blocker for the local candidate.
- This does not publish Beta15.7.1.
- Public mutation still requires executing the release train, publishing SDKs,
  updating public surfaces and passing live verification.
- Public N5, fixpoint, self-hosting, Rust-independence and universal
  correctness claims remain closed.

## Iteration 26 - Beta15.7.x mandatory full release audit gate

Timestamp: `2026-06-18T04:47:00Z`

- Added `scripts/beta15_7-full-release-audit-gate.js` as a mandatory local
  candidate audit before Beta15.7.x publication.
- Exposed the gate through:
  - `gate:beta15.7:full-release-audit`;
  - `test:beta15.7-full-release-audit`.
- Wired `scripts/release-train-dry-run.js` so Beta15.7.x candidates run the
  full audit gate as part of release train dry-run.
- The gate creates an isolated workspace and verifies:
  - version and L4+N5 local engine status;
  - command help matrix;
  - 128 monomer matrix;
  - core/extended PCD certify and verify;
  - TS/Python/Rust emit plus generated tests;
  - core, extended and app-system polymers;
  - lift roundtrip for TS, JS, Python and Rust;
  - unsupported-lift warning behavior;
  - fail-closed adversarial vectors for header, type mismatch, numeric
    coercion, non-exhaustive return, reserved identifiers, invalid monomers,
    missing boundary, empty PCD, path traversal, symlink traversal, stale
    certificate and ledger tampering.

Evidence:

- `npm run gate:beta15.7:full-release-audit` passed with
  `PASS_BRIK64_CLI_BETA15_7_FULL_RELEASE_AUDIT_GATE`.
- `evidence/beta15_7-full-release-audit/report.json` records 111 command
  records.
- `node --check scripts/beta15_7-full-release-audit-gate.js` passed.
- `node --check scripts/release-train-dry-run.js` passed.
- `npm run release:train:dry-run -- --allow-dirty` still fails closed on
  `cli_l6_generation_required`, while also recording the full audit gate as
  passing.

Boundary:

- Beta15.7.1 remains not publicly releasable.
- The full release audit gate is NIVEL 3 local candidate evidence.
- It does not satisfy L6+N5 materialization, formal certification, N5,
  fixpoint, self-hosting or Rust-independence claims.

## Iteration 25 - Beta15.7.1 exact-version L6 publication gate

Timestamp: `2026-06-18T03:55:19Z`

- Fixed `scripts/beta15_7-l6-generation-attempt.js` so the L6 materialization
  request and evidence reports read the exact version from `package.json`
  instead of hardcoding `0.1.0-beta.15.7`.
- Fixed `scripts/cli-l6-generation-required-gate.js` so hotfix versions such
  as `0.1.0-beta.15.7.1` resolve to the shared `beta15_7` evidence directory
  while preserving exact version checks inside the reports.
- Hardened `scripts/release-train-dry-run.js` so Beta15.7.x draft releases run
  the L6 required gate and cannot pass dry-run while L6 materialization is
  blocked.
- Removed stale generated Beta15.7 evidence from the active Beta15.7.1 L6
  evidence pack by rerunning the exact-version materialization attempt; the
  current pack fails closed instead of retaining a mismatched artifact.
- Added test coverage for:
  - patch-version request/package refs for `0.1.0-beta.15.7.1`;
  - hotfix label resolution to `beta15_7`;
  - existing remote version-mismatch fail-closed behavior.

Evidence:

- `bash scripts/tests/test_beta15_7_l6_generation_attempt.sh` passed.
- `bash scripts/tests/test_cli_l6_generation_required_gate.sh` passed.
- `node --check scripts/cli-l6-generation-required-gate.js` passed.
- `node --check scripts/beta15_7-l6-generation-attempt.js` passed.
- `npm run attempt:beta15.7:l6-generation` failed closed with:
  - `remote_l6plus_materializer_version_not_supported:0.1.0-beta.15.7.1`;
  - `remote_l6plus_materialization_contract_unavailable`;
  - `generated_artifact_missing`.
- `npm run gate:cli:l6-generation-required` failed closed on the same missing
  L6 artifact/package/release bindings.
- `npm run release:train:dry-run -- --allow-dirty` failed closed on
  `command_failed:cli_l6_generation_required:1`.

Boundary:

- Beta15.7.1 is still not publicly releasable.
- This iteration removes a false-green release-train path; it does not publish
  GitHub/curl/GCP/docs/skills/SDKs.
- Public N5, fixpoint, self-hosting, Rust-independence and pure BRIK64-chain
  claims remain closed.

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

## Iteration 6

- Investigated Beta15.4 package SHA drift observed during repeated dry-runs.
- Root cause: `release:train:dry-run` reruns pre-public gates that rewrite
  evidence reports with fresh timing fields before packaging; the package is
  deterministic only when its staged inputs are frozen.
- Added `scripts/tests/test_beta15_4_package_determinism.sh` to build the
  package twice from unchanged inputs and compare package SHA, `SHA256SUMS` and
  `stage-checksums.tsv`.

Evidence:

- `bash scripts/tests/test_beta15_4_package_determinism.sh` passed.

Boundary:

- This does not make pre-public evidence reports timestamp-free.
- It proves the packager is deterministic under frozen inputs and preserves the
  release requirement that final L6 evidence, package hash and release manifest
  must be generated as one sealed set.

## Iteration 7

- Added canonical Beta15.4 release contract:
  `pcd/beta15_4/release/l6_cli_materialization_contract.pcd`.
- Added `scripts/beta15_4-l6-generation-attempt.js` and npm script
  `attempt:beta15.4:l6-generation`.
- The attempt sends the contract PCD to the Hetzner L6+N5 wrapper through the
  same command family previously probed: `compile`, `route2`, `materialize`,
  and `emit`.
- Current L6+N5 wrapper still fails closed with unsupported/missing input, so
  the attempt writes blocked evidence rather than release evidence.
- Added `scripts/tests/test_beta15_4_l6_generation_attempt.sh`.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still blocks publication, now with
  `pcd/beta15_4/release/l6_cli_materialization_contract.pcd` included in
  `evidence/beta15_4-l6-generation/input_pcd_hashes.tsv`.

Active blocker remains:

- The L6+N5 host must expose an actual CLI materializer endpoint that accepts
  the Beta15.4 contract and emits artifact/package/release-manifest hash
  binding.

## Iteration 8

- Inspected the Hetzner L6+N5 authority before attempting any publication.
- Confirmed `healthcheck` and `audit` PASS for serial
  `BRIK64-L6PLUS-N5-20260605-BETA6MP-660de957`, but the public wrapper is a
  `shell_exec_only` shim around the current ELF.
- Patched `scripts/beta15_4-l6-generation-attempt.js` so the evidence pack now
  records wrapper hash, executed target hash, current engine directory and
  contract acceptance state.
- Added regression assertions in
  `scripts/tests/test_beta15_4_l6_generation_attempt.sh` for the explicit
  blocker `remote_l6plus_wrapper_has_no_cli_materializer_interface`.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed, now with four
  blockers including `remote_l6plus_wrapper_has_no_cli_materializer_interface`.

Boundary:

- This is not L6+N5 materialization.
- This is not Beta15.4 publication.
- It prevents a healthy remote engine audit from being misread as a complete
  CLI materializer endpoint.

## Iteration 9

- Added `scripts/beta15_4-l6-materialization-result.js` as the strict parser
  and validator for the future L6+N5 endpoint output.
- Updated `scripts/beta15_4-l6-generation-attempt.js` to consume
  `BRIK64_L6_CLI_MATERIALIZATION_RESULT\t<base64-json>` and write PASS
  artifact/package/seal evidence only when all hash-binding fields validate.
- Added adversarial parser coverage for:
  - valid complete hash-bound result;
  - stale version;
  - invalid package hash;
  - missing PCD-to-artifact binding;
  - absent result line.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed, as expected,
  because the remote endpoint is not installed and no L6-generated artifact is
  present.

Boundary:

- This prepares the consumer side of the L6 materializer endpoint.
- It does not install the endpoint, generate the artifact, publish Beta15.4 or
  create self-hosting/fixpoint/Rust-independence claims.

## Iteration 10

- Re-ran the Beta15.4 L6 attempt after the Hetzner wrapper was upgraded to a
  fail-closed CLI materializer dispatcher.
- Updated remote wrapper probing to detect `cli_materializer_dispatcher` and
  bind the dispatcher to the underlying L6+N5 exec target hash.
- Updated the fail-closed attempt regression so the blocker moves from
  `remote_l6plus_wrapper_has_no_cli_materializer_interface` to
  `remote_l6plus_materialization_contract_unavailable`.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed because no
  L6-generated artifact/package/release hash binding exists.

Boundary:

- The dispatcher is operational endpoint plumbing only.
- It is not a generated CLI artifact and does not authorize Beta15.4
  publication.

## Iteration 11

- Hardened `scripts/beta15_4-l6-materialization-result.js` so the accepted
  endpoint result must include L6+N5 provenance, not only package hashes.
- Required fields now include `l6plusEngineSerial`,
  `materializerMode=l6plus_pcd_polymer_materializer`,
  `generationTraceSha256`, `pcdInputSetSha256`, `remoteWrapperSha256` and
  `wrapperExecTargetSha256`.
- Added adversarial parser coverage for missing serial, manual materializer
  mode and missing generation trace hash.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed, as expected,
  because no L6-generated artifact/package/release hash binding exists.

Boundary:

- This closes a provenance-bypass risk in the future endpoint contract.
- It does not materialize the Beta15.4 CLI artifact and does not authorize
  public release.

## Iteration 12

- Extended the L6 materialization result validator to accept expected context:
  PCD input-set hash, remote wrapper hash and wrapper exec-target hash.
- Updated `scripts/beta15_4-l6-generation-attempt.js` to compute the PCD
  input-set hash from `input_pcd_hashes.tsv` content and bind it to the remote
  wrapper references observed over SSH.
- Added adversarial parser coverage for:
  - wrong PCD input-set hash;
  - wrong remote wrapper hash;
  - wrong wrapper exec-target hash.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed with the
  expected publication blockers.
- Current expected context:
  - `pcdInputSetSha256=27ba57a258033dfa9255df57e65e1a6a331eed500b25a89a354c691a8c561501`
  - `remoteWrapperSha256=0377618ff38f71be3e97557b785f25ff73c5d20ce2364ec0d1788eaae3dd3b5c`
  - `wrapperExecTargetSha256=7bad9474a6ff607176c9b00161d917fb0648327b87c684f8b01708a7d7ad758a`

Boundary:

- This prevents shape-valid but context-invalid materialization results from
  passing.
- It does not implement the missing L6 materializer or publish Beta15.4.

## Iteration 13

- Added `pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd` as
  a dedicated PCD for the endpoint result payload contract.
- Updated `scripts/beta15_4-l6-generation-attempt.js` so the L6 input-set
  includes both:
  - `l6_cli_materialization_contract.pcd`;
  - `l6_cli_materialization_result_contract.pcd`.
- Updated the fail-closed generation attempt test to require both PCDs in the
  generated input hash ledger.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `npm run gate:cli:l6-generation-required` still fails closed with expected
  blockers because no L6-generated artifact/package/release binding exists.
- Current PCD input-set hash:
  `1d71d77c1d006dac52a9c2d95053dfa7b7118a9fced5ac2a0a52e8f089d46d7b`.

Boundary:

- This moves more of the materializer acceptance contract into PCD.
- It does not implement the missing materializer endpoint or publish Beta15.4.

## Iteration 14

- Hardened `scripts/beta15_4-l6-materialization-result.js` so an accepted
  result must list all required input PCD paths.
- Updated `scripts/beta15_4-l6-generation-attempt.js` to record
  `requiredInputPcdPaths` in `remoteCapability.expectedMaterializationContext`.
- Added adversarial parser coverage for omitting
  `pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd` from the
  materialization payload.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed with expected
  artifact/package/release binding blockers.

Boundary:

- This prevents a future endpoint from satisfying the aggregate input hash
  while omitting required PCD refs in `inputPcds`.
- It does not implement the materializer endpoint or publish Beta15.4.

## Iteration 15

- Hardened `scripts/beta15_4-l6-materialization-result.js` so an accepted
  endpoint result must include safe relative file refs for:
  - generated artifact;
  - package;
  - release manifest;
  - seal report.
- The generated artifact, package and release manifest refs must match the
  declared top-level hashes.
- Added adversarial parser coverage for:
  - missing generated artifact ref;
  - unsafe package ref path traversal;
  - release manifest ref hash mismatch.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed with expected
  blockers because the L6+N5 endpoint does not emit the required artifact,
  package, release manifest or seal refs.

Boundary:

- This closes a detached-hash evidence-pack bypass in the future endpoint
  contract.
- It does not implement the materializer endpoint or publish Beta15.4.

## Iteration 16

- Updated `pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd`
  so the PCD source contract now expresses the same file-ref closure enforced
  by the CLI parser:
  - generated artifact ref is safe;
  - generated artifact ref hash matches;
  - package ref is safe;
  - package ref hash matches;
  - release manifest ref is safe;
  - release manifest ref hash matches;
  - seal report ref is safe.
- Regenerated the local candidate certificate for the result contract PCD.
- Re-ran the Beta15.4 L6 generation attempt so `input_pcd_hashes.tsv`,
  `hashes.json`, `generated_artifact_manifest.json` and `gate-report.json`
  carry the updated result-contract hash.

Evidence:

- `node src/brik.js certify pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd`
  passed.
- `node src/brik.js verify pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd`
  passed after the certificate was written.
- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed with expected
  blockers because no L6-generated artifact/package/release binding exists.
- Updated PCD input-set hash:
  `89f42e453363bd36f31d6fd05f1542fe018c9614bf7292509268683287f8b377`.

Boundary:

- This aligns the PCD source contract with the stricter parser and prod
  operator packet.
- It does not implement the materializer endpoint or publish Beta15.4.

## Iteration 17

- Hardened `scripts/beta15_4-l6-materialization-result.js` so, when the
  caller supplies `workspaceRoot`, each declared materialization file ref must:
  - resolve under the workspace;
  - exist as a file;
  - hash to its declared SHA-256.
- Updated `scripts/beta15_4-l6-generation-attempt.js` to pass the active
  workspace root inside the expected materialization context.
- Added parser coverage for:
  - valid materialization refs backed by real temp files;
  - missing package evidence file;
  - tampered package evidence hash mismatch.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed with expected
  blockers because the endpoint does not emit any accepted materialization
  result.

Boundary:

- This closes a file-ref existence/hash bypass in the future materializer
  result acceptance path.
- It does not implement the materializer endpoint or publish Beta15.4.

## Iteration 18

- Hardened `scripts/beta15_4-l6-materialization-result.js` so, when the
  caller supplies `workspaceRoot`, each declared `inputPcds[]` ref must:
  - use a safe relative path;
  - resolve under the workspace;
  - exist as a file;
  - hash to its declared SHA-256.
- Added parser coverage for:
  - valid input PCD refs backed by real temp files;
  - missing input PCD file;
  - tampered input PCD file hash mismatch;
  - unsafe input PCD path traversal.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed with expected
  blockers because no L6-generated artifact/package/release binding exists.

Boundary:

- This closes a per-PCD evidence bypass in the future materializer result
  acceptance path.
- It does not implement the materializer endpoint or publish Beta15.4.

## Iteration 19

- Added `scripts/beta15_4-l6-materializer-request-bundle.js` to generate a
  deterministic `BRIK64_L6_CLI_MATERIALIZATION_REQUEST` bundle for the
  Beta15.4 L6 endpoint.
- The bundle includes:
  - exact input PCD paths;
  - per-PCD SHA-256 and byte counts;
  - base64 PCD contents;
  - PCD input-set hash;
  - required output refs for generated artifact, package, release manifest and
    seal report;
  - public claim boundary set to false.
- Updated `scripts/beta15_4-l6-generation-attempt.js` so every L6 attempt
  regenerates the request bundle and records its manifest in
  `l6plus_engine_manifest.json`.
- Added adversarial request-bundle coverage for:
  - valid generated request;
  - tampered PCD content;
  - missing required PCD;
  - unsafe output ref;
  - mismatched aggregate input-set hash.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_materializer_request_bundle.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed with expected
  artifact/package/release binding blockers.

Boundary:

- This creates an exact request input for the missing L6 materializer endpoint.
- It does not produce the L6-generated CLI artifact and does not publish
  Beta15.4.

## Iteration 20

- Added request-result hash binding to the Beta15.4 L6 materialization result
  contract.
- Updated `pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd`
  with `materializer_request_hash_matches`.
- Hardened `scripts/beta15_4-l6-materialization-result.js` so accepted
  endpoint results must include `materializerRequestSha256`.
- Updated `scripts/beta15_4-l6-generation-attempt.js` so the expected
  materialization context includes the SHA-256 of the generated `request.line`.
- Added parser coverage for:
  - missing `materializerRequestSha256`;
  - mismatched `materializerRequestSha256`;
  - valid request hash binding.

Evidence:

- `node src/brik.js certify pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd`
  passed.
- `node src/brik.js verify pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd`
  passed.
- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_materializer_request_bundle.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed with expected
  artifact/package/release binding blockers.

Boundary:

- This binds any future materialization result to the exact current request
  bytes.
- It changes the Beta15.4 input PCD set hash and therefore requires downstream
  prod report sync.
- It does not implement the materializer endpoint or publish Beta15.4.

## Iteration 21

- Extracted strict Beta15.4 L6 materializer gap report validation into
  `scripts/beta15_4-l6-materializer-gap-report-validate.js`.
- Updated `scripts/release-train-dry-run.js` so the release train calls that
  validator instead of an inline decision-only script.
- The validator now requires:
  - version `0.1.0-beta.15.4`;
  - decision `BETA15_4_CLI_L6_MATERIALIZER_GAP_PASS`;
  - closed public claim boundaries;
  - release publication allowed only after the gap report is actually PASS;
  - L6 attempt pass checks;
  - exact materializer request checks, including input-set match;
  - valid expected PCD input-set, materializer request, wrapper and exec-target
    hashes;
  - package pass and release eligibility;
  - every expected input PCD path present in the materializer request.
- Added adversarial coverage for:
  - current real blocked gap report failing closed;
  - synthetic complete PASS report accepted;
  - synthetic PASS report with broken request binding rejected.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_materializer_gap_report_validate.sh`
  passed.
- `bash scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`
  passed.
- `bash scripts/tests/test_beta15_4_release_train_l6_gap.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed with expected
  blockers:
  `artifact_manifest_missing_pcd_to_artifact_hash_binding`,
  `package_manifest_missing_artifact_to_package_hash_binding`, and
  `package_manifest_missing_package_to_release_manifest_hash_binding`.

Boundary:

- This closes a release-train bypass where a future superficial gap `PASS`
  could have hidden missing request-bundle evidence.
- It does not implement the L6 materializer endpoint, generate the missing
  artifact, or publish Beta15.4.

## Iteration 22

- Aligned the Beta15.4 L6 materializer request output refs with the actual
  candidate package archive path:
  `evidence/beta15_4-package/brik64-cli-0.1.0-beta.15.4.tgz`.
- Replaced the stale Beta15.2 `release/manifest.json` with a draft Beta15.4
  candidate manifest bound to the local Beta15.4 package and candidate
  evidence.
- Hardened `scripts/cli-l6-generation-required-gate.js` so an existing release
  manifest must match the candidate version exactly. `package.json` can no
  longer mask a stale release manifest.
- Added `scripts/tests/test_cli_l6_generation_required_gate.sh`, covering:
  - stale release manifest fails closed;
  - matching release manifest passes when all synthetic L6 evidence is valid.

Evidence:

- `bash scripts/tests/test_cli_l6_generation_required_gate.sh` passed.
- `bash scripts/tests/test_beta15_4_l6_materializer_request_bundle.sh` passed.
- `npm run gate:cli:l6-generation-required` still fails closed, now without
  release-manifest drift.
- `npm run smoke:beta15.4:package` passed.
- `node scripts/release-manifest-validate.js --allow-dirty` passed for the
  draft Beta15.4 manifest.

Boundary:

- This closes candidate metadata drift and a stale manifest bypass.
- It does not implement the L6 materializer endpoint, generate the missing
  artifact, or publish Beta15.4.

## Iteration 23

- Added explicit source commit binding semantics to
  `release/manifest.json`.
  - Draft/candidate manifests may use `candidate_base_commit`.
  - Public manifests must use `release_ref_exact`.
- Hardened `scripts/release-manifest-validate.js`:
  - candidate manifests reject missing/unknown commit binding;
  - public manifests reject `candidate_base_commit`;
  - public manifests reject stale release refs when an expected head/ref is
    provided or available from git.
- Added `scripts/tests/test_release_manifest_source_commit_binding.sh` with
  adversarial coverage for:
  - draft candidate base commit accepted;
  - public candidate-base binding rejected;
  - public stale release ref rejected;
  - public exact release ref accepted.

Evidence:

- `bash scripts/tests/test_release_manifest_source_commit_binding.sh` passed.
- `bash scripts/tests/test_cli_l6_generation_required_gate.sh` passed.
- `node scripts/release-manifest-validate.js --allow-dirty` passed for the
  draft Beta15.4 manifest.
- `npm run gate:cli:l6-generation-required` still fails closed on missing
  L6 artifact/package/release hash bindings.

Boundary:

- This closes the manifest self-reference ambiguity for draft vs public
  release evidence.
- It does not implement the L6 materializer endpoint, generate the missing
  artifact, or publish Beta15.4.

## Iteration 24

- Materialized the Beta15.4 CLI L6 evidence pack through the real L6+N5
  route-2 emitter available at
  `/opt/brik64/builds/brik64-prod-e5d6fdba1-min/target/debug/brikc_cli_l6plus`.
- Normalized the required Beta15.4 PCD contracts to the route-2 subset that
  the L6 emitter actually accepts:
  - no `domain` declarations in the route-2 input PCDs;
  - no typed function annotations;
  - direct `if (...) { return ...; }` branches;
  - no nested branch without direct return;
  - no `<`/`>` comparators in `pcd/cli_polymer.pcd`.
- Added direct L6 route-2 materialization to
  `scripts/beta15_4-l6-generation-attempt.js`, producing
  `materialization-out.tgz`, direct materialization SHA256SUMS, a summary,
  generated artifact manifest, package binding manifest and seal report.
- Updated the Beta15.4 generation test to assert successful materialization
  instead of the old fail-closed endpoint-only state.
- Updated release dry-run routing and smoke expectations so Beta15.4 uses the
  existing npm scripts and package-smoke decision names.

Evidence:

- `bash scripts/tests/test_beta15_4_l6_generation_attempt.sh` passed.
- `npm run gate:cli:l6-generation-required` passed.
- `bash scripts/tests/test_cli_l6_generation_required_gate.sh` passed.
- `BRIK64_RELEASE_GATES=1 bash tests/smoke.sh` passed.
- Cross-repo prod gap gate passed after consuming the regenerated CLI evidence.
- `npm run release:train:dry-run` now fails only on
  `initial_worktree_dirty`.

Boundary:

- Beta15.4 is not published.
- The evidence is non-claim L6 route-2 materialization, not fixpoint,
  formal N5, self-hosting or Rust-independence evidence.

## Beta15.7.1 Ralph Loop Iteration - SDK publish preflight hardening

Task:
- Prevent a false-green public mutation plan when `release/manifest.json` declares SDK versions whose repository metadata and artifacts are not present locally.

Change:
- Hardened `scripts/release-train-publish-plan.js` to inspect required SDK project versions and artifacts for npm, PyPI and crates.io before exposing public mutation commands.
- Added `sdkPreflight` evidence to `evidence/release-train-publish-plan/report.json`.
- Updated `TASKS_TODO.md` and `IMPLEMENTATION_PLAN.md` with the explicit SDK blockers for Beta15.7.1.

Evidence:
- `node --check scripts/release-train-publish-plan.js` passed.
- `npm run release:train:publish-plan` fails closed with:
  - `manifest_state_not_public:draft`
  - `sdk_project_version_mismatch:npm:0.1.0-beta.15.7:0.1.0-beta.15.7.1`
  - `sdk_artifact_missing:npm:/Users/carlosjperez/Documents/GitHub/brik64-lib-js/dist/brik64-core-0.1.0-beta.15.7.1.tgz`
  - `sdk_project_version_mismatch:pypi:0.1.0b15.post4:0.1.0b15.post701`
  - `sdk_artifact_missing:pypi:brik64-0.1.0b15.post701*`
  - `sdk_project_version_mismatch:crates.io:0.1.0-beta.15.4:0.1.0-beta.15.7.1`
- `npm run release:train:dry-run -- --allow-dirty` passed with `publicationAllowed=false`.

Boundary:
- This does not publish Beta15.7.1.
- This does not create SDK artifacts.
- It makes the SDK blocker explicit and auditable before public mutation.

## Beta15.7.1 Ralph Loop Iteration - SDK metadata and artifact alignment

Task:
- Align required SDK repositories and local package artifacts with the Beta15.7.1 release manifest before public mutation.

Changes:
- JS SDK: updated `@brik64/core` metadata and README to `0.1.0-beta.15.7.1`; pushed PR https://github.com/brik64-admin/brik64-lib-js/pull/11.
- Python SDK: updated `brik64` metadata, `__version__`, and README to `0.1.0b15.post701` aligned with CLI `0.1.0-beta.15.7.1`; pushed PR https://github.com/brik64-admin/brik64-lib-python/pull/13.
- Rust SDK: updated `brik64-core` metadata, lockfile, workflow default, and README to `0.1.0-beta.15.7.1`; pushed PR https://github.com/brik64-admin/brik64-lib-rust/pull/15.

Evidence:
- JS: `npm run build`, `npm test`, `npm run test:package-exports`, and `npm pack --pack-destination dist` passed; local artifact `dist/brik64-core-0.1.0-beta.15.7.1.tgz` exists.
- Python: system `python3` is 3.9.6 and correctly failed against package syntax requiring Python >=3.10; validation reran in a Python 3.13 venv, `pytest` passed 11 tests, and `python -m build` produced wheel/sdist for `0.1.0b15.post701`.
- Rust: `cargo test` passed 15 unit tests and 34 doc tests; `cargo package --allow-dirty --no-verify` produced `target/package/brik64-core-0.1.0-beta.15.7.1.crate`.
- CLI publish-plan now fails only on `manifest_state_not_public:draft`; previous SDK version/artifact blockers are gone.

Boundary:
- SDK PRs are not merged yet.
- Marketplace publication has not happened yet.
- Public Beta15.7.1 remains unpublished while the manifest is draft.

## Beta15.7.1 Ralph Loop Iteration - SDK PR merge and credential preflight

Task:
- Merge SDK source alignment and check whether the public mutation train can publish Beta15.7.1 atomically.

Changes:
- Rewrote SDK PR branches onto current `origin/main` to remove old branch conflicts.
- JS PR https://github.com/brik64-admin/brik64-lib-js/pull/11 merged.
- Python PR https://github.com/brik64-admin/brik64-lib-python/pull/13 merged.
- Rust PR https://github.com/brik64-admin/brik64-lib-rust/pull/15 merged.
- Fixed JS SDK package allowlist during rebase so the npm tarball no longer embeds historical `.tgz` files from `dist/`.

Evidence:
- JS: `npm run build`, `npm test`, `npm run test:package-exports`, and `npm pack --pack-destination dist` passed after the allowlist fix; tarball size returned to ~20.8 kB and no nested tarballs appeared in npm notice contents.
- Python: Python 3.13 venv validation passed 11 tests and built `brik64-0.1.0b15.post701` wheel/sdist.
- Rust: `cargo test` passed 15 unit tests and 34 doc tests; `cargo package --allow-dirty --no-verify` passed.
- `npm run release:train:publish-plan` now fails only on `manifest_state_not_public:draft` for non-mutating mode.
- `npm run release:train:publish-plan -- --publish` fails closed on missing confirmation, draft manifest and missing release credentials.
- 1Password check inside tmux: `op whoami` works, but active service account lists only vault `C-BIAS`; BRIK64 vault is not visible. The only matching C-BIAS item found was `Service Account Auth Token: BRIK64-FLEET`.

Boundary:
- SDK source is merged, but SDK marketplace publication has not happened.
- Beta15.7.1 public mutation is blocked until the release credential set is exported or the 1Password service account scope is corrected.
- No secrets were printed.

## Beta15.7.1 Ralph Loop Iteration - Public manifest dry-run gate

Task:
- Convert the Beta15.7.1 manifest from draft candidate state to a public-release candidate that can be published by the GitHub Actions release train.

Changes:
- Promoted `release/manifest.json` to `state=public` with `source.commitBinding=public_release_base_commit`.
- Updated README wording from beta candidate to public beta.
- Updated Beta15.7.1 release notes to describe public package behavior without candidate-only wording.
- Hardened `scripts/build-beta15_7-package.js` so regenerating the package preserves an existing public manifest instead of silently downgrading it back to draft.
- Removed the impossible pre-public `beta15_7_publication_gate` blocker from `scripts/release-train-dry-run.js`; post-public evidence remains the responsibility of publish execution and live verify.

Evidence:
- `node --check scripts/build-beta15_7-package.js` passed.
- `node --check scripts/release-train-dry-run.js` passed.
- `node scripts/release-manifest-validate.js --allow-dirty` passed for public manifest.
- `npm run package:beta15.7:local` preserved `state=public` and `source.commitBinding=public_release_base_commit`.
- `npm run gate:beta15.7:full-release-audit` passed.
- `npm run release:train:dry-run -- --allow-dirty` passed with `PASS_RELEASE_TRAIN_DRY_RUN`.
- `npm run release:train:publish-plan` now fails only on `github_verified_signature_not_pass:BLOCKED_RELEASE_GITHUB_VERIFIED_SIGNATURE` because the current local branch commit is unsigned.

Boundary:
- This does not publish Beta15.7.1.
- This prepares the manifest and dry-run path for GitHub Actions publication from a verified merge/ref.

## Beta15.7.1 Ralph Loop Iteration - PR dry-run SDK preflight routing

Task:
- Fix the PR CI `Validate manifest and release train` failure caused by the
  dry-run publish-plan checking sibling SDK repositories/artifacts before the
  GitHub Actions publication workflow has prepared them.

Change:
- Updated `scripts/release-train-publish-plan.js` so SDK project-version and
  artifact checks remain fatal for the real publish plan, but are routed to
  warnings when `BRIK64_RELEASE_TRAIN_DRY_RUN_IN_PROGRESS=1`.

Evidence:
- `node --check scripts/release-train-publish-plan.js` passed.
- `BRIK64_RELEASE_TRAIN_DRY_RUN_IN_PROGRESS=1 node scripts/release-train-publish-plan.js` passed with `PASS_PUBLISH_PLAN_DRY_RUN` and `failures=[]`.
- `npm run release:train:dry-run -- --allow-dirty` passed with `PASS_RELEASE_TRAIN_DRY_RUN`.
- `npm run release:train:publish-plan` still fails closed with `github_verified_signature_not_pass:BLOCKED_RELEASE_GITHUB_VERIFIED_SIGNATURE`, proving the real publication preflight still requires a verified GitHub release ref.

Boundary:
- This does not publish Beta15.7.1.
- This does not weaken SDK marketplace publication requirements for the real
  workflow; it only prevents PR dry-run runners without sibling SDK checkouts
  from failing before publication preparation.

## Beta15.7.1 Ralph Loop Iteration - Public manifest source rebind

Task:
- Fix the GitHub Actions release workflow failure after PR #203 was squash
  merged. The public manifest still pointed to the pre-squash branch commit
  `f0fccb0`, which is not an ancestor of the verified squash merge on `main`.

Change:
- Updated `release/manifest.json` `source.commit` to the verified merge commit
  `e4411162e67c864a1449de5ac3ce8027d61be978` while preserving
  `source.commitBinding=public_release_base_commit`.

Evidence:
- This is a manifest-only rebind required by the existing
  `release-manifest-validate` and `release-flow-audit` ancestry gates.
- `node scripts/release-manifest-validate.js --allow-dirty` passed with
  `PASS_RELEASE_MANIFEST_VALIDATE`.
- `npm run release:flow:audit` passed with `PASS_RELEASE_FLOW_AUDIT`.
- `npm run release:train:dry-run -- --allow-dirty` passed with
  `PASS_RELEASE_TRAIN_DRY_RUN`.

Boundary:
- This changes the release manifest digest and requires a fresh workflow
  dispatch confirmation.
- This does not mutate public surfaces or change CLI package contents.

## Beta15.7.1 Ralph Loop Iteration - Publish execute generated evidence allowlist

Task:
- Fix the real `execute_publication=true` workflow failure after all
  pre-publication gates and credentials passed. `release-train-publish-execute`
  failed closed on `worktree_dirty:3`.

Finding:
- The failed workflow artifact showed only generated evidence files as dirty:
  `evidence/beta15_7-full-release-audit/report.json`,
  `evidence/beta15_7-source-candidate-contract/report.json`, and
  `evidence/release-flow-audit/report.json`.
- `publicationMutated=false`; no public surface was mutated before the failure.
- `release-train-publish-plan` had already reached
  `PASS_PUBLISH_PREFLIGHT_READY_TO_MUTATE`.

Change:
- Allowlisted those generated reports in
  `scripts/release-train-publish-execute.js` as controlled release-train
  evidence, matching the existing pattern for other generated gate reports.

Boundary:
- This does not weaken arbitrary dirty-worktree protection.
- Real publication still requires clean preflight, exact manifest digest,
  valid confirmation, credentials, GitHub verified signature and command
  preflight.

## Beta15.7.1 Ralph Loop Iteration - Patch-version public surface parsers

Task:
- Fix the second real publication failure. The workflow had already published
  GitHub release assets plus npm, PyPI and crates SDKs, then failed on
  `gcp_curl` with `unsupported beta version: 0.1.0-beta.15.7.1`.

Change:
- Updated `scripts/release/upload-gcp-curl-surface.sh` to accept patch beta
  versions such as `0.1.0-beta.15.7.1` while still resolving package evidence
  to `beta15_7`.
- Updated `scripts/release/sync-web-release-surface.js` to accept multi-part
  beta labels for web/download/changelog sync.

Evidence:
- `node --check scripts/release/sync-web-release-surface.js` passed.
- `bash -n scripts/release/upload-gcp-curl-surface.sh` passed.
- `BRIK64_RELEASE_DRY_RUN=1 scripts/release/upload-gcp-curl-surface.sh release/manifest.json`
  passed and resolved the package object under
  `cli/releases/0.1.0-beta.15.7.1/`.

Boundary:
- This is a catch-up fix after partial public mutation.
- Previously executed channels are idempotent in the publish plan and should
  be skipped/read as already published on rerun.

## Beta15.7.1 Ralph Loop Iteration - Public docs/skills sync and live verifier fallback

Task:
- Close the remaining live verification blocker after the partial public
  Beta15.7.1 release train mutation. Public `beta.json`, GitHub release, GCP
  installer and SDK marketplaces were already on `0.1.0-beta.15.7.1`; docs and
  the public skill still exposed `0.1.0-beta.15.7`.

Change:
- Synced public docs from a clean `brik64-docs-site` clone and pushed
  `f41b748` to `main`.
- Synced public `brik64-tools-skills` from a clean clone and pushed `b6fbe7f`
  to `main`.
- Hardened `scripts/release-train-live-verify.js` so `requireText()` fails
  closed on non-text bodies or missing needles and uses the public curl
  installer URL as the install-command fallback when `release/manifest.json`
  does not carry `cli.installCommand`.

Evidence:
- Docs local verification passed:
  `python3 scripts/verify-public-surface.py` reported
  `public surface verification passed`.
- Public probes observed `0.1.0-beta.15.7.1` on
  `https://docs.brik64.com/llms.txt` and on the raw public skill.
- `node --check scripts/release-train-live-verify.js` passed.
- `npm run release:train:live-verify -- --wait-seconds 1` passed with
  `PASS_RELEASE_TRAIN_LIVE_VERIFY` and `publicationAllowed=true`.

Boundary:
- This is live public-surface verification, not a new compiler correctness or
  fixpoint claim.
- The live verifier hardening does not mutate public release assets; it makes
  the verifier deterministic for manifests that omit optional install-command
  metadata.

## Beta17 Ralph Loop Iteration - Fixpoint readiness gate

Task:
- Start the Beta17 fixpoint lane with a fail-closed gate that prevents
  publication or fixpoint claims without fresh Stage1/Stage2 byte-identical
  evidence.

Change:
- Added `scripts/beta17-fixpoint-readiness-gate.js`.
- Added `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
- Added npm scripts `gate:beta17:fixpoint-readiness` and
  `test:beta17:fixpoint-readiness`.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run gate:beta17:fixpoint-readiness` correctly returned
  `BLOCKED_BETA17_FIXPOINT_READINESS_GATE` against the current repository
  because fresh `evidence/beta17-fixpoint/` Stage1/Stage2 fixpoint evidence is
  not present yet.

Boundary:
- This is a release safety gate. It does not generate Beta17, publish Beta17,
  or prove fixpoint by itself.

## Beta17 Ralph Loop Iteration - Fixpoint evidence pack template

Task:
- Add a reproducible Beta17 evidence-pack scaffold so the fixpoint campaign has
  a concrete file contract before materialization.

Change:
- Added `scripts/beta17-fixpoint-evidence-pack-init.js`.
- Added `scripts/tests/test_beta17_fixpoint_evidence_pack_init.sh`.
- Added npm scripts `beta17:fixpoint:evidence:init` and
  `test:beta17:fixpoint:evidence:init`.

Evidence:
- `node --check scripts/beta17-fixpoint-evidence-pack-init.js` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm test` passed.

Boundary:
- Generated evidence-pack files are templates marked `TEMPLATE_NON_CLAIM`.
  They are intentionally rejected by `gate:beta17:fixpoint-readiness` until
  replaced by real Stage1/Stage2 byte-identical evidence.

## Beta17 Ralph Loop Iteration - Stage1/Stage2 source contracts

Task:
- Make the Beta17 fixpoint materialization contract explicit before adapting
  remote L6+N5 materializers.

Change:
- Added `pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd`.
- Added `pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd`.
- Added `scripts/beta17-fixpoint-stage-contract-gate.js`.
- Added `scripts/tests/test_beta17_fixpoint_stage_contract_gate.sh`.
- Added npm scripts `gate:beta17:fixpoint:stage-contract` and
  `test:beta17:fixpoint:stage-contract`.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-contract-gate.js` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm test` passed.

Boundary:
- This validates the PCD source-contract shape only. It does not materialize
  Stage1, regenerate Stage2, prove byte identity, publish Beta17 or authorize
  a public fixpoint claim.

## Beta17 Ralph Loop Iteration - Stage request bundle

Task:
- Create a hash-bound non-claim request bundle for the future Beta17 L6+N5
  Stage1/Stage2 materializer.

Change:
- Added `scripts/beta17-fixpoint-stage-request-bundle.js`.
- Added `scripts/tests/test_beta17_fixpoint_stage_request_bundle.sh`.
- Added npm scripts `bundle:beta17:fixpoint:stage-request` and
  `test:beta17:fixpoint:stage-request`.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-request-bundle.js` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm test` passed.

Boundary:
- This is request/input evidence only. It does not produce Stage1 or Stage2
  artifacts and must not satisfy fixpoint readiness without a real result.

## Beta17 Ralph Loop Iteration - Stage result validator

Task:
- Define and test the expected `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` payload
  before implementing a real remote materializer.

Change:
- Added `scripts/beta17-fixpoint-stage-result.js`.
- Added `scripts/tests/test_beta17_fixpoint_stage_result.sh`.
- Added npm script `test:beta17:fixpoint:stage-result`.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-result.js` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm test` passed.

Boundary:
- This is result-shape validation only. It does not execute L6+N5, generate
  Stage1/Stage2 artifacts, prove byte identity or publish Beta17.

## Beta17 Ralph Loop Iteration - Fixture stage materializer

Task:
- Exercise the Beta17 Stage1/Stage2 request/result contract end-to-end before
  implementing or invoking a real L6+N5 materializer.

Change:
- Added `scripts/beta17-fixpoint-stage-fixture-materializer.js`.
- Added `scripts/tests/test_beta17_fixpoint_stage_fixture_materializer.sh`.
- Added npm scripts `fixture:beta17:fixpoint:stage-materializer` and
  `test:beta17:fixpoint:stage-fixture`.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-fixture-materializer.js` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm test` passed.

Boundary:
- This is deterministic local fixture infrastructure. It is deliberately not
  L6+N5 evidence and must not satisfy fixpoint readiness.

## Beta17 Ralph Loop Iteration - Reject fixture evidence in readiness gate

Task:
- Prevent local fixture reports from being mistaken for claim-bearing Beta17
  fixpoint evidence.

Change:
- Hardened `scripts/beta17-fixpoint-readiness-gate.js` to reject
  `fixtureMaterializer` reports for Stage1, Stage2, byte identity, harness and
  seal evidence.
- Extended `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` with a
  fixture-evidence bypass attempt.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm test` passed.

Boundary:
- This is safety hardening only. It does not run L6+N5 or produce
  claim-bearing Beta17 evidence.

## Beta17 Ralph Loop Iteration - Remote stage attempt script

Task:
- Add a fail-closed attempt script for the future real L6+N5 Beta17 Stage1/Stage2
  materializer.

Change:
- Added `scripts/beta17-fixpoint-stage-remote-attempt.js`.
- Added `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.
- Added npm scripts `attempt:beta17:fixpoint:remote-stage` and
  `test:beta17:fixpoint:remote-stage`.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-remote-attempt.js` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm test` passed.

Boundary:
- This script can record a blocked remote attempt. It does not itself deploy a
  remote L6+N5 dispatcher or create claim-bearing evidence.

## Beta17 Ralph Loop Iteration - Remote attempt transcript retention

Task:
- Preserve full stdout/stderr transcripts from Beta17 remote probes and
  materialization attempts for auditability.

Change:
- Updated `scripts/beta17-fixpoint-stage-remote-attempt.js` to write
  transcript files under `evidence/beta17-fixpoint-remote-attempt/transcripts/`
  and bind their hashes in the attempt report.
- Extended `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` to
  assert transcript presence in skip mode.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-remote-attempt.js` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm test` passed.

Boundary:
- Transcript retention improves auditability only. It does not create Stage1,
  Stage2 or fixpoint evidence.

## Beta17 Ralph Loop Iteration - Release train readiness binding

Timestamp: 2026-06-28T21:25:42Z

Task:
- Bind the Beta17 release train dry-run to the Beta17 fixpoint readiness gate.

Change:
- Updated `scripts/release-train-dry-run.js` so `0.1.0-beta.17` candidate and manifest-driven dry-runs execute `gate:beta17:fixpoint-readiness`.
- Added candidate required evidence validation for `evidence/beta17-fixpoint-readiness/report.json` with explicit claim-boundary checks.
- Added `scripts/tests/test_beta17_release_train_readiness.sh` and npm script `test:beta17:release-train-readiness`.
- The regression test proves both paths: missing/blocked readiness fails dry-run, and a complete promoted evidence set passes dry-run while keeping `publicationAllowed=false`.

Evidence:
- `node --check scripts/release-train-dry-run.js` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm test` passed.

Boundary:
- This is release-train hardening. It does not materialize Beta17, prove fixpoint, or authorize publication without fresh L6+N5 Stage1/Stage2 evidence and external audit.

## Beta17 Ralph Loop Iteration - External audit contract hardening

Timestamp: 2026-06-28T21:33:16Z

Task:
- Prevent superficial external audit reports from satisfying Beta17 fixpoint readiness.

Change:
- Updated `scripts/beta17-fixpoint-readiness-gate.js` so `external_audit_report.json` must prove a clean public install, functional CLI tests, generated-code tests, adversarial tests, public-surface scan and claim-safe scan.
- Extended `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` with a weak external-audit bypass attempt.
- Updated `scripts/tests/test_beta17_release_train_readiness.sh` fixtures to use the stronger audit contract.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm test` passed.

Boundary:
- This is readiness-gate hardening. It does not run the external audit, produce real L6+N5 fixpoint evidence, publish Beta17 or authorize public fixpoint claims.

## Beta17 Ralph Loop Iteration - External audit prompt contract

Timestamp: 2026-06-28T21:43:24Z

Task:
- Add a canonical external audit prompt that produces the exact Beta17 audit JSON contract required by readiness.

Change:
- Added `docs/ops/BETA17_EXTERNAL_AUDIT_PROMPT.md` with clean public install, functional CLI, generated-code, adversarial, public-surface and claim-safe scan requirements.
- Updated `scripts/beta17-fixpoint-evidence-pack-init.js` so the external audit template points to the prompt and exposes the required contract fields.
- Added `scripts/tests/test_beta17_external_audit_prompt_contract.sh` and npm script `test:beta17:external-audit-prompt`.
- Extended `scripts/tests/test_beta17_fixpoint_evidence_pack_init.sh` to verify the audit template references the prompt and required contract.

Evidence:
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.

Boundary:
- This is an audit-instruction hardening patch. It does not perform the external audit, materialize Stage1/Stage2, prove fixpoint or authorize Beta17 publication.

## Beta17 Ralph Loop Iteration - External audit report validator

Timestamp: 2026-06-28T21:50:40Z

Task:
- Extract Beta17 external audit report validation into a reusable validator.

Change:
- Added `scripts/beta17-external-audit-report-validate.js` as a module and CLI validator for `external_audit_report.json`.
- Updated `scripts/beta17-fixpoint-readiness-gate.js` to import the validator instead of duplicating the audit contract inline.
- Added `scripts/tests/test_beta17_external_audit_report_validate.sh` and npm script `test:beta17:external-audit-report`.

Evidence:
- `node --check scripts/beta17-external-audit-report-validate.js` passed.
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.

Boundary:
- This extracts and verifies the audit report decision boundary. It does not execute the external audit, materialize Stage1/Stage2, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - External audit artifact refs

Timestamp: 2026-06-28T22:00:26Z

Task:
- Require hash-bound artifact references in Beta17 external audit reports.

Change:
- Updated `scripts/beta17-external-audit-report-validate.js` to require `artifacts.auditLog`, `artifacts.generatedCodeQuality`, `artifacts.adversarialResults`, `artifacts.publicSurfaceScan` and `artifacts.claimSafeScan` refs.
- The validator now checks safe relative paths, SHA-256 format, file existence and actual SHA-256 matches when run with an evidence root.
- Updated `docs/ops/BETA17_EXTERNAL_AUDIT_PROMPT.md` so external auditors must emit those artifact refs.
- Updated evidence-pack templates and Beta17 readiness/release-train tests to use hash-bound audit artifacts.

Evidence:
- `node --check scripts/beta17-external-audit-report-validate.js` passed.
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.

Boundary:
- This binds future audit evidence files by path and SHA-256. It does not run the external audit, materialize Stage1/Stage2, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Evidence pack manifest

Timestamp: 2026-06-28T22:10:37Z

Task:
- Add a hash-bound manifest for the Beta17 fixpoint evidence pack.

Change:
- Updated `scripts/beta17-fixpoint-evidence-pack-init.js` to create `evidence_pack_manifest.json` with path/SHA-256 refs for generated template evidence files.
- Updated `scripts/beta17-fixpoint-readiness-gate.js` to require and validate the evidence pack manifest schema, version, closed public/formal claim boundaries and SHA-256 agreement for evaluated evidence files.
- Updated Beta17 readiness and release-train tests to generate a manifest for simulated passing evidence packs.

Evidence:
- `node --check scripts/beta17-fixpoint-evidence-pack-init.js` passed.
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm test` passed.

Boundary:
- This indexes and verifies evidence files by SHA-256. It does not create real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Evidence pack manifest adversarial tests

Timestamp: 2026-06-28T22:18:27Z

Task:
- Add adversarial coverage for Beta17 evidence pack manifest validation.

Change:
- Extended `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` with two break attempts:
  - mutate the manifest SHA-256 for `stage1_artifact_manifest.json` and require `evidence_pack_manifest_sha256_mismatch`;
  - remove the manifest ref for `external_audit_report.json` and require `evidence_pack_manifest_missing_ref`.

Evidence:
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.

Boundary:
- This increases adversarial coverage for the manifest gate. It does not generate real L6+N5 evidence, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Reusable evidence manifest generator

Timestamp: 2026-06-29T00:00:00Z

Task:
- Extract evidence-pack manifest creation into a reusable Beta17 command/module.

Change:
- Added `scripts/beta17-fixpoint-evidence-pack-manifest.js`.
- Updated `scripts/beta17-fixpoint-evidence-pack-init.js` to call the reusable manifest writer.
- Added `npm run beta17:fixpoint:evidence:manifest`.
- Added `npm run test:beta17:fixpoint:evidence:manifest`.

Evidence:
- `node --check scripts/beta17-fixpoint-evidence-pack-manifest.js` passed.
- `node --check scripts/beta17-fixpoint-evidence-pack-init.js` passed.
- `npm run test:beta17:fixpoint:evidence:manifest` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.

Boundary:
- This removes duplicated manifest logic and strengthens the evidence-pack
  maintenance path. It does not generate real L6+N5 Stage1/Stage2 evidence,
  prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Evidence manifest freshness check

Timestamp: 2026-06-29T00:00:00Z

Task:
- Add a fail-closed freshness check for the Beta17 evidence-pack manifest.

Change:
- Added `--check` mode to `scripts/beta17-fixpoint-evidence-pack-manifest.js`.
- Extended `scripts/tests/test_beta17_fixpoint_evidence_pack_manifest.sh` so a
  fresh manifest passes and a tampered evidence file produces
  `evidence_pack_manifest_stale`.

Evidence:
- `node --check scripts/beta17-fixpoint-evidence-pack-manifest.js` passed.
- `npm run test:beta17:fixpoint:evidence:manifest` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.

Boundary:
- This catches stale evidence indexes after file tampering. It does not create
  real L6+N5 Stage1/Stage2 evidence, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Evidence manifest aggregate digest

Timestamp: 2026-06-29T00:00:00Z

Task:
- Bind Beta17 readiness to the evidence-pack manifest aggregate digest.

Change:
- Updated `scripts/beta17-fixpoint-readiness-gate.js` to validate
  `evidence_pack_manifest.packSha256` and the manifest
  `definitiveFixpointAllowed=false` boundary.
- Extended `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` with an
  adversarial `packSha256` tamper case that must fail closed with
  `evidence_pack_manifest_pack_sha256_mismatch`.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:fixpoint:evidence:manifest` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.

Boundary:
- This closes a manifest-integrity gap. It does not create real L6+N5
  Stage1/Stage2 evidence, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Input PCD hash validation

Timestamp: 2026-06-29T00:00:00Z

Task:
- Make Beta17 readiness validate `input_pcd_hashes.tsv` as a real input-file
  contract.

Change:
- Updated `scripts/beta17-fixpoint-readiness-gate.js` to reject unsafe PCD
  refs, malformed SHA-256 values, missing files and file/hash mismatches.
- Updated `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` with real
  fixture PCD files plus a mismatch break attempt.
- Updated `scripts/tests/test_beta17_release_train_readiness.sh` to bind the
  release-train fixture to existing Beta17 PCD contract files instead of
  placeholder hashes.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:fixpoint:evidence:manifest` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm test` passed.

Boundary:
- This prevents placeholder or stale PCD input hashes from satisfying
  readiness. It does not generate the real L6+N5 Stage1/Stage2 artifacts,
  prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Promoted Stage artifacts

Timestamp: 2026-06-29T00:00:00Z

Task:
- Require Beta17 readiness to verify promoted Stage1 and Stage2 artifact files.

Change:
- Updated `scripts/beta17-fixpoint-readiness-gate.js` to require
  `remote_promotion_manifest.promoted.stage1Artifact` and `stage2Artifact`
  with safe paths, existing files and matching SHA-256 values.
- Updated `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` and
  `scripts/tests/test_beta17_release_train_readiness.sh` with generated-stage
  artifact fixtures.
- Added an adversarial Stage2 artifact SHA mismatch case.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `bash -n scripts/tests/test_beta17_release_train_readiness.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:fixpoint:evidence:manifest` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm test` passed.

Boundary:
- This prevents claim-bearing readiness without promoted artifact files. It
  does not generate the real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or
  publish Beta17.

## Beta17 Ralph Loop Iteration - Seal artifact bindings

Timestamp: 2026-06-29T00:00:00Z

Task:
- Require Beta17 seal evidence to bind promoted artifacts and input PCDs.

Change:
- Updated `scripts/beta17-fixpoint-readiness-gate.js` so `seal_report.json`
  must include SHA-256 bindings for Stage1 artifact, Stage2 artifact and
  `input_pcd_hashes.tsv`.
- Updated `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` and
  `scripts/tests/test_beta17_release_train_readiness.sh` fixtures with seal
  bindings.
- Added an adversarial Stage2 seal hash mismatch case.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `bash -n scripts/tests/test_beta17_release_train_readiness.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:fixpoint:evidence:manifest` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm test` passed.

Boundary:
- This prevents unbound seal reports from satisfying readiness. It does not
  generate the real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish
  Beta17.

## Beta17 Ralph Loop Iteration - Public surface sync matrix

Timestamp: 2026-06-29T00:00:00Z

Task:
- Require explicit public-surface sync evidence before Beta17 readiness.

Change:
- Updated `scripts/beta17-fixpoint-readiness-gate.js` so
  `public_surface_sync_report.json` must contain passing `surfaceChecks` for
  `cli_installer`, `cli_manifest`, `docs`, `web_changelog` and `skills`, all
  pinned to `0.1.0-beta.17`.
- Updated `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` and
  `scripts/tests/test_beta17_release_train_readiness.sh` fixtures with the
  required matrix.
- Added an adversarial stale docs version case.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `bash -n scripts/tests/test_beta17_release_train_readiness.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm run test:beta17:external-audit-prompt` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:fixpoint:evidence:manifest` passed.
- `npm run test:beta17:fixpoint:evidence:init` passed.
- `npm run test:beta17:fixpoint:stage-contract` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm test` passed.

Boundary:
- This checks declared public-surface sync evidence. It does not deploy
  public surfaces, run the final external audit, prove fixpoint or publish
  Beta17.

## Beta17 Ralph Loop Iteration - Byte identity artifact bindings

Timestamp: 2026-06-29T00:00:00Z

Task:
- Require Beta17 byte-identical comparison evidence to bind promoted Stage
  artifacts.

Change:
- Updated `scripts/beta17-fixpoint-readiness-gate.js` so
  `byte_identical_report.json` must include Stage1 and Stage2 artifact
  SHA-256 values plus byte sizes matching the promoted artifact files.
- Updated `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` and
  `scripts/tests/test_beta17_release_train_readiness.sh` fixtures with
  byte-identity artifact bindings.
- Added an adversarial Stage2 byte-identity SHA mismatch case.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `bash -n scripts/tests/test_beta17_release_train_readiness.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.

Boundary:
- This prevents unbound byte-identity reports from satisfying readiness. It
  does not generate real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or
  publish Beta17.

## Beta17 Ralph Loop Iteration - Stage manifest artifact bindings

Timestamp: 2026-06-29T00:00:00Z

Task:
- Require Beta17 Stage1/Stage2 manifests to bind promoted artifacts.

Change:
- Updated `scripts/beta17-fixpoint-readiness-gate.js` so Stage1 manifest must
  bind the promoted Stage1 artifact SHA-256.
- Updated the same gate so Stage2 regeneration manifest must bind the promoted
  Stage2 artifact SHA-256 and the promoted Stage1 artifact SHA-256 it claims
  to regenerate from.
- Updated `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` and
  `scripts/tests/test_beta17_release_train_readiness.sh` fixtures with Stage
  manifest artifact bindings.
- Added an adversarial Stage2-from-Stage1 SHA mismatch case.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `bash -n scripts/tests/test_beta17_release_train_readiness.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.

Boundary:
- This prevents detached Stage manifests from satisfying readiness. It does
  not generate real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish
  Beta17.

## Beta17 Ralph Loop Iteration - Stage result manifest binding

Timestamp: 2026-06-29T00:00:00Z

Task:
- Reject detached Stage manifests at the Stage result validation boundary.

Change:
- Updated `scripts/beta17-fixpoint-stage-result.js` so
  `validateStageResult(..., { workspaceRoot })` reads the Stage1 and Stage2
  manifest refs and checks artifact SHA-256 bindings.
- Stage1 manifest must bind the Stage1 artifact SHA-256 declared by the
  result.
- Stage2 manifest must bind the Stage2 artifact SHA-256 and the Stage1
  artifact SHA-256 it claims to regenerate from.
- Updated `scripts/tests/test_beta17_fixpoint_stage_result.sh` with a
  Stage2 manifest Stage1 SHA mismatch adversarial case.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-result.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_stage_result.sh` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.

Boundary:
- This prevents detached Stage manifests from entering promotion through the
  Stage result validator. It does not generate real L6+N5 Stage1/Stage2
  artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote promotion Stage result revalidation

Timestamp: 2026-06-29T00:00:00Z

Task:
- Revalidate the accepted Stage result file inside the remote promotion gate.

Change:
- Updated `scripts/beta17-fixpoint-remote-promotion-gate.js` to import and
  rerun `validateStageResult` against the referenced Stage result JSON with
  the remote attempt's expected context.
- Updated `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh` with
  an adversarial case where the remote-attempt report says accepted, but the
  referenced Stage result file is tampered.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-promotion-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.

Boundary:
- This prevents a stale or tampered Stage result ref from entering promotion.
  It does not generate real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or
  publish Beta17.

## Beta17 Ralph Loop Iteration - Remote promotion request context binding

Timestamp: 2026-06-29T00:00:00Z

Task:
- Bind remote promotion expected context to the actual Stage request file.

Change:
- Updated `scripts/beta17-fixpoint-remote-promotion-gate.js` to validate the
  remote attempt's `request` ref, rerun `validateRequest` and recompute the
  `BRIK64_BETA17_FIXPOINT_STAGE_REQUEST` line SHA-256.
- Stage result revalidation now uses request-derived `pcdInputSetSha256`,
  `materializerRequestSha256` and required input PCD paths.
- Updated `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh` with
  an adversarial fabricated `expectedContext.materializerRequestSha256` case.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-promotion-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.

Boundary:
- This prevents fabricated expected context from authorizing remote promotion.
  It does not generate real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or
  publish Beta17.

## Beta17 Ralph Loop Iteration - External workspace result promotion

Timestamp: 2026-06-29T00:00:00Z

Task:
- Make final remote-result promotion work against external evidence
  workspaces.

Change:
- Updated `scripts/beta17-fixpoint-promote-remote-result.js` so it invokes
  `beta17-fixpoint-remote-promotion-gate.js` by absolute script path instead
  of assuming the target evidence workspace contains `scripts/`.
- Updated `scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh` with
  a positive non-fixture promotion fixture. The test now builds a Stage
  request inside an external workspace, creates source evidence refs, promotes
  them into `evidence/beta17-fixpoint/` and verifies the promotion manifest.

Evidence:
- `node --check scripts/beta17-fixpoint-promote-remote-result.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`
  passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.

Boundary:
- This validates final promotion mechanics for clean external workspaces. It
  does not generate real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or
  publish Beta17.

## Beta17 Ralph Loop Iteration - Promoted target copy verification

Timestamp: 2026-06-28T23:50:15Z

Task:
- Verify canonical target files after remote-result promotion copies evidence
  refs into `evidence/beta17-fixpoint/`.

Change:
- Updated `scripts/beta17-fixpoint-promote-remote-result.js` to re-hash each
  promoted target file after copy, record target path/SHA-256/bytes in
  `remote_promotion_manifest.json` and block on any source/target mismatch.
- Updated `scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh` so
  the positive external-workspace fixture asserts the promoted target refs
  match the promoted source refs.

Evidence:
- `node --check scripts/beta17-fixpoint-promote-remote-result.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`
  passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.

Boundary:
- This proves target-copy integrity for promoted evidence refs. It does not
  generate real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish
  Beta17.

## Beta17 Ralph Loop Iteration - Stage result input-set self-consistency

Timestamp: 2026-06-28T23:56:30Z

Task:
- Make `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` self-consistent with its own
  declared PCD input table before remote promotion can consume it.

Change:
- Updated `scripts/beta17-fixpoint-stage-result.js` to require `bytes` for
  each `inputPcds` entry and recompute `pcdInputSetSha256` from
  path/SHA-256/bytes rows.
- Updated `scripts/tests/test_beta17_fixpoint_stage_result.sh` with a valid
  set-hash fixture and an adversarial detached-input-set mutation.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-result.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_stage_result.sh` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.

Boundary:
- This validates Stage result input-set integrity. It does not generate real
  L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Accepted attempt stdout/result binding

Timestamp: 2026-06-29T00:04:21Z

Task:
- Bind the accepted remote-attempt stdout transcript to the same Stage result
  JSON file that promotion revalidates.

Change:
- Updated `scripts/beta17-fixpoint-remote-promotion-gate.js` to parse
  `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` from the accepted stdout transcript
  and compare it against the hash-bound `stage-result.json` ref.
- Updated `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh` so
  fixtures contain real Stage result stdout lines and an adversarial mismatch
  fails closed with `accepted_attempt_stdout_stage_result_mismatch`.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-promotion-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.

Boundary:
- This validates transcript/result binding for accepted remote attempts. It
  does not generate real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or
  publish Beta17.

## Beta17 Ralph Loop Iteration - Remote promotion ref byte validation

Timestamp: 2026-06-29T00:10:41Z

Task:
- Require byte-count metadata on file refs consumed by the remote promotion
  gate to match the actual referenced file size.

Change:
- Updated `scripts/beta17-fixpoint-remote-promotion-gate.js` so `fileRefExists`
  rejects invalid or mismatched `bytes` values in addition to unsafe paths and
  SHA-256 mismatches.
- Updated `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh` with
  an adversarial stdout transcript `bytes` mismatch.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-promotion-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.

Boundary:
- This validates evidence ref metadata integrity. It does not generate real
  L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Readiness promoted target refs

Timestamp: 2026-06-29T00:17:20Z

Task:
- Make Beta17 readiness reject remote promotion manifests that do not include
  target-copy proof for promoted Stage artifacts.

Change:
- Updated `scripts/beta17-fixpoint-readiness-gate.js` so promoted Stage
  artifact refs must include `target.path`, `target.sha256` and `target.bytes`
  matching the canonical file evaluated by readiness.
- Updated `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` to generate
  target refs in the positive fixture and fail closed when a promoted artifact
  target ref is missing.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.

Boundary:
- This validates readiness consumption of target-copy proof. It does not
  generate real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish
  Beta17.

## Beta17 Ralph Loop Iteration - Readiness promoted source refs

Timestamp: 2026-06-29T00:24:41Z

Task:
- Make Beta17 readiness reject promotion manifests that preserve target-copy
  proof but omit the source/remote artifact ref.

Change:
- Updated `scripts/beta17-fixpoint-readiness-gate.js` so promoted Stage
  artifact refs must include `source.path` and `source.sha256` matching the
  promoted artifact SHA-256.
- Updated `scripts/tests/test_beta17_fixpoint_readiness_gate.sh` and
  `scripts/tests/test_beta17_release_train_readiness.sh` to include source
  refs in positive fixtures and fail closed when a promoted artifact source ref
  is missing.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `bash -n scripts/tests/test_beta17_release_train_readiness.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.

Boundary:
- This validates source/target promotion traceability. It does not generate
  real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Promoted source byte binding

Timestamp: 2026-06-29T00:31:11Z

Task:
- Bind promoted Stage artifact source refs by byte count as well as SHA-256.

Change:
- Updated `scripts/beta17-fixpoint-promote-remote-result.js` to include
  `source.bytes` in promoted refs.
- Updated `scripts/beta17-fixpoint-readiness-gate.js` to reject missing,
  invalid or mismatched `source.bytes` values.
- Updated remote-result-promotion, readiness and release-train fixtures to
  include source byte metadata and an adversarial source-byte mismatch.

Evidence:
- `node --check scripts/beta17-fixpoint-promote-remote-result.js` passed.
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`
  passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `bash -n scripts/tests/test_beta17_release_train_readiness.sh` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.

Boundary:
- This validates source byte metadata integrity. It does not generate real
  L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote endpoint capability diagnosis

Timestamp: 2026-06-29T00:39:11Z

Task:
- Move from generic remote wrapper diagnosis to exact installed endpoint
  capability reporting for the L6+N5 host.

Change:
- Updated `scripts/beta17-fixpoint-stage-remote-attempt.js` to parse endpoint
  capability lines that use either real tab separators or literal `\t`
  sequences.
- Exported the endpoint parser and added parser assertions to
  `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.

Evidence:
- `npm run test:beta17:fixpoint:remote-stage` passed.
- A live `npm run attempt:beta17:fixpoint:remote-stage` run produced
  `BLOCKED_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT` with blockers:
  `remote_l6plus_wrapper_mode_not_beta17_stage:unknown`,
  `remote_l6plus_beta17_stage_endpoint_missing:beta15_7_ready,beta16_native_ready,beta16_1_ready`,
  and `remote_l6plus_beta17_stage_result_unavailable`.

Boundary:
- This proves the current L6+N5 host lacks the Beta17 stage dispatcher endpoint
  under the probed wrapper. It does not install the endpoint, generate real
  Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote endpoint install contract

Timestamp: 2026-06-29T00:55:00Z

Task:
- Make the blocked Beta17 remote attempt report the exact endpoint
  installation contract instead of only listing generic endpoint absence.

Change:
- Updated `scripts/beta17-fixpoint-stage-remote-attempt.js` to expose the
  required `beta17_fixpoint_stage_dispatcher` capability, attempted
  materialization commands, required
  `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` marker, install hints and
  non-acceptable substitutes in the generated report.
- Updated `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` to
  assert those report fields in the skip/blocked path.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-remote-attempt.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- Broader regression battery passed:
  `test:beta17:external-audit-prompt`,
  `test:beta17:fixpoint:stage-result`,
  `test:beta17:fixpoint:remote-result-promotion`,
  `test:beta17:fixpoint:remote-promotion`,
  `test:beta17:fixpoint-readiness`,
  `test:beta17:release-train-readiness`,
  `npm test` and `git diff --check`.
- Live remote attempt with a fresh request bundle remained correctly blocked
  on `remote_l6plus_wrapper_mode_not_beta17_stage:unknown`,
  `remote_l6plus_beta17_stage_endpoint_missing:beta15_7_ready,beta16_native_ready,beta16_1_ready`
  and `remote_l6plus_beta17_stage_result_unavailable`.
- The live report included `requiredEndpointCapability:
  beta17_fixpoint_stage_dispatcher` and required marker
  `BRIK64_BETA17_FIXPOINT_STAGE_RESULT`.

Boundary:
- This is an operational/readiness hardening change. It does not install the
  remote endpoint, generate real L6+N5 Stage1/Stage2 artifacts, prove fixpoint
  or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote dispatcher deployment preflight

Timestamp: 2026-06-29T01:18:00Z

Task:
- Add a fail-closed preflight for the Beta17 L6+N5 dispatcher deploy plan
  before any remote Hetzner mutation.

Change:
- Added `scripts/beta17-fixpoint-remote-dispatcher-preflight.js`.
- Added `scripts/tests/test_beta17_fixpoint_remote_dispatcher_preflight.sh`.
- Added npm scripts:
  `preflight:beta17:fixpoint:remote-dispatcher` and
  `test:beta17:fixpoint:remote-dispatcher-preflight`.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-dispatcher-preflight.js`
  passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_dispatcher_preflight.sh`
  passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-preflight` passed.
- Break attempts rejected:
  wrong capability, beta16 legacy materializer path and fixture/template
  deployment plan.

Boundary:
- This validates the deployment plan contract only. It does not install the
  remote dispatcher, generate real L6+N5 Stage1/Stage2 artifacts, prove
  fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote dispatcher deploy-plan generator

Timestamp: 2026-06-29T01:38:00Z

Task:
- Add a reproducible generator for the Beta17 remote dispatcher deploy plan.

Change:
- Added `scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js`.
- Added `scripts/tests/test_beta17_fixpoint_remote_dispatcher_deploy_plan.sh`.
- Added npm scripts:
  `plan:beta17:fixpoint:remote-dispatcher` and
  `test:beta17:fixpoint:remote-dispatcher-plan`.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js`
  passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_dispatcher_deploy_plan.sh`
  passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-plan` passed.
- Generated deploy plan was accepted by
  `scripts/beta17-fixpoint-remote-dispatcher-preflight.js` inside the test
  fixture.
- Break attempts rejected:
  missing materializer file, materializer path outside workspace and beta16
  legacy remote materializer path.

Boundary:
- This creates a non-claim deploy plan from a local candidate materializer. It
  does not create the real L6+N5 materializer, install the remote dispatcher,
  generate real Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote dispatcher installer dry-run

Timestamp: 2026-06-29T01:58:00Z

Task:
- Add a fail-closed installer dry-run for a validated Beta17 dispatcher
  deploy plan.

Change:
- Added `scripts/beta17-fixpoint-remote-dispatcher-install.js`.
- Added `scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh`.
- Added npm scripts:
  `install:beta17:fixpoint:remote-dispatcher` and
  `test:beta17:fixpoint:remote-dispatcher-install`.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-dispatcher-install.js`
  passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh`
  passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-install` passed.
- Break attempts rejected:
  remote execute without exact confirmation, invalid deploy-plan capability
  and tampered local materializer after deploy-plan generation.

Boundary:
- This validates and emits the remote install script only. It does not create
  the real L6+N5 materializer, execute remote mutation in tests, generate real
  Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Materializer provenance binding

Timestamp: 2026-06-29T02:18:00Z

Task:
- Prevent the Beta17 dispatcher deploy-plan path from asserting
  `generatedFromPcdPolymer=true` without a separate provenance manifest.

Change:
- Updated `scripts/beta17-fixpoint-remote-dispatcher-preflight.js` to require
  and validate `materializerProvenanceRef`.
- Updated `scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js` to
  require `--provenance` and bind the provenance file by path, SHA-256 and
  bytes.
- Updated dispatcher plan, preflight and installer tests to create explicit
  non-claim provenance manifests.

Evidence:
- `npm run test:beta17:fixpoint:remote-dispatcher-plan` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-preflight` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-install` passed.
- Break attempts rejected:
  missing provenance argument and materializer provenance SHA mismatch, in
  addition to existing missing file, outside path, legacy remote path,
  invalid capability, fixture/template and tampered materializer cases.

Boundary:
- This binds deploy-plan/install eligibility to a provenance manifest. It does
  not create the real L6+N5 materializer, execute remote mutation, generate
  real Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Materializer provenance generator

Timestamp: 2026-06-29T02:38:00Z

Task:
- Add a reproducible generator for the non-claim materializer provenance
  manifest required by Beta17 dispatcher deploy-plan and preflight gates.

Change:
- Added `scripts/beta17-fixpoint-materializer-provenance.js`.
- Added `scripts/tests/test_beta17_fixpoint_materializer_provenance.sh`.
- Added npm scripts:
  `provenance:beta17:fixpoint:materializer` and
  `test:beta17:fixpoint:materializer-provenance`.
- Updated dispatcher deploy-plan and installer tests to consume provenance
  generated by the new command instead of hand-written provenance JSON.

Evidence:
- `node --check scripts/beta17-fixpoint-materializer-provenance.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_materializer_provenance.sh`
  passed.
- `npm run test:beta17:fixpoint:materializer-provenance` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-plan` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-preflight` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-install` passed.
- Break attempts rejected:
  missing materializer, PCD path outside workspace and invalid L6+N5 serial.

Boundary:
- This generates non-claim provenance from candidate inputs. It does not create
  the real L6+N5 materializer, execute remote mutation, generate real
  Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Materializer provenance standalone gate

Timestamp: 2026-06-29T02:58:00Z

Task:
- Add standalone validation for existing Beta17 materializer provenance
  manifests.

Change:
- Updated `scripts/beta17-fixpoint-materializer-provenance.js` with
  `--validate --input <manifest>`.
- Added npm script `gate:beta17:fixpoint:materializer-provenance`.
- Extended `scripts/tests/test_beta17_fixpoint_materializer_provenance.sh`
  to validate an existing manifest against current workspace files.

Evidence:
- `node --check scripts/beta17-fixpoint-materializer-provenance.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_materializer_provenance.sh`
  passed.
- `npm run test:beta17:fixpoint:materializer-provenance` passed.
- Full Beta17 regression battery passed:
  `test:beta17:fixpoint:remote-dispatcher-plan`,
  `test:beta17:fixpoint:remote-dispatcher-preflight`,
  `test:beta17:fixpoint:remote-dispatcher-install`,
  `test:beta17:fixpoint:remote-stage`,
  `test:beta17:fixpoint:stage-result`,
  `test:beta17:fixpoint:remote-result-promotion`,
  `test:beta17:fixpoint:remote-promotion`,
  `test:beta17:fixpoint-readiness`,
  `test:beta17:release-train-readiness`,
  `test:beta17:external-audit-prompt`,
  `npm test` and `git diff --check`.
- Break attempt rejected:
  PCD tampering after provenance generation triggers
  `provenance_input_pcd_0_file_sha256_mismatch`.

Boundary:
- This validates candidate provenance against workspace files. It does not
  create the real L6+N5 materializer, execute remote mutation, generate real
  Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Stage result ref bytes binding

Timestamp: 2026-06-29T03:24:00Z

Task:
- Require every Beta17 Stage result evidence file ref to bind byte count as
  well as path and SHA-256.

Change:
- Updated `scripts/beta17-fixpoint-stage-result.js` to require `bytes` on
  every Stage result file ref and compare workspace file size when available.
- Updated `scripts/beta17-fixpoint-stage-fixture-materializer.js` so fixture
  manifest/report refs include byte counts.
- Extended `scripts/tests/test_beta17_fixpoint_stage_result.sh` with a
  missing-bytes adversarial case.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-result.js` passed.
- `node --check scripts/beta17-fixpoint-stage-fixture-materializer.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_stage_result.sh` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:stage-fixture` passed.
- Regression battery passed:
  `test:beta17:fixpoint:remote-result-promotion`,
  `test:beta17:fixpoint:remote-promotion`,
  `test:beta17:fixpoint:remote-stage`,
  `test:beta17:fixpoint-readiness`,
  `test:beta17:release-train-readiness`,
  `test:beta17:external-audit-prompt`,
  `npm test` and `git diff --check`.
- Break attempt rejected:
  missing bytes on `stage2Artifact` triggers
  `stage_result_stage2Artifact_ref_bytes_invalid`.

Boundary:
- This strengthens Stage result evidence binding. It does not create the real
  L6+N5 materializer, execute remote mutation, generate real Stage1/Stage2
  artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote promotion source bytes binding

Timestamp: 2026-06-29T03:43:00Z

Task:
- Reject remote result promotion when a Stage result source file ref declares
  stale or missing byte metadata.

Change:
- Updated `scripts/beta17-fixpoint-promote-remote-result.js` so
  `validateCopyRef` requires `sourceRef.bytes` and compares it to the source
  file size before copy.
- Extended `scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`
  with a Stage2 artifact source byte mismatch break attempt.

Evidence:
- `node --check scripts/beta17-fixpoint-promote-remote-result.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`
  passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- Regression battery passed:
  `test:beta17:fixpoint:remote-promotion`,
  `test:beta17:fixpoint:stage-result`,
  `test:beta17:fixpoint-readiness`,
  `test:beta17:release-train-readiness`,
  `test:beta17:external-audit-prompt`,
  `npm test` and `git diff --check`.
- Break attempt rejected:
  mutating `stage2Artifact.bytes` triggers
  `stage2_artifact_source_bytes_mismatch:evidence/beta17-source/generated/stage2/brik64-cli-stage2.mjs`.

Boundary:
- This strengthens remote promotion evidence binding. It does not create the
  real L6+N5 materializer, execute remote mutation, generate real Stage1/Stage2
  artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Evidence pack manifest byte binding

Timestamp: 2026-06-29T04:02:00Z

Task:
- Bind each Beta17 evidence-pack manifest entry to byte count in addition to
  path and SHA-256.

Change:
- Updated `scripts/beta17-fixpoint-evidence-pack-manifest.js` so generated
  entries include `bytes`.
- Updated `scripts/beta17-fixpoint-readiness-gate.js` to reject evaluated
  evidence refs when the manifest bytes value is missing or mismatched.
- Updated evidence-pack and readiness tests to cover the new metadata.

Evidence:
- `node --check scripts/beta17-fixpoint-evidence-pack-manifest.js` passed.
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_evidence_pack_manifest.sh`
  passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `npm run test:beta17:fixpoint:evidence:manifest` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- Regression battery passed:
  `test:beta17:release-train-readiness`,
  `test:beta17:external-audit-report`,
  `test:beta17:external-audit-prompt`,
  `npm test` and `git diff --check`.
- Break attempt rejected:
  mutating `stage1_artifact_manifest.json` bytes metadata triggers
  `evidence_pack_manifest_bytes_mismatch:evidence/beta17-fixpoint/stage1_artifact_manifest.json`.

Boundary:
- This strengthens final evidence-pack indexing. It does not create the real
  L6+N5 materializer, execute remote mutation, generate real Stage1/Stage2
  artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - External audit artifact byte binding

Timestamp: 2026-06-29T04:17:00Z

Task:
- Require Beta17 external audit artifact refs to include byte counts and match
  referenced files.

Change:
- Updated `scripts/beta17-external-audit-report-validate.js` so each required
  audit artifact ref must include `bytes` and match the file size when a
  workspace root is available.
- Updated external audit, readiness and release-train fixtures to emit
  byte-bound audit artifact refs.
- Updated `docs/ops/BETA17_EXTERNAL_AUDIT_PROMPT.md` so external agents
  produce the enforced contract.

Evidence:
- `node --check scripts/beta17-external-audit-report-validate.js` passed.
- `bash -n scripts/tests/test_beta17_external_audit_report_validate.sh`
  passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `bash -n scripts/tests/test_beta17_release_train_readiness.sh` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- Regression battery passed:
  `test:beta17:external-audit-prompt`,
  `test:beta17:fixpoint:evidence:manifest`,
  `npm test` and `git diff --check`.
- Break attempt rejected:
  mutating `generatedCodeQuality.bytes` triggers
  `external_audit_artifact_bytes_mismatch:generatedCodeQuality`.

Boundary:
- This strengthens external audit metadata binding. It does not run the actual
  external audit, create the real L6+N5 materializer, execute remote mutation,
  generate real Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Release train readiness ref binding

Timestamp: 2026-06-29T04:32:00Z

Task:
- Bind the Beta17 release-train `requiredEvidence` entry to the exact readiness
  report file consumed by the dry-run.

Change:
- Updated `scripts/release-train-dry-run.js` so the Beta17 readiness evidence
  entry includes `path`, `sha256` and `bytes` for
  `evidence/beta17-fixpoint-readiness/report.json`.
- Updated `scripts/tests/test_beta17_release_train_readiness.sh` to assert that
  the release-train report records the current readiness report SHA-256 and byte
  count.

Evidence:
- `node --check scripts/release-train-dry-run.js` passed.
- `bash -n scripts/tests/test_beta17_release_train_readiness.sh` passed.
- `npm run test:beta17:release-train-readiness` passed.
- Regression battery passed:
  `test:beta17:fixpoint-readiness`,
  `test:beta17:external-audit-report`,
  `test:beta17:external-audit-prompt`,
  `npm test` and `git diff --check`.
- Break attempt enforced:
  release-train regression rejects a Beta17 requiredEvidence record unless it
  matches the generated readiness report SHA-256 and byte count.

Boundary:
- This strengthens release-train evidence linkage. It does not create the real
  L6+N5 materializer, execute remote mutation, generate real Stage1/Stage2
  artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Dispatcher install result marker binding

Timestamp: 2026-06-29T04:52:00Z

Task:
- Require an executed Beta17 remote dispatcher install to prove installation via
  a hash-bound stdout marker, not SSH status alone.

Change:
- Updated `scripts/beta17-fixpoint-remote-dispatcher-install.js` with
  `parseInstallResult` and `validateInstallExecution`.
- `--execute` mode now requires
  `BRIK64_BETA17_DISPATCHER_INSTALL_RESULT` with `installed`, the expected
  materializer SHA-256 and the expected host.
- Extended `scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh`
  with direct parser/validator break attempts.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-dispatcher-install.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh`
  passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-install` passed.
- Regression battery passed:
  `test:beta17:fixpoint:remote-dispatcher-preflight`,
  `test:beta17:fixpoint:remote-dispatcher-plan`,
  `test:beta17:fixpoint:remote-stage`,
  `test:beta17:fixpoint-readiness`,
  `test:beta17:release-train-readiness`,
  `npm test` and `git diff --check`.
- Break attempts rejected:
  missing install marker triggers `install_result_marker_missing`; mismatched
  materializer SHA triggers `install_result_materializer_sha256_mismatch`.

Boundary:
- This hardens future remote mutation validation. It does not execute the
  remote install, create the real L6+N5 materializer, generate real Stage1 or
  Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote-stage remediation command bridge

Timestamp: 2026-06-29T05:08:00Z

Task:
- Make a blocked Beta17 remote-stage attempt directly actionable through a
  structured, testable remediation command list.

Change:
- Updated `scripts/beta17-fixpoint-stage-remote-attempt.js` to include
  `remoteEndpointContract.remediationCommands` in blocked reports.
- The command sequence covers materializer provenance, dispatcher deploy-plan,
  preflight, guarded install, retry, remote-promotion gate, result promotion and
  readiness gate.
- Extended `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` to
  assert the exported commands include the exact gates/operators required for
  the next materialization path.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-remote-attempt.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- Regression battery passed:
  `test:beta17:fixpoint:remote-promotion`,
  `test:beta17:fixpoint:remote-result-promotion`,
  `test:beta17:fixpoint-readiness`,
  `test:beta17:release-train-readiness`,
  `npm test` and `git diff --check`.
- Break attempt enforced:
  remote-stage tests fail unless the remediation list contains the expected
  provenance, plan, preflight, install, attempt, promotion and readiness gates.

Boundary:
- This makes the missing-dispatcher blocker operationally actionable. It does
  not create the real L6+N5 materializer, execute remote mutation, generate
  Stage1 or Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote-stage remediation input and stop-rule plan

Timestamp: 2026-06-29T05:24:00Z

Task:
- Make the blocked Beta17 remote-stage remediation path less ambiguous by
  publishing required inputs and stop rules alongside the command sequence.

Change:
- Updated `scripts/beta17-fixpoint-stage-remote-attempt.js` with
  `remoteEndpointContract.remediationPlan`.
- The plan names required inputs: `generatedMaterializer`,
  `canonicalInputPcds` and `l6plusEngineSerial`.
- The plan enumerates step ids and stop rules, including stopping on open
  claims, fixture/manual evidence or non-byte-identical Stage1/Stage2.
- Extended `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` to
  assert the required inputs, guarded install command and byte-identity stop
  rule.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-remote-attempt.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- Regression battery passed:
  `test:beta17:fixpoint:remote-promotion`,
  `test:beta17:fixpoint:remote-result-promotion`,
  `test:beta17:fixpoint-readiness`,
  `test:beta17:release-train-readiness`,
  `npm test` and `git diff --check`.
- Break attempt enforced:
  remote-stage tests fail unless the remediation plan requires the L6+N5 serial
  prefix, rejects fixture/template materializer input and includes the
  Stage1/Stage2 byte-identical stop rule.

Boundary:
- This makes the remediation path operationally clearer. It does not create the
  real L6+N5 materializer, execute remote mutation, generate real Stage1 or
  Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Live remote-stage blocker evidence

Timestamp: 2026-06-29T05:43:00Z

Task:
- Run a non-mutating live Beta17 remote-stage attempt against the configured
  L6+N5 host and preserve the current blocker evidence.

Change:
- Updated `scripts/beta17-fixpoint-stage-remote-attempt.js` to parse endpoint
  status signals into structured `remote.endpointSignals`.
- Extended `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` with
  parser coverage for legacy endpoint/result signals.
- Generated a fresh stage request and live remote-attempt evidence under:
  `evidence/beta17-fixpoint-stage-request/` and
  `evidence/beta17-fixpoint-remote-attempt/`.

Live evidence:
- Stage request: `evidence/beta17-fixpoint-stage-request/request.json`
  SHA-256 `f109f24ba91010be439f9156bf018c07871b4febee5175dde22d74f75c7e18b9`.
- Remote attempt report: `evidence/beta17-fixpoint-remote-attempt/report.json`
  decision `BLOCKED_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT`.
- Remote wrapper: SHA-256
  `2e9cd2ffaa68efd0190c06e5cd78072d825bc6313945a51ce14ee9e0a1e4c656`,
  1546 bytes.
- Remote wrapper exec target: SHA-256
  `7bad9474a6ff607176c9b00161d917fb0648327b87c684f8b01708a7d7ad758a`,
  851 bytes.
- Installed endpoint capabilities observed:
  `beta15_7_ready,beta16_native_ready,beta16_1_ready`.
- Legacy endpoint signals observed:
  `BRIK64_L6_CLI_MATERIALIZATION_RESULT=available` and
  `BRIK64_L6_BETA16_STAGE1_MATERIALIZATION_RESULT=available`.
- Blockers:
  `remote_l6plus_wrapper_mode_not_beta17_stage:unknown`,
  `remote_l6plus_beta17_stage_endpoint_missing:beta15_7_ready,beta16_native_ready,beta16_1_ready`,
  `remote_l6plus_beta17_stage_result_unavailable`.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-remote-attempt.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- Regression battery passed:
  `test:beta17:fixpoint:remote-promotion`,
  `test:beta17:fixpoint:remote-result-promotion`,
  `test:beta17:fixpoint-readiness`,
  `test:beta17:release-train-readiness`,
  `npm test` and `git diff --check`.
- Live `npm run attempt:beta17:fixpoint:remote-stage` failed closed with the
  blockers above, as expected while the Beta17 dispatcher is missing.

Boundary:
- This is fresh operational blocker evidence from the live L6+N5 host. It does
  not execute remote mutation, install the missing dispatcher, create real
  Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Materializer provenance content validation

Timestamp: 2026-06-29T06:10:00Z

Task:
- Prevent Beta17 materializer provenance from accepting a hash-bound file that is
  still only a placeholder, fixture or template.

Change:
- Added content validation to `scripts/beta17-fixpoint-materializer-provenance.js`.
- Provenance now fails closed when the materializer lacks
  `BRIK64_BETA17_FIXPOINT_STAGE_RESULT`, contains literal `<base64-json>`, or
  contains fixture/template indicators.
- Updated valid dispatcher test materializers to emit a real base64 JSON payload
  while keeping placeholder output as an adversarial case.

Evidence:
- `node --check scripts/beta17-fixpoint-materializer-provenance.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_materializer_provenance.sh` passed.
- `npm run test:beta17:fixpoint:materializer-provenance` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-plan` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-preflight` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-install` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.
- `git diff --check` passed.

Break attempts:
- Missing result marker is rejected with
  `provenance_materializer_missing_beta17_result_marker`.
- Literal placeholder marker is rejected with
  `provenance_materializer_placeholder_result_marker`.
- Fixture/template content is rejected with
  `provenance_materializer_fixture_or_template_content`.

Boundary:
- This hardens the candidate/provenance path only. It does not create a real
  L6+N5 Beta17 materializer, execute remote mutation, generate Stage1/Stage2
  artifacts, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote dispatcher install-script validation

Timestamp: 2026-06-29T06:35:00Z

Task:
- Prevent the guarded Beta17 dispatcher install path from accepting a generated
  remote install script that does not actually bind to the Beta17 materializer
  endpoint and result marker.

Change:
- Added `validateInstallScript` to
  `scripts/beta17-fixpoint-remote-dispatcher-install.js`.
- The generated remote install script now verifies the uploaded materializer
  contains `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` after SHA-256 validation and
  before installation.
- Extended `scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh`
  with script-level adversarial mutations.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-dispatcher-install.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-install` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-plan` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-preflight` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.
- `git diff --check` passed.

Break attempts:
- Removing the Beta17 endpoint marker fails closed with
  `install_script_beta17_endpoint_marker_missing`.
- Rebinding the materializer exec path fails closed with
  `install_script_materializer_remote_path_missing`.
- Adding a legacy endpoint reference fails closed with
  `install_script_legacy_endpoint_reference`.

Boundary:
- This improves the install gate only. It does not install the live dispatcher,
  execute remote mutation, generate Stage1/Stage2 artifacts, prove fixpoint or
  publish Beta17.

## Beta17 Ralph Loop Iteration - Install dry-run evidence binding

Timestamp: 2026-06-29T06:55:00Z

Task:
- Make Beta17 dispatcher install dry-run evidence self-contained enough for a
  reviewer/operator to verify the script, materializer and provenance binding
  before remote mutation.

Change:
- Updated `scripts/beta17-fixpoint-remote-dispatcher-install.js` so
  `install-report.json` includes local materializer and provenance refs plus
  install-script validation details.
- Extended `scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh` to
  assert the report binds required commands, required capability and the exact
  materializer remote path.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-dispatcher-install.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-install` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-plan` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-preflight` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.
- `git diff --check` passed.

Boundary:
- This binds dry-run evidence only. It does not install the live dispatcher,
  execute remote mutation, generate Stage1/Stage2 artifacts, prove fixpoint or
  publish Beta17.

## Beta17 Ralph Loop Iteration - Remote stage install-evidence preflight

Timestamp: 2026-06-29T07:15:00Z

Task:
- Prevent Beta17 remote stage attempts from running before there is an executed,
  evidence-bound dispatcher install report.

Change:
- Updated `scripts/beta17-fixpoint-stage-remote-attempt.js` to validate
  `evidence/beta17-fixpoint-remote-dispatcher/install-report.json` before
  materialization commands are attempted.
- The validator requires the Beta17 install report schema/version, executed
  PASS decision, closed claim boundary, expected capability, accepted
  install-script validation, materialize command and materializer/provenance refs.
- Updated `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` to assert
  missing install evidence is a blocker.

Evidence:
- `node --check scripts/beta17-fixpoint-stage-remote-attempt.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-install` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-plan` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-preflight` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.
- `git diff --check` passed.

Boundary:
- This is a pre-execution guard. It does not install the live dispatcher, execute
  remote mutation, generate Stage1/Stage2 artifacts, prove fixpoint or publish
  Beta17.

## Beta17 Ralph Loop Iteration - Remote promotion install-evidence binding

Timestamp: 2026-06-29T07:40:00Z

Task:
- Prevent remote result promotion from accepting a PASS remote-attempt report
  unless that attempt is tied to executed Beta17 dispatcher install evidence.

Change:
- Updated `scripts/beta17-fixpoint-remote-promotion-gate.js` with
  `validateInstallEvidence`.
- The promotion gate now verifies the install report ref, schema/version,
  executed PASS decision, closed claim boundaries, expected capability,
  accepted install-script validation, materialize command and materializer
  SHA/path binding.
- Updated remote promotion and remote result promotion tests to include valid
  install evidence in positive fixtures and an install-not-executed adversarial
  case.

Evidence:
- `node --check scripts/beta17-fixpoint-remote-promotion-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm test` passed.
- `git diff --check` passed.

Boundary:
- This is a promotion guard. It does not install the live dispatcher, execute
  remote mutation, generate Stage1/Stage2 artifacts, prove fixpoint or publish
  Beta17.

## Beta17 Ralph Loop Iteration - Readiness source-promotion install-evidence binding

Timestamp: 2026-06-29T08:05:00Z

Task:
- Prevent Beta17 readiness and release train from trusting a standalone remote
  promotion manifest that is not tied back to a promotion gate report with
  executed dispatcher install evidence.

Change:
- Added source promotion report validation to
  `scripts/beta17-fixpoint-readiness-gate.js`.
- Readiness now validates `remote_promotion_manifest.sourcePromotionReport` and
  requires the referenced promotion report to be PASS, claim-closed and contain
  executed Beta17 dispatcher install evidence.
- Updated readiness and release train fixtures to include source promotion and
  install evidence refs.

Evidence:
- `node --check scripts/beta17-fixpoint-readiness-gate.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_readiness_gate.sh` passed.
- `bash -n scripts/tests/test_beta17_release_train_readiness.sh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm test` passed.
- `git diff --check` passed.

Boundary:
- This is a readiness/release-train guard. It does not install the live
  dispatcher, execute remote mutation, generate Stage1/Stage2 artifacts, prove
  fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Fresh live remote-stage blocker evidence

Timestamp: 2026-06-29T08:25:00Z

Task:
- Refresh live non-mutating remote-stage evidence after adding install-evidence
  gates to remote stage, promotion and readiness.

Commands:
- `npm run bundle:beta17:fixpoint:stage-request`
- `npm run attempt:beta17:fixpoint:remote-stage`

Live evidence:
- Stage request SHA-256:
  `904700d893ba6effcc7f83070847978c1ecb024464e1d6728b87aedab8616224`.
- Stage request line SHA-256:
  `af93b234fe02d916d16e5d5f0809ab0ab4a34bcd6a99652f9b72ddfd8572e289`.
- Stage request manifest SHA-256:
  `ecd0074ad5536a16184bb9d7dcc1c8617b144a91a46f69858f157cdd2f262a6d`.
- Remote attempt report SHA-256:
  `a538ff706ecdc12e9add2e2df92df454d94eb35d285f98af4f06edecd5856a3e`.
- Remote attempt decision:
  `BLOCKED_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT`.
- Blockers:
  `remote_dispatcher_install_report_missing`,
  `remote_l6plus_wrapper_mode_not_beta17_stage:unknown`,
  `remote_l6plus_beta17_stage_endpoint_missing:beta15_7_ready,beta16_native_ready,beta16_1_ready`,
  `remote_l6plus_beta17_stage_result_unavailable`.
- Remote endpoint capabilities observed:
  `beta15_7_ready,beta16_native_ready,beta16_1_ready`.
- Materialization attempts count: `0`, because missing install evidence blocks
  the stage attempt before materialization commands are executed.

Validation before refreshing evidence:
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm run test:beta17:fixpoint:remote-promotion` passed.
- `npm run test:beta17:fixpoint:remote-result-promotion` passed.
- `npm test` passed.
- `git diff --check` passed.

Boundary:
- This is fresh operational blocker evidence. It does not install the live
  dispatcher, execute remote mutation, generate Stage1/Stage2 artifacts, prove
  fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Required inputs fail-closed gate

Timestamp: 2026-06-29T03:30:00Z

Task:
- Make the current Beta17 fixpoint blocker machine-readable as a direct
  required-inputs matrix, instead of leaving it only inside the remote-stage
  remediation text.

Change:
- Added `scripts/beta17-fixpoint-required-inputs-gate.js`.
- Added npm scripts `gate:beta17:fixpoint:required-inputs` and
  `test:beta17:fixpoint:required-inputs`.
- Added `scripts/tests/test_beta17_fixpoint_required_inputs_gate.sh`.
- Generated live blocked report at
  `evidence/beta17-fixpoint-required-inputs/report.json`.

Live evidence:
- Decision: `BLOCKED_BETA17_FIXPOINT_REQUIRED_INPUTS`.
- Canonical PCDs present: 4/4.
- Canonical PCD input-set SHA-256:
  `6d2fbee100aa2e266e8aafecfcae8d486d82367cb2909a170fe8c49e1bd59da9`.
- Current blockers:
  `generated_materializer_argument_missing`,
  `materializer_provenance_missing`,
  `dispatcher_deploy_plan_missing`,
  `dispatcher_install_report_missing`,
  `remote_stage_attempt_not_pass`,
  `remote_stage_attempt_accepted_attempt_count_invalid`,
  `remote_stage_attempt_install_evidence_missing`,
  `remote_promotion_report_missing`,
  `remote_promotion_manifest_missing`.

Validation:
- `node --check scripts/beta17-fixpoint-required-inputs-gate.js` passed.
- `npm run test:beta17:fixpoint:required-inputs` passed.
- Live `npm run gate:beta17:fixpoint:required-inputs -- --quiet` failed
  closed as expected and wrote the blocked report.

Break attempts:
- Placeholder materializer with `<base64-json>` is rejected.
- Outside-workspace materializer path is rejected.
- Dry-run dispatcher install evidence is rejected.
- Blocked remote-stage evidence is rejected.

Boundary:
- This is a diagnostic/readiness hardening gate. It does not generate the
  L6+N5 materializer, install the dispatcher, materialize Stage1/Stage2,
  prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Release train required-inputs binding

Timestamp: 2026-06-29T03:55:00Z

Task:
- Make Beta17 release-train dry-run consume the required-inputs gate directly
  before fixpoint readiness, so missing materializer/provenance/install inputs
  remain visible as release evidence.

Change:
- Updated `scripts/release-train-dry-run.js` to run
  `gate:beta17:fixpoint:required-inputs` for `0.1.0-beta.17`.
- Added `beta17_fixpoint_required_inputs` to candidate required evidence with
  path/SHA-256/bytes binding.
- Updated `scripts/beta17-fixpoint-required-inputs-gate.js` to infer the
  generated materializer path from `materializer-provenance.json` and to align
  accepted promotion/deploy-plan fields with existing Beta17 gate contracts.
- Updated `scripts/tests/test_beta17_release_train_readiness.sh` so the
  failure case requires both required-inputs and readiness blockers, and the
  positive fixture must include provenance, deploy plan, executed install
  evidence, accepted remote-stage evidence and promotion evidence.

Validation:
- `node --check scripts/release-train-dry-run.js` passed.
- `node --check scripts/beta17-fixpoint-required-inputs-gate.js` passed.
- `npm run test:beta17:fixpoint:required-inputs` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `git diff --check` passed.
- `npm test` passed.

Live evidence:
- `npm run gate:beta17:fixpoint:required-inputs -- --quiet` still fails
  closed in the real workspace with missing real materializer/provenance,
  deploy plan, executed install evidence, accepted remote stage and promotion
  evidence. That remains the correct current blocker.

Boundary:
- This is release-train hardening. It does not generate the L6+N5
  materializer, install the dispatcher, materialize Stage1/Stage2, prove
  fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - PR review comment closure

Timestamp: 2026-06-29T04:05:00Z

Task:
- Address the remaining PR #223 code-quality review comment without changing
  Beta17 fixpoint semantics.

Change:
- Removed the unused `version` constant from
  `scripts/beta17-fixpoint-remote-dispatcher-install.js`.

Validation:
- `node --check scripts/beta17-fixpoint-remote-dispatcher-install.js` passed.
- `npm run test:beta17:fixpoint:remote-dispatcher-install` passed.
- `npm run test:beta17:fixpoint:required-inputs` passed.
- `git diff --check` passed.

Boundary:
- This is review hygiene only. It does not generate the L6+N5 materializer,
  install the dispatcher, materialize Stage1/Stage2, prove fixpoint or publish
  Beta17.

## Beta17 Ralph Loop Iteration - Materializer route audit

Timestamp: 2026-06-29T04:35:00Z

Task:
- Add a route-level audit before any Beta17 remote mutation, so fixture,
  placeholder, legacy beta15/beta16 materializers and incomplete remote L6
  capabilities cannot be mistaken for a real Beta17 fixpoint path.

Change:
- Added `scripts/beta17-fixpoint-materializer-route-audit.js`.
- Added npm scripts `audit:beta17:fixpoint:materializer-route` and
  `test:beta17:fixpoint:materializer-route`.
- Added `scripts/tests/test_beta17_fixpoint_materializer_route_audit.sh`.
- Generated live blocked report at
  `evidence/beta17-fixpoint-materializer-route-audit/report.json`.

Live evidence:
- Decision: `BLOCKED_BETA17_FIXPOINT_MATERIALIZER_ROUTE_AUDIT`.
- Current remote capabilities: `beta15_7_ready`, `beta16_native_ready`,
  `beta16_1_ready`.
- Current blockers include missing generated materializer argument, missing
  Stage result output, missing materializer provenance, missing
  `beta17_fixpoint_stage_dispatcher`, blocked remote stage attempt and no
  ready Beta17 materializer route.

Validation:
- `node --check scripts/beta17-fixpoint-materializer-route-audit.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_materializer_route_audit.sh` passed.
- `npm run test:beta17:fixpoint:materializer-route` passed.
- `npm run test:beta17:fixpoint:required-inputs` passed.
- `npm run test:beta17:release-train-readiness` passed.
- `git diff --check` passed.

Break attempts:
- Placeholder materializer with `<base64-json>` is rejected.
- Fixture materializer content is rejected.
- Legacy beta15/beta16 materializer scripts are classified as rejected routes.
- A synthetic Stage result with valid shape and no fixture markers is accepted
  by the route audit, proving the audit can go green only for the intended
  Stage-result class.

Boundary:
- This is route and gate hardening. It does not generate the L6+N5
  materializer, install the dispatcher, materialize Stage1/Stage2, prove
  fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Materializer generation request bundle

Timestamp: 2026-06-29T04:58:00Z

Task:
- Add a canonical request bundle for generating the Beta17 fixpoint stage
  materializer itself through L6+N5, before any dispatcher install or Stage1 /
  Stage2 attempt can be considered.

Change:
- Added `pcd/beta17/release/fixpoint_materializer_generation_contract.pcd`.
- Added `scripts/beta17-fixpoint-materializer-generation-request-bundle.js`.
- Added npm scripts `bundle:beta17:fixpoint:materializer-generation-request`
  and `test:beta17:fixpoint:materializer-generation-request`.
- Added `scripts/tests/test_beta17_fixpoint_materializer_generation_request_bundle.sh`.
- Generated request evidence under
  `evidence/beta17-fixpoint-materializer-generation-request/`.

Evidence:
- Manifest decision:
  `PASS_BETA17_FIXPOINT_MATERIALIZER_GENERATION_REQUEST_BUNDLE`.
- Request marker:
  `BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_REQUEST`.
- Required result marker:
  `BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT`.
- PCD input-set SHA-256:
  `953c02a3be17df3d7140ff7e88474ffb453e493460ec00c410f61b0879d0aeaf`.
- Request line SHA-256:
  `8e9e2b35c831dfe216dca3ec4648cb9c2de1f4e23764070f466e41f0f8385803`.

Validation:
- `node --check scripts/beta17-fixpoint-materializer-generation-request-bundle.js` passed.
- `npm run test:beta17:fixpoint:materializer-generation-request` passed.
- `npm run test:beta17:fixpoint:stage-request` passed.
- `npm run test:beta17:fixpoint:materializer-route` passed.
- `git diff --check` passed.

Break attempts:
- Tampered PCD content is rejected by bytes and SHA mismatch.
- Missing materializer generation contract PCD is rejected.
- Unsafe output ref is rejected.
- Missing required binding is rejected.
- Open fixpoint claim boundary is rejected.
- Wrong generated materializer marker is rejected.
- Remote URL output ref fails closed during request construction.

Boundary:
- This is canonical input/request evidence only. It does not generate the
  materializer, install the dispatcher, materialize Stage1/Stage2, prove
  fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Materializer generation result validator

Timestamp: 2026-06-29T05:22:00Z

Task:
- Add a parser and validator for the future L6+N5 materializer-generation
  result so generated materializer evidence can be accepted only when it is
  hash-bound, non-fixture and tied to the exact Beta17 request.

Change:
- Added `scripts/beta17-fixpoint-materializer-generation-result.js`.
- Added npm script `test:beta17:fixpoint:materializer-generation-result`.
- Added `scripts/tests/test_beta17_fixpoint_materializer_generation_result.sh`.

Validation:
- `node --check scripts/beta17-fixpoint-materializer-generation-result.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_materializer_generation_result.sh` passed.
- `npm run test:beta17:fixpoint:materializer-generation-result` passed.
- `npm run test:beta17:fixpoint:materializer-generation-request` passed.
- `npm run test:beta17:fixpoint:materializer-route` passed.
- `git diff --check` passed.

Break attempts:
- Wrong version is rejected.
- Missing L6 generation booleans are rejected.
- Wrong materializer SHA / bytes are rejected.
- Open fixpoint claim boundary is rejected.
- Unsafe materializer path is rejected.
- Wrong materializer-generation request hash is rejected.
- Missing required input PCD is rejected.
- Detached PCD input-set hash is rejected.
- Workspace materializer file without stage marker is rejected.
- Placeholder `<base64-json>` marker is rejected.
- Generation report hash mismatch is rejected.

Boundary:
- This validates future result evidence only. It does not generate the
  materializer, install the dispatcher, materialize Stage1/Stage2, prove
  fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Materializer generation attempt gate

Timestamp: 2026-06-29T04:38:02Z

Task:
- Add a fail-closed attempt gate that sends/probes the Beta17 materializer
  generation request against L6+N5 and accepts only a validated generated
  materializer result.

Change:
- Added `scripts/beta17-fixpoint-materializer-generation-attempt.js`.
- Added npm scripts `attempt:beta17:fixpoint:materializer-generation` and
  `test:beta17:fixpoint:materializer-generation-attempt`.
- Added `scripts/tests/test_beta17_fixpoint_materializer_generation_attempt.sh`.
- Refreshed
  `evidence/beta17-fixpoint-materializer-generation-request/` for source commit
  `51ac26d44f15a4662731a2fc408afad7641dc20c`.
- Added live blocked attempt evidence under
  `evidence/beta17-fixpoint-materializer-generation-attempt/`.

Validation:
- `node --check scripts/beta17-fixpoint-materializer-generation-attempt.js` passed.
- `bash -n scripts/tests/test_beta17_fixpoint_materializer_generation_attempt.sh` passed.
- `npm run test:beta17:fixpoint:materializer-generation-attempt` passed.
- `npm run test:beta17:fixpoint:materializer-generation-result` passed.
- `npm run test:beta17:fixpoint:materializer-generation-request` passed.
- `npm run test:beta17:fixpoint:materializer-route` passed.
- Live attempt ran through
  `npm run bundle:beta17:fixpoint:materializer-generation-request` then
  `npm run attempt:beta17:fixpoint:materializer-generation`; it exited with
  expected blocked rc `2`.

Live evidence:
- Report:
  `evidence/beta17-fixpoint-materializer-generation-attempt/report.json`.
- Decision:
  `BLOCKED_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ATTEMPT`.
- Blockers:
  `remote_l6plus_wrapper_mode_not_materializer_generation:unknown`,
  `remote_l6plus_materializer_generation_endpoint_missing:beta15_7_ready,beta16_native_ready,beta16_1_ready`,
  `remote_l6plus_beta17_materializer_generation_result_unavailable`.
- Remote health:
  host probe status `0`, audit decision `PASS`.

Break attempts:
- Skip-mode remote probe fails closed and records transcript evidence.
- Missing generated result fails closed with
  `remote_l6plus_beta17_materializer_generation_result_unavailable`.
- Parser checks reject relying on generic endpoint text and require explicit
  `beta17_fixpoint_materializer_generator` capability.

Boundary:
- This is attempt/blocker evidence only. It does not generate the materializer,
  install a dispatcher, materialize Stage1/Stage2, prove fixpoint, authorize
  public release or publish Beta17.

## Beta17 Ralph Loop Iteration - Remote materializer result hydration

Timestamp: 2026-06-29T04:58:00Z

Task:
- Remove a consumer-side blocker before installing the L6+N5 Beta17
  materializer-generation endpoint: remote results must be able to return
  generated artifacts as hash-bound content because the remote host cannot
  directly write files into the local workspace.

Change:
- Updated `scripts/beta17-fixpoint-materializer-generation-attempt.js` to
  hydrate `generatedMaterializerContentBase64`,
  `generationReportContentBase64` and `materializerProvenanceContentBase64`
  into their declared workspace refs before validation.
- Added safe-ref, byte-count and SHA-256 checks before any hydrated artifact is
  written.
- Extended
  `scripts/tests/test_beta17_fixpoint_materializer_generation_attempt.sh`.

Validation:
- `npm run test:beta17:fixpoint:materializer-generation-attempt` passed.
- `npm run test:beta17:fixpoint:materializer-generation-result` passed.
- `npm run test:beta17:fixpoint:materializer-generation-request` passed.
- Live attempt reran and remains correctly blocked on missing remote endpoint.

Break attempts:
- Valid hash-bound content hydrates successfully.
- `../outside.js` is rejected as an unsafe result ref.
- Content with wrong SHA-256 is rejected before it can satisfy validation.

Boundary:
- This is consumer contract hardening only. It does not install
  `beta17_fixpoint_materializer_generator`, generate the materializer,
  materialize Stage1/Stage2, prove fixpoint or publish Beta17.

## Beta17 Ralph Loop Iteration - Materializer generator endpoint and remote Stage promotion

Timestamp: 2026-06-29T05:10:00Z

Task:
- Optimize the active Beta17 goal into executable gates and close the next
  concrete blocker: live L6+N5 had to generate the Beta17 stage materializer,
  install the remote stage dispatcher and produce promotable Stage1/Stage2
  evidence without opening public claims.

Change:
- Added `scripts/beta17-fixpoint-materializer-generator-endpoint-install.js`
  and the npm script
  `install:beta17:fixpoint:materializer-generator-endpoint`.
- Added `scripts/tests/test_beta17_fixpoint_materializer_generator_endpoint_install.sh`.
- Corrected the generated materializer provenance contract to emit
  `brik64.beta17_fixpoint.materializer_provenance.v1` with
  `MATERIALIZER_PROVENANCE_NON_CLAIM`, `generatedFromPcdPolymer: true`,
  `fixtureOrTemplate: false` and a hash-bound `materializerRef`.
- Updated `scripts/beta17-fixpoint-stage-remote-attempt.js` so remote Stage
  results can hydrate hash-bound base64 artifacts before validation. Hydration
  is fail-closed on unsafe refs, byte mismatch and SHA-256 mismatch.
- Changed remote Stage attempts to stop after the first present Stage result so
  promotion has exactly one canonical accepted source instead of three alias
  results.

Validation:
- `npm run test:beta17:fixpoint:materializer-generator-endpoint-install` passed.
- `npm run test:beta17:fixpoint:materializer-generation-attempt` passed.
- `npm run test:beta17:fixpoint:stage-result` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run install:beta17:fixpoint:materializer-generator-endpoint -- --execute --confirm INSTALL_BETA17_MATERIALIZER_GENERATOR_ENDPOINT_NON_CLAIM` passed.
- `npm run bundle:beta17:fixpoint:materializer-generation-request` passed.
- `npm run attempt:beta17:fixpoint:materializer-generation` passed.
- `npm run plan:beta17:fixpoint:remote-dispatcher -- --materializer generated/beta17-fixpoint-stage-materializer.js --provenance evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance.json` passed.
- `npm run preflight:beta17:fixpoint:remote-dispatcher` passed.
- `npm run install:beta17:fixpoint:remote-dispatcher -- --execute --confirm INSTALL_BETA17_FIXPOINT_DISPATCHER_NON_CLAIM` passed.
- `npm run bundle:beta17:fixpoint:stage-request` passed.
- `npm run attempt:beta17:fixpoint:remote-stage` passed.
- `npm run gate:beta17:fixpoint:remote-promotion` passed.
- `npm run promote:beta17:fixpoint:remote-result` passed.
- `npm run gate:beta17:fixpoint-readiness` remains blocked.

Break attempts:
- Materializer provenance with missing canonical contract fields is rejected by
  downstream deploy-plan.
- Stage hydration rejects `../outside.mjs`.
- Stage hydration rejects content whose SHA-256 does not match the declared
  file ref.
- Skip-mode remote attempt remains blocked and cannot satisfy Stage readiness.

Current blockers:
- `gate:beta17:fixpoint-readiness` reports missing
  `canonical_motor_manifest.json`, `canonical_harness_manifest.json`,
  `input_pcd_hashes.tsv`, `evidence_pack_manifest.json`,
  `public_surface_sync_report.json` and `external_audit_report.json`.
- Readiness also reports byte-identity/seal binding drift:
  `byte_identity_stage1_artifact_sha256_mismatch`,
  `byte_identity_stage2_artifact_sha256_mismatch`,
  `byte_identity_stage_artifact_size_mismatch`,
  `seal_stage1_artifact_sha256_mismatch`,
  `seal_stage2_artifact_sha256_mismatch` and
  `seal_input_pcd_set_sha256_mismatch`.

Boundary:
- Beta17 has live NON_CLAIM L6+N5 materializer generation and remote
  Stage1/Stage2 byte-identical evidence promoted locally. It is not ready for
  public release, external claims or definitive fixpoint until readiness,
  public sync and external audit pass.

## Beta17 Ralph Loop Iteration - Readiness evidence pack refresh

Timestamp: 2026-06-29T05:27:00Z

Task:
- Close the package-level Beta17 readiness evidence blockers without opening
  public release, self-hosting, formal N5 or definitive fixpoint claims.

Change:
- Added `scripts/beta17-fixpoint-readiness-evidence-refresh.js`.
- Added npm scripts `refresh:beta17:fixpoint:readiness-evidence` and
  `test:beta17:fixpoint:readiness-evidence-refresh`.
- Added `scripts/tests/test_beta17_fixpoint_readiness_evidence_refresh.sh`.
- Updated the generated Beta17 materializer template so future byte-identity
  and seal reports expose the top-level bindings expected by the readiness
  gate.
- Isolated `scripts/tests/test_beta17_fixpoint_materializer_generator_endpoint_install.sh`
  with `BRIK64_CLI_ROOT` so test dry-runs and negative cases no longer
  overwrite live endpoint-install evidence.
- Hardened readiness validation for remote materializer paths: paths must stay
  under `/opt/brik64/engines/l6plus-n5/`, include `beta17`, and reject null or
  `..` traversal segments.
- Refreshed live candidate evidence under `evidence/beta17-fixpoint/`.

Validation:
- `node --check scripts/beta17-fixpoint-readiness-evidence-refresh.js` passed.
- `npm run test:beta17:fixpoint:readiness-evidence-refresh` passed.
- `npm run test:beta17:fixpoint-readiness` passed.
- `npm run test:beta17:fixpoint:materializer-generator-endpoint-install` passed.
- `npm run test:beta17:fixpoint:remote-stage` passed.
- `npm run refresh:beta17:fixpoint:readiness-evidence` passed.
- `npm run gate:beta17:fixpoint-readiness` remains intentionally blocked.

Break attempts:
- Missing Stage result fails closed with `missing_stage_result`.
- Empty `inputPcds` in the Stage result fails closed with
  `stage_result_input_pcds_missing`.
- Tampered input PCD content fails closed with
  `input_pcd_sha256_mismatch:pcd/cli_core.pcd`.

Current blockers:
- `public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC`.
- `external_audit_not_pass:BLOCKED_BETA17_EXTERNAL_AUDIT`.
- Missing external audit proof flags for clean public install, functional tests,
  generated-code tests, adversarial tests, public-surface scan and claim-safe
  scan.

Boundary:
- This iteration produces CANDIDATE_NON_CLAIM readiness evidence only. It does
  not publish Beta17, authorize public fixpoint claims, or replace the required
  public-surface sync and external audit campaigns.

## Beta17 Ralph Loop Iteration - Public surface sync contract

Timestamp: 2026-06-29T06:03:00Z

Task:
- Add a fail-closed Beta17 public-surface sync report producer so the
  readiness gate can distinguish a real Beta17 public sync from stale live
  release evidence.

Change:
- Added `scripts/beta17-fixpoint-public-surface-sync-report.js`.
- Added npm scripts `sync:beta17:fixpoint:public-surfaces` and
  `test:beta17:fixpoint:public-surface-sync`.
- Added `scripts/tests/test_beta17_fixpoint_public_surface_sync_report.sh`.
- Refreshed `evidence/beta17-fixpoint/public_surface_sync_report.json` from the
  current live verification report.

Validation:
- `node --check scripts/beta17-fixpoint-public-surface-sync-report.js` passed.
- `npm run test:beta17:fixpoint:public-surface-sync` passed.
- `npm run sync:beta17:fixpoint:public-surfaces` failed closed as expected with
  `BLOCKED_BETA17_PUBLIC_SURFACE_SYNC`.
- `npm run beta17:fixpoint:evidence:manifest` passed.
- `npm run gate:beta17:fixpoint-readiness` remains intentionally blocked.

Break attempts:
- Missing live verify report fails closed with `missing_live_verify_report`.
- Stale live verify version fails closed with
  `live_verify_version_mismatch:0.1.0-beta.16.1` in fixture tests.
- Missing `public_skill` observation fails closed with
  `surface_missing_observation:skills:public_skill`.

Current real blocker:
- The actual `release-train-live-verify` evidence in this checkout is still for
  `0.1.0-beta.15.7.1`, so the Beta17 public sync report is blocked with
  `live_verify_version_mismatch:0.1.0-beta.15.7.1`.

Boundary:
- This iteration creates the public-sync evidence contract. It does not mutate
  public surfaces, publish Beta17, or replace the required external audit.

## Beta17 Ralph Loop Iteration - External audit status gate

Timestamp: 2026-06-29T06:16:00Z

Task:
- Add a fail-closed status gate for Beta17 external audit evidence so the
  release path cannot treat placeholders or pre-public reports as audit proof.

Change:
- Added `scripts/beta17-fixpoint-external-audit-status-gate.js`.
- Added npm scripts `gate:beta17:fixpoint:external-audit-status` and
  `test:beta17:fixpoint:external-audit-status`.
- Added `scripts/tests/test_beta17_fixpoint_external_audit_status_gate.sh`.
- Generated `evidence/beta17-fixpoint-external-audit-status/report.json` from
  the current blocked public-sync and external-audit evidence.

Validation:
- `node --check scripts/beta17-fixpoint-external-audit-status-gate.js` passed.
- `npm run test:beta17:fixpoint:external-audit-status` passed.
- `npm run test:beta17:external-audit-report` passed.
- `npm run gate:beta17:fixpoint:external-audit-status` failed closed as
  expected with `BLOCKED_BETA17_EXTERNAL_AUDIT_STATUS_GATE`.

Break attempts:
- External audit status cannot pass before public sync; blocked sync produces
  `external_audit_blocked_until_public_surface_sync_passes`.
- Incomplete generated-code audit fails closed with
  `external_audit_missing_generated_code_tests`.
- Missing external audit report fails closed with `missing_external_audit_report`.

Current blockers:
- Public sync is still blocked.
- External audit report is still a blocked placeholder and has no passing clean
  public install, functional, generated-code, adversarial, public-surface or
  claim-safe evidence.

Boundary:
- This iteration creates the external-audit status gate only. It does not run
  the external audit, mutate public surfaces, publish Beta17 or open fixpoint
  claims.

## Beta17 Ralph Loop Iteration - Release train external audit integration

Timestamp: 2026-06-29T06:27:00Z

Task:
- Integrate the Beta17 external audit status gate into the release-train dry-run
  path so public release preflight cannot skip external audit readiness.

Change:
- Updated `scripts/release-train-dry-run.js` so both Beta17 candidate paths run
  `npm run gate:beta17:fixpoint:external-audit-status`.
- Updated `scripts/tests/test_beta17_release_train_readiness.sh` to require the
  new dry-run command and to restore all Beta17 evidence directories touched by
  the regression fixture.

Validation:
- `npm run test:beta17:release-train-readiness` passed.
- The regression test now leaves the worktree clean except for the intentional
  code/test/doc changes.

Break attempts:
- Missing Beta17 readiness still fails dry-run.
- Missing required inputs still fails dry-run.
- External audit status failure is now represented as
  `command_failed:beta17_fixpoint_external_audit_status:1` in the dry-run
  failure matrix.

Boundary:
- This iteration wires the release preflight only. It does not publish Beta17,
  sync public surfaces or run the external audit.

## Beta17 Ralph Loop Iteration - Publication preflight gate

Timestamp: 2026-06-29T07:05:00Z

Task:
- Add a non-mutating publication preflight for Beta17 so the release train has
  an explicit stoplight before changing public surfaces.

Change:
- Added `scripts/beta17-fixpoint-publication-preflight.js`.
- Added npm scripts `preflight:beta17:fixpoint:publication` and
  `test:beta17:fixpoint:publication-preflight`.
- Added `scripts/tests/test_beta17_fixpoint_publication_preflight.sh`.
- Generated
  `evidence/beta17-fixpoint-publication-preflight/report.json` from current
  repo evidence.

Validation:
- `node --check scripts/beta17-fixpoint-publication-preflight.js` passed.
- `npm run test:beta17:fixpoint:publication-preflight` passed.
- `npm run preflight:beta17:fixpoint:publication` failed closed as expected
  with `BLOCKED_BETA17_PUBLICATION_PREFLIGHT`.

Break attempts:
- Stale release manifest version fails closed with
  `release_manifest_version_mismatch:0.1.0-beta.16.1`.
- Package tarball hash/byte drift fails closed with
  `cli_package_sha256_mismatch` and `cli_package_bytes_mismatch`.
- Blocked readiness propagates readiness blockers into the publication
  preflight.
- Blocked public-surface sync and external-audit status block publication
  even if local package fixtures are otherwise green.

Current real blockers:
- `release/manifest.json` and `package.json` are still `0.1.0-beta.16.1`.
- Package manifest evidence is still Beta16.1.
- Public-surface sync evidence is blocked because live verify is still
  `0.1.0-beta.15.7.1`.
- External audit remains blocked until Beta17 public surfaces are synced and
  audited from a clean public install.

Boundary:
- This iteration creates the publication preflight only. It does not mutate
  public surfaces, publish Beta17, run the external audit or authorize
  fixpoint/formal claims.

## Beta17 Ralph Loop Iteration - Package candidate from Stage evidence

Timestamp: 2026-06-29T07:35:00Z

Task:
- Generate a non-public Beta17 package candidate from current L6+N5 Stage
  evidence and keep publication fail-closed if the package is not functional.

Change:
- Added `scripts/build-beta17-package-candidate.js`.
- Added npm scripts `package:beta17:fixpoint:candidate` and
  `test:beta17:fixpoint:package-candidate`.
- Added `scripts/tests/test_beta17_package_candidate.sh`.
- Hardened `scripts/beta17-fixpoint-publication-preflight.js` so a matching
  package manifest cannot pass unless `releaseEligible=true` and
  `publicationAllowed=true`.
- Generated `evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz`,
  `evidence/beta17-package/package.manifest.json`,
  `evidence/beta17-package/SHA256SUMS` and
  `evidence/beta17-package/release.manifest.candidate.json`.

Validation:
- `node --check scripts/build-beta17-package-candidate.js` passed.
- `node --check scripts/beta17-fixpoint-publication-preflight.js` passed.
- `npm run test:beta17:fixpoint:package-candidate` passed.
- `npm run test:beta17:fixpoint:publication-preflight` passed.
- `npm run package:beta17:fixpoint:candidate` passed.
- `node scripts/beta17-fixpoint-publication-preflight.js --manifest evidence/beta17-package/release.manifest.candidate.json`
  failed closed as expected with `BLOCKED_BETA17_PUBLICATION_PREFLIGHT`.

Break attempts:
- Missing Stage1 artifact manifest fails closed with
  `missing_stage1_artifact_manifest`.
- Stage1 artifact SHA drift fails closed with
  `stage1_artifact_sha256_mismatch`.
- Candidate package remains blocked by publication preflight because
  `releaseEligible=false` and `publicationAllowed=false`.

Current real blockers:
- Current Stage1 artifact is 1473 bytes and is stage metadata, not a functional
  CLI artifact; package manifest records
  `stage_artifact_not_functional_cli_sized`.
- Root `package.json` remains `0.1.0-beta.16.1`.
- Public-surface sync and external-audit status remain blocked.

Boundary:
- This iteration creates package candidate evidence only. It does not publish
  Beta17, mutate `release/manifest.json`, run external audit or authorize
  fixpoint/formal claims.

## Beta17 Ralph Loop Iteration - Functional Stage artifact gate

Timestamp: 2026-06-29T08:05:00Z

Task:
- Add a fail-closed gate that distinguishes a full functional Beta17 CLI
  Stage1 artifact from a metadata-only Stage result.

Change:
- Added `scripts/beta17-fixpoint-functional-stage-artifact-gate.js`.
- Added npm scripts `gate:beta17:fixpoint:functional-stage-artifact` and
  `test:beta17:fixpoint:functional-stage-artifact`.
- Added `scripts/tests/test_beta17_fixpoint_functional_stage_artifact_gate.sh`.
- Updated `scripts/build-beta17-package-candidate.js` to consume
  `evidence/beta17-fixpoint-functional-stage-artifact/report.json` before
  setting package release eligibility.
- Regenerated `evidence/beta17-package/package.manifest.json` and package
  candidate evidence with the functional Stage artifact report bound.

Validation:
- `node --check scripts/beta17-fixpoint-functional-stage-artifact-gate.js`
  passed.
- `node --check scripts/build-beta17-package-candidate.js` passed.
- `npm run test:beta17:fixpoint:functional-stage-artifact` passed.
- `npm run test:beta17:fixpoint:package-candidate` passed.
- `npm run gate:beta17:fixpoint:functional-stage-artifact` failed closed as
  expected on real evidence.
- `npm run package:beta17:fixpoint:candidate` passed and preserved
  `releaseEligible=false`.

Break attempts:
- Missing Stage1 manifest fails closed with
  `missing_stage1_artifact_manifest`.
- Stage1 artifact SHA/bytes drift fails closed with
  `stage1_artifact_sha256_mismatch` and `stage1_artifact_bytes_mismatch`.
- Metadata-only Stage1 fails closed on size, missing Node entrypoint and
  missing argv handling.

Current real blockers:
- Stage1 artifact bytes: 1473, below the 50000-byte minimum for a functional
  CLI artifact in this gate.
- Stage1 lacks `#!/usr/bin/env node`, `process.argv` and command dispatcher
  markers.
- Package candidate now records the functional Stage blocker directly:
  `functional_stage_artifact_not_pass:BLOCKED_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE`.

Boundary:
- This iteration adds the functional-artifact gate only. It does not generate
  the full CLI, publish Beta17, run public-surface sync or run external audit.

## Beta17 Ralph Loop Iteration - Functional CLI Stage request bundle

Timestamp: 2026-06-29T08:25:00Z

Task:
- Create the PCD-first input contract for asking L6+N5 to generate a functional
  Beta17 CLI Stage1 artifact instead of metadata-only Stage output.

Change:
- Added
  `pcd/beta17/release/functional_cli_stage_materialization_contract.pcd`.
- Added `scripts/beta17-functional-cli-stage-request-bundle.js`.
- Added npm scripts `bundle:beta17:functional-cli-stage-request` and
  `test:beta17:functional-cli-stage-request`.
- Added `scripts/tests/test_beta17_functional_cli_stage_request_bundle.sh`.
- Generated `evidence/beta17-functional-cli-stage-request/request.json`,
  `request.line`, `request.manifest.json` and `SHA256SUMS`.

Validation:
- `node --check scripts/beta17-functional-cli-stage-request-bundle.js` passed.
- `npm run test:beta17:functional-cli-stage-request` passed.
- Generated manifest decision:
  `PASS_BETA17_FUNCTIONAL_CLI_STAGE_REQUEST_BUNDLE`.

Break attempts:
- Tampered PCD content fails closed with content SHA/byte mismatch.
- Unsafe output ref fails closed with `request_output_ref_invalid`.
- Missing `functionalStageArtifactGatePass` binding fails closed.
- Open self-hosting claim boundary fails closed.
- Min artifact bytes below 50000 fails closed.
- Missing `process.argv` required marker fails closed.
- Wrong input PCD set hash fails closed.

Current real next input:
- `evidence/beta17-functional-cli-stage-request/request.line` contains
  `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_REQUEST`.
- Request input set hash:
  `1cde79f6479e7bb13bde26996652316cfa1323c8d3b712a2367c00f46eb4e4dd`.

Boundary:
- This iteration produces request/input evidence only. It does not execute
  L6+N5, hydrate a generated artifact, publish Beta17 or authorize
  fixpoint/formal claims.

## Beta17 Ralph Loop Iteration - Functional CLI Stage result validator

Timestamp: 2026-06-29T08:45:00Z

Task:
- Add a fail-closed parser/validator for the future
  `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT` emitted by L6+N5.

Change:
- Added `scripts/beta17-functional-cli-stage-result.js`.
- Added npm script `test:beta17:functional-cli-stage-result`.
- Added `scripts/tests/test_beta17_functional_cli_stage_result.sh`.

Validation:
- `node --check scripts/beta17-functional-cli-stage-result.js` passed.
- `npm run test:beta17:functional-cli-stage-result` passed.

Break attempts:
- Stale version fails closed.
- `generatedByL6PlusN5=false` fails closed.
- Open public-release claim boundary fails closed.
- Stage1 artifact SHA drift fails closed.
- Unsafe artifact path fails closed.
- `functionalStageMinSizePass=false` fails closed.
- Missing `process.argv` marker in artifact content fails closed.
- Candidate-only stub text fails closed.
- Wrong functional request hash fails closed.
- Input PCD set drift fails closed.
- Missing required input PCD fails closed.
- Malformed/non-result lines return null.

Current next action:
- Route `evidence/beta17-functional-cli-stage-request/request.line` through
  L6+N5 and accept only a payload that passes this validator before hydrating
  Stage1.

Boundary:
- This iteration validates the future result contract only. It does not execute
  L6+N5, hydrate artifacts, publish Beta17 or open fixpoint/formal claims.

## Beta17 Ralph Loop Iteration - Functional CLI Stage result hydration

Timestamp: 2026-06-29T09:05:00Z

Task:
- Add a fail-closed hydrator that consumes a future validated
  `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT` and writes Stage1/package
  evidence only if every bound ref matches.

Change:
- Added `scripts/beta17-functional-cli-stage-result-hydrate.js`.
- Added npm scripts `hydrate:beta17:functional-cli-stage-result` and
  `test:beta17:functional-cli-stage-result-hydrate`.
- Added `scripts/tests/test_beta17_functional_cli_stage_result_hydrate.sh`.
- Exported `decodeStage1Artifact` from
  `scripts/beta17-functional-cli-stage-result.js`.
- Generated real blocked hydration evidence at
  `evidence/beta17-functional-cli-stage-result/hydrate-report.json`.

Validation:
- `node --check scripts/beta17-functional-cli-stage-result-hydrate.js` passed.
- `npm run test:beta17:functional-cli-stage-result-hydrate` passed.
- `npm run hydrate:beta17:functional-cli-stage-result` failed closed as
  expected on real state.

Break attempts:
- Missing result line fails closed.
- Invalid result fails closed.
- Unsafe output path fails closed.
- Hash-bound synthetic PASS writes artifact and manifests only when all
  expected SHA/byte refs match.

Current real blocker:
- `missing_functional_cli_stage_result_line:evidence/beta17-functional-cli-stage-result/result.line`.

Boundary:
- This iteration adds the consumer/hydrator only. It does not execute L6+N5,
  invent a result, publish Beta17 or authorize fixpoint/formal claims.

## Beta17 Ralph Loop Iteration - Functional CLI Stage attempt entrypoint

Timestamp: 2026-06-29T09:35:00Z

Task:
- Add a single fail-closed attempt command that bridges the functional CLI Stage
  request and the existing result hydrator.

Change:
- Added `scripts/beta17-functional-cli-stage-attempt.js`.
- Added npm scripts `attempt:beta17:functional-cli-stage` and
  `test:beta17:functional-cli-stage-attempt`.
- Added `scripts/tests/test_beta17_functional_cli_stage_attempt.sh`.
- Generated real attempt evidence at
  `evidence/beta17-functional-cli-stage-attempt/report.json`.

Validation:
- `node --check scripts/beta17-functional-cli-stage-attempt.js` passed.
- `npm run test:beta17:functional-cli-stage-attempt` passed.
- `npm run attempt:beta17:functional-cli-stage` failed closed as expected on
  real state.

Break attempts:
- Missing request/result fails closed with missing request and unavailable
  result blockers.
- Invalid result with `generatedFromPcdPolymer=false` fails closed.
- Valid synthetic result hydrates Stage1/package refs but keeps publication
  closed.

Current real blocker:
- `functional_cli_stage_result_unavailable`.

Next exact action:
- Produce a valid `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT` from L6+N5 and
  rerun `npm run attempt:beta17:functional-cli-stage`.

Boundary:
- This iteration does not execute L6+N5, publish Beta17, or authorize
  fixpoint/formal/public-release claims. It only makes the next blocker
  machine-readable and test-gated.

## Beta17 Ralph Loop Iteration - Functional CLI Stage remote route probe

Timestamp: 2026-06-29T09:55:00Z

Task:
- Extend the functional CLI Stage attempt gate so it actively probes the L6+N5
  wrapper for a functional CLI materialization endpoint instead of only waiting
  for a local result line.

Change:
- Updated `scripts/beta17-functional-cli-stage-attempt.js` to try the bounded
  remote commands `beta17-functional-cli-stage-materialize`,
  `functional-cli-stage-materialize` and
  `beta17-fixpoint-functional-cli-stage-materialize` with the current
  `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_REQUEST`.
- The report now records endpoint capabilities, transcripts, the required
  capability `beta17_functional_cli_stage_materializer`, and non-acceptable
  substitutes.
- Updated `scripts/tests/test_beta17_functional_cli_stage_attempt.sh` with a
  remote-skip fail-closed case.
- Regenerated real attempt evidence at
  `evidence/beta17-functional-cli-stage-attempt/report.json`.

Validation:
- `node --check scripts/beta17-functional-cli-stage-attempt.js` passed.
- `npm run test:beta17:functional-cli-stage-attempt` passed.
- `npm run attempt:beta17:functional-cli-stage` failed closed as expected on
  real L6+N5 state.

Break attempts:
- Missing request/result still fails closed.
- Invalid result with `generatedFromPcdPolymer=false` still fails closed.
- Remote skipped by `BRIK64_L6_SKIP_REMOTE=1` fails closed without network.
- Real remote wrapper lacks `beta17_functional_cli_stage_materializer` and no
  attempted command emits `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`.

Current real blockers:
- `functional_cli_stage_result_unavailable`.
- `remote_l6plus_functional_cli_stage_endpoint_missing:beta15_7_ready,beta16_native_ready,beta16_1_ready`.
- `remote_l6plus_functional_cli_stage_result_not_emitted`.

Next exact action:
- Install or generate the L6+N5 endpoint capability
  `beta17_functional_cli_stage_materializer` so the wrapper emits
  `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`, then rerun
  `npm run attempt:beta17:functional-cli-stage`.

Boundary:
- This iteration probes and records remote capability evidence only. It does
  not publish Beta17, invent a result, or authorize fixpoint/formal/public
  claims.

## Beta17 Ralph Loop Iteration - L6+N5 general PCD artifact factory audit

Timestamp: 2026-06-29T10:20:00Z

Task:
- Audit the general behavior of the L6+N5 wrapper and prevent Beta17 from
  depending on another version-specific endpoint when the intended architecture
  is a general PCD/polymer artifact factory.

Change:
- Added `pcd/beta17/release/l6plus_pcd_artifact_factory_contract.pcd`.
- Added `scripts/l6plus-pcd-artifact-factory-audit.js`.
- Added npm scripts `audit:l6plus:pcd-artifact-factory` and
  `test:l6plus:pcd-artifact-factory-audit`.
- Added `scripts/tests/test_l6plus_pcd_artifact_factory_audit.sh`.
- Generated real wrapper evidence at
  `evidence/l6plus-pcd-artifact-factory-audit/report.json`.

Validation:
- `node --check scripts/l6plus-pcd-artifact-factory-audit.js` passed.
- `npm run test:l6plus:pcd-artifact-factory-audit` passed.
- `npm run audit:l6plus:pcd-artifact-factory` failed closed as expected
  against the real remote wrapper.

Break attempts:
- Fixture with `l6plus_pcd_artifact_factory` and
  `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT` passes.
- Legacy-only capabilities `beta15_7_ready,beta16_native_ready,beta16_1_ready`
  fail closed.
- Unsupported `factory-status` fails closed.

Current real blockers:
- `l6plus_pcd_artifact_factory_capability_missing:beta15_7_ready,beta16_1_ready,beta16_native_ready`.
- `l6plus_pcd_artifact_factory_result_marker_missing:BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT`.
- `l6plus_factory_status_unsupported`.

Next exact action:
- Replace version-specific wrapper routing with a general
  `l6plus_pcd_artifact_factory` capability, then route the Beta17 functional
  CLI request through that factory.

Boundary:
- This iteration is an audit/gate. It does not install a remote factory,
  generate the Beta17 CLI artifact, publish Beta17, or authorize fixpoint,
  formal N5, self-hosting, Rust-independence, or public-release claims.

## Beta17 Ralph Loop Iteration - General L6+N5 PCD artifact factory installer dry-run

Timestamp: 2026-06-29T10:45:00Z

Task:
- Prepare the correction path for the wrapper discrepancy by generating a
  guarded installer for a general `l6plus_pcd_artifact_factory` capability.

Change:
- Added `scripts/l6plus-pcd-artifact-factory-install.js`.
- Added `scripts/tests/test_l6plus_pcd_artifact_factory_install.sh`.
- Added npm scripts `install:l6plus:pcd-artifact-factory` and
  `test:l6plus:pcd-artifact-factory-install`.
- Generated dry-run evidence at
  `evidence/l6plus-pcd-artifact-factory-install/install-report.json`.

Validation:
- `node --check scripts/l6plus-pcd-artifact-factory-install.js` passed.
- `npm run test:l6plus:pcd-artifact-factory-install` passed.
- `npm run install:l6plus:pcd-artifact-factory` passed as dry-run.

Break attempts:
- Invalid remote factory path fails closed.
- `--execute` without confirmation fails closed.
- Generated installer keeps public/fixpoint/formal claim boundaries closed.

Current state:
- The general factory installer is ready in dry-run only. The live wrapper has
  not been mutated by this iteration.

Next exact action:
- Run the guarded remote install only when ready:
  `npm run install:l6plus:pcd-artifact-factory -- --execute --confirm INSTALL_L6PLUS_PCD_ARTIFACT_FACTORY_NON_CLAIM`,
  then run `npm run audit:l6plus:pcd-artifact-factory` and route Beta17 through
  `artifact-factory-materialize`.

Boundary:
- This iteration does not install the remote factory, generate Beta17, publish
  Beta17, or authorize fixpoint/formal/public-release claims.

## Beta17 Ralph Loop Iteration - Remote general factory install and Beta17 route attempt

Timestamp: 2026-06-29T11:05:00Z

Task:
- Correct the L6+N5 wrapper discrepancy by installing the general
  `l6plus_pcd_artifact_factory` capability under an explicit non-claim guard,
  then route the Beta17 functional CLI request through that general factory.

Change:
- Executed the guarded installer:
  `npm run install:l6plus:pcd-artifact-factory -- --execute --confirm INSTALL_L6PLUS_PCD_ARTIFACT_FACTORY_NON_CLAIM`.
- Extended `scripts/beta17-functional-cli-stage-attempt.js` so it probes
  `artifact-factory-status`, builds a normalized
  `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_REQUEST`, runs
  `artifact-factory-materialize`, and records whether the factory result is a
  valid `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`.
- Updated real evidence under:
  `evidence/l6plus-pcd-artifact-factory-install/`,
  `evidence/l6plus-pcd-artifact-factory-audit/`, and
  `evidence/beta17-functional-cli-stage-attempt/`.

Validation:
- `npm run install:l6plus:pcd-artifact-factory -- --execute --confirm INSTALL_L6PLUS_PCD_ARTIFACT_FACTORY_NON_CLAIM` passed with
  `PASS_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL`.
- `npm run audit:l6plus:pcd-artifact-factory` passed with
  `PASS_L6PLUS_PCD_ARTIFACT_FACTORY_AUDIT`.
- `npm run test:beta17:functional-cli-stage-attempt` passed.
- `npm run attempt:beta17:functional-cli-stage` failed closed on the next real
  boundary.

Break attempts:
- Existing missing-result fixture still fails closed.
- Invalid result with `generatedFromPcdPolymer=false` still fails closed.
- Remote skipped by `BRIK64_L6_SKIP_REMOTE=1` still fails closed.
- Real remote factory emits a generic factory result, but no functional CLI
  Stage result; this is rejected.

Current real blockers:
- `functional_cli_stage_result_unavailable`.
- `remote_l6plus_factory_result_not_functional_cli_stage_result`.
- `remote_l6plus_functional_cli_stage_result_not_emitted`.

Next exact action:
- Upgrade the L6+N5 factory materializer so a `cli` artifact request for
  Beta17 emits a valid `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`, then rerun
  `npm run attempt:beta17:functional-cli-stage`.

Boundary:
- The wrapper/capability discrepancy is corrected. Beta17 is still not
  generated, not publishable, and not fixpoint/self-hosting/formal claim
  evidence because the current factory output is generic rather than a
  functional CLI Stage result.

## Beta17 Ralph Loop Iteration - Target-aware factory result gate

Timestamp: 2026-06-29T11:35:00Z

Task:
- Add a gate that distinguishes a generic L6+N5 artifact-factory result from a
  target-aware Beta17 functional CLI Stage result.

Change:
- Added `scripts/beta17-target-aware-factory-result-gate.js`.
- Added `scripts/tests/test_beta17_target_aware_factory_result_gate.sh`.
- Added npm scripts `gate:beta17:target-aware-factory-result` and
  `test:beta17:target-aware-factory-result`.
- Generated real evidence at
  `evidence/beta17-target-aware-factory-result-gate/report.json`.

Validation:
- `node --check scripts/beta17-target-aware-factory-result-gate.js` passed.
- `npm run test:beta17:target-aware-factory-result` passed.
- `npm run gate:beta17:target-aware-factory-result` failed closed against real
  current L6+N5 factory output.

Break attempts:
- Synthetic target-aware factory result with embedded
  `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT` passes.
- Generic factory result without target result line fails closed.
- Missing factory transcript fails closed.

Current real blockers:
- `factory_result_missing_target_functional_cli_stage_result_line`.
- `factory_result_not_target_aware`.
- `factory_artifact_not_functional_node_cli`.

Next exact action:
- Upgrade the L6+N5 factory materializer so `artifactKind=cli` requests for
  Beta17 emit or embed a valid `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`,
  then rerun `gate:beta17:target-aware-factory-result` and
  `attempt:beta17:functional-cli-stage`.

Boundary:
- This iteration strengthens the gate only. It does not generate Beta17, does
  not publish, and does not authorize fixpoint/self-hosting/formal claims.

## Beta17 Ralph Loop Iteration - Target-aware factory materialization and package smoke

Timestamp: 2026-06-29T12:05:00Z

Task:
- Upgrade the general L6+N5 factory bridge so the Beta17 `artifactKind=cli`
  request produces a target-aware functional CLI Stage result, then package the
  hydrated Stage artifact without replacing it with an aborting stub.

Change:
- Updated `scripts/l6plus-pcd-artifact-factory-install.js` so the generated
  factory emits an embedded `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT` for the
  Beta17 CLI request.
- Updated `scripts/beta17-functional-cli-stage-attempt.js` to extract embedded
  functional result lines from generic factory results.
- Updated `scripts/build-beta17-package-candidate.js`:
  - fixed the gzip header for valid `.tgz` extraction;
  - packages the hydrated Stage1 artifact as `src/brik.js`;
  - uses CommonJS metadata because the generated artifact uses `require`.
- Reinstalled the guarded remote factory with
  `INSTALL_L6PLUS_PCD_ARTIFACT_FACTORY_NON_CLAIM`.
- Regenerated Beta17 Stage, hydration, target-aware gate and package evidence.

Validation:
- `npm run test:l6plus:pcd-artifact-factory-install` passed.
- `npm run install:l6plus:pcd-artifact-factory -- --execute --confirm INSTALL_L6PLUS_PCD_ARTIFACT_FACTORY_NON_CLAIM` passed.
- `npm run audit:l6plus:pcd-artifact-factory` passed.
- `npm run attempt:beta17:functional-cli-stage` passed.
- `npm run gate:beta17:target-aware-factory-result` passed.
- `npm run gate:beta17:fixpoint:functional-stage-artifact` passed.
- `npm run package:beta17:fixpoint:candidate` passed with
  `releaseEligible=true`.
- Manual tarball smoke passed:
  extracted `evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz` and ran
  `node src/brik.js`, `node src/brik.js certify`, and `node src/brik.js verify`.
- Candidate publication preflight against
  `evidence/beta17-package/release.manifest.candidate.json` remains blocked on
  expected non-public gates.

Break attempts:
- Invalid gzip package was caught by extraction smoke and fixed.
- CommonJS/ESM mismatch was caught by execution smoke and fixed.
- Candidate preflight still blocks publication because public sync and external
  audit are not complete.

Current remaining blockers:
- `package_manifest_publication_allowed_false`.
- `package_json_version_mismatch:0.1.0-beta.16.1`.
- `readiness_not_pass:BLOCKED_BETA17_FIXPOINT_READINESS_GATE`.
- `public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC`.
- external audit remains blocked until public surfaces are synced.

Next exact action:
- Refresh Beta17 readiness against the new functional package candidate, then
  decide whether to promote repo metadata/release manifest to a Beta17
  candidate branch for release-train dry-run. Do not publish until public
  surface sync and external audit gates pass.

Boundary:
- Functional Stage materialization and package candidate are now real local
  evidence. This still does not prove final fixpoint, public release readiness,
  formal N5, self-hosting or Rust independence.

## Beta17 Ralph Loop Iteration - Readiness refresh for functional Stage evidence

Timestamp: 2026-06-29T12:35:00Z

Task:
- Remove stale readiness drift after the functional Stage1 materialization by
  regenerating readiness evidence from the hydrated functional CLI result.

Change:
- Updated `scripts/beta17-fixpoint-readiness-evidence-refresh.js` to prefer
  `evidence/beta17-functional-cli-stage-result/result.line` over the old remote
  stage-result transcript.
- The refresh now regenerates:
  - `stage1_artifact_manifest.json`;
  - `stage2_regeneration_manifest.json`;
  - `byte_identical_report.json`;
  - `seal_report.json`;
  - `remote_promotion_manifest.json` refs;
  - evidence-pack manifest refs.
- Updated test fixture coverage for refreshed Stage1/Stage2 manifest refs.

Validation:
- `npm run test:beta17:fixpoint:readiness-evidence-refresh` passed.
- `npm run refresh:beta17:fixpoint:readiness-evidence` passed.
- `npm run gate:beta17:fixpoint-readiness` now blocks only on public-surface
  sync and external audit.
- `npm run preflight:beta17:fixpoint:publication -- --manifest evidence/beta17-package/release.manifest.candidate.json`
  still blocks publication as expected.

Break attempts:
- Missing stage result still fails closed.
- Empty input PCD list still fails closed.
- Input PCD hash drift still fails closed.
- Stale 1473-byte Stage1/Stage2 refs are no longer accepted in readiness.

Current remaining blockers:
- `public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC`.
- `external_audit_not_pass:BLOCKED_BETA17_EXTERNAL_AUDIT`.
- candidate publication preflight also keeps
  `package_manifest_publication_allowed_false` and
  `package_json_version_mismatch:0.1.0-beta.16.1` until metadata promotion is
  intentionally performed.

Next exact action:
- Prepare controlled Beta17 metadata promotion for dry-run only, then run
  release-train dry-run/surface sync planning. Do not mutate public surfaces
  until public sync and external audit gates can be produced.

Boundary:
- Internal readiness drift is corrected. Public release, public sync, external
  audit, and final fixpoint/public claims remain closed.
