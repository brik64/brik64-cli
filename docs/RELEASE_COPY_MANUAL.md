# BRIK64 CLI Release Copy Manual

This manual standardizes public copy for BRIK64 CLI package pages, GitHub
releases, changelogs, repository descriptions, and launch snippets. It is built
for beta releases where public wording must be useful, commercial, searchable,
and aligned with BRIK64 evidence boundaries.

## Authority

- Product surface: BRIK64 CLI.
- Current candidate target: `0.1.0-beta.5`.
- Public web surface: https://brik64.com
- Docs: https://docs.brik64.com/cli/install
- Installer: https://brik64.com/cli/install.sh
- Latest public release: https://github.com/brik64/brik64-cli/releases
- Evidence authority: `brik64-prod` gates, manifests, checksums, and release
  reports.
- Implementation surface: `brik64-cli` source, package metadata, tests, PCD seed
  files, and beta artifacts.

## Voice Standard

BRIK64 release copy should be:

- technically serious;
- practical for developers;
- clear about beta maturity;
- evidence-aligned;
- commercially legible;
- confident without overreach.

Prefer scope language over negative disclaimers:

- `current beta scope`;
- `focused on macOS local CLI usage`;
- `gated by the BRIK64 evidence process`;
- `promoted when matching gates authorize the scope`;
- `release evidence available in attached manifests and checksums`.

## Canonical Package Description

Use this for `package.json.description` and short package surfaces:

```text
BRIK64 CLI public beta for local PCD workflows, bounded evidence review, and claim-safe project scaffolding.
```

Alternative short descriptions:

```text
BRIK64 CLI beta for local project scaffolding, PCD-oriented workflows, and evidence-aware software review.
```

```text
Command-line beta for BRIK64 local workflows, PCD seed material, and versioned release evidence.
```

## Long Description

Use this for release pages, npm README intros, GitHub repository description
expansion, and docs package cards:

```text
BRIK64 CLI is the public beta command-line surface for local BRIK64 project workflows. It gives developers a practical way to start working with PCD-oriented structure, local evidence review, and claim-safe project scaffolding from their own machine.

The beta5 candidate is focused on local CLI usage, package validation, seed PCD material, `brik doctor`, local candidate certification, hash-bound target emission, and developer-facing evidence workflows. Broader platform support, stronger certification surfaces, and deeper compiler-methodology claims are promoted only when the matching BRIK64 gates and evidence packs authorize that scope.
```

## GitHub Repository Description

Use one of these as the GitHub repo description:

```text
BRIK64 CLI public beta for local PCD workflows, evidence review, and claim-safe project scaffolding.
```

```text
Public beta command-line surface for BRIK64 local workflows, PCD seed material, and release evidence review.
```

Recommended repo topics:

```text
brik64, brik, cli, pcd, evidence, software-trust, developer-tools, public-beta, macos, command-line
```

## npm Keywords

Use these in `package.json.keywords`:

```json
[
  "brik64",
  "brik",
  "cli",
  "pcd",
  "evidence",
  "software-trust",
  "developer-tools",
  "public-beta"
]
```

Optional keywords for later releases, only when the relevant surface exists:

```text
topology, certification, sdk, macos, linux, windows, compiler, governance
```

Add platform keywords only when that platform has release evidence.

## SEO Titles And Meta Copy

Homepage/package card title:

```text
BRIK64 CLI Public Beta
```

SEO title:

```text
BRIK64 CLI - Public Beta for Local PCD and Evidence Workflows
```

Meta description:

```text
Install the BRIK64 CLI public beta for local PCD-oriented workflows, evidence review, and claim-safe project scaffolding. Current beta5 candidate focuses on local PCD workflows and remains gated until release evidence authorizes publication.
```

Social card title:

```text
BRIK64 CLI 0.1 Public Beta
```

Social card description:

```text
A local command-line surface for PCD-oriented project structure, bounded evidence review, and BRIK64 beta workflow evaluation.
```

## GitHub Release Template

```markdown
# BRIK64 CLI {{version}}

BRIK64 CLI is the public beta command-line surface for local BRIK64 project workflows. It gives developers a practical way to start working with PCD-oriented structure, local evidence review, and claim-safe project scaffolding from their own machine.

## Beta Scope

This release is intended for evaluation, local workflow trials, package smoke testing, and bounded PCD/evidence review. The beta5 candidate surface is focused on local CLI usage, PCD parsing, candidate certification, and developer-facing evidence workflows. Broader platform support, stronger certification surfaces, and deeper compiler-methodology claims remain gated by the evidence process in `brik64-prod`.

## Install

```sh
curl -fsSL https://brik64.com/cli/install.sh | bash
brik --version
brik help
```

Public web surface: https://brik64.com

Docs: https://docs.brik64.com/cli/install

## What Is Included

- `brik` CLI beta package for local workflow evaluation.
- PCD seed material for CLI-oriented project structure.
- Bounded evidence artifacts and release checksums.
- macOS package validation surface for this beta.
- Public package/release metadata aligned to BRIK64 claim boundaries.

## Evidence

Use the attached manifests, checksums, and release assets to review the exact package candidate. `brik64-prod` remains the authority for methodology, release gates, evidence contracts, certification boundaries, and public claim authorization.

## Copyright

Copyright (c) 2026 BRIK64 INC. All rights reserved.
```

