# Release Train Implementation Status

Date: 2026-06-05

Branch: `main`

## Executive Checklist

- 🟩 100% | 🟩 🟩 🟩 🟩 | Manifest contract, validator, dry-run gate, sync payload, live verifier, and publication-plan preflight are merged to `main`.
- 🟩 100% | 🟩 🟩 🟩 🟩 | GitHub Actions release train activation.
  - Cloudflare Bot Fight Mode blocker is closed; live verification passes from GitHub Actions.
- 🟩 100% | 🟩 🟩 🟩 🟩 | SDK artifact preparation in the publication runner.
  - The publish workflow clones private SDK repos and builds/packages JS, Python, and Rust SDK artifacts inside the runner.
- 🟨 75% | 🟩 🟩 🟩 ⬜ | Mutation-capable public publication.
  - Dry-run command preflight is clean. Real mutation is blocked only by missing GCP Workload Identity repository secrets.
- ⛔ 75% | 🟩 🟩 🟩 ⛔ | First end-to-end mutation run from `main`.
  - The release publisher service account now has `roles/iam.workloadIdentityPoolAdmin`.
  - `admin@brik64.com` now has `roles/iam.serviceAccountTokenCreator` on that service account.
  - Blocked until `admin@brik64.com` is reauthenticated locally, or another allowed Google Workspace operator runs the documented impersonated WIF commands.

## Implemented

- `release/manifest.json` binds beta5 version, public surfaces, SDK packages,
  release notes, and required evidence.
- `scripts/release-manifest-validate.js` validates manifest drift, public
  changelog language, required surfaces, SDK version alignment, and evidence
  decisions.
- `scripts/release-train-dry-run.js` runs manifest validation, smoke tests,
  release-surface checks, publication preflight, sync payload generation, and
  publication-plan generation without public mutation.
- `tests/smoke.sh` keeps sibling-repository SDK/docs/web/skills checks enabled
  for local release stations and skips those absolute-path checks on GitHub
  Actions, where the committed evidence reports and live verifier are the
  portable authority.
- `scripts/release-train-live-verify.js` observes public installer, channel
  manifest, GitHub Release, docs, web, SDK marketplaces, and public skill state.
- `scripts/release-train-sync-surfaces.js` generates public changelog markdown
  and a structured sync payload from the release manifest.
- `scripts/release-train-publish-plan.js` validates exact confirmation,
  required secret availability, ordered publication commands, and rollback
  instructions.
- `scripts/release-train-publish-execute.js` consumes the publication plan,
  validates command binaries and referenced paths before mutation, runs dry-run
  by default, and only executes ordered public commands with `--publish`.
- `scripts/release/upload-gcp-curl-surface.sh` prepares and uploads the curl
  installer, beta channel manifest, and CLI package object to the configured
  GCP bucket when publication mode is explicitly enabled.
- GitHub Actions workflows exist for dry-run, live verification, and
  publication-plan generation plus fail-closed publication execution.
- `release-train-publish.yml` prepares SDK publication workspaces on GitHub
  Actions runners by cloning `brik64-admin/brik64-lib-js`,
  `brik64-admin/brik64-lib-python`, and `brik64-admin/brik64-lib-rust`.
- `release-train-publish.yml` supports keyless GCP authentication through
  Google Cloud Workload Identity Federation.

## Not Yet Implemented

- GCP Workload Identity Pool/provider for `brik64/brik64-cli` on `main`.
  - Org policy `constraints/iam.allowedPolicyMemberDomains` allows only
    customer `C02zrapel`.
  - Org policy `constraints/iam.disableServiceAccountKeyCreation` blocks
    JSON service account keys.
  - The prepared keyless route is now service account impersonation through
    `brik64-cli-release-publisher@brik64-platform-mvp.iam.gserviceaccount.com`
    by `admin@brik64.com`.
- Concrete channel implementations for:
  - docs dispatch consumer.
  - web or CMS dispatch consumer.
  - public skills dispatch consumer.
- A GitHub environment policy that requires all publication secrets before
  `release-train-publish` can enter mutation mode.
- A persisted failed-release or supersede manifest record written by the
  workflow after a partial public mutation.

## Next Closure Patch

Reauthenticate `admin@brik64.com`, create the GCP Workload Identity
Pool/provider with the impersonated commands documented in
`docs/BETA5_PUBLIC_RELEASE_COMPLETION_PLAN.md`, configure the two GCP repository
secrets, and run `release-train-publish` from `main` in mutation mode using the
exact `PUBLISH <version> <manifest_digest>` confirmation string.
