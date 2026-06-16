# Beta15.4 Tasks

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
- [ ] Create L6+N5 generation evidence pack.
      - Current blocker:
        `remote_l6plus_materialization_contract_unavailable`.
- [ ] Publish public surfaces only after L6 and release train gates pass.
