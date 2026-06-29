#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = '0.1.0-beta.17';
const outPath = path.join(root, 'evidence', 'beta17-candidate-release-train-gate', 'report.json');

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function runPreflight() {
  const result = childProcess.spawnSync(process.execPath, [
    path.join(root, 'scripts', 'beta17-fixpoint-publication-preflight.js'),
    '--manifest',
    path.join(root, 'release', 'manifest.json'),
  ], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, BRIK64_CLI_ROOT: root },
  });
  return {
    rc: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function main() {
  const blockers = [];
  const warnings = [];
  const checks = [];

  const pkg = readJson('package.json');
  const manifest = readJson('release/manifest.json');
  const packageManifest = readJson('evidence/beta17-package/package.manifest.json');

  checks.push({
    id: 'package_json_version',
    expected: version,
    actual: pkg.version || null,
    pass: pkg.version === version,
  });
  if (pkg.version !== version) blockers.push(`package_json_version_mismatch:${pkg.version || 'missing'}`);

  checks.push({
    id: 'release_manifest_candidate',
    expectedVersion: version,
    actualVersion: manifest.version || null,
    state: manifest.state || null,
    pass: manifest.version === version && manifest.releaseId === `brik64-${version}` && manifest.state === 'candidate',
  });
  if (manifest.version !== version) blockers.push(`release_manifest_version_mismatch:${manifest.version || 'missing'}`);
  if (manifest.releaseId !== `brik64-${version}`) blockers.push(`release_manifest_id_mismatch:${manifest.releaseId || 'missing'}`);
  if (manifest.state !== 'candidate') blockers.push(`release_manifest_state_not_candidate:${manifest.state || 'missing'}`);

  const packageRef = manifest.cli?.package || {};
  checks.push({
    id: 'package_manifest_candidate_ready',
    version: packageManifest.version || null,
    releaseEligible: packageManifest.releaseEligible === true,
    publicationAllowed: packageManifest.publicationAllowed === true,
    packagePathMatches: packageManifest.package?.path === packageRef.path,
    packageShaMatches: packageManifest.package?.sha256 === packageRef.sha256,
    packageBytesMatches: packageManifest.package?.bytes === packageRef.bytes,
    pass: packageManifest.version === version
      && packageManifest.releaseEligible === true
      && packageManifest.publicationAllowed === false
      && packageManifest.package?.path === packageRef.path
      && packageManifest.package?.sha256 === packageRef.sha256
      && packageManifest.package?.bytes === packageRef.bytes,
  });
  if (packageManifest.version !== version) blockers.push(`package_manifest_version_mismatch:${packageManifest.version || 'missing'}`);
  if (packageManifest.releaseEligible !== true) blockers.push('package_manifest_release_eligible_false');
  if (packageManifest.publicationAllowed !== false) blockers.push('package_manifest_candidate_publication_not_closed');
  if (packageManifest.package?.path !== packageRef.path) blockers.push('package_manifest_package_path_mismatch');
  if (packageManifest.package?.sha256 !== packageRef.sha256) blockers.push('package_manifest_package_sha256_mismatch');
  if (packageManifest.package?.bytes !== packageRef.bytes) blockers.push('package_manifest_package_bytes_mismatch');

  const claimBoundary = manifest.claimBoundary || {};
  for (const key of ['publicClaimsAllowed', 'formalN5ClaimAllowed', 'fixpointClaimAllowed', 'selfHostingClaimAllowed', 'rustIndependenceClaimAllowed']) {
    if (claimBoundary[key] !== false) blockers.push(`candidate_claim_boundary_not_closed:${key}`);
  }

  const preflightRun = runPreflight();
  const preflight = readJson('evidence/beta17-fixpoint-publication-preflight/report.json');
  const preflightBlockers = Array.isArray(preflight.blockers) ? preflight.blockers : [];
  const expectedBlockingPrefixes = [
    'readiness_not_pass:',
    'public_surface_sync_not_pass:',
    'external_audit_status_not_pass:',
  ];
  const hasExpectedBlockers = expectedBlockingPrefixes.every((prefix) => preflightBlockers.some((blocker) => blocker.startsWith(prefix)));
  const forbiddenBlockers = preflightBlockers.filter((blocker) => [
    'package_manifest_publication_allowed_false',
    'package_manifest_release_eligible_false',
    `package_json_version_mismatch:${pkg.version || 'missing'}`,
    `release_manifest_version_mismatch:${manifest.version || 'missing'}`,
  ].includes(blocker));

  checks.push({
    id: 'publication_preflight_expected_blocked',
    commandRc: preflightRun.rc,
    decision: preflight.decision || null,
    publicationAllowed: preflight.publicationAllowed === true,
    packageManifestCandidateReady: preflight.checks?.find((check) => check.id === 'package_manifest')?.candidateReady === true,
    hasExpectedBlockers,
    forbiddenBlockers,
    pass: preflightRun.rc !== 0
      && preflight.decision === 'BLOCKED_BETA17_PUBLICATION_PREFLIGHT'
      && preflight.publicationAllowed === false
      && preflight.checks?.find((check) => check.id === 'package_manifest')?.candidateReady === true
      && hasExpectedBlockers
      && forbiddenBlockers.length === 0,
  });
  if (preflightRun.rc === 0) blockers.push('candidate_preflight_unexpected_publication_pass');
  if (preflight.decision !== 'BLOCKED_BETA17_PUBLICATION_PREFLIGHT') blockers.push(`candidate_preflight_decision_unexpected:${preflight.decision || 'missing'}`);
  if (preflight.publicationAllowed !== false) blockers.push('candidate_preflight_publication_open');
  if (preflight.checks?.find((check) => check.id === 'package_manifest')?.candidateReady !== true) blockers.push('candidate_preflight_package_not_candidate_ready');
  if (!hasExpectedBlockers) blockers.push('candidate_preflight_missing_expected_publication_blockers');
  for (const blocker of forbiddenBlockers) blockers.push(`candidate_preflight_forbidden_blocker:${blocker}`);
  if (preflight.warnings?.includes('package_manifest_candidate_publication_closed')) {
    warnings.push('package_manifest_candidate_publication_closed');
  }

  const pass = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_candidate_release_train_gate.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: pass ? 'PASS_BETA17_CANDIDATE_RELEASE_TRAIN_GATE' : 'BLOCKED_BETA17_CANDIDATE_RELEASE_TRAIN_GATE',
    publicationAllowed: false,
    checks,
    blockers,
    warnings,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
      publicClaimsAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
    },
  };

  writeJson(outPath, report);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write('publicationAllowed=false\n');
  if (blockers.length > 0) process.stdout.write(`blockers=${blockers.join(',')}\n`);
  if (!pass) process.exit(1);
}

main();
