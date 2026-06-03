# BRIK64 CLI Distribution Roadmap

This roadmap tracks public beta distribution channels for BRIK64 CLI.

## Current Public Channels

- npmjs: primary package registry for `@brik64/cli`.
- GitHub Releases: release notes, source archive, and platform assets.
- GitHub Packages: organization-visible npm mirror, published separately from
  npmjs through `publish-github-packages-beta.yml`.

## Required Next Channels

| Channel | Target | Status | Evidence Required |
| --- | --- | --- | --- |
| macOS Apple Silicon | npm/GitHub release asset | Current beta lane | package smoke, checksum, release manifest |
| macOS Intel | GitHub release asset, curl, Homebrew | Planned | Intel runner/install smoke, checksum, release manifest |
| Debian Linux | `.deb`, curl, apt-ready artifact | Planned | Debian build, install smoke, checksum, release manifest |
| Ubuntu Linux | `.deb`, curl, apt-ready artifact | Planned | Ubuntu build, install smoke, checksum, release manifest |
| Windows PC | installer/zip, GitHub release asset | Planned | Windows runner smoke, checksum, release manifest |
| Homebrew | tap formula | Planned | formula audit, install smoke, checksum binding |
| curl installer | GCP-hosted install script | Planned | signed script, checksum verification, HTTPS availability |

## Automation Boundary

Each channel must publish only after platform-specific package, install, checksum,
and release-evidence gates pass. Docs, npm metadata, GitHub Releases,
GitHub Packages, Homebrew, curl, and brik64.com should reference the same
version and artifact evidence.

## Project Tracking

The GitHub Project should track each channel as a separate issue with:

- target platform;
- distribution channel;
- required artifact;
- smoke command;
- checksum or signature requirement;
- docs/Mintlify update requirement;
- release blocker status.
