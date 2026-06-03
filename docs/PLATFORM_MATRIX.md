# Platform Matrix

| Platform | Status | Required Evidence |
| --- | --- | --- |
| macOS Apple Silicon | current beta lane | package smoke, checksum, release manifest |
| macOS Intel | planned | Intel host or runner install smoke, checksum, release manifest |
| Debian Linux x64 | planned | Debian package/install smoke, checksum, release manifest |
| Ubuntu Linux x64 | planned | Ubuntu package/install smoke, checksum, release manifest |
| Fedora Linux x64 | future lane | Fedora package/install smoke or explicit scope decision |
| Alpine Linux x64 musl | future lane | musl-specific artifact or explicit scope decision |
| Windows x64 | planned | Windows runner smoke, checksum, release manifest |

## Public Wording Rule

Describe each platform only at the evidence level it has reached. Linux package
language should name the distro lane, and macOS language should distinguish
Apple Silicon from Intel until both lanes have passed their own checks.
