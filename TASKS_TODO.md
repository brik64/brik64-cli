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

# Beta17 Fixpoint Tasks

- [x] Add non-mutating Beta17 publication preflight.
      - Script:
        `scripts/beta17-fixpoint-publication-preflight.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_publication_preflight.sh`.
      - NPM:
        `preflight:beta17:fixpoint:publication`.
        `test:beta17:fixpoint:publication-preflight`.
      - Result:
        fixture PASS and four break attempts pass. The live repo report writes
        `BLOCKED_BETA17_PUBLICATION_PREFLIGHT`, with `publicationAllowed=false`,
        because manifest/package metadata remain Beta16.1, public sync is stale
        to Beta15.7.1 live evidence, and external audit is still gated behind
        public-surface sync.
      - Boundary:
        this is a preflight gate only. It does not publish Beta17, mutate public
        surfaces, execute external audit or authorize fixpoint/formal claims.

- [ ] Promote Beta17 release manifest and package metadata to candidate only
      after package tarball and package manifest are generated from the
      L6+N5-materialized artifact.
      - Current blocker:
        `preflight:beta17:fixpoint:publication` reports
        `release_manifest_version_mismatch:0.1.0-beta.16.1`,
        `package_manifest_version_mismatch:0.1.0-beta.16.1` and
        `package_json_version_mismatch:0.1.0-beta.16.1`.
      - Done when:
        `release/manifest.json`, `package.json`, package tarball,
        `package.manifest.json` and `SHA256SUMS` all bind
        `0.1.0-beta.17` without opening public claims prematurely.

- [x] Generate a non-public Beta17 package candidate from current L6+N5 Stage
      evidence.
      - Script:
        `scripts/build-beta17-package-candidate.js`.
      - Test:
        `scripts/tests/test_beta17_package_candidate.sh`.
      - NPM:
        `package:beta17:fixpoint:candidate`.
        `test:beta17:fixpoint:package-candidate`.
      - Result:
        `evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz`,
        `package.manifest.json`, `SHA256SUMS` and
        `release.manifest.candidate.json` are generated from the current
        Stage1 artifact and evidence pack.
      - Boundary:
        package manifest is intentionally `releaseEligible=false` and
        `publicationAllowed=false` because the current Stage1 artifact is
        stage metadata, not a full functional CLI package. This is candidate
        packaging evidence only.

- [ ] Materialize a functional Beta17 CLI artifact, not just a Stage metadata
      artifact.
      - Current blocker:
        `evidence/beta17-package/package.manifest.json` reports
        `stage_artifact_not_functional_cli_sized`, and publication preflight
        reports `package_manifest_release_eligible_false`.
      - General factory blocker:
        `evidence/l6plus-pcd-artifact-factory-audit/report.json` reports
        `BLOCKED_L6PLUS_PCD_ARTIFACT_FACTORY_AUDIT` because the remote wrapper
        exposes only `beta15_7_ready,beta16_1_ready,beta16_native_ready`,
        does not emit `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT`, and
        `factory-status` is unsupported.
      - Required correction:
        replace version-specific wrapper routing with
        `l6plus_pcd_artifact_factory`, then route the Beta17 functional CLI
        request through that general factory.
      - Done when:
        L6+N5 produces a Stage1 artifact that is executable as the Beta17 CLI,
        package candidate marks `releaseEligible=true`, generated package smoke
        passes, and publication preflight advances to public sync/external
        audit blockers only.

- [x] Add a gate that proves whether the Beta17 Stage1 artifact is a
      functional CLI artifact.
      - Script:
        `scripts/beta17-fixpoint-functional-stage-artifact-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_functional_stage_artifact_gate.sh`.
      - NPM:
        `gate:beta17:fixpoint:functional-stage-artifact`.
        `test:beta17:fixpoint:functional-stage-artifact`.
      - Result:
        fixture PASS plus three break attempts pass. Real evidence writes
        `BLOCKED_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE` because the Stage1
        artifact is 1473 bytes and lacks Node entrypoint, argv handling and
        command dispatcher markers.
      - Boundary:
        this gate measures functional artifact shape only. It does not run the
        full CLI command matrix, sync public surfaces or prove fixpoint.

- [x] Add a PCD-first request bundle for generating functional Beta17 CLI
      Stage1 through L6+N5.
      - PCD:
        `pcd/beta17/release/functional_cli_stage_materialization_contract.pcd`.
      - Script:
        `scripts/beta17-functional-cli-stage-request-bundle.js`.
      - Test:
        `scripts/tests/test_beta17_functional_cli_stage_request_bundle.sh`.
      - NPM:
        `bundle:beta17:functional-cli-stage-request`.
        `test:beta17:functional-cli-stage-request`.
      - Result:
        `evidence/beta17-functional-cli-stage-request/request.line` now carries
        `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_REQUEST` with 5 input PCDs,
        functional CLI requirements and closed public/fixpoint/formal claim
        boundaries.
      - Boundary:
        this is request/input evidence only. It does not prove that L6+N5 has
        emitted the functional CLI artifact.

- [ ] Execute or route the functional CLI Stage request through L6+N5 and
      hydrate the result.
      - Current input:
        `evidence/beta17-functional-cli-stage-request/request.line`.
      - Expected result marker:
        `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`.
      - Attempt command:
        `npm run attempt:beta17:functional-cli-stage`.
      - Current evidence:
        `evidence/beta17-functional-cli-stage-attempt/report.json` reports
        `BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_ATTEMPT`.
      - Current blocker:
        `functional_cli_stage_result_unavailable`.
        `remote_l6plus_functional_cli_stage_endpoint_missing:beta15_7_ready,beta16_native_ready,beta16_1_ready`.
        `remote_l6plus_functional_cli_stage_result_not_emitted`.
      - Required remote capability:
        `beta17_functional_cli_stage_materializer`.
      - Attempted remote commands:
        `beta17-functional-cli-stage-materialize`,
        `functional-cli-stage-materialize`,
        `beta17-fixpoint-functional-cli-stage-materialize`.
      - Done when:
        L6+N5 emits a valid result line, the attempt hydrates Stage1/package
        refs, `gate:beta17:fixpoint:functional-stage-artifact` passes on the
        hydrated artifact, and the package candidate becomes
        `releaseEligible=true` while `publicationAllowed=false` until public
        sync and external audit close.

- [x] Add parser/validator for the future functional CLI Stage L6+N5 result.
      - Script:
        `scripts/beta17-functional-cli-stage-result.js`.
      - Test:
        `scripts/tests/test_beta17_functional_cli_stage_result.sh`.
      - NPM:
        `test:beta17:functional-cli-stage-result`.
      - Result:
        validator accepts only `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`
        payloads that bind artifact base64, SHA/bytes, request hash, input PCD
        set, functional CLI markers, L6+N5 serial and closed claims.
      - Boundary:
        this validates future result payloads. It does not call L6+N5, hydrate
        artifacts or prove that the functional CLI has been generated.

- [x] Add fail-closed hydration for a validated functional CLI Stage result.
      - Script:
        `scripts/beta17-functional-cli-stage-result-hydrate.js`.
      - Test:
        `scripts/tests/test_beta17_functional_cli_stage_result_hydrate.sh`.
      - NPM:
        `hydrate:beta17:functional-cli-stage-result`.
        `test:beta17:functional-cli-stage-result-hydrate`.
      - Result:
        valid synthetic result hydrates Stage1, Stage1 manifest, functional
        stage report and package manifest refs. Real repo run writes
        `BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_RESULT_HYDRATION` because no
        L6+N5 result line exists yet.
      - Boundary:
        this consumes a result after it exists. It does not execute L6+N5 or
        fabricate the functional CLI artifact.

