# BRIK64 CLI Beta16.1 Functional Release Plan

## RESUME

- lane: `cli_0_1_beta`
- iter_id: `beta16.1-functional-release`
- source_sha: `origin/main@1bc6b44` at worktree creation
- stage1_sha: pending
- current gate: `codex-loop clean worktree + beta16.1 functional gates`
- last verdict: public beta16 channel is consumable but has release blockers
- primary blocker: beta16 public artifact emitted identity programs and served candidate/release-blocked state
- next exact command: `bash tools/codex-loop/brik64-cli-checks.sh`
- assumptions: beta16.1 is a hotfix release; beta17 fixpoint remains a separate lane

## Release Objective

Publish `0.1.0-beta.16.1` only after the CLI artifact, package manifest, curl installer, SDK coordinates, docs, web, skills and live verification agree on the same version.

Beta16.1 must remain a public CLI beta. It may state that the public package contains the local `L4+N5` runtime when verified by `brik64 engine status --json`. It must not claim fixpoint, Rust independence, formal N5 or universal correctness.

## Required Fixes

- Close GitHub blockers `#209` to `#213`.
- Use a clean worktree from `origin/main`; do not modify the stale local beta8 checkout.
- Ensure `emit` produces semantic TS, Python and Rust programs with generated tests.
- Ensure `polymerize` preserves DAG, source hashes, dependency manifests and composed logic.
- Ensure `certify` fails closed on missing header, type mismatch, implicit numeric coercion and non-exhaustive returns.
- Ensure `init`, `help`, `doctor`, `engine status`, `update`, `monomers`, `lift` and `lock` match public docs and release manifest.
- Package and verify the local `L4+N5` runtime.
- Regenerate the public artifact from PCD/polymer through the current L6+N5 materialization gate, or block publication.

## Current Blocker

`npm test`, `gate:beta16.1:full-release-audit`, `package:beta16.1:local`
and `smoke:beta16.1:package` pass locally. Publication is blocked because
the live L6+N5 materializer does not accept `0.1.0-beta.16.1`.

Observed blocker:

```text
decision=BLOCKED_BETA16_1_L6_GENERATION_GATE
remote_l6plus_materializer_version_not_supported:0.1.0-beta.16.1
remote_l6plus_materializer_endpoint_status:beta15_7_ready,beta16_native_ready
remote_l6plus_materialization_contract_unavailable
generated_artifact_missing
```

The remote wrapper currently exposes:

```text
beta16-cli-materialize
beta16-native-stage1-materialize
l6-cli-materialize
beta15.7-cli-materialize
```

Directly calling `beta16-cli-materialize` with the beta16.1 request also fails
closed with `version_mismatch:0.1.0-beta.16.1`.

## Gates

Run in this order:

1. `npm test`
2. `npm run release:manifest:validate`
3. `npm run release:flow:audit`
4. `npm run gate:cli:l6-generation-required`
5. `bash tools/codex-loop/brik64-cli-checks.sh`
6. beta16.1 full release audit gate
7. beta16.1 package smoke
8. `npm run release:train:dry-run`
9. `npm run release:train:publish-execute`
10. `npm run release:train:live-verify`

If any gate fails, do not publish. If publication partially completes, record `FAILED_PARTIAL_PUBLICATION_INCIDENT` and open a follow-up hotfix instead of mutating the same release silently.

## Public Surface Sync

The following surfaces must be updated atomically:

- GitHub release `v0.1.0-beta.16.1`
- `https://brik64.com/cli/install.sh`
- `https://brik64.com/cli/beta.json`
- `https://brik64.com/download`
- `https://docs.brik64.com`
- public changelog
- `brik64-tools-skills`
- npm `@brik64/core@0.1.0-beta.16.1`
- PyPI `brik64==0.1.0b16.post1`
- crates `brik64-core@0.1.0-beta.16.1`

## Acceptance

- P0 findings: `0`
- P1 findings: `0`
- P2 findings: documented and not related to correctness, install, release train, SDK sync, public docs or security.
- External audit is run from public surfaces after deployment.
- Final report states exact verification level and unverified scope.
