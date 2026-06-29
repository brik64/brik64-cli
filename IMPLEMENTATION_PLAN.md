# BRIK64 CLI Beta15.7.x Implementation Plan

## Beta15.7.1 Ralph Loop Update

- Iteration: `beta15.7.1-publication-readiness-loop`
- Lane: `cli_0_1_beta`
- Current focus: prevent a false-green Beta15.7.1 release train while the L6+N5 materializer still only proves the base Beta15.7 path.
- Full audit policy: every Beta15.7.x candidate must pass
  `gate:beta15.7:full-release-audit` before any release train can be green.
  The gate runs direct CLI checks, 128 monomers, TS/Python/Rust emitted tests,
  polymer app-system output, lift roundtrip, unsupported-lift warnings and
  adversarial fail-closed vectors in an isolated workspace.
- Publication policy: fail closed until `evidence/beta15_7-l6-generation/` is regenerated for the exact package version in `package.json` and `release/manifest.json`.
- Version-family policy: `0.1.0-beta.15.7.x` must use the shared evidence label `beta15_7`, but every report must bind the exact hotfix version.
- L6 materializer policy: the live endpoint may accept only the bounded
  `0.1.0-beta.15.7.x` family. It must reject later beta families, unsafe
  output refs and malformed requests.
- Current status: the live L6 materializer endpoint accepts
  `0.1.0-beta.15.7.1`, `gate:cli:l6-generation-required` passes, and
  `release:train:dry-run -- --allow-dirty` passes with
  `publicationAllowed=false` because the manifest is still draft.
- Publish-plan status: `release:train:publish-plan` supports
  `0.1.0-beta.15.7.1` hotfix labels and now fails closed on
  `manifest_state_not_public:draft` instead of failing on version parsing.
- SDK preflight status: the publish plan now inspects the local JS, Python and
  Rust SDK project versions and required marketplace artifacts before exposing
  mutation commands. SDK metadata has been aligned and pushed for review in
  JS PR #11, Python PR #13 and Rust PR #15. Local SDK artifacts now satisfy
  the publish-plan preflight; marketplace publication remains pending.
- Remaining publication work: executing the real mutation train still requires
  public-surface credentials and marketplace publication for the SDK versions
  declared in `release/manifest.json`. SDK PRs are now merged, but the active
  1Password service account only exposes vault `C-BIAS`, not `BRIK64`, so the
  release credential set is not available in this shell.
- Public manifest status: `release/manifest.json` has been promoted to
  `state=public` with `source.commitBinding=public_release_base_commit`, and
  `release:train:dry-run -- --allow-dirty` passes. Local publish-plan remains
  blocked by the unsigned local branch commit; the next publishable path is a
  GitHub-verified merge/ref followed by the `release-train-publish.yml`
  workflow, which has the required repository secrets configured.
- Public surface closure update: docs and public skills were synced manually
  from clean clones after the release workflow partially published Beta15.7.1.
  `release:train:live-verify` now passes against live public surfaces. The live
  verifier must keep the curl installer fallback for manifests that omit
  optional `cli.installCommand` metadata, so future public checks fail closed
  with verifier failures instead of JavaScript runtime exceptions.

## Beta17 Fixpoint Route Update

- Iteration: `beta17-materializer-route`.
- Lane: `l6plus_n5_self_host_fixpoint`.
- Current focus: prevent route confusion before remote mutation by auditing
  every materializer path as one of: accepted Beta17 Stage result, candidate
  local materializer, blocked provenance, blocked remote endpoint, rejected
  legacy beta15/beta16 materializer or rejected fixture/template.
- Publication policy: Beta17 remains blocked until a non-fixture Stage result
  passes the Beta17 validator and later Stage1/Stage2 byte/hash-identical
  gates pass with fresh evidence.
- Claim boundary: route-audit PASS only proves that a route-shaped Stage result
  is acceptable to the validator. It does not prove production fixpoint,
  publishability, formal N5 or self-hosting without the later readiness and
  release gates.
- Materializer generation update: Beta17 now has a distinct request bundle for
  generating the stage materializer itself:
  `evidence/beta17-fixpoint-materializer-generation-request/request.line`.
  This request must be consumed by L6+N5 before dispatcher install can become
  claim-bearing evidence. The existing Stage1/Stage2 request remains separate
  and must not be used to pretend that the materializer already exists.
- Materializer generation result update: Beta17 now has a result parser and
  validator for `BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT`. Future
  L6+N5 output must bind the generated materializer file, request hash, PCD
  input-set hash, engine serial, non-fixture content and closed claim boundary
  before deploy-plan or dispatcher install can consume it.
- Materializer generation attempt update: Beta17 now has a live attempt gate
  for the materializer-generation request. The gate probes L6+N5, requires
  endpoint capability `beta17_fixpoint_materializer_generator`, tries bounded
  generation commands and accepts only a validated
  `BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT`. Current live
  evidence is fail-closed: the host audit passes, but the wrapper mode is
  `unknown`, exposed capabilities remain
  `beta15_7_ready,beta16_native_ready,beta16_1_ready`, and no Beta17
  materializer-generation result is emitted.
- Remote result hydration update: the Beta17 materializer-generation attempt
  gate can now hydrate hash-bound base64 artifacts returned by a future remote
  generator endpoint before running the existing validator. This is required
  because the L6+N5 host cannot write generated materializer, generation-report
  or provenance files directly into the local workspace. Hydration is fail
  closed on unsafe refs, byte mismatch and SHA-256 mismatch.
- Optimized goal boundary update: Beta17 is now split into three explicit
  gates. Gate 1, materializer generation, is closed by the live
  `beta17_fixpoint_materializer_generator` endpoint and validated
  `PASS_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ATTEMPT` evidence. Gate 2,
  remote Stage1/Stage2 materialization, is closed by the installed
  `beta17_fixpoint_stage_dispatcher`, hydrated Stage result refs,
  `PASS_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT`,
  `PASS_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE` and
  `PASS_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION`. Gate 3, fixpoint readiness,
  remains blocked and is the next active focus.
