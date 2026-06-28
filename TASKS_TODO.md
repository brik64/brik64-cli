# Beta15.7.x Tasks

- [x] Make Beta15.7 L6 generation attempts bind the exact hotfix version.
      - Script:
        `scripts/beta15_7-l6-generation-attempt.js`.
      - Tests:
        `scripts/tests/test_beta15_7_l6_generation_attempt.sh`.
        `scripts/tests/test_cli_l6_generation_required_gate.sh`.
      - Result:
        `0.1.0-beta.15.7.1` now writes L6 request/report/package refs for
        `0.1.0-beta.15.7.1`, while still using the shared evidence label
        `beta15_7`.
      - Boundary:
        live L6 materialization is still blocked because the remote endpoint
        rejects the hotfix version.

- [x] Make `release:train:dry-run` consume the Beta15.7.x L6 required gate.
      - Script:
        `scripts/release-train-dry-run.js`.
      - Result:
        dry-run now fails closed on `cli_l6_generation_required` instead of
        allowing a draft Beta15.7.1 false-green release train.
      - Evidence:
        `npm run release:train:dry-run -- --allow-dirty` fails with
        `FAIL_RELEASE_TRAIN_DRY_RUN` and the expected L6 blockers.

- [x] Add mandatory Beta15.7.x full release audit gate before publication.
      - Script:
        `scripts/beta15_7-full-release-audit-gate.js`.
      - NPM:
        `gate:beta15.7:full-release-audit`.
      - Release train:
        `scripts/release-train-dry-run.js` now runs the gate for Beta15.7.x.
      - Coverage:
        direct CLI commands, L4+N5 engine status, 128 monomers, core/extended
        certify/verify, TS/Python/Rust generated tests, core/extended/app
        polymer, lift TS/JS/Python/Rust, unsupported-lift warnings and
        adversarial fail-closed vectors.
      - Evidence:
        `evidence/beta15_7-full-release-audit/report.json` reports
        `PASS_BRIK64_CLI_BETA15_7_FULL_RELEASE_AUDIT_GATE` with 111 command
        records.
      - Boundary:
        this is local candidate evidence. It does not unblock publication while
        `gate:cli:l6-generation-required` remains blocked.

- [x] Expose or regenerate L6+N5 materialization support for exact version
      `0.1.0-beta.15.7.1`.
      - Scripts:
        `scripts/remote_l6_beta15_7_cli_materializer.js`.
        `scripts/tests/test_remote_l6_beta15_7_cli_materializer.sh`.
      - Result:
        the remote materializer now accepts only the bounded
        `0.1.0-beta.15.7.x` family, rejects out-of-family versions such as
        `0.1.0-beta.15.8`, and keeps unsafe output refs fail-closed.
      - Evidence:
        `npm run attempt:beta15.7:l6-generation` passed with
        `PASS_BETA15_7_L6_GENERATION_GATE`.
        `npm run gate:cli:l6-generation-required` passed with
        `PASS_CLI_L6_GENERATION_REQUIRED_GATE`.
        `npm run release:train:dry-run -- --allow-dirty` passed with
        `PASS_RELEASE_TRAIN_DRY_RUN`.
      - Done when:
        `npm run attempt:beta15.7:l6-generation`,
        `npm run gate:cli:l6-generation-required` and
        `npm run release:train:dry-run -- --allow-dirty` all pass after
        deterministic package regeneration without opening public
        fixpoint/N5/self-hosting claims.

- [ ] Execute public mutation train for Beta15.7.1.
      - Current state:
        local release train dry-run is green with `release/manifest.json`
        promoted to `state=public`, but publication mutation still requires a
        GitHub-verified release commit/ref.
      - Latest Ralph Loop check:
        `npm run release:train:publish-plan` now supports
        `0.1.0-beta.15.7.1` and fails closed on the intended blocker:
        `manifest_state_not_public:draft`.
      - SDK preflight hardening:
        `scripts/release-train-publish-plan.js` now validates the required SDK
        project versions and local marketplace artifacts declared by
        `release/manifest.json` before presenting the mutation commands.
      - Current explicit blockers:
        npm SDK project is `0.1.0-beta.15.7` and has no
        `brik64-core-0.1.0-beta.15.7.1.tgz` artifact.
        Python SDK project is `0.1.0b15.post4` and has no
        `brik64-0.1.0b15.post701*` artifact.
        Rust SDK project is `0.1.0-beta.15.4`.
      - Done when:
        GitHub Release, curl/GCP installer, docs, web, skills, npm, PyPI,
        crates and live verification all point to `0.1.0-beta.15.7.1` with
        fresh evidence and no claim overreach.

