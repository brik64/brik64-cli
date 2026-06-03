# macOS Local Testing

This machine is the local macOS test surface for the CLI beta.

Current local platform:
- OS: macOS / Darwin
- Architecture: arm64

Scope:
- local CLI execution;
- local install path checks;
- local command-contract checks;
- no public release authorization.

Out of scope:
- macOS x64 runner evidence;
- Windows evidence;
- universal macOS artifact claims;
- fixpoint, N5 or release claims.

Required evidence before marking macOS local ready:
- local binary path;
- `brik --version` output;
- BRIK64 ASCII startup output;
- command-contract smoke;
- PCD/certify/emit local workflow smoke;
- report stored under `evidence/macos-local/`.