## Changelog Template

Use this as the standard changelog text for beta releases:

```markdown
# Changelog

## {{version}} - {{date}}

### Added

- Published the BRIK64 CLI public beta package surface for local workflow evaluation.
- Added PCD seed material for CLI-oriented project structure.
- Added bounded evidence artifacts and release checksums for package review.
- Added public metadata linking the package, repository, docs, and BRIK64 web surface.

### Changed

- Standardized package and release copy around beta maturity, local developer workflow, and evidence review.
- Aligned repository and release metadata with BRIK64 claim-safe public wording.

### Verification

- Installer smoke tested with curl and platform checksum verification.
- GitHub release assets include checksums and manifests for the beta artifact.
- curl installer resolves the current beta release and verifies checksums.

### Scope

This beta is centered on local developer workflow, macOS package validation, PCD seed material, and release evidence review. Expanded platform support and stronger certification surfaces are promoted when the matching BRIK64 gates and evidence packs authorize that scope.
```

## README Section Order

For curl, GitHub, and docs, keep README sections in this order:

1. Product intro.
2. Status.
3. Install.
4. What it does.
5. Current scope.
6. Release evidence.
7. Copyright and license.

The npm README is captured at publish time. Updating README copy in the repo does
not update an already published package page; publish a new semver version when
README or metadata must change on npm.

## Copy Rules By Surface

### npm

- Keep the `description` short and searchable.
- Include `homepage`, `repository`, `bugs`, `author`, `keywords`, `engines`,
  `publishConfig`, `README.md`, `LICENSE`, and `NOTICE`.
- Use `--access public` for scoped public packages.
- Keep `beta` dist-tag for beta releases.

### GitHub Release

- Title format: `BRIK64 CLI {{version}} public beta`.
- Body should include beta scope, install command, included artifacts, evidence,
  and copyright.
- Keep release assets and checksums attached.
- Use prerelease for beta versions.

### GitHub Repository

- Description should fit one sentence.
- Topics should be product/search terms, not unsupported platform claims.
- README must mirror npm package copy.
- Keep `NOTICE` and `LICENSE` visible at repo root.

### brik64.com / docs

- Link to npm, GitHub release, and docs install page.
- State the current beta scope positively.
- Prefer `current support` and `beta scope` over negative disclaimers.
- Use evidence language when stronger claims appear.

## Claim-Safe Wording Bank

Use:

```text
public beta
local workflow evaluation
PCD-oriented structure
bounded evidence review
release evidence
macOS local CLI usage
claim-safe project scaffolding
gated by BRIK64 evidence process
versioned release artifacts
checksums and manifests
```

Keep advanced or platform-specific wording evidence-bound. Platform language should stay scoped:

```text
current public beta surface is focused on macOS local CLI usage
```

```text
Linux and Windows support should be described only after platform-specific gates pass
```

## Standard Footer

```text
Copyright (c) 2026 BRIK64 INC. All rights reserved.
```

Use this footer in package README, release notes, NOTICE, docs cards, and public
repo descriptions where space allows.


## License Standard

BRIK64 CLI public beta releases use the `BRIK64 CLI Public Beta Evaluation License`.
This is proprietary evaluation software from BRIK64 INC. Public package metadata
should use:

```json
"license": "SEE LICENSE IN LICENSE"
```

Every beta package should include:

- `LICENSE` with the full BRIK64 CLI Public Beta Evaluation License;
- `NOTICE` with copyright, public links, and beta licensing summary;
- README copyright section pointing to both files;
- package metadata with `author.name` set to `BRIK64 INC`.

Use positive scope language for maturity and support boundaries. Commercial,
hosted, redistribution, partner, enterprise, regulated, or certification-oriented
use should route to written commercial terms from BRIK64 INC.


## ASCII Banner Standard

Use this provisional ASCII banner in CLI README and release surfaces until the
final cross-repo visual identity asset is ready:

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

For beta copy, keep the claim-safe scope paragraph directly after the banner so
the visual language stays anchored to current release evidence.

## Release Asset Matrix Wording

Use this wording for current and future platform packages:

```text
Current beta asset: macOS Apple Silicon package.
Planned release lanes: macOS Intel, Debian/Ubuntu Linux packages, and Windows PC packages after platform-specific build and smoke gates pass.
```

Avoid presenting planned platform lanes as current support until the matching
artifact, checksum, install smoke, and release gate exist.
