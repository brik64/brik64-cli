#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta5-local-completion');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) throw new Error(`local_completion_input_missing:${relativePath}`);
  return {
    path: relativePath,
    sha256: sha256File(file),
    json: JSON.parse(fs.readFileSync(file, 'utf8'))
  };
}

function run(args) {
  const result = spawnSync(args[0], args.slice(1), { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function must(condition, code, failures) {
  if (!condition) failures.push(code);
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const verification = [];

  const version = run(['node', 'src/brik.js', '--version']).stdout.trim();
  must(version.includes('BRIK64 CLI 0.1.0-beta.5'), 'cli_version_contract_drift', failures);
  verification.push({ requirement: 'CLI reports beta5 version', status: 'PASS', evidence: version });

  const doctor = JSON.parse(run(['node', 'src/brik.js', 'doctor']).stdout);
  must(doctor.status === 'PASS', 'doctor_not_passing', failures);
  must(doctor.publicOfflineRuntime === 'L4+N5', 'public_offline_runtime_not_l4plus_n5', failures);
  must(doctor.registeredManagedRuntime === 'L5+N5', 'registered_runtime_not_l5plus_n5', failures);
  must(doctor.internalArtifactFactory === 'L6+N5', 'internal_factory_not_l6plus_n5', failures);
  verification.push({
    requirement: 'doctor passes with L4/L5/L6 policy',
    status: doctor.status,
    evidence: {
      publicOfflineRuntime: doctor.publicOfflineRuntime,
      registeredManagedRuntime: doctor.registeredManagedRuntime,
      internalArtifactFactory: doctor.internalArtifactFactory
    }
  });

  const engine = JSON.parse(run(['node', 'src/brik.js', 'engine', 'status']).stdout);
  must(engine.status === 'PASS', 'engine_status_not_passing', failures);
  must(engine.runtimeMode === 'portable_bir_bundle', 'engine_runtime_mode_unexpected', failures);
  verification.push({ requirement: 'offline L4 runtime bundle validates', status: engine.status, evidence: engine.runtimeMode });

  const packageSmoke = readJson('evidence/beta5-package-smoke/report.json');
  const crossPlatformSmoke = readJson('evidence/beta5-cross-platform-smoke/report.json');
  const adversarialAudit = readJson('evidence/beta5-adversarial-audit/report.json');
  const marketplacePackages = readJson('evidence/beta5-marketplace-packages/report.json');
  const signedChecksums = readJson('evidence/beta5-release-checksums/report.json');
  const buildChain = readJson('evidence/beta5-local-candidate/build-chain.manifest.json');
  const publicationPreflight = readJson('evidence/beta5-publication-preflight/manifest.json');
  const releaseSurface = readJson('evidence/beta5-release-surface-gate/report.json');

  must(packageSmoke.json.decision === 'PASS_LOCAL_PACKAGE_SMOKE', 'package_smoke_not_passing', failures);
  must(crossPlatformSmoke.json.decision === 'PASS_CROSS_PLATFORM_SMOKE', 'cross_platform_smoke_not_passing', failures);
  must(adversarialAudit.json.decision === 'PASS_BETA5_LOCAL_ADVERSARIAL_AUDIT', 'adversarial_audit_not_passing', failures);
  must(marketplacePackages.json.decision === 'PASS_MARKETPLACE_PACKAGE_GATE', 'marketplace_package_gate_not_passing', failures);
  must(signedChecksums.json.decision === 'PASS_SIGNED_CHECKSUMS', 'signed_checksums_not_passing', failures);
  must(buildChain.json.version === '0.1.0-beta.5', 'build_chain_version_drift', failures);

  const expectedPublicBlockers = [
    'github_release_not_created',
    'release_tag_not_created',
    'marketplace_publication_not_authorized'
  ];
  must(publicationPreflight.json.decision === 'BLOCKED_PUBLICATION_PREFLIGHT', 'publication_preflight_unexpected_decision', failures);
  must(JSON.stringify(publicationPreflight.json.blockers || []) === JSON.stringify(expectedPublicBlockers), 'publication_blocker_set_unexpected', failures);
  must(releaseSurface.json.decision === 'BLOCKED_PUBLIC_RELEASE_NOT_READY', 'release_surface_unexpected_decision', failures);
  must((releaseSurface.json.failures || []).length === 0, 'release_surface_failures_present', failures);

  verification.push(
    { requirement: 'local package smoke passes', status: packageSmoke.json.decision, evidence: packageSmoke.path },
    { requirement: 'cross-platform local candidate smoke passes', status: crossPlatformSmoke.json.decision, evidence: crossPlatformSmoke.path },
    { requirement: 'adversarial audit passes', status: adversarialAudit.json.decision, evidence: adversarialAudit.path },
    { requirement: 'SDK package artifacts are locally present and hash-bound', status: marketplacePackages.json.decision, evidence: marketplacePackages.path },
    { requirement: 'release candidate checksums are signed and verified', status: signedChecksums.json.decision, evidence: signedChecksums.path },
    { requirement: 'remaining blockers are publication-only', status: publicationPreflight.json.decision, evidence: publicationPreflight.json.blockers }
  );

  const report = {
    schemaVersion: 'brik64.cli_beta5_local_completion_gate.v1',
    version: '0.1.0-beta.5',
    decision: failures.length === 0 ? 'PASS_BETA5_LOCAL_COMPLETION' : 'FAIL_BETA5_LOCAL_COMPLETION',
    confidenceLevel: 'N3',
    releaseEligible: false,
    localObjectiveSatisfied: failures.length === 0,
    verification,
    artifacts: {
      packageSmoke: { path: packageSmoke.path, sha256: packageSmoke.sha256 },
      crossPlatformSmoke: { path: crossPlatformSmoke.path, sha256: crossPlatformSmoke.sha256 },
      adversarialAudit: { path: adversarialAudit.path, sha256: adversarialAudit.sha256 },
      marketplacePackages: { path: marketplacePackages.path, sha256: marketplacePackages.sha256 },
      signedChecksums: { path: signedChecksums.path, sha256: signedChecksums.sha256 },
      buildChain: { path: buildChain.path, sha256: buildChain.sha256 },
      publicationPreflight: { path: publicationPreflight.path, sha256: publicationPreflight.sha256 },
      releaseSurface: { path: releaseSurface.path, sha256: releaseSurface.sha256 }
    },
    remainingPublicReleaseBlockers: expectedPublicBlockers,
    failures,
    boundary: 'This gate proves the local beta5 functional/adversarial objective. It intentionally does not create a GitHub Release, release tag, curl publication, or marketplace publication.'
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`localObjectiveSatisfied=${report.localObjectiveSatisfied}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
