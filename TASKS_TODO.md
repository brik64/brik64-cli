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
- [ ] Create L6+N5 generation evidence pack.
      - Current blocker:
        `remote_l6plus_wrapper_has_no_cli_materializer_interface`.
- [ ] Publish public surfaces only after L6 and release train gates pass.
