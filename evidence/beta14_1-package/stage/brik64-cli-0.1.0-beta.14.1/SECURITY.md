# Security Policy

BRIK64 CLI is public beta evaluation software from BRIK64 INC.

## Supported Versions

| Version | Status |
| --- | --- |
| `0.1.0-beta.x` | Public beta security review and patch lane |
| Earlier beta artifacts | Superseded |

## Reporting A Vulnerability

Report suspected vulnerabilities through GitHub Security Advisories for this
repository when available, or contact BRIK64 through the public company website:

https://brik64.com

Do not include secrets, private source code, customer data, raw credentials, or
unredacted infrastructure details in public issues.

Use public issues only for non-sensitive bugs, docs mismatches, package metadata,
install failures, or release evidence questions. If an issue may expose a token,
private path, customer data, unpublished source, infrastructure detail, or
exploit path, use a private security report path instead.

## Public Beta Scope

Security review for this repository covers the public CLI package surface,
release metadata, package workflows, local smoke tests, PCD seed files, and
bounded evidence artifacts included with the beta.

`brik64-prod` remains the authority for methodology, certification boundaries,
evidence gates, compiler claim authorization, and release approval.

## Disclosure Handling

BRIK64 will triage reports by affected version, exploitability, package
surface, and evidence impact. Fixes may be shipped as new beta versions,
repository advisories, release notes, or docs updates depending on scope.

## Maintainer Controls

The public repository is maintained through the `brik64-cli-maintainers` team.
External pull requests are not accepted. Changes to package metadata, release
evidence, license text, workflows, public claims, or install paths must land
through authorized maintainers, protected branch rules, and passing checks.

## Dependency And Workflow Security

Dependabot is configured for npm and GitHub Actions update detection. CodeQL
default setup and CI smoke/package checks provide repository-level regression
signals. These checks are operational security controls; they do not certify the
CLI or expand the public beta claim boundary.
