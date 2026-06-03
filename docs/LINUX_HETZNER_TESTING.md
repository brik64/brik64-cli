# Linux Hetzner Testing

Hetzner is the Linux validation surface for BRIK64 CLI beta packaging.

## Scope

- Debian x64 package and install checks.
- Ubuntu x64 package and install checks.
- Fedora x64 package and install checks when that lane opens.
- Alpine x64 musl only with a musl-specific artifact or an explicit scope
  decision.

## Required Evidence Per Distro

- distro identity (`/etc/os-release`);
- architecture (`uname -m`);
- native binary path;
- `brik --version` output;
- BRIK64 ASCII startup output;
- command-contract smoke;
- PCD/certify/emit workflow smoke;
- behavior PASS report.

## Promotion Path

Each distro lane should publish its own artifact, checksum, install smoke, and
release manifest before it is promoted through GitHub Releases, curl/GCP, docs,
or brik64.com. Linux wording should name the validated distro lane instead of
collapsing all Linux distributions into one status.

Windows remains a separate validation lane with its own runner and install smoke.
