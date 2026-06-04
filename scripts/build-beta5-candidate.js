#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta5-local-candidate');
const sourceCli = path.join(root, 'src', 'brik.js');
const pcdDir = path.join(root, 'pcd');
const l6BridgeDir = path.join(root, 'evidence', 'beta5-l6-factory-bridge');
const l6Route2Dir = path.join(root, 'evidence', 'beta5-l6-route2');
const releaseSurfaceGateDir = path.join(root, 'evidence', 'beta5-release-surface-gate');
const l4RuntimeDir = path.join(root, 'engines', 'l4plus-n5');
const adversarialMethodologyPath = path.join(root, 'docs', 'BETA5_ADVERSARIAL_RELEASE_AUDIT.md');
const sdkSyncDir = path.join(root, 'evidence', 'beta5-sdk-sync');
const skillsSyncDir = path.join(root, 'evidence', 'beta5-skills-sync');
const docsWebSyncDir = path.join(root, 'evidence', 'beta5-docs-web-sync');
const marketplacePackagesDir = path.join(root, 'evidence', 'beta5-marketplace-packages');
const publicationPreflightDir = path.join(root, 'evidence', 'beta5-publication-preflight');
const adversarialAuditDir = path.join(root, 'evidence', 'beta5-adversarial-audit');
const packageDir = path.join(root, 'evidence', 'beta5-package');
const packageSmokeDir = path.join(root, 'evidence', 'beta5-package-smoke');
const crossPlatformSmokeDir = path.join(root, 'evidence', 'beta5-cross-platform-smoke');
const releaseChecksumsDir = path.join(root, 'evidence', 'beta5-release-checksums');
const localCompletionDir = path.join(root, 'evidence', 'beta5-local-completion');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line, index) => !(index === 0 && line.startsWith('#!')))
    .map((line) => line.replace(/^\s*\/\/.*$/, '').trimEnd())
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

function pcdInventory() {
  return fs.readdirSync(pcdDir)
    .filter((name) => name.endsWith('.pcd'))
    .sort()
    .map((name) => {
      const file = path.join(pcdDir, name);
      const source = read(file);
      return {
        file: `pcd/${name}`,
        semantic_pcd_sha256: sha256(source),
        bytes: Buffer.byteLength(source, 'utf8')
      };
    });
}

function optionalArtifact(file) {
  if (!fs.existsSync(file)) return null;
  const source = read(file);
  return {
    path: path.relative(root, file),
    sha256: sha256(source),
    bytes: Buffer.byteLength(source, 'utf8')
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const pcds = pcdInventory();
  const cliSource = read(sourceCli);
  const hardened = [
    '#!/usr/bin/env node',
    '// BRIK64 beta5 local candidate hardened artifact',
    '// releaseEligible=false; generatedBy=bootstrap_candidate_until_L6plus_N5_internal_factory',
    stripComments(cliSource)
  ].join('\n');
  const artifact = path.join(outDir, 'brik64-beta5.candidate.hardened.js');
  fs.writeFileSync(artifact, hardened);
  fs.chmodSync(artifact, 0o755);

  const sourceHash = sha256(cliSource);
  const hardenedHash = sha256(hardened);
  const pcdChainHash = sha256(JSON.stringify(pcds));
  const manifest = {
    schemaVersion: 'brik64.cli_beta5_candidate_build_chain.v1',
    version: '0.1.0-beta.5',
    releaseEligible: false,
    claimBoundary: 'local_candidate_only',
    requiredBeforeRelease: [
      'replace_bootstrap_candidate_with_L6plus_N5_internal_generated_artifact',
      'embed_or_package_verified_offline_L4plus_N5_engine',
      'run_cross_platform_adversarial_audit',
      'run_distribution_obfuscation_smoke',
      'publish_release_manifest_checksums_and_attestation'
    ],
    chain: {
      pcd_inventory_sha256: pcdChainHash,
      bootstrap_source_sha256: sourceHash,
      hardened_artifact_sha256: hardenedHash
    },
    pcds,
    hardening: {
      tool: 'scripts/build-beta5-candidate.js',
      mode: 'comment_and_blank_line_strip_candidate',
      securityClaim: false,
      purpose: 'distribution hardening rehearsal and hash-chain gate'
    },
    offlineEngine: {
      status: 'portable_l4plus_n5_bundle_bound',
      declaredRuntime: 'L4+N5 required before release',
      bundle: optionalArtifact(path.join(l4RuntimeDir, 'runtime-bundle.manifest.json')),
      releaseReady: false
    },
    engineTierPolicy: {
      publicOfflineRuntime: 'L4+N5',
      registeredManagedRuntime: 'L5+N5',
      internalArtifactFactory: 'L6+N5',
      l6DistributionAllowed: false,
      l5EmbeddedFreeRuntimeAllowed: false
    },
    l6FactoryBridge: {
      request: optionalArtifact(path.join(l6BridgeDir, 'factory-request.json')),
      preflightReport: optionalArtifact(path.join(l6BridgeDir, 'preflight-report.json')),
      route2GenerationReport: optionalArtifact(path.join(l6Route2Dir, 'generation-report.json')),
      requiredBeforeRelease: [
        'full_cli_polymer_generation_or_scope_exception_recorded',
        'generated_artifact_hash_bound_to_factory_request'
      ]
    },
    releaseSurfaceSync: {
      changelog: optionalArtifact(path.join(root, 'CHANGELOG.md')),
      matrix: optionalArtifact(path.join(root, 'docs', 'BETA5_RELEASE_SURFACE_SYNC.md')),
      adversarialMethodology: optionalArtifact(adversarialMethodologyPath),
      gateReport: optionalArtifact(path.join(releaseSurfaceGateDir, 'report.json')),
      sdkSyncReport: optionalArtifact(path.join(sdkSyncDir, 'report.json')),
      skillsSyncReport: optionalArtifact(path.join(skillsSyncDir, 'report.json')),
      docsWebSyncReport: optionalArtifact(path.join(docsWebSyncDir, 'report.json')),
      marketplacePackageReport: optionalArtifact(path.join(marketplacePackagesDir, 'report.json')),
      publicationPreflight: optionalArtifact(path.join(publicationPreflightDir, 'manifest.json')),
      adversarialAudit: optionalArtifact(path.join(adversarialAuditDir, 'report.json')),
      localPackageManifest: optionalArtifact(path.join(packageDir, 'package.manifest.json')),
      localPackageSmoke: optionalArtifact(path.join(packageSmokeDir, 'report.json')),
      crossPlatformSmoke: optionalArtifact(path.join(crossPlatformSmokeDir, 'report.json')),
      signedChecksums: optionalArtifact(path.join(releaseChecksumsDir, 'report.json')),
      localCompletion: optionalArtifact(path.join(localCompletionDir, 'report.json')),
      requiredBeforeRelease: [
        'all_required_surfaces_updated_or_no_change_required',
        'changelog_matches_artifacts',
        'docs_web_skills_sdk_sync_evidence_present'
      ]
    }
  };
  writeJson(path.join(outDir, 'build-chain.manifest.json'), manifest);
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS'), [
    `${hardenedHash}  brik64-beta5.candidate.hardened.js`,
    `${sha256(JSON.stringify(manifest, null, 2))}  build-chain.manifest.json`
  ].join('\n') + '\n');
  process.stdout.write(`candidate_artifact=${path.relative(root, artifact)}\n`);
  process.stdout.write(`hardened_artifact_sha256=${hardenedHash}\n`);
  process.stdout.write('releaseEligible=false\n');
}

main();
