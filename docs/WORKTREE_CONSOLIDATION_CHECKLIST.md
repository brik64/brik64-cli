# Worktree Consolidation Checklist

Status: operating checklist for release train preparation.

Date: 2026-06-05

## Rule

Release automation must never depend on a dirty worktree. Cleanup is
conservative: classify, stage only owned paths, commit intentionally, and leave
unrelated user or prior-run changes untouched.

Do not use destructive cleanup commands such as `git reset --hard`, `git clean`,
or path checkout unless the owner explicitly authorizes that exact operation.

## Current Snapshot

Observed before this checklist was created:

| Repo | Branch | Snapshot | Action |
| --- | --- | --- | --- |
| brik64-cli | `codex/beta5-public-release` | tracked beta5 evidence files modified | leave evidence untouched; create CI/CD branch from current HEAD |
| brik64-prod | `codex/numeric-topology-n5-refactor` | many tracked and untracked operation artifacts | stage only this plan and report |
| brik64.com | `main` | ahead of legacy upstream plus unrelated dirty files | do not mutate in this phase |
| brik64-docs-site | current branch clean except known untracked files | docs beta5 already aligned | do not mutate in this phase |
| brik64-tools-skills | clean | skills beta5 already aligned | do not mutate in this phase |

## Preflight Checklist

- [ ] Capture `git status --short --branch` for every repo in scope.
- [ ] Capture current HEAD for every repo in scope.
- [ ] Identify tracked edits that belong to the requested task.
- [ ] Identify tracked edits that pre-exist and must be preserved.
- [ ] Identify untracked files that are evidence, generated output, or local
  scratch.
- [ ] Decide the branch for each repo before patching.
- [ ] Stage only owned paths by explicit filename.

## Commit Checklist

- [ ] Run narrow validation for changed files.
- [ ] Run `git diff --check`.
- [ ] Run secret pattern scan on changed public files.
- [ ] Verify staged diff contains only intended files.
- [ ] Commit with a message that names the release train phase.
- [ ] Push the exact branch used for the work.

## Public Release Cleanup Checklist

Before enabling release publication automation:

- [ ] Ensure `brik64-cli` has no unstaged release-manifest changes.
- [ ] Ensure generated evidence for the active release is committed or archived.
- [ ] Ensure `brik64.com` deployment branch tracks the production remote.
- [ ] Ensure `brik64-docs-site` has no stale untracked release docs.
- [ ] Ensure `brik64-tools-skills` has no private terminology drift.
- [ ] Ensure public release notes are functional, not internal.
- [ ] Ensure rollback or supersede records are available for every public
  surface.

## Close Criteria

A repo is clean enough for the release train when:

- all release-owned changes are committed and pushed;
- all unrelated changes are either untouched or documented as pre-existing;
- no public workflow reads local-only state;
- the branch being published is named in the release manifest.

