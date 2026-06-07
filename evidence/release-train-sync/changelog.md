## 0.1.0-beta.9

### Added

- Adds typed i64 function parameters and return annotations for supported PCD programs.
- Adds bounded list and map expressions for supported local PCD emission.
- Adds bounded repeat loops with a fixed maximum iteration count.
- Adds direct same-directory PCD imports and generated helper functions in emitted TypeScript, Rust, and Python outputs.
- Adds package scaffolds for generated TypeScript, Rust, and Python projects when brik64 emit is used with tests.
- Adds actionable brik64 doctor diagnostics with stable JSON output for CI.

### Changed

- Improves parser failures for unsupported calls, invalid imports, malformed collection expressions, and unsupported loop forms.
- Keeps cloud verification and cloud polymerization entitlement-gated while local workflows remain available by default.
