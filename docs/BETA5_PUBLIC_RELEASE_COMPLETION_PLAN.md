# BRIK64 CLI beta5 public release completion plan

Date: 2026-06-05

Source branch: `main`

Current source SHA: `a3c3416`

Release: `0.1.0-beta.5`

Manifest digest:

```text
058440c5d913a3b2cda8dc23d5ac063cb5de164c35d798aa74d289afac68bc95
```

## Executive Objective

Finish beta5 public release through the release train, without bypassing gates
or publishing partial state as complete.

The release is complete only when the same manifest digest is proven across:

- GitHub Release.
- curl/GCP installer and channel manifest.
- npm SDK package.
- PyPI SDK package.
- crates.io SDK package.
- docs update dispatch.
- web/CMS update dispatch.
- public skills update dispatch.
- post-publish live verification.

## Current Verified State

- 🟩 100% | 🟩 🟩 🟩 🟩 | Cloudflare verifier access
  - `Bot Fight Mode` is off for `brik64.com`.
  - GitHub Actions live verifier run `27015163974` passed.
  - `brik64.com` release routes returned HTTP 200 from GitHub Actions.

- 🟩 100% | 🟩 🟩 🟩 🟩 | Publication runner patch
  - PR `#31` merged to `main`.
  - Commit `a3c3416` prepares SDK workspaces on the GitHub Actions runner.
  - Workflow supports keyless GCP auth through Workload Identity Federation.

- 🟩 100% | 🟩 🟩 🟩 🟩 | Publish dry-run after runner patch
  - GitHub Actions run `27015960366` passed.
  - `PASS_RELEASE_TRAIN_PUBLISH_EXECUTE_DRY_RUN`.
  - `blockers=[]`.
  - All command preflight entries pass in dry-run mode.

- 🟨 75% | 🟩 🟩 🟩 ⬜ | Publication secrets
  - Present in `brik64/brik64-cli`: GitHub, npm, PyPI, crates.io, docs,
    web, and skills tokens.
  - Missing: GCP Workload Identity secrets.

- ⛔ 75% | 🟩 🟩 🟩 ⛔ | GCP publication auth
  - Service account exists:
    `brik64-cli-release-publisher@brik64-platform-mvp.iam.gserviceaccount.com`.
  - Bucket binding exists:
    `roles/storage.objectAdmin` on `gs://brik64-cli-releases`.
  - JSON key creation is blocked by org policy:
    `constraints/iam.disableServiceAccountKeyCreation`.
  - Workload Identity Pool creation is blocked for local available accounts by:
    `iam.workloadIdentityPools.create`.
  - IAM role self-grant is blocked by org policy:
    `constraints/iam.allowedPolicyMemberDomains`.

- ⬜ 25% | 🟩 ⬜ ⬜ ⬜ | Real publication execution
  - Blocked until GCP Workload Identity provider and service account secrets
    are configured.

## Required GCP Workload Identity Closure

An operator in the allowed Google Workspace customer with permission
`iam.workloadIdentityPools.create` on project `brik64-platform-mvp` must create
the GitHub Actions OIDC binding below.

Authoritative GCP policy facts observed on 2026-06-05:

```text
project: brik64-platform-mvp
project_number: 897764825865
organization: organizations/862363253041
organization_display_name: brik64.com
allowed_policy_member_domain_customer: C02zrapel
iam.allowedPolicyMemberDomains: allowedValues=["C02zrapel"]
iam.disableServiceAccountKeyCreation: enforce=true
```

Failed self-service attempts that must not be repeated as-is:

```text
brik64admin@gmail.com -> roles/iam.workloadIdentityPoolAdmin
result: blocked by constraints/iam.allowedPolicyMemberDomains
reason: user is not in permitted organization

carlosjperez@brik64.com -> roles/iam.workloadIdentityPoolAdmin
result: blocked by constraints/iam.allowedPolicyMemberDomains
reason: user is not in permitted organization

service account JSON key creation
result: blocked by constraints/iam.disableServiceAccountKeyCreation
```

