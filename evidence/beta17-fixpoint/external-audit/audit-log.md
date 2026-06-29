# BRIK64 CLI Beta17 External Audit Log

Date: 2026-06-29
Install source: https://brik64.com/cli/install.sh
Workspace: /tmp/brik64-beta17-external-audit/workspace

## Commands executed
- Clean HOME install through public curl installer.
- `brik64 --version` returned `BRIK64 CLI 0.1.0-beta.17`.
- `brik64 engine status --json` reported `engine=L4+N5`, `runtimeProfile=l4plus_n5_local`, `localRuntime=available`.
- `brik64 init` created `.brik/manifest.json`.
- `brik64 template --type numeric-monomer --out pcd/add8_gate.pcd` created the fixture PCD.
- `brik64 certify pcd/add8_gate.pcd` created a certificate.
- `brik64 verify pcd/add8_gate.pcd --json` returned PASS.
- `brik64 emit` generated TS, Python, and Rust targets with tests.
- Generated TS test passed with Node.
- Generated Python tests passed in an isolated venv with pytest.
- Generated Rust tests passed with stable rustup toolchain and cargo.
- `brik64 polymerize` generated `polymer.pcd` and `polymer.pcd.manifest.json`.
- `brik64 lift js source/add.js --preview` generated lift preview artifacts.
- `brik64 monomers test --all --json` returned 128 passed, 0 failed.
- Adversarial tests for empty PCD, missing header, invalid monomer, path traversal, absolute out path, and symlink out path failed closed.
- Public surfaces were fetched from brik64.com, docs.brik64.com, GitHub raw skills, npm, PyPI, and crates.

## Boundary
This audit establishes bounded release evidence for Beta17 public beta surfaces. It does not establish formal proof, universal correctness, or a stronger compiler-origin claim.
