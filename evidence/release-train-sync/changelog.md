## 0.1.0-beta.14.4

### Added

- Adds a 128-monomer inspection surface with 64 core entries and 64 extended entries for registry listing, explanation and local test reporting.
- Adds Beta14.4 PCD source contracts for monomer coverage, boundary declarations, lift workflows and release synchronization.

### Changed

- Improves monomer fixtures so each core and extended monomer can be certified and verified through local execution or an explicit deterministic boundary contract.
- Fixes Rust emission for bitwise NOT and floating-point monomers, including generated Rust tests for representative float programs.
- Adds Rust lift preview and directory lift handling for supported JS, Python and Rust sources.
