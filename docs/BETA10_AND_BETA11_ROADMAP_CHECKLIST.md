# BRIK64 CLI Beta10 Closure And Beta11 Roadmap Checklist

Status: active execution checklist.

Date: 2026-06-07.

## Scope

This document converts the beta10 release work and the next beta11 hardening
work into executable checklists. It is intentionally public-claim safe: beta10
and beta11 are Carril A public CLI beta iterations. They must not claim
self-hosting, fixpoint, formal N5, independence from bootstrap tooling, or
universal program correctness unless a separate Carril B evidence pack proves
that scope.

## Executive Dashboard

- 🟨 82% | 🟩 🟩 🟩 ⬜ | Beta10 CLI implementation, package and local gates.
  - Done: local commands, import DAG, constants, explain, lock, telemetry
    boundary, feedback dry-run, redacted error inspection, local gate, closed
    package candidate, package smoke and PR CI.
  - Remaining: release asset, review approval and merge.
- 🟨 45% | 🟩 🟩 ⬜ ⬜ | SDK beta10 source alignment.
  - Done: JavaScript/TypeScript, Python and Rust source PRs opened and tested
    locally where supported.
  - Remaining: marketplace publication or explicit out-of-scope release evidence.
- 🟨 55% | 🟩 🟩 🟩 ⬜ | Docs and skills beta10 alignment.
  - Done: docs PR, public-surface verification, skill PR and private-term scan.
  - Remaining: docs deployment, skill publication and live verification.
- 🟥 35% | 🟩 🟥 ⬜ ⬜ | Web, curl and download surfaces.
  - Done: beta10 web source PR, installer metadata staging, web build.
  - Remaining: final artifact SHA, deploy, curl install smoke and download
    route verification.
- 🟥 20% | 🟩 ⬜ ⬜ ⬜ | Release train automation hardening.
  - Done: dry-run accepts beta10 local gate.
  - Remaining: generic beta package builder, release manifest promotion,
    SDK marketplace gate reuse, docs/web/skills dispatch evidence and final
    live verifier evidence.
- 🟥 20% | 🟩 ⬜ ⬜ ⬜ | Beta11 product hardening.
  - Started: release workflow notebooks/runbooks and release-train issue
    template.
  - Planned: opt-in telemetry transport, user feedback endpoint, automatic
    redacted error reporting, machine-readable diagnostics stability and
    package content minimization.

## Beta10 Release Closure Checklist

### 1. CLI Candidate

- [x] Version all CLI-visible surfaces as `0.1.0-beta.10`.
- [x] Add transitive same-directory import DAG support.
- [x] Add literal `i64` constants for supported PCD programs.
- [x] Add `brik64 explain <file.pcd>` human output.
- [x] Add `brik64 explain <file.pcd> --json` machine output.
- [x] Add `brik64 lock` local hash evidence.
- [x] Add `brik64 telemetry status` and `brik64 telemetry explain`.
- [x] Keep telemetry disabled by default.
- [x] Add `brik64 feedback --dry-run` with redacted preview.
- [x] Add redacted local error-report inspection.
- [x] Add local beta10 gate.
- [x] Build final package from a clean staging manifest with no recursive
  evidence payload.
- [x] Run local package smoke from the staged package candidate.
- [ ] Create GitHub Release `v0.1.0-beta.10` with final package and checksum.
- [ ] Re-run package smoke from the published release asset.

### 2. SDKs

- [x] Align JS/TS SDK source to `0.1.0-beta.10`.
- [x] Align Python SDK source to `0.1.0b10`.
- [x] Align Rust SDK source to `0.1.0-beta.10`.
- [x] Run JS build and tests.
- [x] Run Rust tests and doctests.
- [x] Run Python 3.13 import and behavior smoke.
- [ ] Publish or explicitly defer npm package `@brik64/core@0.1.0-beta.10`.
- [ ] Publish or explicitly defer PyPI package `brik64==0.1.0b10`.
- [ ] Publish or explicitly defer crates.io package `brik64-core@0.1.0-beta.10`.
- [ ] Verify marketplace pages after publication or deferral.

