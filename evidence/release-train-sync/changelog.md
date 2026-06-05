## 0.1.0-beta.7

### Added

- Adds local PCD polymerization so users can combine multiple PCD files into a deterministic polymer file and manifest.
- Adds local verification for certificate presence, source hash agreement, and AST hash agreement before generated outputs are trusted.
- Adds migration support for legacy lowercase PCD syntax with actionable parser guidance.
- Adds account status, login, and logout commands for future platform-connected workflows while keeping local workflows available by default.

### Changed

- Keeps human-readable doctor output as the default and moves machine-readable reports behind an explicit JSON flag.
