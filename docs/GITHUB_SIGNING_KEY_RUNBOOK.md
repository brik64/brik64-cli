# GitHub Signing Key Runbook

This runbook closes the beta8 release integrity blocker where GitHub sees the
release commit as SSH-signed but not verified.

Current blocker:

- PR: https://github.com/brik64/brik64-cli/pull/65
- State: approved, checks green, merge blocked
- GitHub verification reason: `unknown_key`
- Commit signing account: `carlosjperez`
- Public key fingerprint for this release lane:
  `SHA256:Ua933KXYBhzgl5+852YF5GYMwOab/RGZwevZyImNfZ8`

Do not use admin merge override. The release train must pass with GitHub
recognizing the exact release commit as verified.

GitHub SSH signing keys are account-scoped. A public key already registered to
one GitHub account cannot be reused as a signing key for another account. If
the API returns `key is already in use`, create or select a separate signing key
for the actual commit-signing account and register that public key instead.

## Preflight

Run with the public key that belongs to the commit signing account:

```bash
npm run preflight:github-signing-key -- \
  --public-key "$HOME/.ssh/brik64-carlosjperez-release-signing.pub"
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

The active account used to register the key must be the account that owns the
beta8 commit identity. A GitHub SSH signing key cannot be reused across
accounts. If the key is already registered to another account, create a
separate signing key for the actual committing account.

## Register The Public Signing Key

Never print or upload the private key. Register only the public key for the
committing account:

```bash
~/.ssh/brik64-carlosjperez-release-signing.pub
```

The public key fingerprint must match:

```text
SHA256:Ua933KXYBhzgl5+852YF5GYMwOab/RGZwevZyImNfZ8
```

Preferred repo command after scopes are authorized:

```bash
npm run release:github-signing-key:register -- \
  --execute \
  --public-key "$HOME/.ssh/brik64-carlosjperez-release-signing.pub" \
  --title "BRIK64 beta8 release signing key carlosjperez"
```

The command is idempotent. It lists existing GitHub SSH signing keys, compares
public fingerprints, and only submits the public key when no matching key
exists.

Equivalent API path:

```bash
gh api user/ssh_signing_keys \
  --method POST \
  --field title="BRIK64 beta8 release signing key" \
  --field key="$(cat ~/.ssh/brik64-carlosjperez-release-signing.pub)"
```

If GitHub reports the key already exists, continue to validation.

## Validate

Run:

```bash
npm run preflight:github-signing-key -- \
  --public-key "$HOME/.ssh/brik64-carlosjperez-release-signing.pub"
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

If `reviewDecision=APPROVED` but `mergeStateStatus=BLOCKED`, inspect branch
protection before changing code. During beta8, the remaining causes were:

- `require_code_owner_reviews`: approval must come from
  `@brik64/brik64-cli-maintainers`;
- `require_last_push_approval`: approval must come from someone other than the
  last pusher;
- unresolved review threads: even a small code-quality thread blocks protected
  branch update;
- disabled auto-merge or unsupported merge method: use the merge method allowed
  by repo settings and verify GitHub signs the resulting merge commit.

Recommended PR geometry for future release fixes:

1. The PR branch is pushed by one maintainer account.
2. The other maintainer account approves as code owner.
3. After any new push, re-approve from the non-pusher account.
4. Do not rely on switching `gh auth` alone for `git push`; credential helpers
   may still use the previous HTTPS token. If exact pusher identity matters,
   verify it through GitHub's branch-protection rejection or use an explicit
   token-scoped push.

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
