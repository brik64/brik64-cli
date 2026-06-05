# BRIK64 Release Train CI/CD Plan

Status: implementation plan, not an active automation contract yet.

Date: 2026-06-05

## Goal

BRIK64 releases must move as one coordinated train. A public version is not
released until every required public surface has either been updated and
verified or explicitly marked out of scope in the signed release manifest.

The train covers:

- CLI curl installer and downloadable artifacts.
- GitHub tag, release notes, and release assets.
- SDK packages for the active public marketplaces.
- Web install surfaces and changelog.
- Documentation pages.
- Public agent skill surfaces.
- Post-release live verification.

## Current State

- beta5 was aligned manually across public surfaces.
- GitHub Actions currently contains partial publishing and documentation
  workflows, but no single fail-closed orchestrator owns the entire train.
- The release train needs a versioned manifest before adding destructive or
  public publishing steps.

## Release Train Checklist

- [x] Document required release surfaces and failure policy.
- [x] Define release manifest as the single source of truth.
- [x] Define conservative worktree consolidation rules.
- [ ] Add manifest validation command.
- [ ] Add dry-run orchestration workflow.
- [ ] Add publication workflow gated by dry-run evidence.
- [ ] Add docs and web sync workflow consumers.
- [ ] Add SDK marketplace publication consumers.
- [ ] Add live verification workflow.
- [ ] Add rollback and supersede playbooks.
- [ ] Run the full train for the next beta candidate.

## Architecture

```mermaid
flowchart TD
  A["Release manifest"] --> B["Preflight validation"]
  B --> C["Build and package CLI"]
  C --> D["Adversarial and install smoke gates"]
  D --> E["Stage artifacts"]
  E --> F["Publish atomically"]
  F --> G["Sync docs, web, changelog, skills"]
  G --> H["Live verification"]
  H --> I["Mark release public"]
```

The manifest is the only input allowed to name the public version. Workflows
must fail if a version appears in package files, docs, changelog, skills, or
installer metadata but does not match the manifest.

## Required Workflows

### 1. `release-manifest-validate`

Runs on pull requests and manual dispatch.

Checks:

- manifest schema is valid JSON.
- public version is semver prerelease or semver stable.
- CLI artifacts, SDK packages, docs, web, and skills surfaces are declared.
- no public changelog entry contains internal decision language.
- no known secret patterns are present.
- all required source repos and target refs are named.

Output:

- machine-readable validation report.
- release train readiness status.

### 2. `release-train-dry-run`

Runs on manual dispatch from the release branch.

Checks:

- builds CLI candidate.
- packages SDK candidates without publishing.
- regenerates public docs and web changelog inputs.
- validates public skill metadata against version-independent rules.
- runs smoke tests against local or staged artifacts.
- produces an immutable dry-run evidence bundle.

No public endpoint is modified by this workflow.

### 3. `release-train-publish`

Runs only after a successful dry run for the same manifest digest.

The workflow must publish in a controlled order:

1. GitHub tag and release assets.
2. Marketplace SDK packages.
3. GCP curl artifacts and installer metadata.
4. Docs and web content sync.
5. Public skills sync.
6. Live verification.

If any step fails before public traffic changes, the workflow aborts. If a step
fails after public traffic changes, the workflow must create a failed-release
record and require either rollback or supersede before another release can be
marked public.

### 4. `release-train-live-verify`

Runs after publish and on schedule for the active beta channel.

Checks:

- `https://brik64.com/cli/install.sh` installs the manifest version.
- `https://brik64.com/cli/beta.json` points to the same version and assets.
- docs install page shows the same version.
- web changelog shows only public functional changes.
- SDK marketplaces expose the same beta tag or documented equivalent.
- skills contain no private development nomenclature and are version-aware.

## Atomicity Rule

The release is not public when the first channel updates. The release is public
only when every required channel passes live verification for the same manifest
digest.

Allowed states:

- `draft`: manifest is being edited.
- `dry_run_passed`: local/staged evidence exists.
- `publishing`: public publication is in progress.
- `public`: all live surfaces verified.
- `failed`: at least one required surface failed after publish began.
- `superseded`: replaced by a newer manifest.

Any other state is invalid.

## Changelog Policy

Public changelogs describe user-visible changes only:

- new commands or changed command behavior.
- installer and platform support changes.
- SDK API changes.
- fixed user-visible bugs.
- security, compatibility, or migration notes.

Public changelogs must not describe internal methodology, approval decisions,
publishing route choices, private engine tiers, or operational debates.

## Skills Policy

Public skills must be version-independent at install time. A skill may discover
the active CLI version through a public manifest or `brik64 --version`, but it
must not hard-code private release methodology or internal generation labels.

Skills should guide the user through:

- installing or verifying the CLI.
- choosing normal SDK development, mixed SDK and PCD work, or full BRIK64 flows.
- checking that local tools match the public manifest.

## Secrets Policy

Workflow secrets must be named by purpose, not by secret value. The release
manifest may reference required secret names but must never contain tokens.

Required classes:

- GitHub release and repository write token.
- GCP object storage or deployment credential.
- npm publication token.
- PyPI publication token, if Python SDK is active.
- crates.io publication token, if Rust SDK is active.
- docs deployment credential.
- web deployment credential.
- skills repository write credential.

Every publishing job must fail closed when its required secret is unavailable.

## Acceptance Criteria

The CI/CD train is acceptable when:

- a pull request cannot merge with manifest drift.
- a release cannot publish with mismatched docs, web, SDK, skills, or installer
  versions.
- a failed channel blocks the final `public` state.
- the live verifier can independently prove the public version from public URLs
  and marketplace APIs.
- rollback or supersede instructions exist for every public channel.

