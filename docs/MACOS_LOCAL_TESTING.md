# macOS Local Testing

This machine is the local macOS test surface for the CLI beta.

Current local platform:
- OS: macOS / Darwin
- Architecture: arm64

## Scope

- Local CLI execution.
- Local install path checks.
- Local command-contract checks.
- Apple Silicon package smoke for the current beta lane.

## Evidence Still Needed For Broader Promotion

- macOS Intel runner or host evidence.
- Windows evidence.
- Per-artifact checksum and release manifest binding.
- Release authorization from the active BRIK64 evidence process.

## Required Evidence Before Marking macOS Local Ready

- local binary path;
- `brik --version` output;
- BRIK64 ASCII startup output;
- command-contract smoke;
- PCD/certify/emit local workflow smoke;
- report stored under `evidence/macos-local/`.
