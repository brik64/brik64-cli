# Release Manifest Contract

Status: proposed contract for the BRIK64 release train.

Date: 2026-06-05

## Purpose

The release manifest is the single source of truth for a BRIK64 public release.
It binds version, artifacts, public surfaces, release notes, and verification
requirements into one reviewable file.

No workflow should infer the public version from package files, docs, tags, or
web content. Those surfaces are consumers of the manifest.

## File Location

Recommended path:

```text
release/manifest.json
```

The manifest must be committed before dry-run or publish workflows are allowed
to run.

## Minimal Schema

```json
{
  "schemaVersion": "brik64.release_manifest.v1",
  "releaseId": "brik64-0.1.0-beta.6",
  "version": "0.1.0-beta.6",
  "channel": "beta",
  "state": "draft",
  "createdAt": "2026-06-05T00:00:00Z",
  "source": {
    "repo": "brik64/brik64-cli",
    "branch": "codex/release-train-ci",
    "commit": "<sha>"
  },
  "cli": {
    "installCommand": "curl -fsSL https://brik64.com/cli/install.sh | bash",
    "targets": [
      {
        "platform": "darwin-arm64",
        "required": true,
        "artifact": "brik64-darwin-arm64.tar.gz",
        "sha256": "<sha256>"
      }
    ]
  },
  "sdks": [
    {
      "language": "typescript",
      "package": "@brik64/core",
      "marketplace": "npm",
      "version": "0.1.0-beta.6",
      "required": true
    }
  ],
  "publicSurfaces": {
    "githubRelease": {
      "required": true,
      "tag": "v0.1.0-beta.6"
    },
    "gcpInstaller": {
      "required": true,
      "manifestUrl": "https://brik64.com/cli/beta.json"
    },
    "web": {
      "required": true,
      "urls": [
        "https://brik64.com/",
        "https://brik64.com/changelog"
      ]
    },
    "docs": {
      "required": true,
      "urls": [
        "https://docs.brik64.com/cli/install.md"
      ]
    },
    "skills": {
      "required": true,
      "repo": "brik64/brik64-tools-skills"
    }
  },
  "releaseNotes": [
    {
      "type": "added",
      "surface": "cli",
      "text": "Adds the public command behavior described here."
    }
  ],
  "verification": {
    "dryRunReport": null,
    "liveReport": null
  }
}
```

## Required Validation

The validator must fail when:

- `schemaVersion` is not supported.
- `version`, `releaseId`, and tag values disagree.
- a required public surface is missing.
- a required SDK has no marketplace, package name, and version.
- an artifact has no digest.
- release notes contain internal execution language.
- any file generated from the manifest still references a previous active
  version.
- a workflow attempts publish from a manifest that did not pass dry run.

## Release Notes Rules

Release notes are public product text. They must be concise, factual, and
limited to public functionality.

Allowed examples:

- `Adds brik64 init validation for existing workspaces.`
- `Improves install failure messages when Node.js is missing.`
- `Publishes the TypeScript SDK beta package.`

Rejected examples:

- `Moved distribution contract to curl-only because npm is reserved.`
- `Aligned release train decisions across internal surfaces.`
- `Generated through private methodology labels.`

## Consumer Responsibilities

### CLI package

- reads the manifest version during packaging.
- writes package metadata from the manifest.
- signs and hashes artifacts declared by the manifest.

### Docs

- imports the active version and install commands from the manifest.
- renders release notes from public `releaseNotes`.
- fails if manual docs mention a conflicting version.

### Web

- renders the changelog from the manifest or a CMS record created from it.
- keeps install surfaces in sync with the active manifest.
- avoids deploy-only version changes outside the train.

### Skills

- avoid fixed private release terminology.
- can discover the active public version through public endpoints or CLI output.
- include install guidance for SDK-assisted and CLI-first workflows.

## State Transitions

```text
draft -> dry_run_passed -> publishing -> public
draft -> failed
dry_run_passed -> failed
publishing -> failed
failed -> superseded
public -> superseded
```

The publish workflow is the only actor allowed to set `public`.

