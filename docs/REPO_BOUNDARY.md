# BRIK CLI Repository Boundary

## Lives Here

- CLI source code.
- CLI tests and fixtures.
- Platform packaging scripts.
- Local beta artifacts.
- Per-version changelogs.

## Does Not Live Here

- Private engines.
- Claim-bearing certification authority.
- Public release authorization.
- N-level claims.
- Prod evidence source of truth.

## Authority Split

- `brik64-cli`: implementation and packaging iteration.
- `brik64-prod`: gates, evidence, methodology, release decision and claim
  boundary.

## Platform Scope

- macOS local testing can run on the current development machine.
- Linux testing should run on the Hetzner runner and must be split by distro
  family rather than claimed as universal Linux support.
- Windows testing remains pending until a real Windows PC/runner is available.
