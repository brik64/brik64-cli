# BRIK64 CLI Methodology Transition

This document describes how the CLI beta moves from a practical JavaScript
package surface toward the BRIK64 PCD-first methodology.

## Transition Path

The current beta can use operational source and package artifacts while the CLI
is being made usable. As the methodology matures, the CLI should move through
this path:

1. Maintain `.brik` project metadata for traceability.
2. Expand CLI PCDs as the intended semantic source.
3. Certify candidate PCDs through the active prod gates.
4. Compile the CLI through the approved compiler path.
5. Make future CLI iterations by modifying PCD logic before target output.

## Current Boundary

The public beta remains centered on local CLI usage, package inspection, PCD
seed review, and release evidence. Stronger methodology language should be
promoted only after the matching `brik64-prod` gates and platform evidence
authorize it.

## Required Evidence Before Stronger Claims

- `.brik` manifest for the CLI repo.
- PCD source set for CLI logic.
- PCD certification reports.
- Compiler provenance report.
- Platform execution reports.
- Fixpoint/reproducibility evidence under the active methodology.
