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
- Stage result validator: `npm run test:beta17:fixpoint:stage-result`
  validates the expected `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` payload shape.
  It rejects weak fixpoint results where Stage2 is not generated by Stage1,
  byte identity is false, artifact hashes/sizes diverge, adversarial coverage
  is insufficient, refs are unsafe, or public claim boundaries are open.
- Fixture stage materializer: `npm run test:beta17:fixpoint:stage-fixture`
  exercises the request/result contract end-to-end with deterministic local
  fixture artifacts. This is test infrastructure only; readiness must remain
  blocked until fixture/template reports are replaced by real L6+N5 Stage1 and
  Stage2 evidence plus public sync and external audit.
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
- Remote promotion gate: `npm run gate:beta17:fixpoint:remote-promotion`
  validates a passing remote attempt before any final evidence-pack promotion.
  It requires exactly one accepted attempt, complete transcript refs, a
  complete parsed stage-result ref, closed claim boundaries and no
  `fixtureMaterializer` evidence.
- Remote result promotion: `npm run promote:beta17:fixpoint:remote-result`
  copies only a promotion-gate-passing remote Stage1/Stage2 result into the
  canonical `evidence/beta17-fixpoint/` paths. It writes
  `remote_promotion_manifest.json` and keeps public/fixpoint claims closed
  until the full readiness gate and external audit pass.
- Readiness promotion binding: `gate:beta17:fixpoint-readiness` requires
  `evidence/beta17-fixpoint/remote_promotion_manifest.json` to pass with all
  public/fixpoint/formal claim boundaries closed. Manually placed Stage1/Stage2
  evidence is not enough.
- Next gate: `npm run test:beta17:fixpoint-readiness` and
  `npm run test:beta17:fixpoint:evidence:init` and
  `npm run test:beta17:fixpoint:stage-contract` and
  `npm run test:beta17:fixpoint:stage-request` and
  `npm run test:beta17:fixpoint:stage-result` and
  `npm run test:beta17:fixpoint:stage-fixture` and
  `npm run test:beta17:fixpoint:remote-stage` and
  `npm run test:beta17:fixpoint:remote-promotion` and
  `npm run test:beta17:fixpoint:remote-result-promotion`.
