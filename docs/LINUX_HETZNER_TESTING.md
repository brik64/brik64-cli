# Linux Hetzner Testing

Hetzner is the Linux test surface for the CLI beta.

Scope:
- Debian x64 native artifact execution.
- Ubuntu x64 native artifact execution.
- Fedora x64 native artifact execution.
- Alpine x64 musl only with a separate musl artifact or explicit unsupported
  decision.

Required evidence per supported distro:
- distro identity (`/etc/os-release`);
- architecture (`uname -m`);
- native binary path;
- no wrapper evidence;
- `brik --version` output;
- BRIK64 ASCII startup output;
- command-contract smoke;
- PCD/certify/emit workflow smoke;
- behavior PASS report.

Boundary:
- No universal Linux claim.
- No public release authorization.
- No N5, fixpoint or release-readiness claim from a distro smoke alone.
- Windows remains waiting for a real PC/runner.