- [x] Add Beta17 materializer generation result validator.
      - Script:
        `scripts/beta17-fixpoint-materializer-generation-result.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_materializer_generation_result.sh`.
      - NPM:
        `test:beta17:fixpoint:materializer-generation-result`.
      - Result:
        parser/validator now accepts only
        `BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT` payloads that
        bind the materializer file, request hash, PCD input-set hash, L6+N5
        serial, stage-result marker, non-fixture content and closed claim
        boundary.
      - Boundary:
        this validates future result evidence. It does not produce the
        materializer, execute L6+N5, install the dispatcher, prove fixpoint or
        publish Beta17.

- [x] Add Beta17 materializer generation request bundle.
      - PCD:
        `pcd/beta17/release/fixpoint_materializer_generation_contract.pcd`.
      - Script:
        `scripts/beta17-fixpoint-materializer-generation-request-bundle.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_materializer_generation_request_bundle.sh`.
      - NPM:
        `bundle:beta17:fixpoint:materializer-generation-request`.
        `test:beta17:fixpoint:materializer-generation-request`.
      - Evidence:
        `evidence/beta17-fixpoint-materializer-generation-request/request.manifest.json`
        reports
        `PASS_BETA17_FIXPOINT_MATERIALIZER_GENERATION_REQUEST_BUNDLE`.
      - Boundary:
        this is input evidence for asking L6+N5 to generate the Beta17 stage
        materializer. It is not generated materializer evidence, Stage1/Stage2
        evidence, fixpoint proof or publication authorization.

- [x] Audit the Beta17 materializer route before remote mutation.
      - Script:
        `scripts/beta17-fixpoint-materializer-route-audit.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_materializer_route_audit.sh`.
      - NPM:
        `audit:beta17:fixpoint:materializer-route`.
        `test:beta17:fixpoint:materializer-route`.
      - Done when:
        the route audit distinguishes accepted Beta17 Stage results from
        fixture, placeholder, legacy beta15/beta16 and incomplete remote
        endpoint routes, and live evidence reports the current exact blocker.
      - Result:
        test vectors pass, and live
        `evidence/beta17-fixpoint-materializer-route-audit/report.json`
        reports `BLOCKED_BETA17_FIXPOINT_MATERIALIZER_ROUTE_AUDIT` because no
        generated materializer, provenance, accepted Stage result or
        `beta17_fixpoint_stage_dispatcher` capability exists yet.

- [x] Extract reusable Beta17 evidence pack manifest generation.
      - Script:
        `scripts/beta17-fixpoint-evidence-pack-manifest.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_evidence_pack_manifest.sh`.
      - Result:
        evidence-pack manifest generation is now a reusable command/module
        instead of inline init logic. The generator hashes every current
        `evidence/beta17-fixpoint/` file except the manifest itself, closes
        public/fixpoint/formal claim boundaries by default and produces a
        deterministic pack hash over the file refs.
      - Boundary:
        this strengthens evidence indexing only. It does not create real
        Stage1/Stage2 materialization evidence or authorize Beta17 publication.

- [x] Refresh Beta17 readiness evidence pack from promoted remote Stage result.
      - Script:
        `scripts/beta17-fixpoint-readiness-evidence-refresh.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_readiness_evidence_refresh.sh`.
      - NPM:
        `refresh:beta17:fixpoint:readiness-evidence`.
        `test:beta17:fixpoint:readiness-evidence-refresh`.
      - Result:
        the refresh command writes canonical motor/harness manifests,
        `input_pcd_hashes.tsv`, enriched byte-identity/seal reports, blocked
        public-sync and external-audit reports, and a current evidence-pack
        manifest. `gate:beta17:fixpoint-readiness` no longer reports missing
        canonical manifests or Stage binding drift.
      - Boundary:
        generated public-sync and external-audit reports are intentionally
        blocked placeholders. They prevent a false-green release and do not
        authorize publication or public fixpoint claims.

- [ ] Execute Beta17 public-surface sync from fixed package/evidence refs.
      - Current explicit blocker:
        `gate:beta17:fixpoint-readiness` reports
        `public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC`.
      - Producer:
        `scripts/beta17-fixpoint-public-surface-sync-report.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_public_surface_sync_report.sh`.
      - Current real blocker:
        `sync:beta17:fixpoint:public-surfaces` writes
        `live_verify_version_mismatch:0.1.0-beta.15.7.1`, so public surfaces
        are not yet proven synced to Beta17.
      - Done when:
        installer, manifest, docs, web, skills and changelog are synced to the
        exact Beta17 artifact refs and a fresh
        `PASS_BETA17_PUBLIC_SURFACE_SYNC` report is present.

- [ ] Execute Beta17 external audit from public surfaces.
      - Current explicit blocker:
        `gate:beta17:fixpoint-readiness` reports
        `external_audit_not_pass:BLOCKED_BETA17_EXTERNAL_AUDIT` plus missing
        clean install, functional, generated-code, adversarial,
        public-surface and claim-safe audit checks.
      - Status gate:
        `scripts/beta17-fixpoint-external-audit-status-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_external_audit_status_gate.sh`.
      - Current gate result:
        `BLOCKED_BETA17_EXTERNAL_AUDIT_STATUS_GATE` because public sync is not
        PASS and the external audit report remains blocked placeholders.
      - Release train integration:
        `release:train:dry-run` now runs
        `gate:beta17:fixpoint:external-audit-status` for `0.1.0-beta.17`.
      - Done when:
        a clean public install audit produces passing functional, generated
        code, adversarial, public-surface and claim-safe evidence artifacts.

