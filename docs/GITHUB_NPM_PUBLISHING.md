# Deprecated CLI npm Publishing Runbook

BRIK64 CLI beta4 and later are not published through npm. The public CLI
install path is:

```sh
curl -fsSL https://brik64.com/cli/install.sh | bash
```

The historical npm package `@brik64/cli` is a legacy channel and must not be
used as the beta4 install authority. If registry policy permits, legacy CLI npm
versions should be removed. If removal is not permitted, deprecate them with a
message that points users to the curl installer.

## Current Boundary

- npm is reserved for SDK packages, starting with `@brik64/core@0.1.0-beta.4`.
- GitHub Releases remain the public CLI asset and checksum record.
- Cloud Run counts CLI downloads and redirects to verified release assets.
- Docs and brik64.com must not recommend npm for CLI installation.

## Required Verification

After any cleanup of legacy npm CLI metadata:

```sh
npm view @brik64/cli dist-tags versions --json
```

Record whether each legacy version was removed, deprecated, or blocked by npm
registry policy.
