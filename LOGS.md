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
