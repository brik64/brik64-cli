# BRIK64 CLI Beta14.5 Publication Recovery And Beta14.6 Domain Contracts Plan

## Executive Summary

This document records the operational plan to complete the public publication of
`BRIK64 CLI v0.1.0-beta.14.5` and then generate `v0.1.0-beta.14.6` with explicit
bounded domain contracts.

Beta14.5 is not closed as a public release until all public surfaces verify live.
The latest publish workflow reached the public mutation phase but failed closed
before mutating publication channels.

Beta14.6 must start only after Beta14.5 is either fully published and verified or
formally superseded by a documented release decision. Beta14.6 belongs to the
`cli_0_1_beta` lane and must not claim self-hosting, fixpoint, formal N5, Rust
independence, or universal mathematical certification.

## Current State Snapshot

```text
lane: cli_0_1_beta
iter_id: beta14.5-publication-recovery + beta14.6-domain-contracts
source_sha: bfce3668e188d6c8e66be7443ea4690705fb267a
latest_publish_workflow: 27462035574
latest_publish_verdict: FAIL_RELEASE_TRAIN_PUBLISH_EXECUTE
publicationMutated: false
primary_blocker:
  path_missing:sdk_npm:/Users/carlosjperez/Documents/GitHub/brik64-lib-js/dist/brik64-core-0.1.0-beta.14.5.tgz
  path_missing:sdk_pypi:/Users/carlosjperez/Documents/GitHub/brik64-lib-python/dist/brik64-0.1.0b14.post5*
```

Interpretation:

- Credentials were not the blocking issue in the latest run.
- GitHub release preflight, manifest digest, GCP authentication, crates trusted
  publishing authentication, and credential validation passed.
- The workflow failed closed at publication execution because it expected SDK
  package artifacts at absolute local macOS paths that do not exist in GitHub
  Actions.
- Since `publicationMutated=false`, the next action is a workflow/package
  artifact resolution fix, not a rollback.

## Progress Overview

### Beta14.5 Public Release Recovery

- 🟩 100% | 🟩 🟩 🟩 🟩 | Functional Beta14.5 CLI candidate prepared and merged.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Manifest state/source fix merged.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Publish preflight reached credential validation and publication plan.
- 🟨 75% | 🟩 🟩 🟩 ⬜ | Publication train is ready except SDK artifact resolution.
- ⛔ 75% | 🟩 🟩 🟩 ⛔ | Public mutation blocked by missing SDK package paths in CI.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Live public verification after successful publication.

### Beta14.6 Domain Contracts

- 🟩 100% | 🟩 🟩 🟩 🟩 | Product intent defined: bounded domains are mandatory for claim-bearing PCDs.
- 🟨 50% | 🟩 🟩 ⬜ ⬜ | Scope decomposed into parser, commands, emit, lift, polymer, gates, docs.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Implementation branch not started.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Domain parser and command implementation.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Generated target tests with domain preconditions.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Release train and public surfaces.

## Workstream A: Publish Beta14.5

### Objective

Complete the atomic publication of `v0.1.0-beta.14.5` without changing its
functional contract after it has already been packaged and release-manifested.

### Gate A1: Reconstruct Release State

- 🟩 100% | 🟩 🟩 🟩 🟩 | Confirm latest merged commit: `bfce366`.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Confirm latest publish workflow: `27462035574`.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Confirm `publicationMutated=false`.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Confirm blocker is SDK artifact path resolution.

Acceptance:

- Run logs show no public mutation before failure.
- Failure list contains only actionable pre-publication execution blockers.

### Gate A2: Fix SDK Artifact Resolution In CI

- 🟥 25% | 🟥 ⬜ ⬜ ⬜ | Inspect `scripts/release-train-publish-execute.js`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Inspect `scripts/release-train-publish-plan.js`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Inspect SDK workspace preparation step in `.github/workflows/release-train-publish.yml`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Replace host-specific absolute paths with CI-produced artifact paths.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Add fail-closed check that prints expected artifact path source.

Required behavior:

