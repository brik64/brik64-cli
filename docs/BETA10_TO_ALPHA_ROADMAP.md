# BRIK64 CLI Beta10 To Alpha Roadmap

Status: planning document for Carril A public CLI iterations after
`0.1.0-beta.9`.

Date: 2026-06-07

## Scope

This roadmap plans the public CLI product path from `0.1.0-beta.10` through an
alpha-ready line. It keeps Carril A product releases separate from Carril B
L6+N5 self-host/fixpoint work.

Carril A remains `assisted_generation_non_claim` unless Carril B closes with
fresh evidence. Public releases must not claim formal N5, fixpoint,
self-hosting, Rust independence, universal correctness, or a pure BRIK64
toolchain.

Every beta in this roadmap must start from PCD/polymer or an equivalent
hash-bound logical contract before implementation. The release train remains
manifest-driven and must publish GitHub, curl/web, docs, SDKs, skills,
changelog, and live verification as one coordinated train.

## Executive Progress Model

Legend:

```text
🟩 complete and verified
🟨 advanced but needs validation
🟥 active focus
⬜ pending
⛔ blocked
```

Current overall state:

```text
- 🟥 15% | 🟥 ⬜ ⬜ ⬜ | Beta10 planning and issue setup
- ⬜ 0%  | ⬜ ⬜ ⬜ ⬜ | Beta11 developer experience
- ⬜ 0%  | ⬜ ⬜ ⬜ ⬜ | Beta12 SDK, skills and telemetry transport
- ⬜ 0%  | ⬜ ⬜ ⬜ ⬜ | Beta13 source lift and adoption reports
- ⬜ 0%  | ⬜ ⬜ ⬜ ⬜ | Beta14 local/cloud platform split
- ⬜ 0%  | ⬜ ⬜ ⬜ ⬜ | Beta15 alpha hardening
- ⬜ 0%  | ⬜ ⬜ ⬜ ⬜ | Alpha release candidate
```

Roadmap issues:

