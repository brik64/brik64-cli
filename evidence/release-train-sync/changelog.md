## 0.1.0-beta.11

### Added

- Adds semantic local polymerization coverage for supported same-directory PCD import DAGs.
- Materializes referenced local import files beside generated polymer outputs when needed for certification.
- Adds adversarial release gating for malformed PCD input, path traversal, stale certificates, missing imports, and polymer import behavior.

### Changed

- Improves generated Rust scaffold output so the Beta11 supported fallback path is warning-free under cargo test.
- Improves empty-workspace doctor diagnostics for both human output and JSON automation output.
- Expands release synchronization checks across CLI README, changelog, web, docs, SDK pages, and public skills.
