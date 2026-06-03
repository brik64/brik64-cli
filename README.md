# BRIK64 CLI

```text
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   ██████╗ ██████╗  ██╗██╗  ██╗ ██████╗ ██╗  ██╗      ║
║   ██╔══██╗██╔══██╗ ██║██║ ██╔╝██╔════╝ ██║  ██║      ║
║   ██████╔╝██████╔╝ ██║█████╔╝ ███████╗ ███████║      ║
║   ██╔══██╗██╔══██╗ ██║██╔═██╗ ██╔═══██╗╚════██║      ║
║   ██████╔╝██║  ██║ ██║██║  ██╗╚██████╔╝     ██║      ║
║   ╚═════╝ ╚═╝  ╚═╝ ╚═╝╚═╝  ╚═╝ ╚═════╝      ╚═╝      ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

BRIK64 CLI is the public beta command-line surface for local BRIK64 project
workflows. It gives developers a practical way to start working with
PCD-oriented structure, local evidence review, and claim-safe project scaffolding
from their own machine.

Generated code is easy to ship. Trust is the harder part. BRIK64 CLI is built
for teams that want software work to carry clearer structure, repeatable
evidence, and release language that stays aligned with bounded artifacts.

BRIK64 is based on Digital Circuitality: the idea that critical software should
be shaped as inspectable, composable logic rather than treated only as text.
In BRIK64 workflows, `.brik` project state, PCD seed material, local evidence,
and release metadata are kept close to the code so a team can review how a
software surface is described, packaged, and promoted.

PCD, or Program Circuit Description, is the structural description layer used by
BRIK64 to model software logic as reviewable pieces. In this beta, the CLI gives
developers an entry point into that workflow: project scaffolding, local PCD
examples, evidence files, package metadata, and public-beta release checks.
Stronger certification and compiler claims remain governed by the evidence gates
maintained in `brik64-prod`.

Start from the BRIK64 homepage: https://brik64.com

For install instructions, technical context, and methodology notes, read the
docs: https://docs.brik64.com

## Official Channels

- Website: [brik64.com](https://brik64.com)
- Docs: [docs.brik64.com](https://docs.brik64.com)
- npmjs primary package:
  [@brik64/cli](https://www.npmjs.com/package/@brik64/cli)
- GitHub Releases:
  [brik64/brik64-cli releases](https://github.com/brik64/brik64-cli/releases)
- GitHub Packages mirror:
  [@brik64/cli package mirror](https://github.com/brik64/brik64-cli/pkgs/npm/cli)
- Agent skills:
  [brik64-tools-skills](https://github.com/brik64/brik64-tools-skills)
- Public beta roadmap:
  [BRIK64 CLI Public Roadmap](docs/PUBLIC_ROADMAP.md)

## Public Interaction Policy

This repository is public for package inspection, release review, install
metadata, bounded evidence review, and issue reporting.

Allowed:

- Open issues for reproducible CLI beta bugs.
- Open issues for docs, release, npm, checksum, or install metadata mismatches.
- Report security concerns through `SECURITY.md`.

Not accepted:

- External pull requests.
- External direct commits.
- Public edits to release evidence, license text, package metadata, workflows,
  install paths, or public claim surfaces.

BRIK64 lands changes through authorized maintainers so package metadata, public
claims, checksums, licenses, release notes, and docs remain aligned.

## Status

Current beta: [`0.1.0-beta.3`](https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.3)

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

Public web surface: [brik64.com](https://brik64.com)

Docs: [CLI install guide](https://docs.brik64.com/cli/install)

GitHub Packages mirror:

```sh
npm install -g @brik64/cli@beta --registry=https://npm.pkg.github.com
```

The npmjs package remains the primary public install path. GitHub Packages is a
GitHub-visible mirror for release inspection and organization package inventory.

## CLI And Agent Skill

BRIK64 is designed for humans and AI agents working together. Use the CLI for
local project actions and the official `brik64` skill for agent behavior,
claim-safe reporting, `.brik` traceability, PCD 1.0 workflow, and
`AGENTS.md` managed-instruction rules.

Skill repository:
[brik64/brik64-tools-skills](https://github.com/brik64/brik64-tools-skills)

Recommended agent workflow:

```text
read docs.brik64.com -> check current skill repo -> inspect repo state
-> run brik commands -> preserve .brik traceability -> report bounded evidence
```

Install or read the official agent skill from the public skill repository before
using BRIK64 agent workflows:

```text
https://github.com/brik64/brik64-tools-skills
```

`brik init` prepares local BRIK64 metadata. It does not create or modify
`AGENTS.md`. The current CLI beta does not expose `brik skill` subcommands; any
agent instruction installation must remain explicit, reviewable, and
consent-based.

## What It Does

- Provides the `brik` command for the BRIK64 CLI beta.
- Supports local PCD-oriented project scaffolding and inspection workflows.
- Includes seed PCD examples and bounded evidence artifacts for CLI beta review.
- Keeps evidence boundaries visible as teams move from local workflow to stronger
  BRIK64 review.
- Establishes the public package surface for controlled CLI evaluation and future
  SDK alignment.

## Repository Map

Use this map to understand what each public path contains before installing,
auditing, or filing an issue.

| Path | What it contains |
| --- | --- |
| `src/brik.js` | Executable Node.js entry point for the current public beta `brik` command. |
| `tests/smoke.sh` | Local smoke test for version, help, init, skill install policy, status, and certify command behavior. |
| `pcd/` | Candidate PCD seed material that describes the intended CLI command structure and composition path. |
| `evidence/` | Public beta evidence notes and generated-review placeholders used for package inspection. |
| `packaging/` | Platform packaging notes and local package review material for release lanes. |
| `docs/` | Release, distribution, governance, platform, publishing, testing, and methodology documentation. |
| `.github/` | Repository governance, CI, package publishing, CodeQL, Dependabot, issue templates, and maintainer ownership rules. |
| `.brik/manifest.json` | BRIK64 project metadata for local traceability. It is not a certificate. |
| `README.md` | Public entry point for installation, scope, repo map, release assets, and license summary. |
| `LICENSE` | Proprietary beta license terms for BRIK64 CLI. |
| `NOTICE` | Copyright and third-party notice surface. |
| `SECURITY.md` | Security reporting policy and supported beta version scope. |
| `CONTRIBUTING.md` | Public interaction policy: issues accepted, external pull requests not accepted. |
| `package.json` | npm package metadata, executable mapping, scripts, package files, and beta keywords. |

For a fuller file-by-file description, read
[`docs/REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md).