- [x] Make Beta17 remote attempts report the endpoint installation contract.
      - Script:
        `scripts/beta17-fixpoint-stage-remote-attempt.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.
      - Result:
        the remote attempt report now records the required
        `beta17_fixpoint_stage_dispatcher` capability, the attempted
        materialization commands, the required
        `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` marker and the substitutions
        that cannot satisfy Beta17 fixpoint evidence.
      - Boundary:
      this makes the operational blocker explicit. It does not install the
      remote endpoint, generate real Stage1/Stage2 artifacts, prove fixpoint
      or publish Beta17.

- [x] Add Beta17 remote dispatcher deployment preflight.
      - Script:
        `scripts/beta17-fixpoint-remote-dispatcher-preflight.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_dispatcher_preflight.sh`.
      - NPM:
        `preflight:beta17:fixpoint:remote-dispatcher`.
        `test:beta17:fixpoint:remote-dispatcher-preflight`.
      - Result:
        dispatcher installation now has an offline, fail-closed preflight that
        validates the deploy-plan schema, exact Beta17 capability, materializer
        mode, local materializer file hash/bytes, closed claim boundaries and
        non-acceptable substitutes before any Hetzner mutation.
      - Break attempts:
        wrong capability, beta16 legacy materializer path and fixture/template
        deployment are rejected.
      - Boundary:
      this validates an installation plan. It does not install the remote
      endpoint, generate real Stage1/Stage2 artifacts, prove fixpoint or
      publish Beta17.

- [x] Add Beta17 remote dispatcher deploy-plan generator.
      - Script:
        `scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_dispatcher_deploy_plan.sh`.
      - NPM:
        `plan:beta17:fixpoint:remote-dispatcher`.
        `test:beta17:fixpoint:remote-dispatcher-plan`.
      - Result:
        a candidate local Beta17 materializer can now be converted into a
        non-claim `deploy-plan.json` only with a separate materializer
        provenance manifest binding the same path, SHA-256, byte count, L6+N5
        serial, PCD input-set hash and closed claim boundaries. The generated
        plan is immediately validated by the dispatcher preflight.
      - Break attempts:
        missing materializer file, path outside workspace, missing provenance,
        provenance SHA mismatch and legacy beta16 remote path are rejected.
      - Boundary:
        this creates the deployment plan from a candidate file. It does not
      create the real L6+N5 materializer, install the remote endpoint,
      generate Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Add Beta17 materializer provenance generator.
      - Script:
        `scripts/beta17-fixpoint-materializer-provenance.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_materializer_provenance.sh`.
      - NPM:
        `provenance:beta17:fixpoint:materializer`.
        `test:beta17:fixpoint:materializer-provenance`.
      - Result:
        a candidate materializer and explicit PCD input list can now produce
        the non-claim provenance manifest required by deploy-plan and preflight
        gates. The generator computes `pcdInputSetSha256` from actual PCD
        path/SHA-256/byte rows and closes public/fixpoint/formal/universal
        claim boundaries.
      - Break attempts:
        missing materializer, PCD path outside workspace and invalid L6+N5
        serial are rejected.
      - Boundary:
        this creates provenance for a candidate materializer. It does not
        create the real L6+N5 materializer, execute remote mutation, generate
        Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Add standalone Beta17 materializer provenance gate.
      - Script:
        `scripts/beta17-fixpoint-materializer-provenance.js --validate`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_materializer_provenance.sh`.
      - NPM:
        `gate:beta17:fixpoint:materializer-provenance`.
      - Result:
        an existing provenance manifest can now be validated against current
        workspace files before deploy-plan generation or remote installation
        consumes it.
      - Break attempts:
        PCD tampering after provenance generation is rejected with a file
        SHA-256 mismatch, alongside existing missing materializer, outside PCD
        path and invalid serial cases.
      - Boundary:
        this validates candidate provenance. It does not create the real
        L6+N5 materializer, execute remote mutation, generate Stage1/Stage2
        artifacts, prove fixpoint or publish Beta17.

- [x] Require bytes on every Beta17 Stage result file reference.
      - Script:
        `scripts/beta17-fixpoint-stage-result.js`.
      - Fixture:
        `scripts/beta17-fixpoint-stage-fixture-materializer.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_result.sh`.
      - Result:
        Stage result refs now require `path`, `sha256` and `bytes`; workspace
        validation compares file bytes as well as SHA-256.
      - Break attempts:
        missing bytes on `stage2Artifact` is rejected with
        `stage_result_stage2Artifact_ref_bytes_invalid`; tampered workspace
        evidence still fails on SHA-256 mismatch.
      - Boundary:
        this strengthens result evidence binding. It does not create the real
        L6+N5 materializer, generate Stage1/Stage2 artifacts, prove fixpoint
        or publish Beta17.

- [x] Validate Stage result source byte counts during remote result promotion.
      - Script:
        `scripts/beta17-fixpoint-promote-remote-result.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`.
      - Result:
        promotion now rejects Stage result source refs whose declared `bytes`
        do not match the source file, even if SHA-256 is present.
      - Break attempts:
        mutating `stage2Artifact.bytes` in the accepted Stage result is
        rejected with
        `stage2_artifact_source_bytes_mismatch:evidence/beta17-source/generated/stage2/brik64-cli-stage2.mjs`.
      - Boundary:
        this strengthens promotion evidence binding. It does not create the
        real L6+N5 materializer, generate Stage1/Stage2 artifacts, prove
        fixpoint or publish Beta17.

- [x] Add byte-count binding to the Beta17 evidence-pack manifest.
      - Scripts:
        `scripts/beta17-fixpoint-evidence-pack-manifest.js`,
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_evidence_pack_manifest.sh`,
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
      - Result:
        the evidence-pack manifest now records `bytes` for every evidence file,
        and readiness rejects mismatched or missing byte metadata for evaluated
        evidence refs.
      - Break attempts:
        mutating the bytes entry for `stage1_artifact_manifest.json` is
        rejected with
        `evidence_pack_manifest_bytes_mismatch:evidence/beta17-fixpoint/stage1_artifact_manifest.json`.
      - Boundary:
        this hardens final evidence-pack indexing. It does not create the real
        L6+N5 materializer, generate Stage1/Stage2 artifacts, prove fixpoint
        or publish Beta17.

- [x] Add byte-count binding to Beta17 external audit artifact refs.
      - Script:
        `scripts/beta17-external-audit-report-validate.js`.
      - Tests:
        `scripts/tests/test_beta17_external_audit_report_validate.sh`,
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`,
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Docs:
        `docs/ops/BETA17_EXTERNAL_AUDIT_PROMPT.md`.
      - Result:
        external audit artifact refs now require `bytes` and are checked
        against the referenced files before readiness can accept the report.
      - Break attempts:
        mutating `generatedCodeQuality.bytes` is rejected with
        `external_audit_artifact_bytes_mismatch:generatedCodeQuality`.
      - Boundary:
        this hardens external audit evidence metadata. It does not run the
        actual external audit, create real L6+N5 Stage1/Stage2 artifacts, prove
        fixpoint or publish Beta17.

- [x] Bind Beta17 release-train requiredEvidence to readiness report bytes.
      - Script:
        `scripts/release-train-dry-run.js`.
      - Test:
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Result:
        the Beta17 `requiredEvidence` entry now records the exact
        `evidence/beta17-fixpoint-readiness/report.json` path, SHA-256 and byte
        count consumed by the release train.
      - Break attempts:
        the release-train regression now fails unless the requiredEvidence ref
        matches the generated readiness report hash and byte count.
      - Boundary:
        this hardens release-train evidence linkage. It does not create real
        L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Add Beta17 remote dispatcher installer dry-run.
      - Script:
        `scripts/beta17-fixpoint-remote-dispatcher-install.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh`.
      - NPM:
        `install:beta17:fixpoint:remote-dispatcher`.
        `test:beta17:fixpoint:remote-dispatcher-install`.
      - Result:
        a validated deploy plan can now produce an auditable
        `install-script.sh` that copies the materializer into the L6+N5 tree
        and patches the wrapper with the Beta17 stage dispatcher case. Remote
        execution is disabled unless `--execute --confirm
        INSTALL_BETA17_FIXPOINT_DISPATCHER_NON_CLAIM` is provided.
      - Break attempts:
        execute without confirmation, invalid capability and tampered local
        materializer are rejected.
      - Boundary:
        this prepares and validates the install path. It does not create the
        real L6+N5 materializer, execute remote mutation in tests, generate
        Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Require executed Beta17 dispatcher installs to return a hash-bound
      install marker.
      - Script:
        `scripts/beta17-fixpoint-remote-dispatcher-install.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh`.
      - Result:
        `--execute` mode can no longer pass on SSH status alone. It must
        observe `BRIK64_BETA17_DISPATCHER_INSTALL_RESULT` with `installed`,
        the expected materializer SHA-256 and the expected host.
      - Break attempts:
        missing marker and materializer SHA mismatch are rejected.
      - Boundary:
      this hardens future remote mutation validation. It does not execute the
      remote install, create real Stage1/Stage2 artifacts, prove fixpoint or
      publish Beta17.