- [Beta10 modular PCD, diagnostics and SDK ESM](https://github.com/brik64/brik64-cli/issues/90)
- [Beta11 developer experience, feedback and local error reports](https://github.com/brik64/brik64-cli/issues/91)
- [Beta12 SDK parity, skills and opt-in telemetry transport](https://github.com/brik64/brik64-cli/issues/92)
- [Beta13 source lift preview and adoption reports](https://github.com/brik64/brik64-cli/issues/93)
- [Beta14 local/cloud split and platform contracts](https://github.com/brik64/brik64-cli/issues/94)
- [Beta15 alpha hardening candidate](https://github.com/brik64/brik64-cli/issues/95)
- [Alpha entry criteria for 0.2.0-alpha.1](https://github.com/brik64/brik64-cli/issues/96)
- [L6+N5 self-host/fixpoint milestone remains separate](https://github.com/brik64/brik64-cli/issues/97)

## Non-Negotiable Release Gates For Every Beta

- [ ] Version, package name, tarball name, `brik64 --version`, manifest, docs,
  web, SDKs, skills, and changelog all agree.
- [ ] PCD/polymer or logical contract exists for every public behavior change.
- [ ] L6+N5 internal factory is used where supported, with explicit
  `assisted_generation_non_claim` boundary.
- [ ] If L6+N5 cannot generate a surface, report
  `manual_surface_pending_pcd_generation` and do not use it for stronger claims.
- [ ] Edge, fail-closed, and variation tests are added for each meaningful
  behavior.
- [ ] Public changelog only describes user-visible functionality.
- [ ] Public claim scan rejects internal terms and unsupported claims.
- [ ] Release train publishes or verifies all required surfaces together.
- [ ] Live verifier passes after publication.
- [ ] No raw source, PCD source, absolute paths, tokens, emails, private repo
  names, or raw stderr are sent to telemetry, feedback, or error reporting.

## Beta10: Modular PCD And Safe Diagnostics

Goal: make PCD usable in medium-size local projects without weakening bounded
execution.

Progress:

```text
- 🟥 15% | 🟥 ⬜ ⬜ ⬜ | Planning and contracts
- ⬜ 0%  | ⬜ ⬜ ⬜ ⬜ | Parser/typechecker implementation
- ⬜ 0%  | ⬜ ⬜ ⬜ ⬜ | Tests and adversarial gates
- ⬜ 0%  | ⬜ ⬜ ⬜ ⬜ | Release train beta10
```

Required product features:

- [ ] PCD import DAG for local modules.
- [ ] Cycle detection with clear `import_cycle` diagnostics.
- [ ] Import hash binding in emitted outputs and local certificates.
- [ ] Compile-time constants:
  - [ ] `const NAME: i64 = literal;`
  - [ ] constants allowed in `repeat`, collection bounds, and simple
    expressions only after literal resolution;
  - [ ] fail closed for `const_cycle`, `const_not_literal`, and
    `const_out_of_bounds`.
- [ ] Stronger type checks:
  - [ ] parameter and return type mismatch;
  - [ ] collection element mismatch;
  - [ ] map key/value mismatch;
  - [ ] import call arity mismatch.
- [ ] `brik64 explain <file.pcd>`:
  - [ ] human output by default;
  - [ ] `--json` stable schema;
  - [ ] location, rule, impact, and next action for parser/type errors.
- [ ] `brik64 lock`:
  - [ ] writes `brik64.lock.json`;
  - [ ] records PCD, import graph, emitted targets, and local certificate
    hashes;
  - [ ] does not claim formal reproducibility.
- [ ] TypeScript SDK ESM plus CJS:
  - [ ] `exports.import`;
  - [ ] `exports.require`;
  - [ ] `exports.types`;
  - [ ] tests for Node ESM, CJS, Vite, and Next-style resolution.

Privacy and diagnostics scope for beta10:

- [ ] Add local-only anonymous diagnostics schema.
- [ ] Add `brik64 telemetry status`.
- [ ] Add `brik64 telemetry explain`.
- [ ] Add `brik64 feedback --dry-run`.
- [ ] Add local error report capture:
  - [ ] `.brik/error-reports/last.json`;
  - [ ] redacted stack trace;
  - [ ] normalized error code;
  - [ ] no network send in beta10 unless explicitly configured for staging.

Beta10 acceptance criteria:

- [ ] `PASS_BETA10_IMPORT_DAG_GATE`.
- [ ] `PASS_BETA10_CONST_GATE`.
- [ ] `PASS_BETA10_TYPECHECK_GATE`.
- [ ] `PASS_BETA10_EXPLAIN_LOCK_GATE`.
- [ ] `PASS_BETA10_SDK_ESM_GATE`.
- [ ] `PASS_BETA10_PRIVACY_REDACTION_GATE`.
- [ ] `PASS_RELEASE_TRAIN_PUBLISH_EXECUTE`.
- [ ] `PASS_RELEASE_TRAIN_LIVE_VERIFY`.

## Beta11: Developer Experience And Local Project Workflows

Goal: make the CLI comfortable for repeated daily use in local repositories.

Progress:

```text
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Formatter/linter
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Graph and templates
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Feedback local queue
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Release train
```

Required product features:

- [ ] `brik64 fmt` deterministic formatter.
- [ ] `brik64 lint` non-claim structural linting.
- [ ] `brik64 graph`:
  - [ ] `--json`;
  - [ ] `--dot`;
  - [ ] `--mermaid`.
- [ ] `brik64 init --template default|library|agent-skill|ci`.
- [ ] `brik64 examples`.
- [ ] Better line/column diagnostics.
- [ ] Improved migration flow for legacy PCD.

Feedback and error reporting:

- [ ] `brik64 feedback`.
- [ ] `brik64 feedback --category bug|docs|feature|install|compiler|sdk`.
- [ ] `.brik/feedback-queue.jsonl`.
- [ ] `brik64 errors status`.
- [ ] `brik64 errors enable`.
- [ ] `brik64 errors disable`.
- [ ] `brik64 errors explain-last`.
- [ ] Explicit user confirmation before attaching diagnostics.

Beta11 acceptance criteria:

- [ ] Formatter idempotence gate.
- [ ] Linter fail-closed gate for malformed projects.
- [ ] Graph output schema gate.
- [ ] Template smoke gate.
- [ ] Feedback queue redaction gate.
- [ ] Error report redaction gate.
- [ ] Release train passes atomically.

## Beta12: SDK, Skills, And Opt-In Telemetry Transport

Goal: align SDKs, public skills, and opt-in anonymous diagnostics as a product
feedback loop.

Progress:

```text
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | SDK parity
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Skills version awareness
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Telemetry transport
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Internal dashboard
```

SDK and skills:

- [ ] SDK parity fixtures across TypeScript, Python, and Rust.
- [ ] `brik64 sdk doctor`.
- [ ] Public skill becomes version-aware:
  - [ ] can inspect installed CLI version;
  - [ ] can recommend SDK install paths;
  - [ ] contains no internal L4/L5/L6/N5 nomenclature.
- [ ] Skill scaffolding generated by CLI template remains public-safe.

Telemetry:

- [ ] Telemetry remains opt-in.
- [ ] `brik64 telemetry enable`.
- [ ] `brik64 telemetry disable`.
- [ ] `brik64 telemetry export`.
- [ ] `brik64 telemetry purge-local`.
- [ ] Local queue `.brik/telemetry-queue.jsonl`.
- [ ] Endpoint `POST https://brik64.com/api/telemetry/cli`.
- [ ] Event schema `brik64.cli_telemetry_event.v1`.
- [ ] Events may include:
  - [ ] CLI version;
  - [ ] OS and architecture;
  - [ ] command name;
  - [ ] target language;
  - [ ] normalized error code;
  - [ ] duration bucket;
  - [ ] success/failure;
  - [ ] anonymous rotating installation id.
- [ ] Events must not include:
  - [ ] raw source;
  - [ ] PCD contents;
  - [ ] absolute paths;
  - [ ] repo names;
  - [ ] emails;
  - [ ] tokens;
  - [ ] raw stdout/stderr.

Feedback/error transport:

- [ ] Endpoint `POST https://brik64.com/api/feedback`.
- [ ] Endpoint `POST https://brik64.com/api/error-reports`.
- [ ] Error fingerprinting by normalized stack and error code.
- [ ] User-controlled diagnostic attachment.
- [ ] Optional public issue link only after explicit user approval.

Beta12 acceptance criteria:

- [ ] SDK parity gate.
- [ ] Skills public-surface gate.
- [ ] Telemetry opt-in gate.
- [ ] Telemetry redaction adversarial gate.
- [ ] Feedback redaction adversarial gate.
- [ ] Error-report redaction adversarial gate.
- [ ] Internal dashboard smoke gate.
- [ ] Release train passes atomically.

## Beta13: Source Lift And Adoption Reports

Goal: start converting existing code into PCD candidates without overclaiming
coverage or correctness.

Progress:

```text
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Lift preview
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Adoption reports
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Privacy boundary
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Release train
```

Required features:

- [ ] `brik64 lift js --preview`.
- [ ] `brik64 lift ts --preview`.
- [ ] `brik64 lift python --preview`.
- [ ] Generates PCD candidates, not certificates.
- [ ] Produces warnings for unsupported language constructs.
- [ ] Redacted source snapshot metadata only.
- [ ] `brik64 adoption report`.
- [ ] Local evidence bundle:
  - [ ] source file count;
  - [ ] supported function count;
  - [ ] unsupported construct count;
  - [ ] generated PCD candidate count;
  - [ ] no raw source by default.

Beta13 acceptance criteria:

- [ ] Lift fixtures for JS/TS/Python.
- [ ] Unsupported construct fail-open-as-warning but no false certificate.
- [ ] Adoption report schema gate.
- [ ] Privacy gate for source lift.
- [ ] Release train passes atomically.

## Beta14: Local/Cloud Split And Managed Platform Readiness

Goal: make free local workflows and paid/cloud workflows explicit without
fragmenting CLI UX.

Progress:

```text
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Account/session UX
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Local/cloud routing
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Platform API contracts
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Release train
```

Required features:

- [ ] `brik64 login`.
- [ ] `brik64 logout`.
- [ ] `brik64 account status`.
- [ ] `verify --local` stable and default.
- [ ] `verify --cloud` entitlement-gated.
- [ ] `polymerize --local` stable and default.
- [ ] `polymerize --cloud` entitlement-gated.
- [ ] Platform API contract files.
- [ ] Cloud unavailable fail-closed or graceful local fallback depending on
  command.
- [ ] No cloud correctness claims without evidence pack and entitlement.

Beta14 acceptance criteria:

- [ ] Account state machine gate.
- [ ] Local/cloud routing gate.
- [ ] Entitlement fail-closed gate.
- [ ] Platform API contract gate.
- [ ] Release train passes atomically.

## Beta15: Alpha Hardening Candidate

Goal: harden the product until it can support an alpha release without manual
operator supervision.

Progress:

```text
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Cross-platform install/smoke
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Update/rollback
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Release train rehearsal
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Alpha readiness report
```

Required features:

- [ ] macOS ARM install smoke.
- [ ] macOS Intel or Rosetta smoke.
- [ ] Linux x64 smoke.
- [ ] Linux ARM smoke or explicit blocked status.
- [ ] Windows native smoke or explicit blocked status.
- [ ] `brik64 update`.
- [ ] `brik64 rollback`.
- [ ] Signed channel manifests.
- [ ] Installer channel rollback test.
- [ ] Download analytics dashboard with privacy constraints.
- [ ] Error/feedback dashboard operational.
- [ ] Two consecutive releases pass the atomic release train without manual
  web/docs/SDK/skills hotfix.

Beta15 acceptance criteria:

- [ ] Cross-platform smoke matrix.
- [ ] Update/rollback gate.
- [ ] Signed manifest gate.
- [ ] Privacy dashboard gate.
- [ ] Two-release train rehearsal report.
- [ ] Alpha readiness report.

## Alpha Entry: `0.2.0-alpha.1`

Open `0.2.0-alpha.1` only after Beta15 closes.

Alpha readiness requirements:

- [ ] Public CLI install works on supported platforms.
- [ ] Unsupported platforms fail closed with useful messages.
- [ ] PCD subset is stable and documented.
- [ ] TypeScript, Rust, and Python emission generate executable projects.
- [ ] Imports, constants, lockfiles, explain, graph, fmt, lint, templates, and
  local verify are usable.
- [ ] SDKs are published and version-compatible.
- [ ] Public skills are version-aware and claim-safe.
- [ ] Telemetry, feedback, and error reporting are opt-in and redacted.
- [ ] Release train is atomically automated.
- [ ] Public changelog and docs are manifest-driven.
- [ ] Claim scan passes.
- [ ] Alpha release notes do not imply formal certification, N5, fixpoint,
  self-hosting, Rust independence, or pure BRIK64 toolchain.

Recommended alpha label:

```text
0.2.0-alpha.1
```

Recommended public description:

```text
BRIK64 CLI alpha for local PCD workflows, executable bounded emission, SDK
integration, project diagnostics, and opt-in privacy-preserving product
feedback.
```

## Parallel Carril B: L6+N5 Self-Host/Fixpoint

Carril B remains independent and must not be averaged into Carril A progress.

Progress:

```text
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Canonical motor PCD/polymer
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Harness generated from PCD
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | BIR/ELF/native hash-bound chain
- ⬜ 0% | ⬜ ⬜ ⬜ ⬜ | Fresh self-host/fixpoint evidence
```

Carril B requirements:

- [ ] PCD/polymer canonical source for motor and harness.
- [ ] Engine and harness generated from those PCDs.
- [ ] BIR/ELF/native outputs hash-bound.
- [ ] Serial, checksums, composite hash, and seal report.
- [ ] Hetzner deployment verifies same serial/hash.
- [ ] Self-host/fixpoint report is fresh and reproducible.
- [ ] Rust/Cargo/bootstrap no longer source of semantic claim.

Only after Carril B closes can the project consider a future
`1.0.0-beta.1` line with stronger factory claims.