## Current Scope

The `0.1.0-beta.3` release is scoped to public beta evaluation. It is centered
on local developer workflow, macOS package validation, PCD seed material, and
release evidence review. Production certification, expanded platform support,
and advanced compiler-methodology claims are promoted only when the matching
BRIK64 gates and evidence packs authorize that scope.


## Release Assets

Current beta availability:

| Surface | Status | Link |
| --- | --- | --- |
| npmjs package | Primary public beta install path | [@brik64/cli on npm](https://www.npmjs.com/package/@brik64/cli) |
| GitHub Release | Versioned release notes and beta asset review | [v0.1.0-beta.3](https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.3) |
| GitHub Packages | GitHub-visible npm mirror for organization package inventory | [@brik64/cli mirror](https://github.com/brik64/brik64-cli/pkgs/npm/cli) |
| Docs | Install and usage documentation | [CLI install guide](https://docs.brik64.com/cli/install) |
| Website | Public product entry point | [brik64.com](https://brik64.com) |

Current platform asset:

- macOS Apple Silicon package for local CLI evaluation, listed in the
  [v0.1.0-beta.3 GitHub Release](https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.3).

Planned release lanes:

- macOS Intel package after platform-specific package and smoke gates pass.
- Debian/Ubuntu Linux packages after distro-specific build and install gates pass.
- Windows PC package after Windows runner validation and install smoke pass.
- Homebrew, curl/GCP, apt-ready metadata, and GitHub Packages support the
  platform milestones as distribution channels; they are not standalone product
  milestones.

Each platform package should ship with its own artifact, checksum, install smoke,
and release evidence before it is promoted on npm, GitHub Releases, docs, or
brik64.com.

## Release Evidence

The public beta package is tied to versioned release artifacts, checksums, and
operator gates. Use the GitHub release assets and checksums to review the exact
package candidate before treating any install path as authoritative.

GitHub release:
[v0.1.0-beta.3](https://github.com/brik64/brik64-cli/releases/tag/v0.1.0-beta.3)

## Copyright And License

Copyright (c) 2026 BRIK64 INC. All rights reserved.

See [LICENSE](LICENSE) and [NOTICE](NOTICE). BRIK64 CLI public beta is
proprietary evaluation software from BRIK64 INC. Production, commercial,
hosted, redistribution, partner, enterprise, regulated, or
certification-oriented use requires written commercial terms from BRIK64 INC.