### 3. Docs, Web, Changelog And Skills

- [x] Update docs source to beta10.
- [x] Regenerate `llms.txt` and `llms-full.txt`.
- [x] Run public-surface docs verification.
- [x] Update public skills source to beta10 without private nomenclature.
- [x] Update web source to beta10 install and changelog surfaces.
- [x] Keep public changelog limited to user-visible functionality.
- [ ] Deploy docs and verify public routes.
- [ ] Deploy web and verify public routes.
- [ ] Publish skills and verify public repository state.
- [ ] Verify `https://brik64.com/cli/install.sh` installs beta10.
- [ ] Verify `https://brik64.com/cli/beta.json` points to beta10.

### 4. Atomic Release Gate

- [ ] Merge CLI PR after required review.
- [ ] Merge SDK PRs or record release-approved deferrals.
- [ ] Merge docs, web and skills PRs.
- [ ] Run release train dry-run from clean `main`.
- [ ] Run mutation-capable release train with exact manifest digest.
- [ ] Run live verifier after publication.
- [ ] Record final evidence paths, workflow run IDs, package hashes and public
  URLs in the release issue.

## Beta11 Planning Checklist

### 1. Telemetry And Feedback

- [ ] Add explicit opt-in command for telemetry enablement.
- [ ] Add explicit opt-out command and local config reset.
- [ ] Define telemetry schema with no raw source, no PCD body, no local paths, no
  secrets and no personal identifiers.
- [ ] Add local event queue with bounded size and visible purge command.
- [ ] Add transport endpoint only after privacy and security review.
- [ ] Add feedback submission command with dry-run default in CI.
- [ ] Add automatic error-report prompt that never sends data silently.
- [ ] Add redaction tests for tokens, emails, paths and common secret formats.

### 2. Diagnostics Stability

- [ ] Version `explain --json`, `doctor --json`, `lock --json` and error-report
  schemas.
- [ ] Add compatibility tests for machine-readable outputs.
- [ ] Add sample fixtures for import DAGs, constants, cycles, invalid constants,
  unknown identifiers and unsupported dynamic behavior.
- [ ] Document all user-facing error codes.

### 3. Package And Release Automation

- [ ] Replace per-beta package builders with a version-parameterized builder.
- [ ] Ensure package artifacts exclude generated evidence directories unless
  explicitly listed.
- [ ] Add package content snapshot gate.
- [ ] Add SDK marketplace publish gate that accepts version parameters instead
  of beta-specific scripts.
- [ ] Add release manifest update helper that writes docs/web/skills dispatch
  payloads from one source.
- [ ] Add live verifier assertions for telemetry/feedback routes once public.

### 4. Workflow Notebook And Runbook Hardening

- [x] Add an operator notebook/runbook that starts with current PR status, clean
  worktree checks, manifest digest and required approvals.
- [x] Add a failure notebook/runbook for partial publication rollback or
  supersede.
- [x] Add a release issue template that stores progress percentages, blockers,
  final evidence and next action.
- [ ] Add a post-release retrospective section for methodology recycling.

## Issue Map

The roadmap should be tracked as separate GitHub issues rather than one large
release bucket:

1. Beta10 public release train closure.
2. Beta10 SDK marketplace publication or explicit release deferral.
3. Beta10 docs, web, curl and skills live verification.
4. Beta11 opt-in telemetry, feedback and redacted error reporting.
5. Beta11 generic release automation and package-content gates.
6. Beta11 workflow notebooks and operator runbooks.

## Completion Rule

Beta10 is public only after CLI release assets, curl/GCP installer, docs, web,
skills, SDK marketplace state and live verifier all agree on the same version
or have explicit release-approved deferrals. A green PR, a local package, one
SDK marketplace, or a deployed web page is not sufficient.

Beta11 planning is ready only when each planned feature has a schema, tests,
privacy boundary and release gate before implementation begins.
