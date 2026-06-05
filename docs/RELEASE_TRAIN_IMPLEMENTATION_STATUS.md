# Release Train Implementation Status

Date: 2026-06-05

Branch: `codex/release-train-ci`

## Executive Checklist

- 🟩 100% | 🟩 🟩 🟩 🟩 | Manifest contract, validator, dry-run gate, sync payload, live verifier, and publication-plan preflight exist on the branch.
- 🟥 50% | 🟩 🟩 🟥 ⬜ | GitHub Actions release train branch publication.
  - The branch is pushed but must be reviewed and merged before workflows are active on the operational release branch.
- 🟥 75% | 🟩 🟩 🟩 ⬜ | Mutation-capable public publication.
  - The executor and GCP upload script exist and are fail-closed, but external channel secrets and downstream consumers still need to be configured before mutation mode can pass.
- ⬜ 25% | 🟩 ⬜ ⬜ ⬜ | First end-to-end release run from the active branch.
  - Depends on the merge and mutation executor work above.

## Implemented

- `release/manifest.json` binds beta5 version, public surfaces, SDK packages,
  release notes, and required evidence.
- `scripts/release-manifest-validate.js` validates manifest drift, public
  changelog language, required surfaces, SDK version alignment, and evidence
  decisions.
- `scripts/release-train-dry-run.js` runs manifest validation, smoke tests,
  release-surface checks, publication preflight, sync payload generation, and
  publication-plan generation without public mutation.
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

## Not Yet Implemented

- Concrete channel implementations for:
  - docs dispatch consumer.
  - web or CMS dispatch consumer.
  - public skills dispatch consumer.
- A GitHub environment policy that requires all publication secrets before
  `release-train-publish` can enter mutation mode.
- A persisted failed-release or supersede manifest record written by the
  workflow after a partial public mutation.

## Next Closure Patch

Wire docs, web, and skills dispatch consumers in their own repositories, then
run the publication workflow from the active branch with repository/environment
secrets configured.
