# GitHub Repository Governance

This repository is public so developers can inspect BRIK64 CLI beta releases,
read package metadata, download artifacts, and open issues.

It is not an external contribution repository.

## Ownership

- Organization: `brik64`
- Repository: `brik64/brik64-cli`
- Maintainer team: `brik64/brik64-cli-maintainers`
- Initial maintainers: `brik64-admin`, `carlosjperez`

`CODEOWNERS` assigns the full repository to the maintainer team.

## Public Interaction Policy

Allowed:

- Open issues.
- Report reproducible CLI beta bugs.
- Report docs, release, npm, checksum, or install metadata mismatches.
- Report security concerns through the security policy.

Not accepted:

- External pull requests.
- External direct commits.
- Public changes to release evidence, license text, package metadata, or docs
  claim surfaces.

BRIK64 lands changes through authorized maintainers so release evidence,
package metadata, public claims, licenses, checksums, and docs stay aligned.

## Required Repository Settings

Recommended public repo settings:

- Issues: enabled.
- Wiki: enabled.
- Projects: private/internal for execution tracking; do not use Projects as the
  public roadmap entry point.
- Merge commit, squash merge, and rebase merge: disabled for public PR paths.
- Auto merge: disabled.
- Delete branch on merge: enabled.
- Web commit signoff: enabled.
- Homepage: `https://brik64.com`.
- Repository topics: `brik64`, `brik`, `cli`, `pcd`, `evidence`,
  `software-trust`, `developer-tools`, `public-beta`, `macos`, `command-line`.

Recommended `main` branch protection:

- Restrict pushes to `brik64-cli-maintainers`.
- Require signed commits.
- Require linear history.
- Block force pushes.
- Block deletions.
- Require conversation resolution.

## Security And Code Quality

Repository security should include:

- Secret scanning enabled.
- Secret scanning push protection enabled.
- Dependabot security updates enabled.
- Dependabot version update config for npm and GitHub Actions.
- CodeQL default setup for JavaScript analysis.
- CI smoke and package checks.

Dependabot PRs should be reviewed by `brik64-cli-maintainers` and merged only
after protected branch checks pass. Dependency update PRs are maintenance
signals, not release promotion evidence.

Do not add a custom CodeQL advanced workflow while GitHub CodeQL default setup is
enabled for this repository. GitHub rejects SARIF from advanced configuration
when default setup is active.

## Docs And Mintlify Changelog

The publish workflow dispatches `brik64-cli-release` to
`brik64/brik64-docs-site` when `BRIK64_DOCS_REPO_DISPATCH_TOKEN` is configured.

Required secret:

```text
BRIK64_DOCS_REPO_DISPATCH_TOKEN
```

The token should be fine-grained and scoped to trigger repository dispatch or
workflow dispatch in `brik64/brik64-docs-site`. The receiving docs repository
should update `releases/changelog.mdx`, rebuild Mintlify output, and deploy docs.

The GitHub App installation token rollout announced in May 2026 means any app or
automation that creates installation tokens must treat `ghs_` tokens as opaque
and avoid fixed-length token assumptions. This repo's workflows do not parse
GitHub App installation tokens.
