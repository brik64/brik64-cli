# BRIK64 CLI PCD Seeds

This directory contains the public beta PCD seed material for the local `brik`
CLI. These files describe the intended command structure and composition path
used to move the CLI toward a PCD-first BRIK64 methodology.

## Current Role

- `src/brik.js` remains the executable CLI source for the current beta.
- `cli_core.pcd`, `cli_init_policy.pcd`, and `cli_certify_emit.pcd` describe
  candidate command contracts.
- `cli_polymer.pcd` describes the candidate composition contract that binds the
  command PCD seeds before a future compile route.
- `l6_full_cli_generation_factory.pcd` describes the beta6 internal factory
  contract that the serialized L6+N5 Hetzner engine must satisfy before a
  public beta6 artifact can be generated from the CLI polymer.
- `beta6_package_harness.pcd` describes the package/release harness logic for
  the first beta6 generated harness target. The current target is `js_node` for
  CI and release-train compatibility; it remains non-release until materialized
  by the serialized L6+N5 factory.
- The files in this directory are review material for beta methodology, package
  inspection, and future compiler-aligned work.
- `cli_beta9_transpiler_contract.pcd` is the beta9 source contract for the
  compiler/scaffold/token-isolation changes. It is not sufficient for release
  by itself; beta9 promotion also requires a materialization report proving the
  final artifact was generated from the PCD/polymer inputs through the internal
  L6+N5 factory.
- `cli_beta10_modular_diagnostics_contract.pcd` is the beta10 source contract
  for local import DAGs, literal constants, `explain`, `lock`, local telemetry
  status, feedback dry-run, and redacted local error reports. It is a
  Carril A product contract only and does not claim formal N5, self-hosting, or
  fixpoint.

## Promotion Path

Before these seeds can support stronger public release language, BRIK64 must:

1. Complete candidate PCD coverage for CLI behavior.
2. Certify candidate PCDs with the active gate stack.
3. Validate the polymer/composition PCD against command PCDs.
4. Satisfy `l6_full_cli_generation_factory.pcd` through the serialized L6+N5
   factory, including source, artifact, package and release manifest hashes.
5. Materialize `beta6_package_harness.pcd` through L6+N5, not through a manual
   script, and bind the harness artifact to package/release manifests.
6. For beta9 and later, materialize the version contract through L6+N5 and
   publish `evidence/betaN-l6-materialization/report.json` with PCD inventory,
   polymer, generated artifact, package and release-manifest hashes.
7. Compile the CLI through the BRIK compiler path.
8. Run platform execution reports for macOS, Linux distro lanes, and Windows.
9. Publish release-boundary evidence from `brik64-prod`.

`brik64-prod` remains the authority for release gates, certificate boundaries,
compiler evidence, and public claim authorization.
