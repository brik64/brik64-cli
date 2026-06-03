# GitHub Packages Publishing Runbook

GitHub Packages is a separate npm registry mirror for organization visibility
inside GitHub. Publishing `@brik64/cli` to npmjs does not create a visible
package under the GitHub repository Packages tab.

## Registry

```text
https://npm.pkg.github.com
```

Package:

```text
@brik64/cli
```

## Workflow

Use the manual workflow:

```text
.github/workflows/publish-github-packages-beta.yml
```

Inputs:

- `version`: exact `package.json` version, for example `0.1.0-beta.2`.
- `dist_tag`: normally `beta`; use `latest` only when intentionally aligning the
  GitHub Packages default install path.
- `confirm_github_packages_beta`: must equal
  `PUBLISH_BRIK64_CLI_GITHUB_PACKAGES`.

The workflow uses `GITHUB_TOKEN` with `packages: write`. It does not need the
npmjs `NPM_TOKEN`.

## Boundary

npmjs remains the primary public registry for install commands. GitHub Packages
is a GitHub-visible mirror for release inspection, organization package
inventory, and future internal automation.

Do not treat GitHub Packages publication as new release evidence. It mirrors the
same package version and must remain aligned with npmjs, GitHub Releases,
docs.brik64.com, and brik64.com.