- [x] Add a Beta17 required-inputs gate for the fixpoint path.
      - Script:
        `scripts/beta17-fixpoint-required-inputs-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_required_inputs_gate.sh`.
      - NPM:
        `gate:beta17:fixpoint:required-inputs`.
        `test:beta17:fixpoint:required-inputs`.
      - Result:
        operators now have a single fail-closed report that lists the exact
        inputs still missing before Beta17 can attempt claim-bearing remote
        Stage1/Stage2 generation: real L6+N5-generated materializer,
        materializer provenance, deploy plan, executed dispatcher install
        evidence, passing remote stage attempt and promotion evidence.
      - Live evidence:
        `evidence/beta17-fixpoint-required-inputs/report.json` currently
        reports `BLOCKED_BETA17_FIXPOINT_REQUIRED_INPUTS` with canonical PCDs
        present and the real materializer/provenance/install/promotion inputs
        missing.
      - Break attempts:
        dry-run install evidence, blocked remote-stage evidence, placeholder
        materializer content and outside-workspace materializer paths remain
        rejected.
      - Boundary:
        this makes the blocker auditable and actionable. It does not create
        the real L6+N5 materializer, install the dispatcher, generate
        Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Bind Beta17 release train to required-inputs evidence.
      - Scripts:
        `scripts/release-train-dry-run.js`.
        `scripts/beta17-fixpoint-required-inputs-gate.js`.
      - Test:
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Result:
        Beta17 dry-run now runs `gate:beta17:fixpoint:required-inputs` before
        `gate:beta17:fixpoint-readiness` and records
        `beta17_fixpoint_required_inputs` in `requiredEvidence` with
        path/SHA-256/bytes. A dry-run cannot hide missing materializer,
        provenance, install or promotion inputs behind a later readiness
        report.
      - Break attempts:
        missing required-inputs report fails the release train; the positive
        fixture must provide materializer provenance, deploy plan, executed
        install evidence, accepted remote-stage evidence and remote promotion
        evidence before the release-train regression passes.
      - Boundary:
        this strengthens release-train evidence ordering. It does not create
        the real materializer, execute remote install, prove fixpoint or
        publish Beta17.

- [x] Close PR #223 code-quality review comment.
      - File:
        `scripts/beta17-fixpoint-remote-dispatcher-install.js`.
      - Result:
        removed unused `version` constant flagged by review.
      - Validation:
        `node --check scripts/beta17-fixpoint-remote-dispatcher-install.js`,
        `npm run test:beta17:fixpoint:remote-dispatcher-install`,
        `npm run test:beta17:fixpoint:required-inputs` and
        `git diff --check` passed.
      - Boundary:
        review hygiene only; no materialization or fixpoint claim.

- [x] Add stale-manifest check for the Beta17 evidence pack.
      - Script:
        `scripts/beta17-fixpoint-evidence-pack-manifest.js --check`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_evidence_pack_manifest.sh`.
      - Result:
        CI and operators can now verify that
        `evidence/beta17-fixpoint/evidence_pack_manifest.json` still matches
        the current evidence directory. The check fails closed if a referenced
        evidence file changes without regenerating the manifest.
      - Boundary:
        this detects stale evidence indexes. It does not prove Stage1/Stage2
        fixpoint, run external audit or publish Beta17.

- [x] Bind Beta17 readiness to the evidence-pack aggregate digest.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
      - Result:
        readiness now validates `evidence_pack_manifest.packSha256` and the
        closed `definitiveFixpointAllowed=false` manifest boundary. A manifest
        with correct-looking file refs but a tampered aggregate pack digest
        fails closed before release readiness.
      - Boundary:
        this strengthens evidence-pack integrity checks. It does not produce
        the missing real Stage1/Stage2 L6+N5 materialization.

- [x] Validate Beta17 input PCD hash list against real files.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Result:
        `input_pcd_hashes.tsv` now requires safe relative paths, valid SHA-256
        values, existing files and exact file/hash agreement. Release-train
        fixtures now bind to real Beta17 PCD contract files instead of
        placeholder hashes.
      - Boundary:
        this validates input PCD references. It does not materialize Stage1 or
        Stage2 artifacts.

- [x] Require promoted Stage1/Stage2 artifacts in Beta17 readiness.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Result:
        readiness now requires `remote_promotion_manifest.promoted.stage1Artifact`
        and `stage2Artifact` to reference safe, existing files whose SHA-256
        matches the promotion manifest. A declarative Stage1/Stage2 manifest
        without promoted artifacts can no longer satisfy the gate.
      - Boundary:
        this verifies promoted artifact refs. It does not create real L6+N5
        artifacts.

- [x] Bind Beta17 seal report to artifacts and input PCD set.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Result:
        readiness now requires `seal_report.json` to bind Stage1 artifact,
        Stage2 artifact and `input_pcd_hashes.tsv` by SHA-256. A passing seal
        decision without matching hash bindings fails closed.
      - Boundary:
        this validates seal bindings. It does not produce the missing L6+N5
        artifacts.

- [x] Bind Beta17 byte-identity report to promoted Stage artifacts.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Result:
        `byte_identical_report.json` must now bind Stage1 and Stage2 artifact
        SHA-256 values and byte sizes to the promoted artifact files evaluated
        by the readiness gate. A generic `byteIdentical=true` report can no
        longer satisfy readiness by itself.
      - Boundary:
        this validates byte-identity evidence bindings. It does not create
        real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Bind Beta17 Stage manifests to promoted artifacts.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Result:
        Stage1 manifest must bind the promoted Stage1 artifact SHA-256.
        Stage2 manifest must bind the promoted Stage2 artifact SHA-256 and
        the promoted Stage1 artifact SHA-256 it claims to regenerate from.
      - Boundary:
        this closes detached Stage manifest evidence. It does not create
        claim-bearing L6+N5 Stage1/Stage2 artifacts or prove fixpoint.

- [x] Require explicit Beta17 public-surface sync matrix.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Result:
        `public_surface_sync_report.json` must now include passing
        `surfaceChecks` for CLI installer, CLI manifest, docs, web changelog
        and skills, each pinned to `0.1.0-beta.17`. A stale public surface
        version fails readiness.
      - Boundary:
        this validates declared public-surface sync evidence. It does not
        deploy the public surfaces.

- [x] Preserve complete Beta17 remote stage results before readiness promotion.
      - Script:
        `scripts/beta17-fixpoint-stage-remote-attempt.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.
      - Result:
        the remote attempt validator no longer validates Stage1/Stage2 output
        from the truncated `observed` preview. It validates the full parsed
        `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` and persists the complete parsed
        result as a transcript ref when present.
      - Boundary:
        this does not make Beta17 public-release-ready. It prevents a real
        long remote result from being dropped or replaced by a short preview.

- [x] Add Beta17 remote promotion gate before final evidence-pack promotion.
      - Script:
        `scripts/beta17-fixpoint-remote-promotion-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh`.
      - Result:
        a remote attempt must be PASS, unskipped, claim-closed, transcript-bound
        and include exactly one accepted full stage-result ref before it can be
        considered promotable toward `evidence/beta17-fixpoint/`.
      - Boundary:
        fixture materializer results remain blocked even if their internal
        stage-result validation says accepted.

