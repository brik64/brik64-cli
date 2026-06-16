# BRIK64 CLI Beta15.4 Implementation Plan

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

## Phases

1. Reproduce and fix Rust app-polymer domain assertion scope.
2. Add Beta15.4 regression gate with core polymer, extended polymer, and app-system emission to TS/Python/Rust.
3. Version, package, and smoke Beta15.4 as a non-public candidate.
4. Materialize L6+N5 evidence pack for Beta15.4.
5. Only after all gates pass, synchronize public surfaces and publish atomically.
