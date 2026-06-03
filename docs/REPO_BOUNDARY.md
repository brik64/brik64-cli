# BRIK CLI Repository Boundary

## Lives Here

- Public beta CLI source code.
- CLI smoke tests and fixtures.
- Platform packaging scripts and wrappers.
- Local beta artifacts and package metadata.
- Per-version release notes, runbooks, and distribution docs.

## Authority Boundary

- `brik64-cli` owns implementation, public package metadata, distribution
  workflows, issue templates, and release-surface documentation for the CLI beta.
- `brik64-prod` owns methodology gates, evidence authority, release decision,
  compiler evidence, certificate boundaries, and public claim authorization.

## Public Surface Rule

The public repository should help developers inspect, install, and report on the
CLI beta without exposing private engines, internal gates, private evidence
stores, raw credentials, or unsupported certification language.

## Platform Scope

- macOS local testing can run on the current development machine.
- Linux testing should run on the Hetzner runner and must be split by distro
  family.
- Windows testing remains pending until a real Windows PC/runner is available.