- JS SDK package path must come from the CI SDK preparation workspace or from a
  checked-in release artifact manifest, not from
  `/Users/carlosjperez/Documents/GitHub/brik64-lib-js/...`.
- Python SDK package path must come from the CI SDK preparation workspace or from
  a checked-in release artifact manifest, not from
  `/Users/carlosjperez/Documents/GitHub/brik64-lib-python/...`.
- If a marketplace package is not generated, the workflow must fail before
  public mutation with a clear `sdk_artifact_missing` error.
- If a marketplace package is intentionally unchanged, the release manifest must
  mark `no_change_required` with evidence.

Acceptance:

```bash
npm run release:train:publish-plan -- --publish
npm run release:train:publish-execute -- --dry-run
```

must both pass in a clean CI-like workspace or fail closed before publication
with no absolute developer-machine paths.

### Gate A3: Re-run Publication Dry Run

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Recompute manifest digest.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Dispatch `release-train-publish.yml` with `execute_publication=false` if supported.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Confirm publication plan has no path or version blockers.

Acceptance:

- Publication plan reaches `decision=PASS` or equivalent non-mutating success.
- Evidence uploaded under `evidence/release-train-publish-plan`.

### Gate A4: Execute Atomic Publication

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Dispatch workflow with explicit confirm string.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Publish GitHub release `v0.1.0-beta.14.5`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Publish curl/GCP installer and `beta.json`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Publish or verify SDK marketplace packages.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Update docs/web/skills if required by the manifest.

Acceptance:

- No channel can be declared complete independently.
- If any channel fails after mutation, classify as
  `partial_publication_incident` and run catch-up or rollback.

### Gate A5: Live Verification

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Verify `https://brik64.com/cli/beta.json` reports `0.1.0-beta.14.5`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Install from `curl -fsSL https://brik64.com/cli/install.sh | bash`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Run `brik64 --version`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Run smoke commands from clean workspace.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Verify SDK marketplace installs.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Verify docs, web, changelog, and skills surfaces.

Required smoke:

```bash
brik64 --version
brik64 help
brik64 monomers list --json
brik64 monomers test --all --json
brik64 lift js ./sample.js --preview
brik64 lift ts ./sample.ts --preview
brik64 lift python ./sample.py --preview
brik64 lift rust ./sample.rs --preview
brik64 emit ./sample.pcd --target ts --tests --out ./out-ts
brik64 emit ./sample.pcd --target python --tests --out ./out-python
brik64 emit ./sample.pcd --target rust --tests --out ./out-rust
brik64 polymerize ./pcd/*.pcd --out ./polymer.pcd
```

Acceptance:

- Public release is declared closed only after this gate passes.

## Workstream B: Generate Beta14.6 With Bounded Domains

### Objective

Generate `BRIK64 CLI v0.1.0-beta.14.6` with explicit bounded domain contracts as
the required boundary for claim-bearing PCD workflows.

### Non-Claims

Beta14.6 must not claim:

- self-hosting;
- fixpoint;
- formal N5;
- complete Rust independence;
- universal mathematical certification;
- arbitrary software correctness.

Allowed public framing:

- bounded domain contracts;
- deterministic local checks within declared contract boundaries;
- generated target tests with in-domain, edge, and out-of-domain cases;
- fail-closed behavior when domain contracts are missing or inconsistent.

### Gate B1: Branch And Baseline

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Start from `origin/main` after Beta14.5 closure or supersession.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Create branch `codex/beta14-6-domain-contracts`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Record baseline `release/manifest.json`, `package.json`, `.brik/manifest.json`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Create `pcd/beta14_6/` scaffold.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Create `evidence/beta14_6-domain-contracts/`.

Acceptance:

- Clean branch.
- No inherited dirty worktree.
- Baseline report written before code changes.

### Gate B2: PCD Domain Syntax

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Parse simple fixed domains.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Parse `domain_param`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Parse `invariant`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Parse conditional `when` domain blocks.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Parse relational domain constraints.

Required syntax:

