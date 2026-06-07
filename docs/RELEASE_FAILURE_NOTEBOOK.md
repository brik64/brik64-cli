# BRIK64 Release Failure Notebook

Status: operator notebook for failed or partial release trains.

Use this notebook when any required public release channel mutates or fails
during publication.

## 1. Freeze

- [ ] Stop new publication attempts.
- [ ] Preserve failed workflow artifacts.
- [ ] Preserve package, checksum, manifest and live verifier reports.
- [ ] Record timestamp and operator.

## 2. Classify The Failure

Choose the first matching class:

- [ ] `pre_publication_gate_failed`: no public channel changed.
- [ ] `github_release_partial`: GitHub tag/release changed, later channel failed.
- [ ] `sdk_marketplace_partial`: at least one SDK package changed, later channel failed.
- [ ] `curl_gcp_partial`: installer or channel manifest changed, later channel failed.
- [ ] `docs_web_skills_partial`: docs, web or skills changed inconsistently.
- [ ] `live_verifier_failed`: all mutations ran, but public verifier found drift.

## 3. Record Evidence

| Item | Value |
| --- | --- |
| Version | |
| Manifest digest | |
| Failing workflow run | |
| First failing step | |
| Mutated surfaces | |
| Unmutated surfaces | |
| Live verifier decision | |
| Package SHA | |
| Curl beta.json version | |

## 4. Decide Recovery Path

Use rollback only when the current public installer or package pointer is unsafe.
Otherwise prefer a superseding manifest so immutable marketplace artifacts remain
traceable.

- [ ] Rollback curl/GCP to previous known-good object.
- [ ] Supersede with a new manifest.
- [ ] Amend GitHub Release notes to point to superseding state.
- [ ] Update release issue with failure class and evidence.
- [ ] Re-run dry-run from a clean branch.
- [ ] Re-run mutation workflow only after the blocker is fixed.

## 5. Post-Incident Checks

- [ ] Public curl installer is safe.
- [ ] Public changelog does not call failed release complete.
- [ ] Docs/web/skills do not point to unavailable SDKs or packages.
- [ ] SDK marketplace pages are either correct or explicitly superseded.
- [ ] Release issue remains open until live verifier passes.

## Methodology Recycling

If the same failure could recur, create or update a gate before retrying:

- [ ] Package content snapshot gate.
- [ ] Marketplace availability gate.
- [ ] Docs/web/skills dispatch evidence collector.
- [ ] Cloudflare/curl live verifier rule.
- [ ] Public changelog claim-safety scan.
- [ ] Worktree cleanliness precheck.

## Claim Boundary

A partial release is not public completion. Do not close the release issue or
announce availability until all required public surfaces verify the same
manifest or have explicit release-approved deferrals.
