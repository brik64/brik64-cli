# AGENTS.md - brik64-cli-beta15.3-cleanup

<!-- BEGIN:brik64-repo-specific-control-layer -->

# BRIK64 Repo-Specific Agent Control Layer

Last updated: 2026-07-08
Repo: `brik64-cli-beta15.3-cleanup`
Lane: `cli-release-cleanup`

## Repo Role

Historical cleanup lane for Beta15.3 stale public-surface and release evidence correction.

## Current Strategic Control Layer

This repo inherits the BRIK64 Software Logic Sovereignty framework v0.1:

- Doctrine: **Logic Sovereignty**.
- Strategic category: **Software Logic Sovereignty**.
- Product/infrastructure category: **Logic Evidence Infrastructure**.
- Operating line: **The model can be rented. The logic must be owned.**

Control-layer chain:

```text
Requirement -> Logic Blueprint -> PCD / Structured Circuit -> Agent Branch -> Generated Implementation -> Evidence Pack -> Promotion Gate -> Traceable Release
```

Use `docs/strategy/LOGIC_SOVEREIGNTY_CONTROL_LAYER.md` as the local reference when writing positioning, product, docs, platform, engine, or evidence language.

## Repo-Specific Guardrails

Treat as historical/recovery lane. Do not promote old evidence into current release claims.

## Evidence And Validation

Expected checks before closing meaningful work: release-evidence validation and stale-surface checks.

Documentation-only changes may stop at file/path/link verification, but must say that no runtime, release, or formal evidence was produced.

## Claim Boundary

Allowed: BRIK64 gives teams infrastructure to make software logic explicit, traceable, portable, and governed.

Blocked without fresh evidence: complete enterprise sovereignty, formal certification, production correctness, final semantic verification, self-hosting, fixpoint completion, or independent runtime proof.

<!-- END:brik64-repo-specific-control-layer -->

## General Rules

- Reconstruct state from disk before non-trivial edits.
- Preserve existing user changes and dirty worktree state.
- Keep patches causal, minimal, and reviewable.
- Do not edit generated artifacts as source of truth.
- Do not commit secrets, tokens, keys, cookies, or private customer data.
- Report verification level and what remains unverified.
