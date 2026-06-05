# Beta6 Bootstrap Prototype Status

Date: 2026-06-05

Status: non-release prototype boundary.

## Rule

Any direct implementation work in `src/brik.js`, package wrappers, SDK source,
docs bundles, or release assets for beta6 is classified as
`bootstrap_prototype_non_release` until the L6+N5 Hetzner factory regenerates
the final artifact from PCD/polymer sources.

This is intentional. Hand-authored code can be used to discover command shape,
tests, diagnostics and UX behavior, but it is not the semantic source for a
public beta.

## Current Boundary

The beta6 generation gate is:

```sh
npm run gate:beta6:l6-hetzner
```

Current verdict:

```text
BLOCKED_L6_FULL_CLI_GENERATION_UNAVAILABLE
```

The remote L6+N5 host passes identity, checksum, health and audit checks, but
currently reports `general_compile_supported=route2_bounded_only`. That means
public beta6 cannot be generated from the full CLI polymer yet.

## Promotion Requirement

A beta6 implementation may be promoted only when
`evidence/beta6-l6-hetzner-generation/report.json` records:

```text
PASS_L6_FULL_CLI_GENERATION_READY
```

and the generated report binds:

```text
pcd inventory -> pcd/cli_polymer.pcd -> generated artifact -> package manifest -> release manifest
```

Until then, beta6 remains candidate-only and no curl/GitHub/docs/web/skills/SDK
publication may be declared complete.
