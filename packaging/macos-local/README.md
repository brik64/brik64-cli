# macOS Local Bootstrap Wrapper

This directory contains the local macOS wrapper used to exercise the public beta
CLI during package and command smoke testing.

```bash
export PATH="/Users/carlosjperez/Documents/GitHub/brik64-cli/packaging/macos-local:$PATH"
brik --version
```

## Current Role

- Provides a local `brik` command wrapper for macOS testing.
- Depends on the local Node.js runtime.
- Supports install-path and command-contract checks before platform packages are
  promoted.

## Promotion Path

Native macOS release assets should ship with platform-specific checksum,
install-smoke, and release-manifest evidence before they are promoted through
GitHub Releases, curl/GCP, Homebrew, docs, or brik64.com.