- [ ] Align SDK repositories and artifacts to Beta15.7.1 before public
      mutation.
      - npm target:
        `@brik64/core@0.1.0-beta.15.7.1`.
      - PyPI target:
        `brik64==0.1.0b15.post701`.
      - crates target:
        `brik64-core@0.1.0-beta.15.7.1`.
      - Current state:
        metadata is committed and pushed in SDK PRs:
        JS https://github.com/brik64-admin/brik64-lib-js/pull/11,
        Python https://github.com/brik64-admin/brik64-lib-python/pull/13,
        Rust https://github.com/brik64-admin/brik64-lib-rust/pull/15.
        Local artifacts were generated for the publish-plan preflight.
      - Remaining:
        merge SDK PRs and publish the marketplace packages during the atomic
        release train.
      - Updated state:
        SDK PRs are merged:
        JS #11, Python #13, Rust #15. Local artifacts still exist for the
        publish-plan preflight.
      - Done when:
        package metadata, README public references, built artifacts and
        release-train publish-plan all match `release/manifest.json`.

- [ ] Restore/export release credentials for the atomic Beta15.7.1 mutation
      train.
      - Current blocker:
        `op whoami` works, but the active service account only lists vault
        `C-BIAS`; it does not list `BRIK64`. The only matching C-BIAS item
        found was `Service Account Auth Token: BRIK64-FLEET`, not the
        marketplace/publication token set.
      - Publish preflight currently fails on missing:
        `BRIK64_GITHUB_RELEASE_TOKEN`, `BRIK64_NPM_TOKEN`,
        `BRIK64_PYPI_TOKEN`, `BRIK64_CRATES_TOKEN`,
        `BRIK64_DOCS_DISPATCH_TOKEN`, `BRIK64_WEB_DEPLOY_TOKEN`,
        `BRIK64_SKILLS_REPO_TOKEN` and GCP release auth.
      - Done when:
        release credentials are available to the publish workflow without
        printing secrets, and `npm run release:train:publish-plan -- --publish`
        fails only on intentional confirmation/manifest gates or passes after
        manifest promotion.

- [ ] Merge CLI PR through GitHub and dispatch release workflow from verified
      main commit.
      - Current blocker:
        local `release:github-verified-signature` reports the current branch
        commit as `unsigned`, so local publish-plan fails with
        `github_verified_signature_not_pass`.
      - Reason:
        public mutation requires GitHub-verified release identity. A GitHub
        merge/squash commit on `main` is expected to provide the verified ref
        that the workflow checks before publishing.
      - Done when:
        PR #203 is merged, `release:github-verified-signature` passes on the
        release ref, and `release-train-publish.yml` is dispatched with the
        manifest digest and confirmation string.

## Legacy Beta15.4 Tasks

- [x] Create clean checkout from `origin/main`.
- [x] Identify Rust app-polymer domain assertion scope defect.
- [x] Add PCD-first Beta15.4 contract files.
- [x] Patch Rust domain assertion codegen.
- [x] Add `gate:beta15.4:rust-polymer-domain`.
- [x] Run gate and iterate until green.
- [x] Add Beta15.4 package and smoke scripts.
- [x] Update release train dry-run for Beta15.4.
- [x] Keep PR dry-run mergeable while publication remains blocked by L6.
- [x] Make release dry-run consume the `brik64-prod` Beta15.4 L6 materializer gap report.
- [x] Add frozen-input package determinism regression for Beta15.4.
- [x] Add Beta15.4 L6 materialization contract PCD and reproducible fail-closed attempt.
- [x] Add remote-wrapper capability diagnostics to the Beta15.4 L6 attempt.
      - Evidence:
        `evidence/beta15_4-l6-generation/gate-report.json`.
      - Result:
        current Hetzner wrapper is `shell_exec_only`, points at the L6+N5 ELF,
        and does not expose a CLI materializer interface for the Beta15.4
        contract.
