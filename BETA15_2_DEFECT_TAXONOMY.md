# BRIK64 CLI Beta15.2 Defect Taxonomy

Beta15.2 is a pre-public release candidate hardening pass derived from the
second PR-TEST case study. The observed defects are generalized here as CLI,
generator, evidence, skill, and documentation requirements.

## Claim Boundary

- Lane: `cli_0_1_beta`
- Version: `0.1.0-beta.15.2`
- Generation claim: `assisted_generation_non_claim`
- Public forbidden claims: self-hosting, fixpoint, formal N5, Rust
  independence, universal correctness, whole-application certification.

## Blocking Defects Generalized

| Code | Severity | Observed failure | Required Beta15.2 behavior |
| --- | --- | --- | --- |
| `domain_contract_not_enforced` | blocker | PCD domain declared max bounds but generated logic only checked lower bounds. | Every declared min and max bound must be enforced by generated runtime before user logic runs. |
| `polymer_helper_domain_bypass` | blocker | Generated helper functions were importable and callable without complete boundary checks. | Generated helpers/imported functions must perform partial domain checks for their own parameters. |
| `generated_test_matrix_gap` | high | Generated tests covered one easy path and did not test max-boundary failures. | Generated tests must include happy path, below-min, above-max, and branch variation cases. |
| `external_data_sanitation_gap` | high | App backend could receive `None` from external weather data and raise 500. | Generated application scaffolds must sanitize missing external data or fail closed with a domain error. |
| `claim_overreach` | blocker | A report declared release-ready while manifest declared `releaseAllowed:false`. | `doctor` must fail when local audit reports contradict manifest release eligibility. |
| `mock_install_evidence_contamination` | blocker | Case study audit relied on a mock/patched Beta15.1 install path. | Mock installs are valid for investigation only and cannot become public release evidence. |
| `ui_internal_vocab_leak` | high | End-user UI exposed PCD, DTL, ledger, cryptographic, and certification vocabulary. | User-facing UI must translate internal BRIK64 terms into domain language. |
| `sdk_version_metadata_drift` | medium | Runtime package version and package metadata can drift. | Release gates must compare runtime version, package metadata, and release manifest. |

## Implemented In This Patch

- `src/brik.js` now reports `0.1.0-beta.15.2`.
- Generated Python/TS/Rust tests include below-min and above-max domain failure
  cases for every literal domain in the PCD entrypoint.
- Generated local/import helper functions perform partial domain checks before
  executing helper body logic.
- `doctor --json` scans `.brik/audit` reports and fails on release-ready
  language when the manifest says local candidate only.
- `scripts/beta15_2-pre-public-rc-gate.js` reproduces the case-study boundary
  failure as a regression gate.

## Still Required Before Public Promotion

- Full release train package for `0.1.0-beta.15.2`.
- L6+N5 generation evidence or explicit blocker classification.
- Docs, skills, web, changelog, SDK surfaces synchronized or marked
  `no_change_required` with evidence.
- Clean external audit from public install surface.
