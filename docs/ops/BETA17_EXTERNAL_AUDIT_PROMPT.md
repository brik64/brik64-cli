# BRIK64 Beta17 External Audit Prompt

Use this prompt only after the Beta17 fixpoint evidence pack has real Stage1,
Stage2, byte-identity, harness, seal and public-surface sync evidence. Do not
use it to generate placeholder evidence.

## Agent Role

Act as an external release auditor for BRIK64 CLI `0.1.0-beta.17`.

Your task is to install BRIK64 from public surfaces, test it as a clean user,
verify generated programs and adversarial behavior, scan public surfaces for
claim safety, and write a machine-readable audit report at:

```text
evidence/beta17-fixpoint/external_audit_report.json
```

Also write an audit execution log and reference it from the output JSON
`artifacts.auditLog` with a SHA-256 digest.

## Hard Rules

- Do not use local checkout artifacts as proof of public install success.
- Do not accept internal claims as evidence.
- Do not edit generated CLI artifacts to make tests pass.
- Do not mark the audit PASS if any P0/P1 issue remains.
- Do not claim formal N5, universal correctness, full toolchain independence or
  definitive fixpoint unless separately proven by the evidence pack.

## Required Clean Workspace

Use a new temporary workspace:

```bash
export BRIK64_AUDIT_HOME="$(mktemp -d /tmp/brik64-beta17-audit-home.XXXXXX)"
export HOME="$BRIK64_AUDIT_HOME"
mkdir -p /tmp/brik64-beta17-external-audit
cd /tmp/brik64-beta17-external-audit
```

## Required Public Install Checks

Run:

```bash
curl -fsSL https://brik64.com/cli/install.sh | bash
brik64 --version
brik64 engine status --json
brik64 skill check-version --json
```

The installed CLI must report `0.1.0-beta.17`. If it does not, fail the audit.

## Required Functional Tests

Create a release-grade demo workspace and test:

- `brik64 init`
- `brik64 template`
- `brik64 certify`
- `brik64 verify`
- `brik64 emit --target ts --tests`
- `brik64 emit --target python --tests`
- `brik64 emit --target rust --tests`
- execution of generated TS, Python and Rust tests
- `brik64 polymerize` for core, extended and app-system polymers
- `brik64 lift js --preview`
- `brik64 lift ts --preview`
- `brik64 lift python --preview`
- `brik64 lift rust --preview`
- `brik64 monomers list --json`
- `brik64 monomers explain MC_00.ADD8 --json`
- `brik64 monomers test --all --json`
- `brik64 lock`
- `brik64 doctor --json`
- `brik64 update --check`

## Required Generated-Code Tests

Generate at least one non-trivial app-system polymer from PCDs and emit it to
TypeScript, Python and Rust. The emitted code must compile or run, and generated
tests must pass without manual code patches.

Record generated-code quality findings:

- semantic parity across targets;
- integer and float behavior;
- division behavior;
- generated test completeness;
- readability and maintainability issues;
- any manual intervention required.

Write the generated-code quality report to a file and reference it from the
output JSON `artifacts.generatedCodeQuality` with a SHA-256 digest.

## Required Adversarial Tests

At minimum, test these fail-closed cases:

- empty PCD;
- corrupt PCD;
- missing PCD header;
- invalid monomer;
- unsupported monomer signature;
- type mismatch;
- non-exhaustive return;
- stale certificate;
- path traversal input;
- symlink traversal;
- output outside workspace;
- malformed polymer;
- unsupported lift construct;
- tampered `.brik` ledger or manifest;
- public installer unavailable or version drift.

Write adversarial results to a file and reference it from the output JSON
`artifacts.adversarialResults` with a SHA-256 digest.

## Required Public Surface Scan

Inspect public surfaces:

- `https://brik64.com/cli/install.sh`
- `https://brik64.com/cli/beta.json`
- `https://brik64.com/download`
- `https://brik64.com/changelog`
- `https://docs.brik64.com`
- SDK marketplace versions for npm, PyPI and crates;
- public skills repository/version instructions.

Fail if active public surfaces point to a stale release or contradict the
Beta17 artifact.

Write the public-surface scan to a file and reference it from the output JSON
`artifacts.publicSurfaceScan` with a SHA-256 digest.

## Required Claim-Safe Scan

Scan public docs, web, changelog, SDK READMEs and skills for unsupported claims.

Fail if public surfaces claim any of the following without exact evidence:

- formal N5 status;
- universal correctness;
- self-hosting beyond bounded byte-identical evidence;
- independence from all toolchains;
- production certification;
- perfect or bug-free behavior.

Write the claim-safe scan to a file and reference it from the output JSON
`artifacts.claimSafeScan` with a SHA-256 digest.

## Required Output JSON

Write this exact top-level contract:

```json
{
  "schemaVersion": "brik64.beta17_external_audit.v1",
  "version": "0.1.0-beta.17",
  "decision": "PASS_BETA17_EXTERNAL_AUDIT",
  "generatedAt": "ISO-8601 timestamp",
  "auditor": {
    "type": "external_agent",
    "workspace": "/tmp/brik64-beta17-external-audit"
  },
  "cleanPublicInstall": { "pass": true, "evidence": [] },
  "functionalTests": { "pass": true, "evidence": [] },
  "generatedCodeTests": { "pass": true, "evidence": [] },
  "adversarialTests": { "pass": true, "evidence": [] },
  "publicSurfaceScan": { "pass": true, "evidence": [] },
  "claimSafeScan": { "pass": true, "evidence": [] },
  "artifacts": {
    "auditLog": {
      "path": "evidence/beta17-fixpoint/audit-artifacts/audit-log.json",
      "sha256": "64 lowercase hex characters",
      "bytes": 1
    },
    "generatedCodeQuality": {
      "path": "evidence/beta17-fixpoint/audit-artifacts/generated-code-quality.json",
      "sha256": "64 lowercase hex characters",
      "bytes": 1
    },
    "adversarialResults": {
      "path": "evidence/beta17-fixpoint/audit-artifacts/adversarial-results.json",
      "sha256": "64 lowercase hex characters",
      "bytes": 1
    },
    "publicSurfaceScan": {
      "path": "evidence/beta17-fixpoint/audit-artifacts/public-surface-scan.json",
      "sha256": "64 lowercase hex characters",
      "bytes": 1
    },
    "claimSafeScan": {
      "path": "evidence/beta17-fixpoint/audit-artifacts/claim-safe-scan.json",
      "sha256": "64 lowercase hex characters",
      "bytes": 1
    }
  },
  "findings": [],
  "blockers": []
}
```

If any required section fails, set:

```json
{
  "decision": "FAIL_BETA17_EXTERNAL_AUDIT"
}
```

and set the relevant section `pass` to `false`.

## Acceptance

The readiness gate accepts the audit only when all required section `pass`
values are true and `decision` is `PASS_BETA17_EXTERNAL_AUDIT`.
