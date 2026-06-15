# External Audit Prompt: BRIK64 CLI v0.1.0-beta.15.3

Install only from the candidate package or public installer provided for the audit. Do not use a local development checkout unless explicitly instructed.

Audit objectives:

1. Verify `brik64 --version` reports `0.1.0-beta.15.3`.
2. Run `brik64 monomers test --all --json` and confirm `total=128`, `passed=128`, `failed=0`.
3. Generate PCDs using representative CORE and EXTENDED monomers, including `MC_03.DIV8`, `MC_64.FADD`, `MC_70.FSQRT`, `MC_76.LOG`, and one contract boundary monomer.
4. For each representative PCD, run `certify`, `verify`, and `emit --target ts|python|rust --tests`.
5. Execute all generated tests and record compiler warnings as failures.
6. Polymerize at least two CORE PCDs into `core_system.polymer.pcd`; certify and verify the polymer.
7. Polymerize a mixed CORE/EXTENDED set and confirm boundary contracts are preserved before functions.
8. Test fail-closed behavior for stale certificates, corrupt PCDs, path traversal, missing domain declarations, missing boundaries, and unsupported monomers.
9. Confirm generated frontend-facing project text does not mention PCD internals where user-facing language should say data, rules, workflows, or bounded domains.
10. Report whether Beta15.3 is eligible for public release. Treat missing web/docs/SDK/skills/live synchronization or missing L6+N5 generation evidence as blockers.

Expected report:

- `BRIK64-CLI-BETA15.3-EXTERNAL-AUDIT-REPORT.md`
- Include pass/fail matrix, exact commands, generated artifacts inspected, warning/error excerpts, and recommendations for Beta15.4 or Beta16.
