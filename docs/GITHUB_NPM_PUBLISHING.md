# GitHub To npm Publishing Runbook

BRIK64 CLI beta releases should be published from GitHub Actions after the
package metadata, README, NOTICE, release evidence, and claim-safe copy have
been reviewed.

## Recommended Path

Use the manual workflow:

```text
.github/workflows/publish-npm-beta.yml
```

This publishes to npmjs. It does not publish to GitHub Packages. Use
`docs/GITHUB_PACKAGES_PUBLISHING.md` and
`.github/workflows/publish-github-packages-beta.yml` for the separate GitHub
Packages mirror.

Inputs:

- `version`: exact `package.json` version, for example `0.1.0-beta.1`.
- `dist_tag`: normally `beta`.
- `confirm_public_beta`: must equal `PUBLISH_BRIK64_CLI_BETA`.

Required GitHub configuration:

- Environment: `npm-beta`.
- Secret: `NPM_TOKEN` with publish rights for `@brik64/cli`.
- Recommended environment protection: require human approval before publish.

## Workflow Checks

The workflow:

- validates package name and exact version;
- restricts this lane to `0.1.0-beta.*` versions;
- runs `npm test`;
- runs `npm pack --dry-run`;
- requires `README.md` and `NOTICE`;
- fails if the version already exists on npm;
- publishes with public access and the selected dist-tag;
- verifies npm version metadata, README filename/content metadata, tarball metadata, and dist-tag after publish. The workflow retries metadata reads because npm propagation can lag immediately after a successful publish.

## Trusted Publishing Upgrade

npm supports Trusted Publishing from GitHub Actions using OIDC. That path reduces
long-lived token exposure and can generate npm provenance automatically for a
public package published from a public GitHub repository.

To migrate:

1. In npm package settings, add GitHub Actions as a trusted publisher for
   organization `brik64`, repository `brik64-cli`, and this workflow.
2. Keep `permissions.id-token: write` in the workflow.
3. Test one beta publish from GitHub Actions.
4. After the trusted publisher works, restrict or revoke traditional npm tokens.

Until the trusted publisher is configured on npmjs.com, keep using `NPM_TOKEN`
in the protected `npm-beta` GitHub environment.

## Copy Boundary

Release copy should describe beta scope positively:

- local PCD workflows;
- bounded evidence review;
- claim-safe project scaffolding;
- macOS local CLI usage for the current beta;
- stronger scopes promoted only after matching BRIK64 gates authorize them.

Use `docs/RELEASE_COPY_MANUAL.md` before publishing a new npm beta.
