# BRIK64 Release Train Runbook

This runbook is the operator path for publishing a BRIK64 CLI beta release
across the public curl installer, GitHub Release, SDK marketplaces, docs, web,
and public skills. The release is not closed until every public channel verifies
the same release manifest.

## Current Baseline

- Active public version: `0.1.0-beta.8` once the beta8 publish workflow and
  post-publish live verifier both pass.
- Active manifest: `release/manifest.json`
- Active manifest digest: compute from `main` immediately before dispatch.
- Active release tag format: `v<version>`
- Publish confirmation string format:
  `PUBLISH <version> <manifest-sha256>`

## Source Of Truth

`release/manifest.json` is the only file allowed to name the release version,
install command, SDK marketplace versions, public URLs, and required evidence.
Docs, web, skills, GitHub Release notes, GCP installer metadata, and SDK package
metadata are consumers of that manifest.

Do not publish a channel manually when another channel is still stale. If a
single public channel diverges after mutation begins, classify the state as a
partial-publication incident and recover through a superseding manifest.

## Required Secrets

Configured in GitHub Actions, not committed:

- `BRIK64_GITHUB_RELEASE_TOKEN`
- `BRIK64_NPM_TOKEN`
- `BRIK64_PYPI_TOKEN`
- `BRIK64_CRATES_TOKEN`
- `BRIK64_DOCS_DISPATCH_TOKEN`
- `BRIK64_WEB_DEPLOY_TOKEN`
- `BRIK64_SKILLS_REPO_TOKEN`
- `BRIK64_GCP_WORKLOAD_IDENTITY_PROVIDER`
- `BRIK64_GCP_SERVICE_ACCOUNT`

GCP publication uses Workload Identity Federation. Do not reintroduce long-lived
JSON service-account keys unless a separate security review explicitly approves
that fallback.

## Preflight

Run these before publication:

```bash
git status --short --branch
npm run release:manifest:validate
npm run release:train:dry-run
npm run release:train:live-verify
```

For beta9, run the staged SDK and manifest guards before attempting public
mutation:

```bash
npm run gate:beta9:sdk-marketplace-publish
npm run gate:beta9:sdk-marketplaces
npm run gate:beta9:manifest-drift
npm run gate:beta9:release-readiness
```

If `gate:beta9:sdk-marketplace-publish` reports
`npm_auth_failed_or_missing`, follow
`docs/BETA9_SDK_MARKETPLACE_RELEASE_RUNBOOK.md` and do not publish PyPI or
crates.io independently.

Expected result:

- manifest validation has no failures;
- dry-run has no mutation;
- live verifier observes the current public release without drift;
- the working tree is clean or only contains expected regenerated evidence that
  will be committed before publication.

Do not run standalone report-writing commands immediately before
`release:train:dry-run` in the same clean-worktree gate. The dry-run command
already runs manifest validation with controlled dirty-state handling. Running
report writers first can make the dry-run fail correctly with
`initial_worktree_dirty`.

GitHub Actions release dry-runs must checkout full history and provide a
GitHub token:

```yaml
- uses: actions/checkout@v6
  with:
    fetch-depth: 0

- name: Release train dry run
  env:
    GH_TOKEN: ${{ github.token }}
  run: npm run release:train:dry-run
```

`fetch-depth: 0` is required because the release-flow audit proves that
`release/manifest.json.source.commit` is an ancestor of `HEAD`. Shallow
checkouts can make valid ancestry look invalid.

## Publication

Use the GitHub Actions workflow from `main`:

```bash
gh workflow run release-train-publish.yml \
  --repo brik64/brik64-cli \
  --ref main \
  -f manifest_digest="<manifest-sha256>" \
  -f confirm="PUBLISH <version> <manifest-sha256>" \
  -f execute_publication=true
```

The workflow must:

