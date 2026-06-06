# GitHub Signing Key Runbook

This runbook closes the beta8 release integrity blocker where GitHub sees the
release commit as SSH-signed but not verified.

Current blocker:

- PR: https://github.com/brik64/brik64-cli/pull/65
- State: approved, checks green, merge blocked
- GitHub verification reason: `unknown_key`
- Expected public key fingerprint:
  `SHA256:OEJJTFqu5VlYv7mAH3iGhTpIVhQLYbMaSzZ9Y+MLwFo`

Do not use admin merge override. The release train must pass with GitHub
recognizing the exact release commit as verified.

## Preflight

Run:

```bash
npm run preflight:github-signing-key
```

Expected blocked state before authorization:

```text
decision=BLOCKED_GITHUB_SIGNING_KEY_PREFLIGHT
failures=github_token_missing_scope:admin:ssh_signing_key
```

The preflight must not read private keys or print secrets. It only checks the
public signing key fingerprint and GitHub API visibility.

## Authorize GitHub API Scopes

Run:

```bash
gh auth refresh -h github.com -s admin:ssh_signing_key -s admin:public_key
```

Complete the browser device-flow approval. After approval, verify scopes:

```bash
gh auth status -h github.com
```

The active account used to register the key must be the account that will own
the verified signing key for the beta8 commit identity.

## Register The Public Signing Key

Never print or upload the private key. Register only:

```bash
~/.ssh/brik64-admin-signing.pub
```

The public key fingerprint must match:

```text
SHA256:OEJJTFqu5VlYv7mAH3iGhTpIVhQLYbMaSzZ9Y+MLwFo
```

Preferred API path after scopes are authorized:

```bash
gh api user/ssh_signing_keys \
  --method POST \
  --field title="BRIK64 beta8 release signing key" \
  --field key="$(cat ~/.ssh/brik64-admin-signing.pub)"
```

If GitHub reports the key already exists, continue to validation.

## Validate

Run:

```bash
npm run preflight:github-signing-key
```

Required result:

```text
decision=PASS_GITHUB_SIGNING_KEY_PREFLIGHT
```

Then regenerate the beta8 signature report for the exact PR head:

```bash
npm run gate:beta8:github-verified-signature
```

Required result:

```text
decision=PASS_BETA8_GITHUB_VERIFIED_SIGNATURE
publicReleaseAllowed=true
```

Finally verify PR #65:

```bash
gh pr view 65 --repo brik64/brik64-cli \
  --json mergeStateStatus,reviewDecision,statusCheckRollup,headRefOid
```

Required release-ready state:

- `reviewDecision=APPROVED`
- every required check is `SUCCESS`
- `mergeStateStatus` is no longer blocked by signature verification

## Resume Release Train

Only after the verified-signature gate passes:

```bash
npm run release:train:publish-plan
```

Publication must still remain blocked while `release/manifest.json` is
`state=draft`. Moving beta8 from draft to public requires the full synchronized
release train: GitHub Release, curl/GCP installer, SDKs, docs, web, changelog,
skills, platform smoke and public-claim scan.

## Failure Handling

If the commit remains `verified=false`:

- `unknown_key`: the public key is not registered as a GitHub SSH signing key
  for the relevant account.
- `no_user`: the commit identity is not associated with a GitHub user/email.
- `bad_email`: update commit author/committer email to a verified account
  email and recreate the signed commit.

Do not bypass with admin override. Keep the failed reports as evidence and fix
the identity/signing configuration.