```pcd
PC fee_gate {
  domain x: i64 [10, 100];

  fn run(x: i64) -> i64 {
    return MC_00.ADD8(x, 5);
  }
}
```

```pcd
PC ratio_gate {
  domain numerator: i64 [0, 10000];
  domain denominator: i64 [1, 10000];
  invariant denominator != 0;

  fn run(numerator: i64, denominator: i64) -> i64 {
    return MC_03.DIV8(numerator, denominator);
  }
}
```

```pcd
PC mode_gate {
  domain mode: i64 [1, 2];

  when mode == 1 {
    domain x: i64 [0, 255];
  }

  when mode == 2 {
    domain x: i64 [-1000, 1000];
  }

  fn run(mode: i64, x: i64) -> i64 {
    if (mode == 1) return MC_07.CLAMP(x, 0, 255);
    return MC_06.ABS(x);
  }
}
```

Acceptance:

```bash
npm run gate:beta14.6:domain-parser
```

passes with edge, fail-closed, and variation cases.

### Gate B3: Domain Commands

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `brik64 domain inspect <file.pcd> --json`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `brik64 domain validate <file.pcd> --json`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `brik64 domain add <file.pcd> --param x --type i64 --min 10 --max 100`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `brik64 domain sheet <file.pcd> --out technical-sheet.json`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `brik64 template --type domain-gate`.

Acceptance:

- JSON output has stable schema.
- Human output is readable.
- Missing domains fail closed with actionable guidance.

### Gate B4: Existing Command Integration

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `certify` rejects functional PCDs without domains.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `verify` validates domain contract hash.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `emit` includes domain precondition checks in TS/Python/Rust.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `lift` marks missing domains as `prototype_non_claim`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `polymerize` detects domain conflicts and emits composite domain hash.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `doctor` reports domain completeness and release eligibility.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `lock` includes domain/invariant/technical sheet hashes.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `explain` shows effective domain by function and input.

Acceptance:

```bash
npm run gate:beta14.6:domain-required
npm run gate:beta14.6:domain-tests
npm run gate:beta14.6:lift-domain-boundary
npm run gate:beta14.6:polymer-domain-compat
```

all pass.

### Gate B5: Error Contract

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `bounded_domain_required`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `domain_param_unresolved`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `domain_type_mismatch`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `domain_invariant_invalid`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `domain_condition_unsupported`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `domain_relation_unsupported`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `domain_contract_hash_mismatch`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `domain_conflict_in_polymer`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `domain_required_for_claim_bearing_certification`.

Acceptance:

- Every error has code, human message, remediation, and JSON shape.
- No raw stack traces on expected domain failures.

### Gate B6: Generated Tests With Domains

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | TS generated tests cover in-domain cases.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | TS generated tests cover out-of-domain fail-closed cases.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Python generated tests cover in-domain cases.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Python generated tests cover out-of-domain fail-closed cases.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Rust generated tests cover in-domain cases.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Rust generated tests cover out-of-domain fail-closed cases.

Acceptance:

- Generated programs compile or run under declared target requirements.
- Tests fail closed outside domain.

### Gate B7: L6+N5 Generation Evidence

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Verify L6+N5 healthcheck on authorized host.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Verify serial/checksum/audit status.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Generate or materialize Beta14.6 artifacts from PCD/polymer where supported.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | If full materialization is not supported, classify capability gap explicitly.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Bind PCD/polymer hashes to artifact/package manifest.

Acceptance:

- Evidence report exists under `evidence/beta14_6-l6-generation/`.
- If L6+N5 cannot fully materialize the artifact, Beta14.6 release report must
  say `assisted_generation_non_claim`, not self-host/fixpoint.

### Gate B8: Public Surface Sync

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `package.json` version `0.1.0-beta.14.6`.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `.brik/manifest.json` version aligned.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | `release/manifest.json` version aligned.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | README describes domains and no internal claims.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Changelog describes only user-visible functional changes.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Docs explain bounded domains and technical sheets.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Skills teach agents how to inspect/add/validate domains.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | SDK examples use domain-aware PCD examples where relevant.