- Readiness blockers are now package-level, not endpoint-level: missing
  canonical motor/harness manifests, input PCD hash list, evidence-pack
  manifest, public-surface sync report, external-audit report, plus
  byte-identity/seal report binding shape drift. Publication is out of scope
  until `gate:beta17:fixpoint-readiness`, public surface sync and external
  audit all pass with fresh evidence.
- Readiness evidence-pack update: Beta17 now has a reusable
  `refresh:beta17:fixpoint:readiness-evidence` command that derives canonical
  motor/harness manifests, `input_pcd_hashes.tsv`, enriched byte-identity and
  seal reports, an evidence-pack manifest, and explicit blocked public-sync /
  external-audit reports from the promoted remote Stage result. The refresh
  closes the previous missing-manifest and binding-drift blockers without
  opening publication or fixpoint claims. The readiness gate now blocks only on
  the expected live public-surface sync and external audit evidence.
- Public-surface sync contract update: Beta17 now has
  `sync:beta17:fixpoint:public-surfaces`, a fail-closed producer for
  `public_surface_sync_report.json`. It converts `release-train-live-verify`
  evidence into `PASS_BETA17_PUBLIC_SURFACE_SYNC` only when every required
  surface is observed at `0.1.0-beta.17`; otherwise it writes a blocked report
  with exact blockers. Current real evidence is blocked because the latest
  live verify report is still `0.1.0-beta.15.7.1`.
- External-audit status update: Beta17 now has
  `gate:beta17:fixpoint:external-audit-status`, which requires
  `PASS_BETA17_PUBLIC_SURFACE_SYNC` before external audit evidence can satisfy
  the release path. It reuses the strict external audit report validator and
  writes a status report under `evidence/beta17-fixpoint-external-audit-status/`.
- Release-train Beta17 dry-run update: `release:train:dry-run` now executes
  `gate:beta17:fixpoint:external-audit-status` explicitly for
  `0.1.0-beta.17`, so the public release preflight cannot rely only on the
  aggregate readiness report. The regression test also restores all Beta17
  evidence it mutates, keeping the worktree clean after checks.
- Publication preflight update: Beta17 now has
  `preflight:beta17:fixpoint:publication`, a non-mutating publication
  readiness gate that binds `release/manifest.json`, package tarball,
  `package.manifest.json`, required fixpoint evidence files, readiness,
  public-surface sync and external-audit status before any public mutation can
  be considered. Current real evidence is correctly blocked because the active
  release manifest and package metadata are still `0.1.0-beta.16.1`, public
  sync evidence is still based on live `0.1.0-beta.15.7.1`, and external audit
  remains blocked until public surfaces are synced to Beta17.
- Package candidate update: Beta17 now has
  `package:beta17:fixpoint:candidate`, a deterministic candidate-package
  builder that packages the current L6+N5 Stage1 artifact and Beta17 evidence
  into `evidence/beta17-package/` without mutating the active public
  `release/manifest.json`. The package manifest is intentionally
  `releaseEligible=false` and `publicationAllowed=false` while the Stage1
  artifact is only a small stage metadata module, not a full functional CLI
  artifact. This closes the metadata/package-location gap without opening a
  false publication path.
- Functional Stage artifact gate update: Beta17 now has
  `gate:beta17:fixpoint:functional-stage-artifact`, which requires the Stage1
  artifact to be hash-bound, byte-bound, sufficiently sized, executable as a
  Node CLI entrypoint, version-bound and command-dispatch capable. The current
  real Stage1 evidence is blocked with `stage1_artifact_too_small`,
  `stage1_artifact_missing_node_entrypoint`,
  `stage1_artifact_missing_argv_handling` and
  `stage1_artifact_missing_command_dispatcher`; therefore the package candidate
  remains `releaseEligible=false`.
- Functional CLI Stage request update: Beta17 now has a dedicated PCD source
  contract and request bundle for asking L6+N5 to materialize Stage1 as a full
  CLI artifact. `bundle:beta17:functional-cli-stage-request` produces
  `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_REQUEST` with the functional CLI
  requirements, required PCD hashes, output refs and closed claim boundary.
  This is input evidence only; it does not replace the future L6+N5 result or
  functional Stage artifact gate.
- Functional CLI Stage result validator update: Beta17 now has a parser and
  validator for `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`. The validator
  accepts only a result that binds the request hash, PCD input set, L6+N5
  serial, full Stage1 artifact bytes/base64, hash/byte refs, functional CLI
  markers and closed claim boundaries. This prepares safe hydration of a future
  remote L6+N5 result without allowing metadata-only or claim-overreaching
  payloads.
- Functional CLI Stage hydration update: Beta17 now has
  `hydrate:beta17:functional-cli-stage-result`, a fail-closed consumer for the
  future L6+N5 result line. It validates the result, decodes the Stage1
  artifact, writes only safe hash-bound refs, and produces a hydration report.
  Current live evidence is blocked because no
  `evidence/beta17-functional-cli-stage-result/result.line` exists yet.
- Functional CLI Stage attempt update: Beta17 now has
  `attempt:beta17:functional-cli-stage`, a single entrypoint for the optimized
  goal step between request generation and hydration. It consumes an explicit
  `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT` if supplied, validates it with
  the request manifest, runs the hydrator, and writes
  `evidence/beta17-functional-cli-stage-attempt/report.json`. It now also
  probes the L6+N5 wrapper with the functional CLI Stage request and records
  transcripts for the attempted remote commands. Current real evidence is
  fail-closed with `functional_cli_stage_result_unavailable`,
  `remote_l6plus_functional_cli_stage_endpoint_missing:beta15_7_ready,beta16_native_ready,beta16_1_ready`
  and `remote_l6plus_functional_cli_stage_result_not_emitted`, proving that
  the remaining blocker is a missing L6+N5 functional CLI Stage endpoint, not
  package metadata or local hydration plumbing.
