# Beta6 L6+N5 Hetzner Generation Endpoint

Date: 2026-06-05

Status: required before public beta6 release.

## Authority

Official beta6 CLI artifacts must be generated from PCD/polymer sources through
the internal L6+N5 factory hosted on Hetzner.

Entry point:

- host: `root@89.167.104.236`;
- Hetzner instance id: `125157982`;
- expected public IPv4: `89.167.104.236`;
- expected availability zone: `hel1-dc2`;
- documented server name: `ECO-BRIK-HETZNER`;
- observed OS hostname may still be `ubuntu-16gb-hel1-1`; this does not by
  itself mean the wrong server is being used if the instance id, IP and zone
  match;
- engine root: `/opt/brik64/engines/l6plus-n5/current`;
- wrapper: `/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5`;
- healthcheck: `/opt/brik64/engines/l6plus-n5/bin/healthcheck`;
- audit harness: `/opt/brik64/engines/l6plus-n5/bin/audit`;
- binary:
  `/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus`;
- serial: `BRIK64-L6PLUS-N5-20260601-ee53196434bd17cf`;
- binary sha256:
  `1ee21aec87146322cc0136fab19b90cc0a62171ef4ad4058417fbac661bb4885`.

## Current Gate

Run:

```sh
npm run gate:beta6:l6-hetzner
```

Current observed verdict:

```text
decision=BLOCKED_L6_FULL_CLI_GENERATION_UNAVAILABLE
blockers=l6_full_cli_generation_endpoint_missing,l6_general_compile_route2_bounded_only
```

This means SSH, serial, binary hash, healthcheck, audit and claim boundary are
valid, but the remote motor currently exposes only bounded route2 compile. That
is not sufficient for public beta6 generation from `pcd/cli_polymer.pcd`.

## Compatible Route2 Evidence

While the full generation endpoint is blocked, beta6 may keep a separate
non-release evidence lane:

```sh
npm run generate:beta6:l6-compatible
```

This emits:

```text
evidence/beta6-l6-compatible-polymer/report.json
```

That report proves only that an encoded one-parameter candidate can be compiled
by the currently deployed route2-bounded L6+N5 motor and checked against a
finite parity set. It must remain `releaseEligible=false` and cannot satisfy the
public beta6 gate.

## Required Endpoint Contract

The Hetzner factory must expose a non-public command or harness that accepts:

- `.brik/manifest.json`;
- `pcd/cli_polymer.pcd`;
- all command-family PCDs referenced by the polymer;
- a technical sheet;
- target selection for the most efficient supported public artifact;
- output directory for generated artifact, package manifest, checksums and
  evidence.

Minimum fail-closed checks:

- Hetzner instance id, public IPv4 and availability zone match the documented
  permanent host;
- serial and binary hash match expected values;
- healthcheck and audit pass before generation;
- PCD inventory hash matches the request;
- polymer hash matches the request;
- route2-only mode cannot satisfy full CLI generation;
- generated artifact hash is recorded;
- package manifest binds generated artifact hash;
- release manifest binds package manifest hash;
- claim boundary remains closed.

Minimum report:

```text
evidence/beta6-l6-hetzner-generation/report.json
```

Required PASS decision:

```text
PASS_L6_FULL_CLI_GENERATION_READY
```

Until that decision exists, beta6 must remain candidate-only.
