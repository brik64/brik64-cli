# BRIK64 Beta17 Fixpoint Plan

## RESUME

- lane: `l6plus_n5_self_host_fixpoint`
- iter_id: `beta17-fixpoint`
- source_sha: pending beta16.1 closure
- stage1_sha: pending
- current gate: `fixpoint evidence campaign planning`
- last verdict: fixpoint is not authorized by beta16 evidence
- primary blocker: no fresh byte-identical self-regeneration evidence for Beta17
- next exact command: prepare canonical PCD/polymer inputs and reproducibility harness
- assumptions: Beta17 cannot inherit beta16.1 evidence as fixpoint evidence

## Objective

Beta17 is the first candidate that may be evaluated for definitive fixpoint. It must not be published as fixpoint unless the engine produced from canonical PCD/polymer can regenerate its own artifact byte-identically under a recorded harness.

## Required Evidence

- canonical motor PCD/polymer source
- canonical harness PCD/polymer source
- L6+N5 engine serial and manifest
- input PCD hashes
- generated artifact manifest
- second-pass regenerated artifact manifest
- byte-identical hash comparison
- package manifest
- seal report
- reproducibility report
- external audit prompt and final audit report

## Gates

1. PCD/polymer source validates.
2. First-pass L6+N5 materialization succeeds.
3. Generated motor runs the harness.
4. Generated motor regenerates the same artifact.
5. Hashes are byte-identical under the declared environment.
6. No public claim-safe scan violations.
7. Beta17 release train remains blocked until all fixpoint gates pass.

## Claim Boundary

Allowed before closure:

- `fixpoint candidate`
- `reproducibility campaign in progress`
- `internal evidence under review`

Not allowed before closure:

- `definitive fixpoint`
- `compiler hosts itself`
- `independent of Rust/toolchain`
- `formal level-5 engine status`
- `universally correct`

## Acceptance

Beta17 can move from candidate to public fixpoint only when the fresh evidence pack supports the exact claim. If any step depends on manual edits, bootstrap substitution or non-reproducible environment state, the lane remains blocked.