- L6+N5 general factory audit update: the Beta17 route now explicitly rejects
  accumulating version-specific wrapper endpoints as the long-term generation
  model. `audit:l6plus:pcd-artifact-factory` requires the remote wrapper to
  expose `l6plus_pcd_artifact_factory` and emit
  `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT` for versioned PCD/polymer
  artifact requests. Current real evidence is fail-closed with only
  `beta15_7_ready,beta16_1_ready,beta16_native_ready` observed, no factory
  result marker, and `factory-status` unsupported. Beta17 materialization must
  route through this general factory before publication or fixpoint claims.

## Legacy Plan Context

The earlier Beta15.4 plan below remains historical context for the release-train
hardening style. Active work is now Beta15.7.x.

## Goal

Publish `BRIK64 CLI v0.1.0-beta.15.4` only after:

- Rust app-polymer domain codegen is corrected.
- The final artifact is generated from PCD/polymer through authorized L6+N5 evidence.
- Exhaustive CLI, generated-target, SDK, skills, docs, web, release-train, and live verification gates pass.

## Active Iteration

- Iteration: `beta15.4-rust-polymer-l6`
- Lane: `cli_0_1_beta`
- Current focus: keep the Beta15.4 candidate mergeable while publication remains blocked by version-specific L6+N5 materializer evidence.
- Publication policy: fail closed until `evidence/beta15_4-l6-generation/` satisfies `gate:cli:l6-generation-required`.
- Cross-repo evidence policy: `release:train:dry-run` must also consume the
  Beta15.4 materializer gap report from `brik64-prod` and reject legacy
  `0.1.0-beta.15` materialization evidence.
- Package policy: Beta15.4 package generation must be deterministic for frozen
  inputs; final release evidence and package hashes must be sealed together
  after the last evidence-generating gate run.
- L6 attempt policy: Beta15.4 materialization attempts must use
  `pcd/beta15_4/release/l6_cli_materialization_contract.pcd` as the release
  contract input and write blocked evidence if the host cannot accept it.
- Remote capability evidence policy: blocked attempts must record the Hetzner
  wrapper mode, wrapper hash, executed target hash and whether the materializer
  contract was accepted, so a healthy engine host cannot be mistaken for a
  CLI materializer endpoint.
- Endpoint result policy: the L6+N5 CLI materializer endpoint must emit
  `BRIK64_L6_CLI_MATERIALIZATION_RESULT\t<base64-json>` with version,
  PCD-to-artifact, artifact-to-package, package-to-release-manifest and seal
  hash bindings. The CLI consumer must reject stale versions, malformed hashes
  or missing bindings.
- Remote dispatcher policy: a fail-closed endpoint dispatcher is acceptable as
  operational progress only. It removes `shell_exec_only` ambiguity but must
  not satisfy release gates until a real materialization result is emitted and
  hash-bound.
- L6 provenance policy: a materialization result must include L6+N5 engine
  serial, materializer mode `l6plus_pcd_polymer_materializer`, generation trace
  hash, PCD input-set hash, remote wrapper hash and wrapper exec-target hash.
  Package and artifact hashes alone are not sufficient release evidence.
- Observed provenance binding policy: the materialization result must match
  the exact PCD input-set hash and remote wrapper / wrapper exec-target hashes
  observed during the current L6 attempt. Shape-valid provenance with arbitrary
  hashes must fail closed.
- Result contract policy: the Beta15.4 L6 input set includes a dedicated
  `l6_cli_materialization_result_contract.pcd` describing the required
  `BRIK64_L6_CLI_MATERIALIZATION_RESULT` closure: CLI scope, result emission,
  L6 serial, materializer mode, observed hash matches, artifact/package/release
  bindings and seal pass.
- Required input PCD policy: the materialization result payload must list every
  required input PCD path. A payload with the right aggregate hash but missing
  `inputPcds` entries fails closed.
- Result file-ref policy: the materialization result payload must include
  relative, safe file refs for generated artifact, package, release manifest
  and seal report. The artifact/package/release refs must match the declared
  hashes, so a result cannot pass with detached hash strings only.
- PCD result-closure policy: `l6_cli_materialization_result_contract.pcd`
  must encode the same file-ref closure as domains, including safe refs and
  ref-hash matches for generated artifact, package and release manifest plus a
  safe seal-report ref.
- Materialization evidence file policy: when validating a real endpoint result,
  the CLI consumer must resolve every declared evidence file ref under the
  active workspace root and verify that the file exists and hashes to the
  declared SHA-256.
- Materialization input PCD file policy: when validating a real endpoint result,
  every declared input PCD ref must resolve under the active workspace root,
  exist as a file and hash to its declared SHA-256. A future endpoint cannot
  satisfy the aggregate input-set hash with stale, missing, tampered or unsafe
  per-PCD references.
- Materializer request bundle policy: each Beta15.4 L6 attempt must generate a
  reproducible `BRIK64_L6_CLI_MATERIALIZATION_REQUEST` bundle containing the
  exact canonical input PCDs, per-file hashes, base64 content, output refs,
  required result schema and claim boundary. This is input evidence only; it
  does not satisfy release gates without a matching L6 result.
- Request-result binding policy: an accepted
  `BRIK64_L6_CLI_MATERIALIZATION_RESULT` must include
  `materializerRequestSha256` matching the exact `request.line` generated for
  the current attempt. A result for a different request, stale request or
  reconstructed input fails closed.
- Release-train gap report policy: `release:train:dry-run` must validate the
  Beta15.4 materializer gap report through a reusable strict validator, not an
  inline decision-only check. A future `BETA15_4_CLI_L6_MATERIALIZER_GAP_PASS`
  report must include coherent L6 attempt checks, exact request-bundle checks,
  package eligibility, materializer request hash context and public-claim
  boundaries before it can unblock publication.
- Candidate release manifest policy: `release/manifest.json` must match the
  active CLI candidate version exactly. Matching `package.json` is not enough;
  a stale release manifest must fail the L6 generation required gate.
