# BRIK64 CLI beta10 Release Train Recovery

Date: 2026-06-08
Lane: Carril A, public CLI 0.1.x beta release train
Version: 0.1.0-beta.10

## Current Public State

The beta10 release train reached these surfaces successfully:

- GitHub Release `v0.1.0-beta.10` exists in `brik64/brik64-cli`.
- Release asset `brik64-cli-0.1.0-beta.10.tgz` was uploaded with SHA-256 `b7794371859e0267923db7f4c0b5404cc29040376d23b5cd9d02dd344afa88ea`.
- GCP curl upload reported `uploaded=true` for `0.1.0-beta.10`.
- `brik64-admin/brik64.com` received commit `453ab2ee7d54a7c1bbcf42d42491a3f4af995ed8`, `Align public web surface to 0.1.0-beta.10`.
- Docs, web, and skills dispatch commands returned success from the beta10 publication train.

The remaining blocker is Cloudflare Pages production deployment for `brik64.com`.

## Root Cause

The release train was able to push the beta10 web files into the `brik64-admin/brik64.com` repository, but the public site continued serving beta9 because the Cloudflare Pages deploy workflow did not complete.

Observed failures:

1. `CLOUDFLARE_PAGES_API_TOKEN` was initially missing from `brik64-admin/brik64.com` GitHub Actions secrets.
2. The token stored in 1Password item `CMS API Token - brik64.com Cloudflare Pages` was then installed as the GitHub secret, but Wrangler rejected it:
   - `Invalid access token [code: 9109]`
   - `Authentication error [code: 10000]`
3. Other valid Cloudflare tokens in the BRIK64 vault did not have Cloudflare Pages project access for `brik64-web-brik64com`.

Therefore this is not a GitHub Release, GCP curl, SDK marketplace, or web-repo push blocker. It is specifically a Cloudflare Pages deployment token/permission blocker.

## Required Secret

Set `CLOUDFLARE_PAGES_API_TOKEN` in `brik64-admin/brik64.com` to a valid Cloudflare API token that can deploy the Pages project `brik64-web-brik64com` in account `a04543fa4f600499c3a9d3aa2ab93159`.

Minimum expected permissions:

- Account: `Cloudflare Pages: Edit`
- Account: `Account Settings: Read`
- If the Cloudflare UI requires zone scoping for the project or custom domain, include Zone `brik64.com`: `Zone: Read`

Verify the token before setting it as the repository secret:

```bash
curl -fsS -H "Authorization: Bearer $CLOUDFLARE_PAGES_API_TOKEN" \
  https://api.cloudflare.com/client/v4/user/tokens/verify | jq .

curl -fsS -H "Authorization: Bearer $CLOUDFLARE_PAGES_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/a04543fa4f600499c3a9d3aa2ab93159/pages/projects/brik64-web-brik64com | jq .
```

Then set the GitHub secret without printing it:

```bash
gh secret set CLOUDFLARE_PAGES_API_TOKEN --repo brik64-admin/brik64.com
```

## Recovery Commands

After replacing the token, deploy and verify beta10:

```bash
gh workflow run cloudflare-pages-deploy.yml \
  --repo brik64-admin/brik64.com \
  -f version=0.1.0-beta.10 \
  -f project_name=brik64-web-brik64com
```

Watch the run:

```bash
gh run watch <run_id> --repo brik64-admin/brik64.com --interval 10 --exit-status
```

Verify live:

```bash
curl -fsSL https://brik64.com/cli/beta.json | jq .
curl -fsSL https://brik64.com/cli/install.sh | grep '0.1.0-beta.10'
curl -fsSL https://brik64.com/cli/releases/0.1.0-beta.10.json | jq .
curl -fsSL https://brik64.com/changelog | grep '0.1.0-beta.10'
```

Then re-run the CLI release live verifier:

```bash
node scripts/release-train-live-verify.js --wait-seconds 600 --interval-seconds 20
```

## Workflow Hardening Applied

- `scripts/release/sync-web-release-surface.js` now configures git identity in GitHub Actions, records git command diagnostics, and avoids rewriting `0.1.0-beta.10` as `0.1.0-beta.100`.
- `scripts/tests/test_release_web_surface_sync.sh` follows the active release manifest instead of hardcoding beta9.
- `scripts/release/dispatch-web-pages-deploy.js` dispatches and waits for the `brik64.com` Cloudflare Pages deploy workflow.
- `scripts/release-train-publish-plan.js` now makes the Pages deploy a first-class release train command before final live verification.
- `brik64.com` `Consume BRIK64 release manifest` no longer verifies live immediately before deployment.
- `brik64.com` `Deploy Cloudflare Pages` verifies the Cloudflare token explicitly and waits for live propagation.

## Claim Boundary

This recovery only concerns public release train deployment. It does not assert formal certification, universal correctness, self-hosting, fixpoint, or independent toolchain closure.
