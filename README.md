# BRIK64 CLI

```text
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   ██████╗ ██████╗  ██╗██╗  ██╗ ██████╗ ██╗  ██╗    ║
║   ██╔══██╗██╔══██╗ ██║██║ ██╔╝██╔════╝ ██║  ██║    ║
║   ██████╔╝██████╔╝ ██║█████╔╝ ███████╗ ███████║    ║
║   ██╔══██╗██╔══██╗ ██║██╔═██╗ ██╔═══██╗╚════██║    ║
║   ██████╔╝██║  ██║ ██║██║  ██╗╚██████╔╝     ██║    ║
║   ╚═════╝ ╚═╝  ╚═╝ ╚═╝╚═╝  ╚═╝ ╚═════╝      ╚═╝    ║
║                                                      ║
║        BRIK64 SYSTEM BOOT                            ║
║        SOFTWARE LOGIC COMPILER                       ║
║        MAKE SOFTWARE REVIEWABLE AGAIN                ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

BRIK64 CLI is the public beta command-line surface for local BRIK64 project
workflows. It gives developers a practical way to start working with
PCD-oriented structure, local evidence review, and claim-safe project scaffolding
from their own machine.

Generated code is easy to ship. Trust is the harder part. BRIK64 CLI is built
for teams that want software work to carry clearer structure, repeatable
evidence, and release language that stays aligned with verified artifacts.

## Status

Current beta: `0.1.0-beta.2`

This beta is intended for evaluation, local workflow trials, package smoke
testing, and bounded PCD/evidence review. The current public beta surface is
focused on macOS local CLI usage and developer-facing evidence workflows.
Broader platform support, stronger certification surfaces, and deeper compiler
claims remain gated by the evidence process in `brik64-prod`.

`brik64-prod` remains the authority for methodology, release gates, evidence
contracts, certification boundaries, and public claim authorization. This repo
contains the CLI source, package metadata, local tests, PCD seed files, and
versioned beta artifacts.

## Install

```sh
npm install -g @brik64/cli@beta
```

After installation:

```sh
brik --version
brik help
```

Public web surface: https://brik64.com/home-cli

Docs: https://docs.brik64.com/cli/install

## What It Does

- Provides the `brik` command for the BRIK64 CLI beta.
- Supports local PCD-oriented project scaffolding and inspection workflows.
- Includes seed PCD examples and bounded evidence artifacts for CLI beta review.
- Keeps evidence boundaries visible as teams move from local workflow to stronger
  BRIK64 review.
- Establishes the public package surface for controlled CLI evaluation and future
  SDK alignment.

## Current Scope

The `0.1.0-beta.2` release is scoped to public beta evaluation. It is centered
on local developer workflow, macOS package validation, PCD seed material, and
release evidence review. Production certification, expanded platform support,
and advanced compiler-methodology claims are promoted only when the matching
BRIK64 gates and evidence packs authorize that scope.


## Release Assets

Current beta asset:

- macOS Apple Silicon package for local CLI evaluation.

Planned release lanes:

- macOS Intel package after platform-specific package and smoke gates pass.
- Debian/Ubuntu Linux packages after distro-specific build and install gates pass.
- Windows PC package after Windows runner validation and install smoke pass.

Each platform package should ship with its own artifact, checksum, install smoke,
and release evidence before it is promoted on npm, GitHub Releases, docs, or
brik64.com.

## Release Evidence

The public beta package is tied to versioned release artifacts, checksums, and
operator gates. Use the GitHub release assets and checksums to review the exact
package candidate before treating any install path as authoritative.

GitHub release: https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.2

## Copyright And License

Copyright (c) 2026 BRIK64 INC. All rights reserved.

See `LICENSE` and `NOTICE`. BRIK64 CLI public beta is proprietary
evaluation software from BRIK64 INC. Production, commercial, hosted,
redistribution, partner, enterprise, regulated, or certification-oriented use
requires written commercial terms from BRIK64 INC.