1. validate the manifest;
2. run dry-run gates;
3. run live verification before mutation;
4. prepare SDK workspaces;
5. publish or confirm GitHub Release;
6. publish or confirm npm, PyPI, and crates.io SDK packages;
7. upload the curl installer and channel manifest to GCP;
8. dispatch docs, web, and skills consumers;
9. run post-publish live verification.

`release/manifest.json.state` must remain `draft` while a release candidate is
being assembled. Move it to `public` only after the candidate gates, public
copy, SDK/docs/web/skills sync gates, and signed commit requirements are ready
for actual publication. When the manifest is promoted to `public`, README
wording must also change from candidate language to public-release language.

The workflow is idempotent for already-published SDK versions. Re-running after
a transient marketplace/network failure should confirm existing packages rather
than attempting to overwrite immutable versions.

## Consumer Workflows

The release train dispatches a `repository_dispatch` event with type
`brik64-release-manifest`.

Required consumers:

- `brik64-admin/brik64-docs-site`: updates install docs and release notes from
  the manifest payload.
- `brik64-admin/brik64.com`: verifies public web copy, installer command, SDK
  versions, and live routes.
- `brik64/brik64-tools-skills`: verifies the public agent skill version,
  install command, SDK versions, and absence of private engine nomenclature.

Consumer success is evidence that the receiving repo did not silently ignore the
release manifest. Dispatch success alone is not release closure.

## Post-Publish Verification

Run or re-run:

```bash
gh workflow run release-train-live-verify.yml \
  --repo brik64/brik64-cli \
  --ref main
```

The release is closed only when `evidence/release-train-live-verify/report.json`
has:

```json
{
  "decision": "PASS_RELEASE_TRAIN_LIVE_VERIFY",
  "failures": []
}
```

Verify these live surfaces for the same version:

- `https://brik64.com/cli/install.sh`
- `https://brik64.com/cli/beta.json`
- GitHub Release tag
- docs install page
- web home and changelog
- npm `@brik64/core`
- PyPI `brik64`
- crates.io `brik64-core`
- public `brik64-tools-skills` skill

## Public Changelog Rule

Public changelog entries describe user-visible changes only: commands, install
behavior, SDK API/package changes, supported formats, compatibility changes,
error messages, and user-facing fixes.

Do not put internal release decisions, evidence mechanics, approval flow,
cross-repo coordination, rollback planning, or unpublished engineering names in
public changelog copy. Those belong in manifests, internal reports, and evidence
artifacts.

## GitHub Protection Geometry

The `main` branch requires signed commits, code owner review, last-push approval
from someone other than the last pusher, linear history, and resolved review
threads.

For release-fix PRs, use this geometry:

1. The account that opens and pushes the PR must be different from the account
   that approves it.
2. The approving account must be in `@brik64/brik64-cli-maintainers`.
3. If GitHub says "New changes require approval from someone other than X",
   do not retry the same approval. Change the PR/push geometry or use the other
   maintainer account.
4. Resolve or obsolete all review threads before merge. A single unresolved
   code-quality comment blocks protected branch update.
5. Do not use admin override as release evidence.

If a PR is a single commit and branch protection still blocks a CLI merge, check
the exact protected-branch rejection by attempting a non-mutating/expected-fail
push to `main` and reading the GitHub error. Treat that message as authoritative.

## Partial-Publication Incident

If any channel mutates while another channel remains stale:

1. stop new publication attempts;
2. preserve the failing workflow artifacts;
3. create a superseding manifest that records the failed or superseded state;
4. restore the curl/GCP channel to the previous known-good object if the
   installer is stale or unsafe;
5. amend GitHub Release notes to point to the superseding manifest;
6. fix the failing consumer or marketplace blocker;
7. rerun publish and live verification from `main`.

Never describe a release as public merely because GitHub Release or one SDK
marketplace succeeded.

## Operator Memory

After a release closes, write a small memory note with:

- version and manifest digest;
- workflow run IDs;
- public verifier decision;
- any incident and fix;
- credential or provider boundary changes, without secrets.

The note must not include raw tokens, API keys, passwords, or private source
snapshots.
