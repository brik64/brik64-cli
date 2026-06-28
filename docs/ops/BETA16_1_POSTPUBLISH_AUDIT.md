# BRIK64 CLI Beta16.1 Post-Publication Audit

## RESUME

- lane: `cli_0_1_beta`
- iter_id: `beta16.1-postpublish-exhaustive-audit`
- source_sha: `c92b1e1c0284835355ca79744fce410af0f64f42`
- stage1_sha: `n/a for public post-release audit`
- current gate: `postpublish audit and surface drift correction`
- last verdict: `PASS_RELEASE_TRAIN_LIVE_VERIFY`
- primary blocker: `npm latest dist-tag remains stale; npm beta tag is aligned`
- next exact command: `npm run release:manifest:validate`
- assumptions: Beta16.1 is not a fixpoint release and does not claim formal correctness.

## Executive Checklist

- 🟩 100% | 🟩 🟩 🟩 🟩 | CLI release train live verify passed for `0.1.0-beta.16.1`.
- 🟩 100% | 🟩 🟩 🟩 🟩 | `npm test`, full beta16.1 release audit, L6 generation gate, and package smoke passed locally.
- 🟩 100% | 🟩 🟩 🟩 🟩 | Web stale active surfaces corrected and redeployed.
- 🟨 75% | 🟩 🟩 🟩 ⬜ | SDK marketplaces aligned by exact version; npm `latest` tag remains stale while npm `beta` tag is aligned.
- 🟨 75% | 🟩 🟩 🟩 ⬜ | Public installer is correct for Linux x64; local macOS install fails closed because no macOS asset is published.
- 🟥 50% | 🟩 🟩 🟥 ⬜ | Release train hardening still needs a CI runner failure investigation for `brik64-admin` web/docs/SDK workflows.
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Beta17 fixpoint evidence campaign remains separate and not authorized by Beta16.1 evidence.

## Commands Executed

```bash
npm test
npm run gate:beta16.1:full-release-audit
npm run release:flow:audit
npm run gate:cli:l6-generation-required
npm run smoke:beta16.1:package
curl -fsSL https://brik64.com/cli/beta.json
curl -fsSL https://brik64.com/cli/releases/0.1.0-beta.16.1.json
npm view @brik64/core version
npm view @brik64/core@beta version
curl -fsSL https://pypi.org/pypi/brik64/json
curl -fsSL -A 'brik64-audit/1.0' https://crates.io/api/v1/crates/brik64-core
```

## Verified Public State

- CLI channel manifest: `currentVersion=0.1.0-beta.16.1`.
- Release manifest: `version=0.1.0-beta.16.1`.
- Installer: serves `0.1.0-beta.16.1` and fails closed on unsupported platforms with the requested version in the error message.
- Web `/download`, `/sdks`, `/presskit`, and agent-readable `/home-cli/agent.json`: active beta6/beta16 stale references removed.
- Docs entrypoint and public skill entrypoint: beta16.1 visible.
- npm: exact `@brik64/core@0.1.0-beta.16.1` and dist-tag `beta` are available; `latest` remains `0.1.0-beta.6.1`.
- PyPI: `brik64==0.1.0b16.post1`.
- crates.io: `brik64-core@0.1.0-beta.16.1`.

## Findings

### P1: npm latest dist-tag is stale

`npm view @brik64/core version` returns `0.1.0-beta.6.1`, while `npm view @brik64/core@beta version` returns `0.1.0-beta.16.1`.

Release guidance should use the exact version or `@beta` tag until npm credentials or trusted publishing can update `latest`. This is a distribution-surface issue, not a CLI binary correctness issue.

### P2: Linux x64 is the only installable public asset

The installer correctly fails closed on macOS with an unsupported-platform message. Docker was not available in the audit environment, so a fresh Linux x64 public install was not re-run locally in this pass. Package smoke and live verify cover the published Linux x64 package path.

### P2: Release train workflows on `brik64-admin` need runner-level diagnosis

Web/docs/SDK workflow jobs previously failed before runner assignment, requiring direct deploys or manual publication catch-up. Beta17 must not rely on manual catch-up for an atomic release claim.

### P2: Generated evidence dirties the worktree

Running release gates writes report files under `evidence/`. `release-manifest-validate` allows known generated evidence, but it omitted `evidence/release-train-live-verify/report.json`. This has been patched so post-live-verify validation can distinguish allowed generated evidence from real dirty source.

## Claim Boundary

Beta16.1 remains a public CLI beta. It can be described as a Linux x64 local CLI package with an embedded local runtime profile when supported by `engine status` and package smoke evidence. It must not be described as self-hosting, definitive fixpoint, toolchain-independent, formal N5, or universally correct.

## Closure Criteria Before Beta17

- npm dist-tag strategy closed: either `latest` moves to beta16.1+ or public docs consistently use exact/`@beta` paths with an explicit release policy.
- brik64-admin workflow runner failures have a durable resolution or an alternate automated deployment lane.
- Beta17 has fresh fixpoint evidence; Beta16.1 evidence must not be reused as fixpoint evidence.
