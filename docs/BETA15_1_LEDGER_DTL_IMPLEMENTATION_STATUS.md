# Beta15.1 Ledger DTL Implementation Status

Version: `0.1.0-beta.15.1`
Lane: `cli_0_1_beta`
Status: local candidate implemented; public release train pending.

## Scope

Beta15.1 adds a simple local append-only `.brik` ledger for workspace actions,
hardens multi-PCD polymer entrypoint selection, and fixes generated Python
test-package collisions discovered in the first real Beta15 case study.

This is a Carril A CLI maintenance release. It does not claim self-hosting,
fixpoint, formal N5, universal correctness, or independent toolchain closure.

## Executive Checklist

- 🟩 100% | 🟩 🟩 🟩 🟩 | Local ledger command surface
  - `brik64 ledger status`
  - `brik64 ledger verify`
  - `brik64 ledger snapshot`
  - `brik64 ledger tombstone`
  - `brik64 ledger export --redacted`
  - `brik64 ledger repair --dry-run`
- 🟩 100% | 🟩 🟩 🟩 🟩 | Ledger hooks for local candidate actions
  - `init`
  - `certify`
  - `emit`
  - `polymerize`
  - `lock`
- 🟩 100% | 🟩 🟩 🟩 🟩 | Tamper-evidence checks
  - Edited event detection.
  - Deleted event detection.
  - Reordered event detection.
  - Missing ledger files detection in initialized workspaces.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Polymer entrypoint hardening
  - Multi-input inline polymers require `--root`.
  - Missing root fails closed.
  - Compatible domains deduplicate.
  - Conflicting domains fail closed.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Generated Python test layout
  - Directory emits use package-specific module names.
  - Multiple generated packages can run in one pytest workspace.
- 🟩 100% | 🟩 🟩 🟩 🟩 | PCD source contracts
  - Ledger command contract.
  - Ledger verification contract.
  - Polymer entrypoint contract.
  - Python emit layout contract.
  - Ledger tamper harness.
  - Real-case galaxy harness.
- 🟨 75% | 🟩 🟩 🟩 ⬜ | Evidence
  - Local gate report is present.
  - PCD contracts are certified.
  - Real-case temporary audit passed.
  - Public release train evidence is still pending.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Public surfaces
  - GitHub release pending.
  - `brik64.com/cli/install.sh` pending.
  - `brik64.com/cli/beta.json` pending.
  - Docs/web/skills/SDK sync pending.

## Verification Run

Fresh commands executed in this candidate:

```sh
node --check src/brik.js
node --check scripts/beta15_1-ledger-dtl-gate.js
npm run test:beta15.1-ledger-dtl
npm test
```

Additional PCD contract check:

```sh
for f in pcd/beta15_1/cli/*.pcd pcd/beta15_1/harness/*.pcd; do
  node src/brik.js certify "$f"
done
```

Temporary real-case audit:

```text
/Users/carlosjperez/Documents/GitHub/PR-TEST-brik64/case_study_1_galaxy_classification.zip
decision=PASS_PR_TEST_BETA15_1_TEMP_AUDIT
```

## Current Decision

`PASS_LOCAL_CANDIDATE_GATE`.

Beta15.1 is not yet a public release. The next required gate is release train
dry-run followed by live public-surface verification.
