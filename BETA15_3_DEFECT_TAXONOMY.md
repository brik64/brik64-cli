# BRIK64 CLI Beta15.3 Defect Taxonomy

Beta15.3 is a pre-public candidate focused on generated application integrity. It does not claim formal certification, fixpoint, self-hosting, or independence from bootstrap tooling.

## Closed In Candidate

- `ts_condition_parentheses`: generated TypeScript must not emit `if false {` or equivalent invalid branch syntax.
- `div8_tuple_codegen`: `MC_03.DIV8` must be executable as `tuple_u8_u8` in TypeScript, Python, and Rust generated outputs.
- `rust_f64_codegen`: Rust f64 literals and f64 monomer method calls must compile in generated code.
- `rust_generated_warning`: generated Rust code covered by the Beta15.3 gate must not produce compiler warnings.
- `python_math_domain_fixture`: generated Python tests for math monomers must avoid invalid default values when domains declare stricter bounds.
- `polymer_pcd_certifiability`: polymer outputs intended as source must be `.polymer.pcd`, certifiable, and accompanied by a manifest.

## Still Blocking Public Release

- Public surfaces are not yet synchronized for Beta15.3.
- L6+N5 generation evidence has not been refreshed for this candidate.
- External audit from public installer has not been run for Beta15.3.

