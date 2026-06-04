# Deprecated CLI GitHub Packages Runbook

BRIK64 CLI beta4 and later are not mirrored through GitHub Packages. The public
CLI channel is the curl installer plus GitHub Release assets.

GitHub Packages may be reconsidered for future SDK or internal automation work,
but it is not a CLI beta4 distribution surface.

## Current Boundary

- Do not publish `@brik64/cli` to GitHub Packages.
- Do not document GitHub Packages as a CLI install mirror.
- Use GitHub Releases for versioned CLI assets, manifests, and checksums.
- Use npm only for SDK packages such as `@brik64/core`.