- [x] Add controlled remote-result promotion into the Beta17 evidence pack.
      - Script:
        `scripts/beta17-fixpoint-promote-remote-result.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`.
      - Result:
        the final `evidence/beta17-fixpoint/` Stage1, Stage2,
        byte-identity, harness, seal and generated artifact paths can be
        populated only after `gate:beta17:fixpoint:remote-promotion` passes.
      - Boundary:
        the promotion manifest keeps public release and definitive fixpoint
        claims closed until canonical manifests, public sync, external audit
        and readiness gate also pass.

- [x] Bind Beta17 readiness to the remote promotion manifest.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
      - Result:
        readiness now requires `remote_promotion_manifest.json` to PASS with
        public/fixpoint/formal claim boundaries closed.
      - Boundary:
        manually placed Stage1/Stage2 evidence cannot satisfy readiness without
        the promotion-chain manifest.

- [x] Bind promoted refs to readiness-evaluated evidence files.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
      - Result:
        readiness compares promoted Stage1, Stage2, byte-identity, harness and
        seal refs to the exact files and SHA-256 values being evaluated.
      - Boundary:
        detached or manually swapped evidence files fail closed.

- [ ] Merge PR #223 after review.
      - Current state:
        PR #223 is open at `d213b04`, CI checks are green, and GitHub reports
        `reviewDecision=REVIEW_REQUIRED`.
      - Done when:
        PR #223 is merged into the verified release branch/ref.

- [ ] Run real L6+N5 Beta17 Stage1/Stage2 materialization.
      - Done when:
        `evidence/beta17-fixpoint/` contains non-fixture, non-template,
        hash-bound Stage1, Stage2, byte-identity, harness, seal, public sync
        and external audit reports, and `gate:beta17:fixpoint-readiness`
        passes.

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

- [x] Beta17 Stage1/Stage2 result validator.
      - Script:
        `scripts/beta17-fixpoint-stage-result.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_result.sh`.
      - Goal:
        reject weak or unsafe `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` payloads
        before any result can feed the readiness gate.
      - Boundary:
        this validates result shape only. It does not create a real L6+N5
        result or prove fixpoint.

- [x] Beta17 Stage result validator enforces Stage manifest artifact bindings.
      - Script:
        `scripts/beta17-fixpoint-stage-result.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_result.sh`.
      - Result:
        when the result validator has a workspace root, it now reads
        Stage1/Stage2 manifest refs and rejects manifests that do not bind the
        artifact SHA-256 values declared by the Stage result. Stage2 must also
        bind the Stage1 artifact SHA-256 it claims to regenerate from.
      - Boundary:
        this rejects detached remote result manifests before promotion. It
        does not generate real L6+N5 Stage1/Stage2 artifacts.

- [x] Beta17 Stage1/Stage2 fixture materializer.
      - Script:
        `scripts/beta17-fixpoint-stage-fixture-materializer.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_fixture_materializer.sh`.
      - Goal:
        exercise the Beta17 request/result contract end-to-end with local,
        deterministic, byte-identical fixture artifacts.
      - Boundary:
        fixture output is not L6+N5 evidence and must keep
        `gate:beta17:fixpoint-readiness` blocked.

- [x] Beta17 readiness gate rejects fixture evidence.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
      - Goal:
        ensure local fixture reports cannot be promoted into claim-bearing
        fixpoint evidence.
      - Boundary:
        this is a release safety hardening patch, not L6+N5 materialization.

- [x] Beta17 remote Stage1/Stage2 attempt script.
      - Script:
        `scripts/beta17-fixpoint-stage-remote-attempt.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.
      - Goal:
        probe the configured L6+N5 wrapper and accept only a valid
        `BRIK64_BETA17_FIXPOINT_STAGE_RESULT`.
      - Boundary:
        skip/unavailable mode must write blocked evidence and cannot publish
        or prove fixpoint.

- [x] Beta17 remote attempt transcript retention.
      - Script:
        `scripts/beta17-fixpoint-stage-remote-attempt.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.
      - Goal:
        retain probe and attempt stdout/stderr as hash-bound transcript files
        for future L6+N5 audit.
      - Boundary:
        transcripts are diagnostic evidence, not fixpoint proof.

- [x] Beta17 remote promotion independently revalidates Stage result file.
      - Script:
        `scripts/beta17-fixpoint-remote-promotion-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh`.
      - Result:
        promotion no longer trusts only `stageResultValidation.accepted` from
        the remote-attempt report. It reloads the referenced Stage result JSON
        from disk and reruns `validateStageResult` with the expected context
        before accepting promotion.
      - Boundary:
        this protects promotion from tampered or stale Stage result refs. It
        does not create real L6+N5 Stage1/Stage2 artifacts.

- [x] Beta17 remote promotion derives expected context from request file.
      - Script:
        `scripts/beta17-fixpoint-remote-promotion-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh`.
      - Result:
        promotion now validates the remote attempt's `request` ref, reruns
        `validateRequest`, recomputes the materializer request line SHA-256
        and uses the request-derived context for Stage result revalidation.
      - Boundary:
        this prevents fabricated expected context in remote attempts. It does
        not create real L6+N5 Stage1/Stage2 artifacts.

- [x] Beta17 remote result promotion supports external evidence workspaces.
      - Script:
        `scripts/beta17-fixpoint-promote-remote-result.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`.
      - Result:
        final promotion now invokes the promotion gate by absolute script path,
        so `BRIK64_CLI_ROOT` can point at an external audit/evidence workspace.
        The test now includes a positive non-fixture promotion fixture that
        copies source evidence refs into the canonical `evidence/beta17-fixpoint/`
        pack.
      - Boundary:
        this validates promotion mechanics in an external workspace. It does
        not create real L6+N5 Stage1/Stage2 artifacts.

- [x] Beta17 release-train readiness binding.
      - Release train:
        `scripts/release-train-dry-run.js`.
      - Test:
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Goal:
        ensure a `0.1.0-beta.17` candidate cannot dry-run as green unless
        `gate:beta17:fixpoint-readiness` passes and the readiness report is
        recorded as required evidence with closed formal/universal claim
        boundaries.
      - Boundary:
        this connects the release train to the readiness gate. It does not
        create claim-bearing Stage1/Stage2 L6+N5 evidence or publish Beta17.