Therefore the remaining closure must be performed by a Google Workspace identity
that is a member of customer `C02zrapel` and already has, or can be granted by an
authorized admin, `roles/iam.workloadIdentityPoolAdmin` or equivalent custom
permissions.

```bash
PROJECT=brik64-platform-mvp
PROJECT_NUMBER=897764825865
POOL=brik64-github-actions
PROVIDER=brik64-cli-main
SA=brik64-cli-release-publisher@$PROJECT.iam.gserviceaccount.com

gcloud iam workload-identity-pools create "$POOL" \
  --project "$PROJECT" \
  --location global \
  --display-name="BRIK64 GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
  --project "$PROJECT" \
  --location global \
  --workload-identity-pool "$POOL" \
  --display-name="BRIK64 CLI main" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='brik64/brik64-cli' && assertion.ref=='refs/heads/main'"

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project "$PROJECT" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/brik64/brik64-cli"
```

Then configure these repository secrets in `brik64/brik64-cli`:

```text
BRIK64_GCP_WORKLOAD_IDENTITY_PROVIDER=projects/897764825865/locations/global/workloadIdentityPools/brik64-github-actions/providers/brik64-cli-main
BRIK64_GCP_SERVICE_ACCOUNT=brik64-cli-release-publisher@brik64-platform-mvp.iam.gserviceaccount.com
```

Do not create a long-lived JSON key unless org security policy is explicitly
changed and the release process is updated to accept that risk.

## Publication Command

After GCP Workload Identity is configured, run:

```bash
gh workflow run release-train-publish.yml --repo brik64/brik64-cli --ref main \
  -f manifest_digest="058440c5d913a3b2cda8dc23d5ac063cb5de164c35d798aa74d289afac68bc95" \
  -f confirm="PUBLISH 0.1.0-beta.5 058440c5d913a3b2cda8dc23d5ac063cb5de164c35d798aa74d289afac68bc95" \
  -F execute_publication=true
```

The confirmation string is intentionally strict. The valid format is:

```text
PUBLISH <version> <manifest_digest>
```

## Required Post-Publish Evidence

The publication run must produce:

- `PASS_PUBLISH_PREFLIGHT_READY_TO_MUTATE`.
- `PASS_RELEASE_TRAIN_PUBLISH_EXECUTE`.
- `publicationMutated=true`.
- No `command_failed:*`.
- Post-publish live verification pass.

Then verify live public surfaces:

```bash
gh workflow run release-train-live-verify.yml --repo brik64/brik64-cli --ref main
```

The live verifier must produce:

```text
PASS_RELEASE_TRAIN_LIVE_VERIFY
failures=[]
```

## Rollback / Supersede Rule

If publication starts and a public channel fails after any mutation:

1. Do not delete historical artifacts.
2. Create a superseding manifest with state `failed` for `0.1.0-beta.5`.
3. Restore the curl/GCP channel manifest to the previous known-good object.
4. Amend GitHub Release notes to point to the failed/superseding manifest.
5. Re-run live verification and keep the failed report as evidence.

## Final Completion Checklist

- ⬜ GCP Workload Identity Pool exists.
- ⬜ GCP provider is scoped to `brik64/brik64-cli` and `refs/heads/main`.
- ⬜ Service account has `roles/iam.workloadIdentityUser` for the provider.
- ⬜ `BRIK64_GCP_WORKLOAD_IDENTITY_PROVIDER` secret exists.
- ⬜ `BRIK64_GCP_SERVICE_ACCOUNT` secret exists.
- ⬜ `release-train-publish` mutation run passes.
- ⬜ Post-publish `release-train-live-verify` passes.
- ⬜ Live `install.sh` installs `0.1.0-beta.5`.
- ⬜ Live `beta.json` points to `0.1.0-beta.5`.
- ⬜ npm, PyPI, and crates.io expose beta5 SDKs.
- ⬜ docs, web changelog, and public skill surfaces match the manifest.
