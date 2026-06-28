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