- [x] Beta17 external audit contract hardening.
      - Gate:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`,
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Goal:
        prevent a superficial `external_audit_report.json` with only
        `pass=true` from authorizing Beta17 readiness.
      - Required audit proof:
        clean public install, functional CLI tests, generated-code tests,
        adversarial tests, public surface scan and claim-safe scan.
      - Boundary:
        this validates audit evidence shape. It does not perform the external
        audit or create claim-bearing L6+N5 Stage1/Stage2 artifacts.

- [x] Beta17 external audit prompt contract.
      - Prompt:
        `docs/ops/BETA17_EXTERNAL_AUDIT_PROMPT.md`.
      - Evidence pack:
        `scripts/beta17-fixpoint-evidence-pack-init.js`.
      - Test:
        `scripts/tests/test_beta17_external_audit_prompt_contract.sh`.
      - Goal:
        give external agents a canonical instruction packet that produces the
        exact `external_audit_report.json` contract enforced by readiness.
      - Boundary:
        this creates the audit instruction contract only. It does not execute
        the audit, publish Beta17 or prove fixpoint.

- [x] Beta17 standalone external audit report validator.
      - Validator:
        `scripts/beta17-external-audit-report-validate.js`.
      - Test:
        `scripts/tests/test_beta17_external_audit_report_validate.sh`.
      - Integration:
        `scripts/beta17-fixpoint-readiness-gate.js` imports the validator.
      - Goal:
        make the `external_audit_report.json` decision boundary reusable by
        external agents, CI and readiness without duplicating logic.
      - Boundary:
        this validates the audit report shape and section pass states. It does
        not run the audit or convert a report into fixpoint evidence by itself.

- [x] Beta17 external audit artifact refs.
      - Validator:
        `scripts/beta17-external-audit-report-validate.js`.
      - Prompt:
        `docs/ops/BETA17_EXTERNAL_AUDIT_PROMPT.md`.
      - Tests:
        `scripts/tests/test_beta17_external_audit_report_validate.sh`,
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`,
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Goal:
        require hash-bound refs for audit log, generated-code quality,
        adversarial results, public-surface scan and claim-safe scan.
      - Boundary:
        this binds audit evidence files by path and SHA-256. It does not
        generate those real audit files or approve Beta17 publication.

- [x] Beta17 evidence pack manifest.
      - Generator:
        `scripts/beta17-fixpoint-evidence-pack-init.js`.
      - Gate:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_evidence_pack_init.sh`,
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`,
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Goal:
        inventory the Beta17 evidence pack with path/SHA-256 refs and make
        readiness reject missing or mismatched refs for evaluated evidence.
      - Boundary:
        this creates and validates the pack index. It does not create real
        claim-bearing Stage1/Stage2 evidence.

- [x] Beta17 evidence pack manifest adversarial tests.
      - Test:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
      - Goal:
        prove readiness rejects a manifest SHA-256 mismatch and a manifest with
        a missing evidence ref.
      - Boundary:
        this is adversarial gate coverage only. It does not create or validate
        real L6+N5 Stage1/Stage2 artifacts.

- [x] Beta17 promoted target-copy verification.
      - Script:
        `scripts/beta17-fixpoint-promote-remote-result.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`.
      - Goal:
        after remote evidence refs are promoted into canonical
        `evidence/beta17-fixpoint/` paths, re-hash the copied target files and
        record target refs in `remote_promotion_manifest.json`.
      - Boundary:
        this proves copy integrity for promoted evidence refs. It does not
        create real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish
        Beta17.

- [x] Beta17 Stage result input-set self-consistency.
      - Validator:
        `scripts/beta17-fixpoint-stage-result.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_result.sh`.
      - Goal:
        recompute `pcdInputSetSha256` from the Stage result's own `inputPcds`
        path/SHA-256/bytes table and reject detached or silently altered PCD
        input sets.
      - Boundary:
        this validates the Stage result evidence contract. It does not create
        real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Beta17 accepted-attempt stdout/result binding.
      - Gate:
        `scripts/beta17-fixpoint-remote-promotion-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh`.
      - Goal:
        require the accepted attempt stdout transcript to contain the same
        `BRIK64_BETA17_FIXPOINT_STAGE_RESULT` payload as the hash-bound
        `stage-result.json` ref.
      - Boundary:
        this binds remote attempt transcript evidence to the Stage result file.
        It does not create real L6+N5 Stage1/Stage2 artifacts, prove fixpoint
        or publish Beta17.

- [x] Beta17 remote promotion ref byte validation.
      - Gate:
        `scripts/beta17-fixpoint-remote-promotion-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh`.
      - Goal:
        require every file ref consumed by the promotion gate to have a valid
        `bytes` value matching the referenced file size, in addition to
        SHA-256.
      - Boundary:
        this hardens evidence metadata integrity. It does not create real
        L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Beta17 readiness requires promoted target refs.
      - Gate:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`.
      - Goal:
        require promoted Stage artifacts to include `target` refs that match
        the canonical file path, SHA-256 and byte count evaluated by readiness.
      - Boundary:
        this rejects stale or pre-target-verification promotion manifests. It
        does not create real L6+N5 Stage1/Stage2 artifacts, prove fixpoint or
        publish Beta17.

- [x] Beta17 readiness requires promoted source refs.
      - Gate:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`,
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Goal:
        require promoted Stage artifacts to retain `source` refs that bind the
        promoted canonical artifact to the remote/source evidence SHA-256.
      - Boundary:
        this rejects target-only promotion manifests. It does not create real
        L6+N5 Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Beta17 promoted source byte binding.
      - Scripts:
        `scripts/beta17-fixpoint-promote-remote-result.js`,
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`,
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`,
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Goal:
        record `source.bytes` during remote-result promotion and require
        readiness to reject promoted artifacts whose source byte count does not
        match the canonical promoted artifact.
      - Boundary:
        this hardens source metadata binding. It does not create real L6+N5
        Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Beta17 remote endpoint capability diagnosis.
      - Script:
        `scripts/beta17-fixpoint-stage-remote-attempt.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.
      - Goal:
        parse both tab and literal `\t` endpoint status output and report the
        exact installed capabilities when the Beta17 fixpoint stage endpoint is
        missing.
      - Evidence:
        live L6+N5 host currently reports
        `beta15_7_ready,beta16_native_ready,beta16_1_ready` and no
        `beta17_fixpoint_stage_dispatcher`.
      - Boundary:
        this improves blocker diagnosis. It does not install the missing
        Beta17 endpoint, generate real Stage1/Stage2 artifacts, prove fixpoint
        or publish Beta17.

- [x] Add structured remediation commands to blocked Beta17 remote-stage
      attempts.
      - Script:
        `scripts/beta17-fixpoint-stage-remote-attempt.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.
      - Result:
        blocked remote-stage reports now include `remediationCommands` covering
        materializer provenance, dispatcher plan, preflight, guarded install,
        remote stage attempt, remote promotion, result promotion and readiness.
      - Break attempts:
        tests assert the remediation list contains the exact gates/operators
        required to move from missing dispatcher to promoted evidence.
      - Boundary:
        this makes the blocker actionable. It does not create the real
        materializer, execute remote mutation, generate Stage1/Stage2 artifacts,
        prove fixpoint or publish Beta17.

- [x] Capture live Beta17 remote-stage blocker evidence.
      - Scripts:
        `scripts/beta17-fixpoint-stage-request-bundle.js`,
        `scripts/beta17-fixpoint-stage-remote-attempt.js`.
      - Evidence:
        `evidence/beta17-fixpoint-stage-request/`,
        `evidence/beta17-fixpoint-remote-attempt/`.
      - Result:
        the live L6+N5 host currently reports beta15.7/beta16 endpoint
        capabilities and legacy result signals, but no
        `beta17_fixpoint_stage_dispatcher`. The attempt fails closed with
        `remote_l6plus_beta17_stage_result_unavailable`.
      - Boundary:
        this is fresh blocker evidence only. It does not execute remote
        mutation, generate Stage1/Stage2 artifacts, prove fixpoint or publish
        Beta17.

