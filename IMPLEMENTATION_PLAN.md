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

## Phases

1. Reproduce and fix Rust app-polymer domain assertion scope.
2. Add Beta15.4 regression gate with core polymer, extended polymer, and app-system emission to TS/Python/Rust.
3. Version, package, and smoke Beta15.4 as a non-public candidate.
4. Materialize L6+N5 evidence pack for Beta15.4.
5. Only after all gates pass, synchronize public surfaces and publish atomically.
