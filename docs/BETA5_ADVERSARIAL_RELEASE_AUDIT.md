# BRIK64 CLI Beta5+ Adversarial Release Audit

Version: `0.1.0-beta.5+`

Status: `mandatory_before_publication`

This audit is the clean-room adversarial gate required before any BRIK64 CLI
beta, release candidate, or public release can be published. It exists to prove
that only functional versions move to public channels.

## Release Rule

A CLI version cannot be published unless a fresh isolated run produces:

- `PASS_BETA5_LOCAL_COMPLETION` or the version-equivalent completion decision;
- `PASS_BETA5_LOCAL_ADVERSARIAL_AUDIT` or the version-equivalent adversarial
  decision;
- package smoke from the release artifact, not only from source;
- cross-platform smoke for every platform claimed by the release;
- signed checksums for CLI and SDK package artifacts;
- publication preflight whose remaining blockers are intentionally external
  authorization steps only.

If any required audit is missing, stale, run from a contaminated workspace, or
only checks the source tree instead of the packaged artifact, publication must
fail closed.

## Isolated Workspace

Each run must use a fresh scratch directory:

```text
/Users/carlosjperez/.gemini/antigravity/scratch/brik64_<version>_adversarial_<timestamp>
```

Rules:

- never run destructive adversarial cases in the user home, repo root, or an
  existing `.brik` workspace;
- never use secrets, registry tokens, 1Password tokens, GitHub release tokens,
  npm/PyPI/Cargo publish tokens, or production deployment credentials;
- never publish, tag, upload, or mutate marketplace state from this audit;
- record every command, exit code, stderr excerpt, and generated evidence path.

## Beta5 Command Surface

The beta5 public local surface is:

- `brik64 --version`;
- `brik64 --help`;
- `brik64 init`;
- `brik64 doctor`;
- `brik64 engine status`;
- `brik64 certify <file.pcd>`;
- `brik64 emit <file.pcd> --target ts|rust|python --out <dir> [--tests]`.

Do not audit beta4-only or speculative commands as release requirements. If an
old command still appears in docs, classify it as documentation drift.

## Required Audit Phases

### 1. Clean Install And Baseline

1. Create the scratch workspace.
2. Run `brik64 --version` and verify the exact version.
3. Run `brik64 --help` and verify only supported beta5 commands are presented.
4. Run `brik64 init`.
5. Verify `.brik/manifest.json` exists.
6. Verify `AGENTS.md` was not created by `init`.
7. Create `pcd/inventory.pcd`.
8. Run `brik64 doctor`.
9. Run `brik64 engine status`.

Expected result: all supported baseline commands pass and report `releaseEligible=false`.

### 2. Functional PCD Flow

Run the same valid PCD through:

- `certify`;
- `emit --target ts --tests`;
- `emit --target rust --tests`;
- `emit --target python --tests`.

Verify:

- certificate includes the PCD hash;
- emitted outputs differ when the PCD changes;
- generated tests are created for each supported target;
- unsupported targets fail closed with `unsupported_target`.

### 3. Mandatory Adversarial Triad

Each release must include fresh cases in all three classes.

Edge:

- valid minimal PCD;
- valid PCD with comments/whitespace;
- valid PCD near the declared size limit.

Fail-closed:

- corrupt `.brik/manifest.json`;
- manifest with `l6DistributionAllowed=true`;
- empty PCD;
- corrupt PCD;
- stale certificate after PCD mutation;
- unsupported target;
- unknown command;
- input path traversal attempt;
- output path traversal attempt;
- read-only output directory when the platform supports permission changes.

Variation:

- at least two distinct valid PCDs must produce distinct semantic hashes and
  distinct emitted outputs;
- target outputs for TS/Rust/Python must preserve the same input-derived
  structure, not a fixed template unrelated to PCD bytes.

### 4. Fuzz And Resource Limits

Run bounded fuzzing only:

- random/binary PCD payloads up to the declared audit limit;
- long names and long paths inside the scratch workspace;
- repeated certify/emit loops under a fixed iteration budget.

Expected result: no uncaught Node.js stack trace, no write outside scratch, no
success on malformed input, and no uncontrolled resource exhaustion.

### 5. Package And Distribution Candidate

The audit must test the artifact that would be distributed:

- build local CLI package;
- extract package into a fresh directory;
- run version, engine status, doctor, init, certify, emit, stale-cert checks
  from the extracted package;
- run cross-platform package smoke for all claimed platforms;
- verify `SHA256SUMS` and signature.

Source-tree-only tests are not sufficient for release.

### 6. Surface Synchronization

Before publication, verify the version train:

- CLI version, `package.json`, `.brik/manifest.json`, package name and
  changelog match;
- SDK package artifacts for JS/TS, Python and Rust are present or explicitly
  scoped out;
- public skills contain no private/internal engine nomenclature;
- docs/web/curl surfaces either reference the same release manifest or remain
  clearly blocked/candidate;
- release surface matrix is hash-bound into the build-chain.

### 7. Publication Preflight

Run publication preflight last.

Allowed remaining blockers before owner authorization:

- release tag not created;
- GitHub Release not created;
- marketplace publication not authorized.

Any technical blocker such as missing package smoke, missing cross-platform
smoke, missing checksums, missing SDK package artifacts, changelog drift or
matrix drift blocks publication and must be fixed before owner authorization.

## Severity Model

`P0 release blocker`:

- malformed input succeeds;
- path traversal writes outside scratch;
- stale certificate emits successfully;
- L6 distribution is allowed in public runtime;
- package artifact differs from source contract;
- completion/adversarial gate fails.

`P1 release blocker`:

- uncaught Node.js stack trace on expected hostile input;
- missing supported target output;
- SDK/package/checksum evidence missing;
- docs or skills advertise an incompatible version.

`P2 fix before broad release`:

- error messages are unclear but fail closed;
- platform not claimed by release lacks smoke;
- generated code quality issue without semantic drift.

`P3 backlog`:

- formatting, wording or developer-experience issue that does not affect
  correctness, safety or publication claims.

## Required Report Shape

Every audit run must produce a report with:

```json
{
  "schemaVersion": "brik64.cli_adversarial_release_audit.v1",
  "version": "0.1.0-beta.5",
  "workspace": "...",
  "decision": "PASS|FAIL|BLOCKED",
  "confidenceLevel": "N3",
  "commands": [
    {
      "name": "stale certificate fail closed",
      "command": "...",
      "exitCode": 1,
      "expected": "certificate_hash_mismatch",
      "actual": "...",
      "severity": null
    }
  ],
  "findings": [],
  "remainingPublicationBlockers": []
}
```

The release manager must treat missing report fields as `BLOCKED_AUDIT_SCHEMA`.

## CI Boundary

`npm test` runs the portable CLI smoke by default so GitHub Actions can verify
the public command surface without sibling private/local repositories.

Release-local gates that depend on sibling SDK repos, local signed checksums,
Hetzner smoke, docs/web source checkouts or marketplace package artifacts must
run with:

```bash
BRIK64_RELEASE_GATES=1 npm test
```

Public CI passing is necessary but not sufficient for release. A release manager
must also attach the clean-room adversarial report and release-local gate
outputs before publishing.

## Current Beta5 Agent Assignment

An adversarial execution worker has been assigned to run this methodology in:

```text
/Users/carlosjperez/.gemini/antigravity/scratch/brik64_beta5_adversarial_agent
```

The worker must not modify release repos. Findings are integrated only after
review.