- [x] Add structured remediation input/stop-rule plan to blocked Beta17
      remote-stage attempts.
      - Script:
        `scripts/beta17-fixpoint-stage-remote-attempt.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.
      - Result:
        blocked reports now include `remediationPlan` with required inputs
        (`generatedMaterializer`, `canonicalInputPcds`, `l6plusEngineSerial`),
        step ids and fail-closed stop rules.
      - Break attempts:
        tests assert the plan keeps fixture/template inputs disallowed, requires
        the L6+N5 serial prefix and stops if Stage1/Stage2 are not
        byte-identical.
      - Boundary:
        this makes the remediation path less ambiguous. It does not create a
        materializer, execute remote mutation, generate Stage1/Stage2 artifacts,
        prove fixpoint or publish Beta17.

- [x] Harden Beta17 materializer provenance content validation.
      - Script:
        `scripts/beta17-fixpoint-materializer-provenance.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_materializer_provenance.sh`,
        `scripts/tests/test_beta17_fixpoint_remote_dispatcher_deploy_plan.sh`,
        `scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh`.
      - Result:
        materializer provenance now rejects references that do not contain
        `BRIK64_BETA17_FIXPOINT_STAGE_RESULT`, still contain the literal
        placeholder `<base64-json>`, or look like fixture/template content.
      - Break attempts:
        the provenance test covers a missing marker, a placeholder marker and
        fixture/template content. Dispatcher fixtures were updated to use a real
        base64 JSON payload so valid tests no longer depend on a placeholder.
      - Boundary:
        this prevents placeholder provenance from being treated as a candidate
        materializer. It does not create the real L6+N5 materializer, generate
        Stage1/Stage2 artifacts, prove fixpoint or publish Beta17.

- [x] Harden Beta17 remote dispatcher install script validation.
      - Script:
        `scripts/beta17-fixpoint-remote-dispatcher-install.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh`.
      - Result:
        installer dry-run now validates the generated remote install script
        before it can be accepted. The remote script verifies the copied
        materializer contains `BRIK64_BETA17_FIXPOINT_STAGE_RESULT`, rejects
        legacy endpoint references, requires the Beta17 endpoint marker and
        binds execution to the exact planned materializer remote path.
      - Break attempts:
        tests mutate the generated script by removing the endpoint marker,
        changing the materializer execution path and appending a legacy endpoint
        reference. Each mutation must fail closed.
      - Boundary:
        this hardens the guarded install path only. It does not install the
        dispatcher on the live host, generate Stage1/Stage2 artifacts, prove
        fixpoint or publish Beta17.

- [x] Bind Beta17 dispatcher install dry-run report to install-script validation and materializer refs.
      - Script:
        `scripts/beta17-fixpoint-remote-dispatcher-install.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_remote_dispatcher_install.sh`.
      - Result:
        install dry-run reports now include hash-bound local materializer and
        materializer provenance refs plus the install-script validation outcome,
        required capability, required commands and exact materializer exec
        binding. This makes the dry-run evidence self-contained before any
        remote mutation is attempted.
      - Break attempts:
        tests assert the report binds the local materializer path, provenance
        path, validation status, required commands and materializer remote path.
      - Boundary:
        this improves evidence traceability for guarded install. It does not
        install the live dispatcher, generate Stage1/Stage2 artifacts, prove
        fixpoint or publish Beta17.

- [x] Require executed Beta17 dispatcher install evidence before remote stage attempts.
      - Script:
        `scripts/beta17-fixpoint-stage-remote-attempt.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.
      - Result:
        remote stage attempts now fail closed unless an executed
        `evidence/beta17-fixpoint-remote-dispatcher/install-report.json` proves
        the Beta17 dispatcher install path passed with the expected capability,
        validated install script, materializer refs and closed claim boundaries.
      - Break attempts:
        skip-mode test now proves the remote stage report includes
        `remote_dispatcher_install_report_missing` and does not attempt to treat
        a missing install report as sufficient pre-execution evidence.
      - Boundary:
        this blocks premature remote stage execution. It does not create or
        install the real dispatcher, generate Stage1/Stage2 artifacts, prove
        fixpoint or publish Beta17.

- [x] Bind Beta17 remote promotion to executed dispatcher install evidence.
      - Script:
        `scripts/beta17-fixpoint-remote-promotion-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh`,
        `scripts/tests/test_beta17_fixpoint_remote_result_promotion.sh`.
      - Result:
        remote promotion now rejects accepted remote attempts that do not carry
        hash-bound executed dispatcher install evidence. The install report must
        show executed PASS, closed claim boundaries, Beta17 capability, accepted
        install-script validation, materialize command and materializer binding.
      - Break attempts:
        tests mutate the referenced install report to dry-run/not-executed and
        prove promotion fails closed with install-report blockers.
      - Boundary:
        this hardens promotion only. It does not create or install the real
        dispatcher, generate Stage1/Stage2 artifacts, prove fixpoint or publish
        Beta17.

- [x] Bind Beta17 readiness gate to remote promotion source report and install evidence.
      - Script:
        `scripts/beta17-fixpoint-readiness-gate.js`.
      - Tests:
        `scripts/tests/test_beta17_fixpoint_readiness_gate.sh`,
        `scripts/tests/test_beta17_release_train_readiness.sh`.
      - Result:
        readiness now rejects a remote promotion manifest unless it is bound to
        a passing remote promotion gate report. That source report must include
        executed Beta17 dispatcher install evidence with materializer SHA/path.
      - Break attempts:
        tests remove install evidence from the source promotion report and prove
        readiness fails closed before release train can pass.
      - Boundary:
        this hardens readiness/release train only. It does not create or install
        the real dispatcher, generate Stage1/Stage2 artifacts, prove fixpoint or
        publish Beta17.

- [x] Refresh live Beta17 remote-stage blocker evidence under current gates.
      - Commands:
        `npm run bundle:beta17:fixpoint:stage-request`,
        `npm run attempt:beta17:fixpoint:remote-stage`.
      - Evidence:
        `evidence/beta17-fixpoint-stage-request/`,
        `evidence/beta17-fixpoint-remote-attempt/report.json`.
      - Result:
        live non-mutating attempt now fails closed with
        `remote_dispatcher_install_report_missing`, missing Beta17 wrapper mode,
        missing Beta17 endpoint capability and unavailable Beta17 stage result.
        The report has zero materialization attempts because install evidence is
        missing, which is the current expected guard behavior.
      - Boundary:
        this is fresh blocker evidence only. It does not install the dispatcher,
        execute remote mutation, generate Stage1/Stage2 artifacts, prove
        fixpoint or publish Beta17.

- [x] Add Beta17 materializer generation attempt gate.
      - Script:
        `scripts/beta17-fixpoint-materializer-generation-attempt.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_materializer_generation_attempt.sh`.
      - NPM:
        `attempt:beta17:fixpoint:materializer-generation`.
        `test:beta17:fixpoint:materializer-generation-attempt`.
      - Result:
        the gate consumes the materializer-generation request, probes the
        L6+N5 host, tries bounded materializer-generation commands and accepts
        only `BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT` evidence
        validated against the current request and observed remote hashes.
      - Live evidence:
        `evidence/beta17-fixpoint-materializer-generation-attempt/report.json`
        reports
        `BLOCKED_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ATTEMPT`.
      - Current blocker:
        remote L6+N5 audit passes, but the wrapper mode is `unknown`, exposed
        capabilities are `beta15_7_ready,beta16_native_ready,beta16_1_ready`,
        and no Beta17 materializer-generation result is emitted.
      - Boundary:
        this is fail-closed attempt evidence. It does not generate the
        materializer, install the dispatcher, materialize Stage1/Stage2, prove
        fixpoint or publish Beta17.