- [x] Add strict consumer for L6 CLI materialization endpoint result.
      - Parser:
        `scripts/beta15_4-l6-materialization-result.js`.
      - Test:
        `scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`.
      - Result:
        only a complete version-matched hash-bound result can switch
        `attempt:beta15.4:l6-generation` from BLOCKED to PASS.
      - Boundary:
        no synthetic PASS is used for release evidence; real run remains
        blocked until the remote endpoint emits the contract result.
- [x] Detect installed fail-closed dispatcher without treating it as release evidence.
      - Evidence:
        `evidence/beta15_4-l6-generation/gate-report.json`.
      - Result:
        `wrapperMode` is now `cli_materializer_dispatcher`; generation remains
        blocked by missing materialization result and missing artifact.
      - Boundary:
        dispatcher installation is not L6 artifact generation.
- [x] Harden L6 materialization result provenance.
      - Parser:
        `scripts/beta15_4-l6-materialization-result.js`.
      - Test:
        `scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`.
      - Result:
        the CLI consumer now rejects results that omit the L6+N5 serial,
        materializer mode, generation trace hash, PCD input-set hash, remote
        wrapper hash or wrapper exec-target hash.
      - Boundary:
        this still does not generate the Beta15.4 artifact; it prevents manual
        package hashes from satisfying the L6 release gate.
- [x] Bind L6 materialization result to observed inputs and remote wrapper.
      - Parser:
        `scripts/beta15_4-l6-materialization-result.js`.
      - Attempt:
        `scripts/beta15_4-l6-generation-attempt.js`.
      - Evidence:
        `evidence/beta15_4-l6-generation/gate-report.json`.
      - Result:
        the accepted endpoint result must match the current PCD input-set hash,
        remote wrapper hash and wrapper exec-target hash observed by SSH.
      - Boundary:
        this hardens future acceptance; current run remains blocked because no
        L6 artifact is emitted.
- [x] Add PCD contract for the L6 CLI materialization result payload.
      - PCD:
        `pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd`.
      - Attempt:
        `scripts/beta15_4-l6-generation-attempt.js`.
      - Evidence:
        `evidence/beta15_4-l6-generation/input_pcd_hashes.tsv`.
      - Result:
        the L6 input-set now includes explicit closure conditions for result
        line emission, L6 serial, materializer mode, observed context hashes,
        artifact/package/release binding and seal pass.
      - Boundary:
        this strengthens the contract; it does not generate the missing
        artifact.
- [x] Require materialization payload to list all input PCD paths.
      - Parser:
        `scripts/beta15_4-l6-materialization-result.js`.
      - Attempt:
        `scripts/beta15_4-l6-generation-attempt.js`.
      - Test:
        `scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`.
      - Result:
        `expectedMaterializationContext.requiredInputPcdPaths` now blocks a
        payload that omits any required input PCD, including the result
        contract PCD.
      - Boundary:
        this is acceptance hardening; no artifact has been generated.
- [x] Require materialization payload to include safe file refs for release evidence.
      - Parser:
        `scripts/beta15_4-l6-materialization-result.js`.
      - Test:
        `scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`.
      - Result:
        accepted results must include safe relative refs for generated artifact,
        package, release manifest and seal report; artifact/package/release
        refs must match the declared hashes.
      - Boundary:
        this validates the future evidence pack shape; it does not create the
        missing L6-generated artifact.
- [x] Encode materialization file-ref closure in the Beta15.4 result PCD.
      - PCD:
        `pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd`.
      - Certificate:
        `pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd.cert.json`.
      - Result:
        the PCD now includes domains for safe refs and ref-hash matches for
        generated artifact, package and release manifest plus a safe seal-report
        ref.
      - Boundary:
        this aligns the source contract with parser behavior; it does not
        generate the missing artifact.
- [x] Verify materialization file refs against workspace files.
      - Parser:
        `scripts/beta15_4-l6-materialization-result.js`.
      - Attempt:
        `scripts/beta15_4-l6-generation-attempt.js`.
      - Test:
        `scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`.
      - Result:
        when `workspaceRoot` is present, accepted endpoint results must point
        to files that exist under the workspace and hash to the declared refs.
      - Boundary:
        this hardens future acceptance; no endpoint result currently exists.
