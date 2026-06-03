# BRIK CLI Methodology Transition

## Rule

The initial beta can use scaffold and operational artifacts while the CLI is
being made usable. Once the beta CLI is functionally validated, CLI semantics
must move to BRIK64 methodology:

1. create `.brik` project metadata;
2. generate CLI PCDs as the semantic source;
3. certify candidate PCDs through the active prod gates;
4. compile the CLI through the approved compiler path;
5. make future CLI iterations by modifying PCD logic, not by treating emitted
   target code as the semantic source.

## Boundary

This document does not claim current fixpoint, N5 authorization, public beta
release readiness or Rust independence.

The transition is blocked until the initial CLI beta has real platform evidence
and `brik64-prod` release gates allow promotion.

## Required Evidence Before Stronger Claims

- `.brik` manifest for the CLI repo.
- PCD source set for CLI logic.
- PCD certification reports.
- Compiler provenance report.
- Platform execution reports.
- Fixpoint/reproducibility evidence under the active methodology.
