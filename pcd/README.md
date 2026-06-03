# BRIK CLI PCD Seed

This directory contains candidate semantic PCD seeds for the local `brik` CLI.
They are not release artifacts and do not certify formal correctness, N5 status,
fixpoint, or Rust independence.

Current status:

- Source of truth for executable behavior remains `src/brik.js`.
- These PCD files define the transition contract for moving CLI iteration to a
  PCD-first BRIK64 methodology.
- `cli_polymer.pcd` is the candidate composition contract that binds the CLI
  command PCD seeds before any future compile route.
- Any future public beta claim must be backed by fresh compiler, certificate,
  platform execution, and release-boundary reports.

Required next methodology step:

1. Complete candidate PCD coverage for all CLI behavior.
2. Certify candidate PCDs with the active private gate stack.
3. Validate the polymer/composition PCD against the certified command PCDs.
4. Compile the CLI through the BRIK compiler path.
5. Run macOS, Linux distro, and Windows execution reports.
6. Promote only if the release claim boundary gate passes.
