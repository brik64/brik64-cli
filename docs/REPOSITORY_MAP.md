# BRIK64 CLI Repository Map

This map describes the public files and folders in `brik64/brik64-cli`.
It is intended for package reviewers, beta users, security reporters, and
maintainers who need to understand what each path is for.

## Root Files

| Path | Description |
| --- | --- |
| `README.md` | Primary public entry point for BRIK64 CLI install instructions, beta scope, official channels, repository map, release assets, and license summary. |
| `package.json` | npm package manifest for `@brik64/cli`, including package version, description, binary mapping, scripts, keywords, publish config, and package file allowlist. |
| `LICENSE` | Proprietary beta license for BRIK64 CLI. The package is public for evaluation and inspection, not open source redistribution. |
| `NOTICE` | Copyright notice and third-party notice surface for the public beta package. |
| `SECURITY.md` | Security reporting policy, supported beta version scope, and private reporting route. |
| `CONTRIBUTING.md` | Public interaction policy. Issues are accepted for reproducible beta bugs and metadata mismatches; external pull requests are not accepted. |
| `.gitignore` | Local Git ignore rules for generated files, dependency directories, package outputs, logs, and temporary artifacts. |
| `.npmignore` | npm packaging exclusions for repository-only files that should not ship in the published package. |

## Executable CLI

| Path | Description |
| --- | --- |
| `src/` | Executable CLI source directory for the current beta. |
| `src/brik.js` | Node.js command entry point exposed as `brik` by npm. It implements the current public beta command behavior. |

## Tests

| Path | Description |
| --- | --- |
| `tests/` | Local test directory for current beta smoke checks. |
| `tests/smoke.sh` | Shell smoke test covering basic CLI execution, help/version output, project initialization behavior, `AGENTS.md` non-mutation policy, certify/emit behavior, target generation, and fail-closed unsupported targets. |

## PCD Seed Material

| Path | Description |
| --- | --- |
| `pcd/` | Candidate PCD seed material for moving CLI behavior toward a PCD-first BRIK64 methodology. These files are review material, not release certificates. |
| `pcd/README.md` | Folder-level explanation of current PCD seed role, promotion path, and authority boundary. |
| `pcd/cli_core.pcd` | Candidate command contract seed for core CLI behavior. |
| `pcd/cli_init_policy.pcd` | Candidate command contract seed for initialization and agent-file consent policy. |
| `pcd/cli_certify_emit.pcd` | Candidate command contract seed for bounded certification-output behavior. |
| `pcd/cli_polymer.pcd` | Candidate composition contract that binds the CLI command PCD seeds before a future compile route. |

## Evidence And Packaging

| Path | Description |
| --- | --- |
| `evidence/` | Public beta evidence area for package inspection and generated-review material. |
| `evidence/pcd-seed/` | Generated PCD seed review material used to keep methodology work inspectable without presenting it as certification. |
| `evidence/pcd-seed/README.md` | Explanation of how seed evidence should be read and what must happen before stronger release language is allowed. |
| `packaging/` | Packaging notes and release-lane material for platform-specific package work. |
| `packaging/macos-local/` | macOS local package review material for the current beta lane. |
| `packaging/macos-local/README.md` | macOS local packaging scope, package review expectations, and promotion requirements. |

## Documentation

| Path | Description |
| --- | --- |
| `docs/REPOSITORY_MAP.md` | This file-by-file public repository map. |
| `docs/BRIK_METHODOLOGY_TRANSITION.md` | Methodology transition plan for moving the CLI from executable beta source toward PCD-first implementation and evidence-backed promotion. |
| `docs/PUBLIC_ROADMAP.md` | Public roadmap for CLI beta platform coverage, distribution hardening, agent workflow alignment, and SDK/language surface alignment. |
| `docs/DISTRIBUTION_ROADMAP.md` | Distribution-channel roadmap for curl, Cloud Run, GitHub Releases, SDK npm, Homebrew, macOS, Linux, and Windows lanes. |
| `docs/GITHUB_NPM_PUBLISHING.md` | Deprecated CLI npm publishing notes and legacy cleanup boundary. |
| `docs/GITHUB_PACKAGES_PUBLISHING.md` | Deprecated CLI GitHub Packages notes and mirror-disabled boundary. |
| `docs/GITHUB_REPO_GOVERNANCE.md` | Repository governance policy for branch protection, maintainer ownership, issue flow, package publication, and public interaction controls. |
| `docs/LINUX_HETZNER_TESTING.md` | Linux test plan and operator guidance for Debian/Ubuntu lanes using remote execution infrastructure. |
| `docs/MACOS_LOCAL_TESTING.md` | macOS local test plan and operator guidance for current Apple Silicon package validation. |
| `docs/PLATFORM_MATRIX.md` | Platform support matrix for current beta support and planned release lanes. |
| `docs/RELEASE_COPY_MANUAL.md` | Standardized release-copy guide for npm, GitHub Releases, package descriptions, changelog entries, and public keywords. |
| `docs/REPO_BOUNDARY.md` | Public repository boundary: what this repo owns, what `brik64-prod` owns, and what must not be claimed from this repo alone. |
| `docs/WIKI_HOME.md` | Versioned wiki-home content while GitHub Wiki remote access remains under operational review. |

## GitHub Governance

| Path | Description |
| --- | --- |
| `.github/CODEOWNERS` | Maintainer ownership rules for protected files and review-required changes. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Internal maintainer checklist for protected changes, claim-safety review, package impact, and evidence updates. |
| `.github/dependabot.yml` | Dependabot grouping and review configuration for GitHub Actions and npm ecosystem updates. |
| `.github/ISSUE_TEMPLATE/` | Public issue templates for beta bugs, docs/package metadata mismatches, and security-report routing. |
| `.github/workflows/ci.yml` | Main CI workflow for smoke tests and package-content checks. |
| `.github/workflows/codeql.yml` | CodeQL workflow configuration where custom analysis is needed. |
| `.github/workflows/publish-npm-beta.yml` | Disabled workflow documenting that CLI npm publishing is no longer allowed. |
| `.github/workflows/publish-github-packages-beta.yml` | Disabled workflow documenting that CLI GitHub Packages publishing is no longer allowed. |

## BRIK64 Traceability

| Path | Description |
| --- | --- |
| `.brik/` | BRIK64 local project metadata directory. |
| `.brik/manifest.json` | Local traceability manifest for the CLI repo. It is operational metadata and is not a formal certificate. |

## Authority Boundary

This repository owns the public CLI package surface, local beta source, package
metadata, package smoke checks, public repo governance, and beta documentation.

`brik64-prod` remains the authority for release gates, certificate boundaries,
compiler evidence, promotion decisions, and any stronger public claim
authorization.