- [x] Install or expose the Beta17 materializer-generation endpoint on L6+N5.
      - Required endpoint capability:
        `beta17_fixpoint_materializer_generator`.
      - Required result marker:
        `BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT`.
      - Result:
        `scripts/beta17-fixpoint-materializer-generator-endpoint-install.js`
        installs a guarded NON_CLAIM endpoint on the L6+N5 wrapper and emits
        `BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT`.
      - Live evidence:
        `npm run install:beta17:fixpoint:materializer-generator-endpoint -- --execute --confirm INSTALL_BETA17_MATERIALIZER_GENERATOR_ENDPOINT_NON_CLAIM`
        passed, and
        `npm run attempt:beta17:fixpoint:materializer-generation` passes with
        a validated non-fixture generated materializer and closed claim
        boundaries.
      - Boundary:
        this installs a generation endpoint and produces a materializer. It
        does not by itself prove fixpoint or authorize public Beta17.

- [x] Let Beta17 materializer-generation attempt hydrate remote result artifacts.
      - Script:
        `scripts/beta17-fixpoint-materializer-generation-attempt.js`.
      - Test:
        `scripts/tests/test_beta17_fixpoint_materializer_generation_attempt.sh`.
      - Result:
        a future remote endpoint may return hash-bound base64 content for the
        generated materializer, generation report and provenance. The attempt
        writes those refs under the local workspace only after safe-path,
        byte-count and SHA-256 checks, then runs the existing result validator.
      - Break attempts:
        path traversal is rejected, content SHA mismatch is rejected and valid
        content hydrates to the expected workspace file.
      - Boundary:
        hydration support does not create the remote endpoint, generate the
        materializer, prove fixpoint or publish Beta17. It only removes a
      consumer-side blocker that would otherwise reject a legitimate remote
      result.

- [x] Install Beta17 remote stage dispatcher and validate Stage1/Stage2 remote result.
      - Scripts:
        `scripts/beta17-fixpoint-stage-remote-attempt.js`,
        `scripts/tests/test_beta17_fixpoint_stage_remote_attempt.sh`.
      - Result:
        `npm run install:beta17:fixpoint:remote-dispatcher -- --execute --confirm INSTALL_BETA17_FIXPOINT_DISPATCHER_NON_CLAIM`
        passed, `npm run attempt:beta17:fixpoint:remote-stage` passed, and
        `npm run gate:beta17:fixpoint:remote-promotion` plus
        `npm run promote:beta17:fixpoint:remote-result` passed.
      - Contract hardening:
        remote Stage results now hydrate Stage1/Stage2 artifacts, manifests,
        byte-identity, harness and seal reports only after safe-path, bytes and
        SHA-256 checks. The remote attempt stops after the first present Stage
        result so promotion has one canonical source.
      - Boundary:
        Stage1/Stage2 remote materialization is promoted as NON_CLAIM evidence.
        Readiness remains blocked until final canonical manifests, input hash
        list, evidence pack, public surface sync and external audit are present
        and coherent.

- [ ] Close Beta17 fixpoint readiness package.
      - Current blockers from `npm run gate:beta17:fixpoint-readiness`:
        missing `canonical_motor_manifest.json`,
        `canonical_harness_manifest.json`, `input_pcd_hashes.tsv`,
        `evidence_pack_manifest.json`, `public_surface_sync_report.json` and
        `external_audit_report.json`.
      - Current report-binding blockers:
        byte-identity and seal reports do not expose all SHA/size/input-set
        bindings in the exact shape required by the readiness gate.
      - Done when:
        `npm run gate:beta17:fixpoint-readiness` passes with claim boundaries
        closed except the bounded `definitiveFixpointAllowed` gate output, and
        no public release is declared before public sync plus external audit.

- [x] Install and validate the general L6+N5 PCD artifact factory.
      - Current dry-run:
        `npm run install:l6plus:pcd-artifact-factory` writes
        `evidence/l6plus-pcd-artifact-factory-install/install-report.json`
        with `PASS_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL_DRY_RUN`.
      - Execute guard:
        remote mutation requires
        `--execute --confirm INSTALL_L6PLUS_PCD_ARTIFACT_FACTORY_NON_CLAIM`.
      - Current audit blocker:
        `npm run audit:l6plus:pcd-artifact-factory` reports missing
        `l6plus_pcd_artifact_factory` and missing
        `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT` on the live wrapper.
      - Done when:
        the live wrapper exposes `l6plus_pcd_artifact_factory`, emits the
        factory result marker, `factory-status` passes, and Beta17 functional
        CLI requests can be routed through `artifact-factory-materialize`.
      - Closed:
        remote install passed with
        `PASS_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL`; live audit passed with
        `PASS_L6PLUS_PCD_ARTIFACT_FACTORY_AUDIT`.

- [x] Upgrade the general L6+N5 PCD artifact factory from generic artifact
      materialization to Beta17 functional CLI result materialization.
      - Current state:
        `npm run attempt:beta17:functional-cli-stage` now routes through
        `artifact-factory-materialize` and observes
        `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT`.
      - Current blocker:
        the factory result is generic and does not emit
        `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`; the attempt fails closed
        with `remote_l6plus_factory_result_not_functional_cli_stage_result`.
      - Done when:
        L6+N5 emits a valid `BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT`, the
        hydration gate writes a functional Stage1 CLI artifact, package
        candidate reports `releaseEligible=true`, and no publication/fixpoint
        claim is opened before readiness and external-audit gates.
      - Closed:
        `attempt:beta17:functional-cli-stage` now passes, hydration writes the
        Stage1 CLI artifact, `gate:beta17:target-aware-factory-result` passes,
        `gate:beta17:fixpoint:functional-stage-artifact` passes, and
        `package:beta17:fixpoint:candidate` reports `releaseEligible=true`.

- [x] Add a target-aware factory result gate for Beta17.
      - Script:
        `scripts/beta17-target-aware-factory-result-gate.js`.
      - Test:
        `scripts/tests/test_beta17_target_aware_factory_result_gate.sh`.
      - NPM:
        `gate:beta17:target-aware-factory-result`.
        `test:beta17:target-aware-factory-result`.
      - Result:
        fixture PASS, generic factory output fail-closed and missing transcript
        fail-closed are all covered. Real evidence currently blocks with
        `factory_result_missing_target_functional_cli_stage_result_line`,
        `factory_result_not_target_aware` and
        `factory_artifact_not_functional_node_cli`.
      - Boundary:
        this gate prevents confusing a valid generic factory result with a
        functional Beta17 CLI Stage result. It does not generate or publish
        Beta17.

- [ ] Promote Beta17 metadata only after readiness/public sync/external audit
      gates are ready.
      - Current package candidate:
        `evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz` extracts and
        runs basic commands (`version`, `certify`, `verify`).
      - Current preflight blockers:
        package manifest keeps `publicationAllowed=false`, repo `package.json`
        is still `0.1.0-beta.16.1`, fixpoint readiness is blocked, live public
        surface evidence is still `0.1.0-beta.15.7.1`, and external audit is
        intentionally blocked until public-surface sync passes.
      - Done when:
        readiness, public-surface sync, external audit, SDK/docs/web/skills
        release train and claim-safe scan all pass before public mutation.
