# External Audit Prompt — BRIK64 CLI Beta15.2

Act as an external adversarial auditor. Use only public or packaged artifacts
provided for BRIK64 CLI `0.1.0-beta.15.2`; do not rely on local source checkout
unless explicitly asked to audit source.

## Install And Baseline

```bash
rm -rf /tmp/brik64-beta15-2-audit ~/.brik64-audit-beta15-2
mkdir -p /tmp/brik64-beta15-2-audit
cd /tmp/brik64-beta15-2-audit
brik64 --version
brik64 help
```

If testing public install:

```bash
curl -fsSL https://brik64.com/cli/install.sh | bash
brik64 --version
```

## Required Tests

1. Initialize a clean workspace.
2. Create PCDs with bounded domains that include both min and max values.
3. Certify, emit Python/TS/Rust with tests, and run generated tests.
4. Import generated helpers directly and attempt to bypass max bounds.
5. Polymerize multiple PCDs and inspect manifest/domain composition.
6. Tamper `.brik/ledger/events.jsonl` and verify `brik64 ledger verify --json`
   fails.
7. Add `.brik/audit/FINAL_AUDIT_REPORT.md` with release-ready language while
   manifest has `releaseAllowed:false`; verify `brik64 doctor --json` fails.
8. Test corrupt PCD, empty PCD, stale certificate, traversal path, unsupported
   target, and manifest contradiction.
9. Scan any generated user-facing frontend copy. It must not expose PCD,
   monomer, polymer, DTL, ledger, certification, cryptographic, N5, L6, or
   fixpoint vocabulary outside developer diagnostics.
10. Verify CLI, package metadata, docs, skills, and changelog all reference the
    same version or are marked `no_change_required` with evidence.

## Report

Produce `BRIK64-CLI-BETA15.2-EXTERNAL-AUDIT-REPORT.md` with:

- exact install source;
- `brik64 --version` output;
- pass/fail matrix;
- commands run;
- generated code quality notes;
- boundary bypass attempts;
- release claim scan;
- public UI language scan;
- remaining blockers;
- final decision: `PASS_PUBLIC_RC`, `FAIL_BLOCKING`, or `INCONCLUSIVE`.