- [x] Verify materialization input PCD refs against workspace files.
      - Parser:
        `scripts/beta15_4-l6-materialization-result.js`.
      - Test:
        `scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`.
      - Result:
        when `workspaceRoot` is present, accepted endpoint results must point
        every `inputPcds[]` entry to an existing file under the workspace whose
        SHA-256 matches the declared ref.
      - Boundary:
        this closes stale/missing/tampered input PCD evidence acceptance; no
        L6 endpoint result currently exists.
- [x] Generate reproducible L6 CLI materializer request bundle.
      - Generator:
        `scripts/beta15_4-l6-materializer-request-bundle.js`.
      - Evidence:
        `evidence/beta15_4-l6-materializer-request/request.json`.
        `evidence/beta15_4-l6-materializer-request/request.line`.
        `evidence/beta15_4-l6-materializer-request/request.manifest.json`.
      - Test:
        `scripts/tests/test_beta15_4_l6_materializer_request_bundle.sh`.
      - Result:
        each L6 attempt now has an exact
        `BRIK64_L6_CLI_MATERIALIZATION_REQUEST` input bundle with input PCD
        contents, hashes, required output refs and claim boundary.
      - Boundary:
        this is request/input evidence only. It does not satisfy release gates
        until L6 emits a matching materialization result.
- [x] Bind accepted L6 materialization result to exact request hash.
      - PCD:
        `pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd`.
      - Parser:
        `scripts/beta15_4-l6-materialization-result.js`.
      - Attempt:
        `scripts/beta15_4-l6-generation-attempt.js`.
      - Test:
        `scripts/tests/test_beta15_4_l6_materialization_result_parser.sh`.
      - Result:
        accepted endpoint results must include `materializerRequestSha256`
        matching the current generated `request.line`.
      - Boundary:
        this invalidates stale request/result pairs; it still does not produce
        the missing L6 artifact.
- [x] Harden release train gap-report validation.
      - Validator:
        `scripts/beta15_4-l6-materializer-gap-report-validate.js`.
      - Release train:
        `scripts/release-train-dry-run.js`.
      - Test:
        `scripts/tests/test_beta15_4_l6_materializer_gap_report_validate.sh`.
      - Result:
        `release:train:dry-run` now rejects a superficial
        `BETA15_4_CLI_L6_MATERIALIZER_GAP_PASS` unless the report also proves
        L6 attempt pass checks, request-bundle hash checks, package eligibility,
        exact materializer request context and closed public-claim boundaries.
      - Boundary:
        this prevents a future false green gap report; current Beta15.4 remains
        blocked until the L6 endpoint emits a real materialized artifact.
- [x] Create L6+N5 generation evidence pack.
      - Generator:
        `scripts/beta15_4-l6-generation-attempt.js`.
      - PCD compatibility fix:
        Beta15.4 materialization contracts and `pcd/cli_polymer.pcd` were
        normalized to the route-2 subset accepted by the real L6+N5 emitter.
      - Evidence:
        `evidence/beta15_4-l6-generation/gate-report.json`.
        `evidence/beta15_4-l6-generation/materialization-out.tgz`.
        `evidence/beta15_4-l6-generation/direct-materialization-summary.json`.
        `evidence/cli-l6-generation-required/report.json`.
      - Result:
        `PASS_BETA15_4_L6_GENERATION_GATE` and
        `PASS_CLI_L6_GENERATION_REQUIRED_GATE`.
      - Boundary:
        this is non-claim L6 route-2 materialization evidence for Beta15.4; it
        does not assert fixpoint, formal N5, self-hosting or Rust independence.