- Source commit binding policy: draft candidate manifests may use
  `source.commitBinding = candidate_base_commit` because a manifest cannot
  hash-bind to the commit that contains itself. Public manifests must use
  `source.commitBinding = release_ref_exact` and match the verified release
  commit/ref.
- Materializer output ref policy: the L6 materializer request must point to the
  actual candidate package artifact path. For Beta15.4 this is
  `evidence/beta15_4-package/brik64-cli-0.1.0-beta.15.4.tgz`.
- Route-2 compatibility policy: Beta15.4 PCDs consumed directly by the current
  L6 route-2 emitter must stay inside its observed subset: untyped function
  parameters, no `domain` declarations, direct return branches, no nested
  branch without direct return and no unsupported `<`/`>` guards. Richer public
  PCD syntax remains a CLI/parser concern until the L6 route-2 emitter is
  upgraded and re-evidenced.
- Direct L6 materialization policy: if the fail-closed dispatcher is not yet
  backed by a result emitter, the release train may consume a direct L6 route-2
  materialization only when the exact L6 binary hash, input PCD hashes,
  generated artifact hash, package hash, release manifest hash and seal report
  are recorded in the Beta15.4 evidence pack.

## Phases

1. Reproduce and fix Rust app-polymer domain assertion scope.
2. Add Beta15.4 regression gate with core polymer, extended polymer, and app-system emission to TS/Python/Rust.
3. Version, package, and smoke Beta15.4 as a non-public candidate.
4. Materialize L6+N5 evidence pack for Beta15.4.
5. Only after all gates pass, synchronize public surfaces and publish atomically.

## Active Beta15.7.1 Release Continuation

- PR: https://github.com/brik64/brik64-cli/pull/203
- Branch: `codex/beta15-7-1-publication-gate`
- Current focus: pass PR CI after public manifest promotion without weakening
  real publication preflight.
- Dry-run policy: `release:train:dry-run` may run before sibling SDK repos are
  prepared, so SDK local-artifact preflight is warning-only while
  `BRIK64_RELEASE_TRAIN_DRY_RUN_IN_PROGRESS=1`.
- Publish policy: `release:train:publish-plan` outside dry-run still fails
  closed unless SDK artifacts, marketplace credentials, exact confirmation and
  GitHub verified signature gates pass.
- Next gate: push the PR dry-run routing fix, wait for PR #203 checks, then
  merge through GitHub verified ref before dispatching the release workflow.

## Active Beta17 Fixpoint Ralph Loop

- Lane: `l6plus_n5_self_host_fixpoint`.
- Branch: `codex/beta17-fixpoint-readiness-gate`.
- Current focus: add a fail-closed readiness gate before any Beta17 fixpoint
  publication attempt.
- Policy: Beta17 is not public-release-ready until canonical motor and harness
  PCD/polymer manifests, Stage1 L6+N5 artifact, Stage2 regeneration by Stage1,
  byte-identical comparison, harness report, seal report, public surface sync
  report, and external audit report are all present and passing.
- Evidence pack scaffold: `npm run beta17:fixpoint:evidence:init` creates
  `evidence/beta17-fixpoint/` template files only. Those files are marked
  `TEMPLATE_NON_CLAIM` and must remain rejected by
  `gate:beta17:fixpoint-readiness` until replaced by fresh claim-bearing
  artifacts.
- Stage contract gate: `npm run gate:beta17:fixpoint:stage-contract` validates
  the Beta17 Stage1 and Stage2 PCD contracts before any materialization script
  can be treated as release-relevant. Stage2 must explicitly bind regeneration
  from Stage1 and byte-identical hash/size comparison.
- Stage request bundle: `npm run bundle:beta17:fixpoint:stage-request`
  creates a non-claim request for an L6+N5 fixpoint materializer. It includes
  canonical Stage1/Stage2 contracts, CLI core/polymer PCD inputs, safe output
  refs and required result bindings for Stage1, Stage2, byte identity, harness
  and seal evidence.
- Remote endpoint install contract: `npm run attempt:beta17:fixpoint:remote-stage`
  now records the exact required L6+N5 endpoint capability
  `beta17_fixpoint_stage_dispatcher`, the materialization commands it tries
  and the required `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` marker. Healthy host
  audit, beta15.7/beta16 endpoints, fixture results and manual artifact patches
  are recorded as non-acceptable substitutes.
- Remote dispatcher deployment preflight: `npm run preflight:beta17:fixpoint:remote-dispatcher`
  validates a non-claim `deploy-plan.json` before any Hetzner mutation. The
  preflight requires a Beta17 dispatcher capability, a non-legacy L6+N5
  materializer ref, local hash/byte binding, required stage-result marker,
  closed claim boundaries and explicit rejection of beta15.7/beta16 endpoints,
  fixtures and manual patches as substitutes.
- Remote dispatcher deploy-plan generation: `npm run plan:beta17:fixpoint:remote-dispatcher`
  converts a candidate local Beta17 materializer file into a non-claim,
  hash-bound deploy plan only when a separate materializer provenance manifest
  binds the same file path, SHA-256, byte count, L6+N5 serial, PCD input-set
  hash and closed claim boundaries. Missing files, paths outside the workspace,
  missing provenance, provenance mismatches and legacy beta15/beta16 remote
  materializer paths fail closed before any remote installation step.
- Materializer provenance generation: `npm run provenance:beta17:fixpoint:materializer`
  creates the required non-claim provenance manifest from a candidate
  materializer plus explicit PCD inputs. It computes the PCD input-set hash from
  real file path/SHA-256/byte rows and keeps public release, definitive
  fixpoint, formal N5 and universal correctness boundaries closed.
- Standalone materializer provenance gate:
  `npm run gate:beta17:fixpoint:materializer-provenance` validates an existing
  provenance manifest against current workspace files. It rejects stale
  materializer refs, tampered PCD inputs, invalid serials and open claim
  boundaries before deploy-plan generation or installation can consume the
  manifest.
