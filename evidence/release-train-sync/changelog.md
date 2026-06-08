## 0.1.0-beta.12

### Added

- Adds opt-in telemetry commands for local export, purge, and explicit send behavior.
- Adds redacted user feedback capture with local preview by default and explicit send support.
- Adds redacted local error-report inspection and explicit send support.

### Changed

- Rejects PCD inputs, imports, certificates, and generated output paths that resolve outside the workspace through symlinks or existing parent directories.
- Improves empty-workspace doctor guidance when PCD files are present outside the default pcd inventory directory.
- Aligns JavaScript, Python, and Rust SDK package coordinates to the Beta12 release.
