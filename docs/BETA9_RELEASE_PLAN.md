# BRIK64 CLI 0.1.0-beta.9 Release Plan

## Scope

`0.1.0-beta.9` is a Carril A public CLI beta. It improves the public product
surface while keeping L6+N5 as an internal non-claim factory.

Beta9 must not claim formal N5, public fixpoint, self-hosting, Rust
independence, universal correctness, or a pure BRIK64 toolchain.

## Required Capability Delta

Beta9 extends the beta8 source-to-source compiler into a more useful local
developer workflow.

Required compiler improvements:

- parse and emit arrays/lists;
- parse and emit maps/dictionaries;
- parse and emit bounded `for` loops;
- parse and emit bounded `while` loops;
- infer and validate strict parameter and return types from the PCD interface;
- support local calls/imports between PCDs inside the same polymer;
- fail closed for unsupported dynamic behavior, unbounded loops, unknown
  identifiers, unsupported target features, and path traversal.

Required scaffold improvements:

- TypeScript target emits `package.json`, `tsconfig.json`, source module and
  executable tests.
- Rust target emits `Cargo.toml`, `src/` module layout and executable tests.
- Python target emits `pyproject.toml`, package/module layout and executable
  tests.

Required UX improvements:

- `brik64 doctor` remains human-readable by default.
- `brik64 doctor --json` remains stable for CI.
- human doctor output must group errors/warnings/actions with clear text.

Required gate hardening:

- GitHub signature validation must not fail only because a developer shell has
  an expired, SSO-blocked, or unrelated `GITHUB_TOKEN`.
- Public GitHub commit verification must sanitize host `GITHUB_TOKEN` by
  default and recover with unauthenticated HTTPS for public repositories.
- CI may explicitly allow a workflow token when required.

## PCD/Polymer Source Rule

Beta9 changes must be represented by PCD/polymer or a hash-bound logical
contract before publication.

At minimum:

- `pcd/cli_beta9_transpiler_contract.pcd` records parser/emitter/scaffold
  requirements and staged public-surface contracts such as curl/GCP installer
  staging.
- `pcd/cli_polymer.pcd` is updated to reference the beta9 contract.
- package and release reports bind PCD/polymer hashes to generated artifacts.

Manual code changes are allowed only as implementation work toward the beta9
contract. They are `prototype_non_claim` until a beta9 L6+N5 materialization
report proves that the distributed artifact was generated from the PCD/polymer
inputs through the internal factory.

Promotion is blocked unless `evidence/beta9-l6-materialization/report.json`
exists and records:

- `decision: PASS_BETA9_PCD_L6_MATERIALIZATION`;
- beta9 version `0.1.0-beta.9`;
- lane `cli_0_1_beta`;
- generation claim `assisted_generation_non_claim`;
- PCD inventory hash;
- `pcd/cli_polymer.pcd` hash;
- `pcd/cli_beta9_transpiler_contract.pcd` hash;
- factory serial and Stage1 hash;
- generated artifact/package/release-manifest hashes;
- closed public claim boundary.

If that report is missing or stale, the state is
`manual_surface_pending_pcd_generation`, not a releasable beta9.

Any new beta9 change after a passing materialization report invalidates the
previous PCD inventory hash. The required response is to update the PCD/polymer
contract first, rerun L6+N5 materialization, rebuild the package, rerun the
package smoke, and then rerun release readiness. The previous report becomes
baseline evidence only.

## Required Gates

Before publication:

- beta9 compiler functionality gate;
- beta9 adversarial gate with edge, fail-closed and variation cases;
- beta9 PCD/L6+N5 materialization gate;
- token-contamination gate for GitHub verification;
- package smoke from extracted tarball;
- release manifest validation;
- release-flow audit;
- SDK sync and marketplace package gates;
- docs/web sync gate;
- skills sync gate;
- public claim scan;
- live verifier after publication.

## Release Train

Publication must be atomic across:

- GitHub Release;
- curl/GCP installer;
- `https://brik64.com/cli/install.sh`;
- `https://brik64.com/cli/beta.json`;
- docs;
- web download/changelog/SDK pages;
- SDK marketplaces;
- public skills.

If any surface mutates while another remains stale, the state is
`incident_partial_publication`, not release closure.

## Public Changelog Boundary

The public changelog for beta9 must describe only user-visible changes:

- compiler syntax support;
- generated package scaffolds;
- doctor UX;
- install or compatibility changes;
- bug fixes and migration notes.

It must not mention internal engine tiers, L6+N5, branch-protection mechanics,
private CI/CD decisions, approval workflow, or methodology internals.

## Completion Definition

Beta9 is complete only when the official release train reports:

- `PASS_RELEASE_TRAIN_PUBLISH_EXECUTE`;
- `PASS_RELEASE_TRAIN_LIVE_VERIFY`;
- all declared package and public-surface gates pass;
- public claim scan remains clean;
- no required surface is stale.