- [ ] Publish public surfaces only after L6 and release train gates pass.
      - Current blocker:
        PR CI must pass `Validate manifest and release train` with the same
        dry-run semantics used by the GitHub Actions release workflow.
      - [x] Treat missing sibling SDK repositories/artifacts as warnings only
            while `release:train:dry-run` is actively generating its report.
      - [x] Push CI dry-run fix and wait for PR #203 checks to pass.
      - [x] Merge through GitHub verified ref.
      - [x] Rebind public manifest source commit after squash merge so ancestry
            gates can validate the verified release base.
      - [x] Allow generated Beta15.7.1 audit reports in publish-execute dirty
            check after the real workflow failed before public mutation.
      - [x] Fix public-surface version parsers for patch beta labels after
            `gcp_curl` rejected `0.1.0-beta.15.7.1`.
      - [x] Sync public docs and skill surfaces to `0.1.0-beta.15.7.1`.
            External commits:
            docs `f41b748`, skills `b6fbe7f`.
      - [x] Harden live verifier install-command fallback so a manifest
            missing `cli.installCommand` produces deterministic verification
            instead of an opaque `undefined.replace` runtime error.
      - [ ] Trigger release-train workflow with exact manifest digest.
      - [x] Verify public curl/GitHub/GCP, SDK marketplaces, docs/web and
            skills surfaces live.

- [x] Align Beta15.4 candidate manifest and materializer request refs.
      - Request bundle:
        `scripts/beta15_4-l6-materializer-request-bundle.js`.
      - Release manifest:
        `release/manifest.json`.
      - Gate:
        `scripts/cli-l6-generation-required-gate.js`.
      - Test:
        `scripts/tests/test_cli_l6_generation_required_gate.sh`.
      - Result:
        the request now points at the actual `.tgz` package path and the L6
        generation required gate fails closed when `release/manifest.json`
        points to a stale version.
      - Boundary:
        this closes candidate metadata drift. It does not implement the missing
        L6 materializer endpoint or publish Beta15.4.

- [x] Add explicit release manifest source commit binding rules.
      - Validator:
        `scripts/release-manifest-validate.js`.
      - Test:
        `scripts/tests/test_release_manifest_source_commit_binding.sh`.
      - Result:
        draft manifests may use `candidate_base_commit`; public manifests must
        use `release_ref_exact` and match the expected release commit/ref.
      - Boundary:
        this prevents a draft self-reference workaround from being promoted as
        a public release hash binding.

- [x] Beta17 fixpoint readiness gate.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
      - Goal:
        fail closed until Beta17 has canonical PCD/polymer manifests,
        Stage1/Stage2 byte-identical evidence, harness, seal, public sync and
        external audit.
      - Boundary:
        this gate does not generate Beta17 or prove fixpoint; it prevents
        publication/claim drift while the fixpoint campaign is incomplete.

- [x] Beta17 fixpoint evidence pack template.
      - Script:
        `scripts/beta17-fixpoint-evidence-pack-init.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_evidence_pack_init.sh`.
      - Goal:
        create the exact `evidence/beta17-fixpoint/` file layout that the
        readiness gate expects, while marking every generated file
        `TEMPLATE_NON_CLAIM`.
      - Boundary:
        template files are operational scaffolding only. They must keep
        `gate:beta17:fixpoint-readiness` blocked until replaced by fresh
        Stage1/Stage2 byte-identical evidence.

- [ ] Generate Beta17 claim-bearing evidence pack.
      - Depends on:
        canonical Beta17 PCD/polymer inputs and an authorized L6+N5
        materialization run.
      - Required output:
        replace every `TEMPLATE_NON_CLAIM` file under
        `evidence/beta17-fixpoint/` with passing claim-bearing reports.
      - Gate:
        `npm run gate:beta17:fixpoint-readiness`.

- [x] Beta17 Stage1/Stage2 PCD contract gate.
      - PCDs:
        `pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd`,
        `pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd`.
      - Gate:
        `scripts/beta17-fixpoint-stage-contract-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_contract_gate.sh`.
      - Goal:
        make Stage1 L6+N5 materialization and Stage2 regeneration/byte-identity
        explicit before implementing a remote materializer.
      - Boundary:
        this is source-contract validation only. It does not run L6+N5,
        generate Stage1, regenerate Stage2 or publish Beta17.

- [x] Beta17 Stage1/Stage2 materializer request bundle.
      - Script:
        `scripts/beta17-fixpoint-stage-request-bundle.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_request_bundle.sh`.
      - Goal:
        produce a hash-bound non-claim request for an L6+N5 fixpoint
        materializer, including Stage1/Stage2 contracts, CLI PCD inputs, safe
        output refs and required result bindings.
      - Boundary:
        this creates only request/input evidence. It does not materialize
        Stage1, regenerate Stage2, compare bytes or publish Beta17.