- Remote dispatcher installation dry-run: `npm run install:beta17:fixpoint:remote-dispatcher`
  validates the deploy plan again, verifies the local materializer hash and
  byte count, then emits an auditable `install-script.sh` that installs the
  materializer and patches the L6+N5 wrapper for the Beta17 dispatcher. Remote
  mutation requires explicit `--execute --confirm
  INSTALL_BETA17_FIXPOINT_DISPATCHER_NON_CLAIM`.
- Remote dispatcher executed-install proof: when remote mutation is explicitly
  enabled, the installer must observe
  `BRIK64_BETA17_DISPATCHER_INSTALL_RESULT` in SSH stdout with `installed`, the
  expected materializer SHA-256 and the expected host. SSH status alone is not
  enough evidence that the Beta17 dispatcher was installed.
- Required-inputs gate: `npm run gate:beta17:fixpoint:required-inputs` writes
  `evidence/beta17-fixpoint-required-inputs/report.json` and fails closed until
  the exact inputs needed for the Beta17 fixpoint lane exist: canonical PCDs,
  non-fixture L6+N5-generated materializer, materializer provenance, deploy
  plan, executed dispatcher install evidence, passing remote stage attempt and
  remote promotion artifacts. This gate is diagnostic and operational; it is
  not materialization evidence.
- Release-train required-inputs binding: `release:train:dry-run` for
  `0.1.0-beta.17` runs the required-inputs gate before the readiness gate and
  records the required-inputs report path/SHA-256/bytes in `requiredEvidence`.
  This keeps missing materializer/provenance/install/promotion inputs visible
  even when later readiness fixtures or reports exist.
- Stage result validator: `npm run test:beta17:fixpoint:stage-result`
  validates the expected `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` payload shape.
  It rejects weak fixpoint results where Stage2 is not generated by Stage1,
  byte identity is false, artifact hashes/sizes diverge, adversarial coverage
  is insufficient, refs are unsafe, or public claim boundaries are open.
- Stage result ref-size binding: every Stage result file ref must include
  `bytes` in addition to path and SHA-256. When validated with a workspace
  root, the validator compares both file hash and file size, so detached refs
  or partially copied evidence cannot satisfy the result contract.
- Stage result manifest binding: when run with a workspace root, the Stage
  result validator reads Stage1/Stage2 manifest refs and rejects manifests
  that do not bind the Stage artifact SHA-256 values declared by the result.
  Stage2 must also bind the Stage1 artifact SHA-256 it claims to regenerate
  from before any promotion gate can consume the result.
- Stage result input-set binding: the Stage result validator recomputes
  `pcdInputSetSha256` from the result's own `inputPcds` path/SHA-256/bytes
  table. Detached or silently altered PCD input sets fail before promotion.
- Fixture stage materializer: `npm run test:beta17:fixpoint:stage-fixture`
  exercises the request/result contract end-to-end with deterministic local
  fixture artifacts. This is test infrastructure only; readiness must remain
  blocked until fixture/template reports are replaced by real L6+N5 Stage1 and
  Stage2 evidence plus public sync and external audit.
- Evidence manifest generator: `npm run beta17:fixpoint:evidence:manifest`
  regenerates the Beta17 evidence-pack manifest as a reusable command. The
  init flow now consumes the same generator, so future promotion/live-audit
  steps can refresh file/SHA refs without duplicating manifest semantics.
- Evidence manifest freshness: `node scripts/beta17-fixpoint-evidence-pack-manifest.js --check`
  validates that the current evidence directory still matches
  `evidence_pack_manifest.json`. A stale manifest must fail closed before any
  release-readiness or publication path can treat the pack as current.
- Evidence aggregate binding: `gate:beta17:fixpoint-readiness` validates the
  manifest's aggregate `packSha256` over its file refs and requires all public,
  definitive fixpoint, formal N5 and universal correctness boundaries to stay
  closed inside the evidence-pack manifest.
- Input PCD binding: `gate:beta17:fixpoint-readiness` treats
  `input_pcd_hashes.tsv` as a concrete file/hash contract. Each non-comment row
  must contain a safe relative PCD path, a valid SHA-256 and an existing file
  whose hash matches. Placeholder hashes cannot satisfy readiness.
- Promoted artifact binding: `gate:beta17:fixpoint-readiness` requires the
  remote promotion manifest to include Stage1 and Stage2 artifact refs. Those
  refs must use safe workspace-relative paths, point to existing files and
  match the declared SHA-256.
- Stage manifest artifact binding: `gate:beta17:fixpoint-readiness` requires
  the Stage1 artifact manifest to bind the promoted Stage1 artifact SHA-256,
  and the Stage2 regeneration manifest to bind both the promoted Stage2
  artifact SHA-256 and the promoted Stage1 artifact SHA-256 it claims to
  regenerate from.
- Seal binding: `gate:beta17:fixpoint-readiness` requires `seal_report.json`
  to hash-bind the promoted Stage1 artifact, promoted Stage2 artifact and
  `input_pcd_hashes.tsv`. A generic `sealed=true` report is insufficient.
- Byte-identity binding: `gate:beta17:fixpoint-readiness` requires
  `byte_identical_report.json` to hash-bind Stage1 and Stage2 artifact SHA-256
  values and byte sizes to the promoted artifact files. A generic
  `byteIdentical=true` report is insufficient.
- Public-surface sync matrix: `gate:beta17:fixpoint-readiness` requires
  `public_surface_sync_report.json` to include passing `surfaceChecks` for
  `cli_installer`, `cli_manifest`, `docs`, `web_changelog` and `skills`, each
  pinned to `0.1.0-beta.17`.
- Readiness hardening: `gate:beta17:fixpoint-readiness` rejects any Stage1,
  Stage2, byte-identity, harness or seal report marked `fixtureMaterializer`.
  Fixture evidence may test the contract, but it can never authorize Beta17
  publication.