Acceptance:

```bash
npm run release:train:dry-run
```

passes without stale version or claim-safety blockers.

### Gate B9: External Audit

- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Install from public curl in clean workspace.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Test domain commands.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Test certify/verify/emit/lift/polymerize with domains.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Test missing domain fail-closed behavior.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Test stale certificate after domain change.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Test corrupt technical sheet.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Test traversal and symlink attempts.

Acceptance:

- `BRIK64-CLI-BETA14.6-EXTERNAL-AUDIT-REPORT.md` exists.
- Blocking failures are zero or formally classified out-of-scope with issues.

## Required New Package Scripts

Add these scripts or their exact equivalents:

```json
{
  "gate:beta14.6:domain-parser": "node scripts/beta14_6-domain-parser-gate.js",
  "gate:beta14.6:domain-required": "node scripts/beta14_6-domain-required-gate.js",
  "gate:beta14.6:domain-tests": "node scripts/beta14_6-domain-tests-gate.js",
  "gate:beta14.6:conditional-domains": "node scripts/beta14_6-conditional-domains-gate.js",
  "gate:beta14.6:relational-domains": "node scripts/beta14_6-relational-domains-gate.js",
  "gate:beta14.6:parametric-domains": "node scripts/beta14_6-parametric-domains-gate.js",
  "gate:beta14.6:lift-domain-boundary": "node scripts/beta14_6-lift-domain-boundary-gate.js",
  "gate:beta14.6:polymer-domain-compat": "node scripts/beta14_6-polymer-domain-compat-gate.js",
  "gate:beta14.6:release-train": "npm run release:train:dry-run"
}
```

## Beta14.6 Implementation Order

1. Close or supersede Beta14.5.
2. Create clean Beta14.6 branch.
3. Add PCD domain fixtures first.
4. Add parser support.
5. Add domain inspection/validation commands.
6. Add certify/verify fail-closed integration.
7. Add emit precondition checks and generated tests.
8. Add lift domain boundary reporting.
9. Add polymer domain compatibility graph.
10. Add doctor/lock/explain domain reporting.
11. Add gates and adversarial tests.
12. Update docs, skills, README, changelog, SDK examples.
13. Run package, smoke, release dry run.
14. Publish only through atomic release train.
15. Run external audit from public installer.

## Risks And Controls

| Risk | Control | Blocking? |
| --- | --- | --- |
| Beta14.5 not actually public | Verify live before starting Beta14.6 release | Yes |
| SDK artifacts depend on local paths | Generate or resolve artifacts in CI workspace | Yes |
| Domain syntax becomes scripting language | Keep PCD as circuit description; bounded declarations only | Yes |
| Domains treated as formal proof | Public claim-safety scan and changelog discipline | Yes |
| Lift infers domains incorrectly | Mark inferred domains as candidates pending confirmation | Yes |
| Generated tests pass but runtime ignores domain | Add out-of-domain fail-closed target tests | Yes |
| Polymer combines incompatible domains | Composite domain graph and conflict gate | Yes |

## Completion Definition

Beta14.5 is complete when:

- GitHub release, installer, beta manifest, SDKs, docs/web/skills, and changelog
  are live and synchronized.
- Live install from `brik64.com` returns `0.1.0-beta.14.5`.
- Release train live verify passes.

Beta14.6 is complete when:

- Bounded domain syntax is supported.
- Claim-bearing certification requires bounded domains.
- Generated TS/Python/Rust code includes domain precondition checks.
- Generated tests cover in-domain, edge, and out-of-domain cases.
- Lift, polymer, doctor, lock, and explain report domain status correctly.
- External audit from public installer passes.

## Recommended Immediate Next Actions

1. Patch release train SDK artifact path resolution.
2. Re-run Beta14.5 publication workflow.
3. Verify all public Beta14.5 surfaces live.
4. Create Beta14.6 branch from verified main.
5. Implement `gate:beta14.6:domain-parser` first.
