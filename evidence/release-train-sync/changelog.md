## 0.1.0-beta.15.6

### Fixed

- The local engine bundle now includes all runtime artifacts required by the installable CLI package and verifies their checksums during package smoke tests.
- Lift previews now report semantic-loss warnings and mark low-coverage candidates as not certification eligible instead of silently dropping source branches.

### Added

- Release gates now exercise local engine status, Rust floating-point polymer emission, cross-target generated tests, and lift semantic-loss regression.

### Changed

- Engine status reports the offline beta runtime profile used by the local CLI.