- Remote attempt transcript policy: accepted remote attempts must validate the
  complete parsed `BRIK64_BETA17_FIXPOINT_STAGE_RESULT`, not the truncated
  human `observed` preview. The full parsed stage result is persisted as a
  hash-bound transcript ref so a long Stage1/Stage2 payload can be promoted
  only after independent validation.
- Remote stage attempt: `npm run attempt:beta17:fixpoint:remote-stage` consumes
  the Beta17 stage request, probes the configured L6+N5 wrapper and accepts
  only a valid `BRIK64_BETA17_FIXPOINT_STAGE_RESULT`. In skip or unavailable
  modes it writes `evidence/beta17-fixpoint-remote-attempt/report.json` and
  probe/attempt transcripts with a blocked decision and keeps publication
  disabled.
- Remote endpoint capability diagnosis: the remote attempt parser accepts both
  tab-separated and literal `\t` endpoint status lines. If the L6+N5 host lacks
  `beta17_fixpoint_stage_dispatcher`, the report records the installed
  capabilities instead of only `missing` or `unknown`.
- Remote-stage remediation commands: a blocked
  `attempt:beta17:fixpoint:remote-stage` report now includes structured
  `remediationCommands` for provenance, dispatcher plan, preflight, guarded
  install, retry, promotion and readiness gates. This keeps the missing
  dispatcher blocker actionable without treating install instructions as
  materialization evidence.
- Remote-stage remediation plan: the same blocked report now includes
  `remediationPlan` with required inputs, step ids and stop rules. The plan
  requires a non-fixture L6+N5-generated materializer, canonical input PCDs and
  an authorized `BRIK64-L6PLUS-N5-` serial, and stops on command failure,
  open claims, fixture/manual evidence or non-byte-identical Stage1/Stage2.
- Live remote-stage blocker evidence: a fresh non-mutating
  `attempt:beta17:fixpoint:remote-stage` run confirms the configured L6+N5 host
  exposes `beta15_7_ready,beta16_native_ready,beta16_1_ready` and legacy result
  signals, but not `beta17_fixpoint_stage_dispatcher`. The report captures
  wrapper and exec-target SHA-256/byte refs plus endpoint signals under
  `evidence/beta17-fixpoint-remote-attempt/`.
- Remote promotion gate: `npm run gate:beta17:fixpoint:remote-promotion`
  validates a passing remote attempt before any final evidence-pack promotion.
  It requires exactly one accepted attempt, complete transcript refs, a
  complete parsed stage-result ref, closed claim boundaries and no
  `fixtureMaterializer` evidence.
- Remote promotion revalidation: the promotion gate reloads the accepted
  Stage result JSON from its hash-bound transcript ref and reruns
  `validateStageResult` with the remote attempt's expected context. A stale or
  tampered `stage-result.json` cannot be promoted merely because the attempt
  report says `accepted=true`.
- Remote result promotion source-size binding:
  `beta17-fixpoint-promote-remote-result.js` verifies every Stage result source
  ref declares `bytes` matching the source file before copying it into
  `evidence/beta17-fixpoint/`. A source ref with correct SHA-256 but stale or
  missing byte metadata fails closed.
- Release-train readiness evidence binding: for `0.1.0-beta.17`,
  `release:train:dry-run` records the exact
  `evidence/beta17-fixpoint-readiness/report.json` path, SHA-256 and byte
  count in `requiredEvidence`, so the release report is tied to the readiness
  gate artifact it consumed.
- Accepted attempt stdout/result binding: the promotion gate parses the
  accepted attempt stdout transcript and requires its
  `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` payload to match the hash-bound
  `stage-result.json` ref. A report cannot pair one stdout transcript with a
  different Stage result file.
- Remote promotion ref byte validation: every file ref consumed by the
  promotion gate must declare `bytes` and the value must match the referenced
  file size, alongside SHA-256 validation. Detached metadata fails closed.
- Remote promotion request binding: the promotion gate validates the remote
  attempt's `request` ref, reruns `validateRequest`, recomputes the
  `BRIK64_BETA17_FIXPOINT_STAGE_REQUEST` line SHA-256 and uses request-derived
  context when revalidating the accepted Stage result. A fabricated
  `expectedContext` cannot authorize promotion.
- Remote result promotion: `npm run promote:beta17:fixpoint:remote-result`
  copies only a promotion-gate-passing remote Stage1/Stage2 result into the
  canonical `evidence/beta17-fixpoint/` paths. It writes
  `remote_promotion_manifest.json` and keeps public/fixpoint claims closed
  until the full readiness gate and external audit pass.
- Remote result target verification: after copying promoted evidence files into
  canonical paths, the promotion manifest records the target file path, bytes
  and SHA-256 and blocks if the copied target does not match the source ref.
  This keeps the final promotion boundary tied to the actual canonical files,
  not only the remote source refs.
- External workspace promotion: remote result promotion invokes its gate by
  absolute script path while using `BRIK64_CLI_ROOT` as the evidence workspace.
  This allows clean external audit workspaces to promote evidence without
  requiring a local `scripts/` directory inside the evidence root.
- Readiness promotion binding: `gate:beta17:fixpoint-readiness` requires
  `evidence/beta17-fixpoint/remote_promotion_manifest.json` to pass with all
  public/fixpoint/formal claim boundaries closed. Manually placed Stage1/Stage2
  evidence is not enough.
- Promotion ref binding: readiness compares the promotion manifest's promoted
  Stage1, Stage2, byte-identity, harness and seal refs against the exact files
  it evaluates, including SHA-256. Detached or manually swapped evidence fails
  closed.
- Promotion target binding: readiness requires promoted Stage artifact refs to
  include `target` metadata matching the canonical promoted file path,
  SHA-256 and byte count. Older promotion manifests without target-copy proof
  remain blocked.
- Promotion source binding: readiness requires promoted Stage artifact refs to
  include `source` metadata binding the canonical promoted file back to the
  source/remote evidence SHA-256. Target-only promotion manifests remain
  blocked.
- Promotion source byte binding: remote result promotion records
  `source.bytes`, and readiness requires that value to match the canonical
  promoted artifact size. Source refs with detached byte metadata fail closed.
