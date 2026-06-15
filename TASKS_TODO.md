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
- [ ] Create L6+N5 generation evidence pack.
      - Current blocker:
        `remote_l6plus_materialization_contract_unavailable`.
- [ ] Publish public surfaces only after L6 and release train gates pass.
