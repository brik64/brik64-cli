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
- The files in this directory are review material for beta methodology, package
  inspection, and future compiler-aligned work.

## Promotion Path

Before these seeds can support stronger public release language, BRIK64 must:

1. Complete candidate PCD coverage for CLI behavior.
2. Certify candidate PCDs with the active gate stack.
3. Validate the polymer/composition PCD against command PCDs.
4. Compile the CLI through the BRIK compiler path.
5. Run platform execution reports for macOS, Linux distro lanes, and Windows.
6. Publish release-boundary evidence from `brik64-prod`.

`brik64-prod` remains the authority for release gates, certificate boundaries,
compiler evidence, and public claim authorization.
