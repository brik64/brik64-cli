#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'cli-l6-generation-required');
const outPath = path.join(outDir, 'report.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function rel(file) {
  return path.relative(root, file);
}

function betaLabel(version) {
  const match = String(version).match(/^0\.1\.0-beta\.(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  return match[2] ? `beta${match[1]}_${match[2]}` : `beta${match[1]}`;
}

function valueAt(object, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, object);
}

function truthyAt(object, dottedPath) {
  return valueAt(object, dottedPath) === true;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const packageJson = readJson(path.join(root, 'package.json'));
  const manifestPath = path.join(root, 'release', 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const argVersionIndex = process.argv.indexOf('--version');
  const version = argVersionIndex >= 0
    ? process.argv[argVersionIndex + 1]
    : packageJson.version;
  const label = betaLabel(version);
  const blockers = [];
  const checks = {};
  const evidence = {};

  if (!label) blockers.push(`unsupported_version_format:${version}`);

  const evidenceDir = label ? path.join(root, 'evidence', `${label}-l6-generation`) : null;
  const requiredFiles = [
    'gate-report.json',
    'l6plus_engine_manifest.json',
    'input_pcd_hashes.tsv',
    'generated_artifact_manifest.json',
    'package.manifest.json',
    'seal_report.json',
    'hashes.json'
  ];

  if (!evidenceDir || !fs.existsSync(evidenceDir)) {
    blockers.push(`missing_l6_generation_evidence_dir:${label ? `evidence/${label}-l6-generation` : 'unknown'}`);
  } else {
    evidence.dir = rel(evidenceDir);
    for (const name of requiredFiles) {
      const file = path.join(evidenceDir, name);
      if (!fs.existsSync(file)) {
        blockers.push(`missing_l6_generation_evidence_file:${rel(file)}`);
        continue;
      }
      evidence[name] = {
        path: rel(file),
        sha256: sha256File(file),
        sizeBytes: fs.statSync(file).size
      };
    }
  }

  const gatePath = evidenceDir ? path.join(evidenceDir, 'gate-report.json') : null;
  const gate = gatePath && fs.existsSync(gatePath) ? readJson(gatePath) : null;
  if (gate) {
    checks.gateVersionMatches = gate.version === version;
    if (!checks.gateVersionMatches) blockers.push(`l6_gate_version_mismatch:${gate.version || 'missing'}:${version}`);

    checks.gateDecisionPass = typeof gate.decision === 'string' && gate.decision.startsWith('PASS');
    if (!checks.gateDecisionPass) blockers.push(`l6_gate_decision_not_pass:${gate.decision || 'missing'}`);

    checks.gatePublicationAllowed = gate.publicationAllowed === true || gate.releasePublicationAllowed === true;
    if (!checks.gatePublicationAllowed) blockers.push('l6_gate_publication_not_allowed');

    checks.gateNoBlockers = Array.isArray(gate.blockers) && gate.blockers.length === 0;
    if (!checks.gateNoBlockers) blockers.push(`l6_gate_blockers_present:${Array.isArray(gate.blockers) ? gate.blockers.length : 'missing'}`);

    const claimBoundary = gate.claimBoundary || gate.claim_boundary || {};
    checks.noFormalClaimLeak =
      (claimBoundary.formalN5ClaimAllowed === false || claimBoundary.n5_authorized === false || claimBoundary.n5FormalClaimAllowed === false)
      && (claimBoundary.fixpointClaimAllowed === false || claimBoundary.fixpoint_claim_allowed === false)
      && (claimBoundary.selfHostingClaimAllowed === false || claimBoundary.self_hosting_claim_allowed === false)
      && (claimBoundary.rustIndependenceClaimAllowed === false || claimBoundary.rust_independence_claim_allowed === false);
    if (!checks.noFormalClaimLeak) blockers.push('l6_gate_claim_boundary_missing_or_unsafe');
  }

  const artifactManifestPath = evidenceDir ? path.join(evidenceDir, 'generated_artifact_manifest.json') : null;
  const artifactManifest = artifactManifestPath && fs.existsSync(artifactManifestPath) ? readJson(artifactManifestPath) : null;
  if (artifactManifest) {
    checks.artifactVersionMatches = artifactManifest.version === version || artifactManifest.cliVersion === version;
    if (!checks.artifactVersionMatches) blockers.push(`artifact_manifest_version_mismatch:${artifactManifest.version || artifactManifest.cliVersion || 'missing'}:${version}`);

    checks.pcdToArtifactHashBound =
      truthyAt(artifactManifest, 'pcdToArtifactHashBound')
      || truthyAt(artifactManifest, 'materialization.generated_by_l6plus_n5')
      || truthyAt(artifactManifest, 'generatedByL6PlusN5');
    if (!checks.pcdToArtifactHashBound) blockers.push('artifact_manifest_missing_pcd_to_artifact_hash_binding');
  }

  const packageManifestPath = evidenceDir ? path.join(evidenceDir, 'package.manifest.json') : null;
  const packageManifest = packageManifestPath && fs.existsSync(packageManifestPath) ? readJson(packageManifestPath) : null;
  if (packageManifest) {
    checks.packageVersionMatches = packageManifest.version === version;
    if (!checks.packageVersionMatches) blockers.push(`package_manifest_version_mismatch:${packageManifest.version || 'missing'}:${version}`);

    checks.artifactToPackageHashBound =
      truthyAt(packageManifest, 'artifactToPackageHashBound')
      || truthyAt(packageManifest, 'hashBinding.artifactToPackage')
      || truthyAt(packageManifest, 'package.hashBoundToGeneratedArtifact');
    if (!checks.artifactToPackageHashBound) blockers.push('package_manifest_missing_artifact_to_package_hash_binding');

    checks.packageToReleaseManifestHashBound =
      truthyAt(packageManifest, 'packageToReleaseManifestHashBound')
      || truthyAt(packageManifest, 'hashBinding.packageToReleaseManifest')
      || truthyAt(packageManifest, 'releaseManifest.hashBoundToPackage');
    if (!checks.packageToReleaseManifestHashBound) blockers.push('package_manifest_missing_package_to_release_manifest_hash_binding');
  }

  if (manifest) {
    checks.releaseManifestVersionContext = manifest.version === version;
    if (!checks.releaseManifestVersionContext) blockers.push(`release_manifest_version_context_mismatch:${manifest.version}:${version}`);
  }

  const report = {
    schemaVersion: 'brik64.cli_l6_generation_required_gate.v1',
    generatedAt: new Date().toISOString(),
    version,
    label,
    decision: blockers.length === 0
      ? 'PASS_CLI_L6_GENERATION_REQUIRED_GATE'
      : 'BLOCKED_CLI_L6_GENERATION_REQUIRED_GATE',
    policy: {
      requirement: 'Every new public BRIK64 CLI version must include direct L6+N5 generation evidence before release.',
      acceptedChain: 'PCD/polymer -> L6+N5 serial -> generated artifact -> package -> release manifest',
      rejectedEvidence: [
        'preflight-only L6 health reports',
        'manual patches without PCD regeneration',
        'route2 bounded historical generation reused for a newer CLI',
        'internal reports with releasePublicationAllowed=false'
      ]
    },
    evidence,
    checks,
    blockers
  };

  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.decision} ${rel(outPath)}`);
  if (blockers.length > 0) {
    for (const blocker of blockers) console.error(blocker);
    process.exit(1);
  }
}

main();