- Release train binding: `release:train:dry-run` routes `0.1.0-beta.17`
  candidate branches and manifest-driven runs through
  `gate:beta17:fixpoint-readiness`. In candidate mode it also records
  `beta17_fixpoint_readiness` as required evidence and rejects missing,
  blocked or claim-boundary-invalid readiness reports.
- External audit contract: `gate:beta17:fixpoint-readiness` rejects superficial
  external audit reports. A passing `external_audit_report.json` must prove a
  clean public install, functional CLI tests, generated-code tests,
  adversarial tests, public-surface scan and claim-safe scan before Beta17 can
  become release-ready.
- External audit prompt: `docs/ops/BETA17_EXTERNAL_AUDIT_PROMPT.md` is the
  canonical instruction packet for producing `external_audit_report.json`.
  The evidence-pack template points auditors to this prompt and exposes the
  same required contract fields used by the readiness gate.
- External audit validator: `scripts/beta17-external-audit-report-validate.js`
  is the reusable validator for `external_audit_report.json`. Readiness imports
  it instead of duplicating the contract inline, so external agents, CI and the
  release gate share one decision boundary.
- External audit artifact binding: a passing `external_audit_report.json` must
  include hash-bound artifact refs for the audit log, generated-code quality
  report, adversarial results, public-surface scan and claim-safe scan. The
  validator verifies safe relative paths, file existence, SHA-256 and byte
  counts when run from the evidence workspace.
- Evidence pack manifest: `evidence/beta17-fixpoint/evidence_pack_manifest.json`
  inventories the Beta17 evidence pack with path/SHA-256/bytes refs. Readiness
  validates the manifest schema, version, closed public/formal claim boundaries
  plus SHA-256 and byte-count agreement for every evidence file it evaluates.
- Evidence pack manifest adversarial coverage: readiness tests now mutate the
  manifest to prove SHA-256 mismatch and missing-ref cases fail closed before
  any Beta17 release train can pass.
- Next gate: `npm run test:beta17:fixpoint-readiness` and
  `npm run test:beta17:fixpoint:evidence:init` and
  `npm run test:beta17:external-audit-prompt` and
  `npm run test:beta17:external-audit-report` and
  `npm run test:beta17:fixpoint:stage-contract` and
  `npm run test:beta17:fixpoint:stage-request` and
  `npm run test:beta17:fixpoint:stage-result` and
  `npm run test:beta17:fixpoint:stage-fixture` and
  `npm run test:beta17:fixpoint:remote-stage` and
  `npm run test:beta17:fixpoint:remote-promotion` and
  `npm run test:beta17:fixpoint:remote-result-promotion` and
  `npm run test:beta17:release-train-readiness`.

- Materializer provenance content gate: `beta17-fixpoint-materializer-provenance.js`
  now validates the referenced materializer content, not just its path/hash/bytes.
  Candidate materializers must include the `BRIK64_BETA17_FIXPOINT_STAGE_RESULT`
  marker and must not use the literal `<base64-json>` placeholder or fixture/template
  markers. This keeps downstream dispatcher plans from accepting a placeholder as
  a deployable Beta17 materializer.
- Dispatcher test fixtures now emit a non-claim base64 JSON test vector for valid
  cases. The placeholder string remains only as an adversarial rejection case.
- Next gate remains unchanged: install or generate a real Beta17 L6+N5 stage
  dispatcher/materializer, run the guarded remote stage, promote the resulting
  Stage1/Stage2 evidence, and only then re-run readiness/release train gates.

- Remote dispatcher install-script validation: `beta17-fixpoint-remote-dispatcher-install.js`
  now treats the generated install script itself as a gate artifact. A dry-run
  cannot pass unless the script contains the Beta17 endpoint marker, required
  capability, stage status/materialize commands, result marker check, exact
  materializer remote path and no beta15/beta16 legacy endpoint references. The
  remote install script also greps the uploaded materializer for
  `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` after verifying SHA-256 and before
  installing it.
- Next gate remains the same: run the guarded install only with a real
  L6+N5-generated Beta17 materializer, then attempt remote stage and promote
  evidence only if Stage1 and Stage2 are byte-identical.

- Dispatcher install dry-run report binding: `install-report.json` now records
  the validated install-script contract together with the hash-bound local
  materializer and materializer provenance refs from the deploy plan. This makes
  the review artifact sufficient to answer which script was validated, which
  materializer it would install and which provenance file authorizes that
  materializer before executing the guarded remote install.

- Remote stage pre-execution gate: `attempt:beta17:fixpoint:remote-stage` now
  requires an executed Beta17 dispatcher `install-report.json` before attempting
  materialization commands. The report must show the Beta17 capability, executed
  install decision, closed claim boundary, accepted install-script validation,
  required materialize command and materializer/provenance refs. Missing or
  dry-run-only install evidence is a hard blocker.

- Remote promotion install-evidence binding: `gate:beta17:fixpoint:remote-promotion`
  now requires the accepted remote attempt to include `installEvidence.reportRef`
  bound to an executed Beta17 dispatcher install report. A passing remote stage
  attempt without executed dispatcher install evidence is no longer promotable.
  `promote:beta17:fixpoint:remote-result` inherits this gate because it invokes
  the remote promotion gate before copying canonical evidence.

- Readiness source-promotion binding: `gate:beta17:fixpoint-readiness` now reads
  `remote_promotion_manifest.sourcePromotionReport`, verifies the referenced
  remote promotion gate report by SHA/bytes, and requires that report to include
  executed Beta17 dispatcher install evidence. A standalone promotion manifest
  is no longer enough to unlock Beta17 readiness or release-train dry-run.

- Current live blocker evidence refreshed after readiness/promotion hardening:
  `evidence/beta17-fixpoint-remote-attempt/report.json` now reflects the active
  pre-execution guard. The live host still advertises only beta15.7/beta16
  capabilities, and the Beta17 attempt stops before materialization commands
  because no executed dispatcher install report exists.

## Beta17 General Factory Update

- L6+N5 general factory audit: the Beta17 route now rejects accumulating
  version-specific wrapper endpoints as the generation model. The required
  capability is `l6plus_pcd_artifact_factory`, and the required result marker
  is `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT`. Current real wrapper evidence
  remains blocked: observed capabilities are only
  `beta15_7_ready,beta16_1_ready,beta16_native_ready`, the factory result marker
  is absent, and `factory-status` is unsupported.
- General factory install dry-run: `install:l6plus:pcd-artifact-factory` now
  produces a guarded installer for a reusable wrapper capability. The generated
  factory accepts `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_REQUEST`, supports artifact
  kinds `cli`, `sdk`, `harness`, `engine`, `docs` and `evidence-pack`, emits
  `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT`, and keeps public/fixpoint/formal
  claim boundaries closed. Current evidence is dry-run only; remote mutation
  requires `--execute --confirm INSTALL_L6PLUS_PCD_ARTIFACT_FACTORY_NON_CLAIM`.
- Beta17 materialization must route through this general factory before
  publication or fixpoint claims. A version-specific Beta17 endpoint is not the
  optimized target architecture.
- Remote factory validation update: the guarded remote install has now passed
  with `PASS_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL`, and the live wrapper audit
  passes with `PASS_L6PLUS_PCD_ARTIFACT_FACTORY_AUDIT`. The wrapper discrepancy
  is corrected at the routing/capability layer: `factory-status` is supported,
  `l6plus_pcd_artifact_factory` is advertised, and
  `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT` is emitted.
- Remaining Beta17 blocker: the installed factory currently emits a generic
  artifact-factory result, not the Beta17-specific
  `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`. The functional CLI Stage attempt
  now routes through `artifact-factory-materialize` and fails closed on
  `remote_l6plus_factory_result_not_functional_cli_stage_result`. This is the
  correct next boundary: L6+N5 needs a target-aware factory materializer that
  can produce the functional CLI Stage result from PCD/polymer inputs, without
  turning the non-claim wrapper bridge into fixpoint/self-hosting evidence.
- Target-aware factory result gate update:
  `gate:beta17:target-aware-factory-result` now validates the output of
  `artifact-factory-materialize` as a target-aware Beta17 CLI Stage output. A
  generic `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT` is not sufficient unless
  it carries or embeds a valid `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`.
  Current real evidence is blocked with missing target result line, non
  target-aware factory result and non-functional Node CLI artifact blockers.
- Target-aware materialization update: the L6+N5 factory bridge now emits an
  embedded `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT` for the Beta17 CLI
  request, and `attempt:beta17:functional-cli-stage` hydrates the Stage1 CLI
  artifact successfully. `gate:beta17:target-aware-factory-result` and
  `gate:beta17:fixpoint:functional-stage-artifact` pass. The package candidate
  now extracts and executes basic commands from the generated artifact instead
  of shipping the previous aborting stub. Publication remains blocked by
  metadata promotion, readiness, public-surface sync and external audit.
- Readiness refresh update: readiness evidence now derives from the hydrated
  functional CLI Stage result when present, regenerates Stage1/Stage2 manifests,
  byte-identity and seal reports for the 190315-byte functional artifact, and
  refreshes remote-promotion refs. `gate:beta17:fixpoint-readiness` now blocks
  only on public-surface sync and external audit evidence, not on stale Stage
  artifact drift.
- Candidate preflight semantics update: `preflight:beta17:fixpoint:publication`
  now separates candidate package readiness from public publication
  authorization. For `state=candidate` manifests, a package manifest with
  `releaseEligible=true` and `publicationAllowed=false` is valid
  candidate-ready evidence and emits a warning instead of the false
  `package_manifest_publication_allowed_false` blocker. Public manifests still
  require `publicationAllowed=true`. The real candidate preflight now blocks
  only on active metadata promotion, public-surface sync and external audit.
- Candidate release-manifest evidence update: `package:beta17:fixpoint:candidate`
  now writes `verification.requiredEvidence` as structured evidence items
  with `id`, `path` and `decision`, and `release:train:dry-run` supports
  `decision=FILE_EXISTS` for binary artifacts such as the CLI tarball. This
  keeps the candidate manifest consumable by the release train without forcing
  binary packages through JSON report parsing.
- Active candidate metadata update: Beta17 now has an explicit candidate-mode
  release-train gate. `package.json` and `release/manifest.json` can point to
  `0.1.0-beta.17` while `release/manifest.json.state=candidate`; in that
  state `release:train:dry-run` validates the generated package candidate and
  expected publication blockers through `gate:beta17:candidate-release-train`
  instead of running the public mutation path. `tests/smoke.sh` also switches
  to the generated Beta17 tarball in this mode, so CI validates the L6+N5
  materialized artifact rather than the historical source tree.
- Required-inputs wrapper reconciliation: `gate:beta17:fixpoint:required-inputs`
  now accepts the current executed dispatcher-install evidence contract used by
  the remote stage attempt and promotion gates. The install marker is validated
  from `execution.installResult`, the dispatcher capability/script binding is
  checked, and accepted remote attempts may be recorded as
  `stageResultValidation.accepted`. This closes the false blocker where the
  wrapper had executed correctly but the required-inputs gate was still reading
  an older `remoteInstallResult`/top-level `accepted` shape.
- Pre-publication mutation gate: Beta17 now has an explicit
  `gate:beta17:pre-publication-mutation` for the release-train handoff from a
  validated local candidate to public-surface mutation. The gate requires
  `release/manifest.json.state=public`, hash-bound CLI package evidence,
  `PASS_BETA17_FIXPOINT_REQUIRED_INPUTS`, closed public/fixpoint/formal claim
  boundaries, and all local evidence-pack files. It deliberately does not
  require public-surface sync or external audit, because those are post-mutation
  gates. `publicationMutationAllowed=true` is therefore not the same as
  `publicationAllowed=true`; final public readiness remains gated by live verify
  and external audit.
