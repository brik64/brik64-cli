#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = '0.1.0-beta.17';
const outPath = path.join(root, 'evidence', 'beta17-pre-publication-mutation-gate', 'report.json');

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fileInfo(ref) {
  const file = path.resolve(root, ref);
  const workspace = path.resolve(root);
  if (!(file === workspace || file.startsWith(`${workspace}${path.sep}`))) {
    return { exists: false, unsafe: true, path: ref };
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return { exists: false, path: ref };
  const bytes = fs.readFileSync(file);
  return {
    exists: true,
    path: ref,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  };
}

function reportDecision(ref) {
  try {
    return readJson(ref).decision || null;
  } catch {
    return null;
  }
}

function main() {
  const blockers = [];
  const warnings = [];
  const checks = [];

  const pkg = readJson('package.json');
  const manifest = readJson('release/manifest.json');
  const packageManifest = readJson('evidence/beta17-package/package.manifest.json');
  const requiredInputs = readJson('evidence/beta17-fixpoint-required-inputs/report.json');

  checks.push({
    id: 'package_json_version',
    expected: version,
    actual: pkg.version || null,
    pass: pkg.version === version,
  });
  if (pkg.version !== version) blockers.push(`package_json_version_mismatch:${pkg.version || 'missing'}`);

  checks.push({
    id: 'release_manifest_pre_public',
    expectedVersion: version,
    actualVersion: manifest.version || null,
    state: manifest.state || null,
    pass: manifest.version === version && manifest.releaseId === `brik64-${version}` && manifest.state === 'public',
  });
  if (manifest.version !== version) blockers.push(`release_manifest_version_mismatch:${manifest.version || 'missing'}`);
  if (manifest.releaseId !== `brik64-${version}`) blockers.push(`release_manifest_id_mismatch:${manifest.releaseId || 'missing'}`);
  if (manifest.state !== 'public') blockers.push(`release_manifest_state_not_public:${manifest.state || 'missing'}`);

  const packageRef = manifest.cli?.package || {};
  const packageInfo = packageRef.path ? fileInfo(packageRef.path) : { exists: false, path: null };
  checks.push({
    id: 'cli_package_hash_bound',
    path: packageRef.path || null,
    expectedSha256: packageRef.sha256 || null,
    actualSha256: packageInfo.sha256 || null,
    expectedBytes: packageRef.bytes || null,
    actualBytes: packageInfo.bytes || null,
    pass: packageInfo.exists === true
      && packageInfo.sha256 === packageRef.sha256
      && packageInfo.bytes === packageRef.bytes,
  });
  if (packageInfo.unsafe) blockers.push(`cli_package_path_unsafe:${packageRef.path}`);
  if (!packageInfo.exists) blockers.push(`cli_package_missing:${packageRef.path || 'missing'}`);
  if (packageInfo.exists && packageInfo.sha256 !== packageRef.sha256) blockers.push('cli_package_sha256_mismatch');
  if (packageInfo.exists && packageInfo.bytes !== packageRef.bytes) blockers.push('cli_package_bytes_mismatch');

  checks.push({
    id: 'package_manifest_candidate_ready_for_mutation',
    version: packageManifest.version || null,
    decision: packageManifest.decision || null,
    releaseEligible: packageManifest.releaseEligible === true,
    publicationAllowed: packageManifest.publicationAllowed === true,
    packagePathMatches: packageManifest.package?.path === packageRef.path,
    packageShaMatches: packageManifest.package?.sha256 === packageRef.sha256,
    packageBytesMatches: packageManifest.package?.bytes === packageRef.bytes,
    pass: packageManifest.version === version
      && packageManifest.releaseEligible === true
      && packageManifest.package?.path === packageRef.path
      && packageManifest.package?.sha256 === packageRef.sha256
      && packageManifest.package?.bytes === packageRef.bytes,
  });
  if (packageManifest.version !== version) blockers.push(`package_manifest_version_mismatch:${packageManifest.version || 'missing'}`);
  if (packageManifest.releaseEligible !== true) blockers.push('package_manifest_release_eligible_false');
  if (packageManifest.package?.path !== packageRef.path) blockers.push('package_manifest_package_path_mismatch');
  if (packageManifest.package?.sha256 !== packageRef.sha256) blockers.push('package_manifest_package_sha256_mismatch');
  if (packageManifest.package?.bytes !== packageRef.bytes) blockers.push('package_manifest_package_bytes_mismatch');
  if (packageManifest.publicationAllowed !== false) {
    warnings.push('package_manifest_publication_boundary_not_closed_for_pre_publication');
  }

  checks.push({
    id: 'required_inputs',
    decision: requiredInputs.decision || null,
    publicationAllowed: requiredInputs.publicationAllowed === true,
    pass: requiredInputs.decision === 'PASS_BETA17_FIXPOINT_REQUIRED_INPUTS'
      && requiredInputs.publicationAllowed === false
      && requiredInputs.claimBoundary?.publicReleaseAllowed === false,
  });
  if (requiredInputs.decision !== 'PASS_BETA17_FIXPOINT_REQUIRED_INPUTS') {
    blockers.push(`required_inputs_not_pass:${requiredInputs.decision || 'missing'}`);
  }
  if (requiredInputs.publicationAllowed !== false || requiredInputs.claimBoundary?.publicReleaseAllowed !== false) {
    blockers.push('required_inputs_publication_boundary_open');
  }

  const requiredEvidence = [
    'evidence/beta17-fixpoint/canonical_motor_manifest.json',
    'evidence/beta17-fixpoint/canonical_harness_manifest.json',
    'evidence/beta17-fixpoint/input_pcd_hashes.tsv',
    'evidence/beta17-fixpoint/stage1_artifact_manifest.json',
    'evidence/beta17-fixpoint/stage2_regeneration_manifest.json',
    'evidence/beta17-fixpoint/byte_identical_report.json',
    'evidence/beta17-fixpoint/harness_report.json',
    'evidence/beta17-fixpoint/seal_report.json',
    'evidence/beta17-fixpoint/remote_promotion_manifest.json',
    'evidence/beta17-fixpoint/evidence_pack_manifest.json',
  ];
  for (const ref of requiredEvidence) {
    const info = fileInfo(ref);
    checks.push({
      id: `evidence:${ref}`,
      path: ref,
      exists: info.exists === true,
      sha256: info.sha256 || null,
      bytes: info.bytes || null,
      pass: info.exists === true,
    });
    if (!info.exists) blockers.push(`required_evidence_missing:${ref}`);
  }

  const claimBoundary = manifest.claimBoundary || {};
  for (const key of ['formalN5ClaimAllowed', 'fixpointClaimAllowed', 'selfHostingClaimAllowed', 'rustIndependenceClaimAllowed']) {
    if (claimBoundary[key] === true) blockers.push(`manifest_claim_boundary_overreach:${key}`);
  }
  if (claimBoundary.publicClaimsAllowed === true) blockers.push('manifest_public_claims_open_before_live_verify');

  const postPublicReports = [
    ['public_surface_sync', 'evidence/beta17-fixpoint/public_surface_sync_report.json'],
    ['external_audit_status', 'evidence/beta17-fixpoint-external-audit-status/report.json'],
    ['readiness', 'evidence/beta17-fixpoint-readiness/report.json'],
  ].map(([id, ref]) => ({ id, ref, decision: reportDecision(ref) }));

  const pass = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_pre_publication_mutation_gate.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: pass ? 'PASS_BETA17_PRE_PUBLICATION_MUTATION_GATE' : 'BLOCKED_BETA17_PRE_PUBLICATION_MUTATION_GATE',
    publicationMutationAllowed: pass,
    publicationAllowed: false,
    checks,
    postPublicReports,
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
    boundary: 'PASS allows release-train public-surface mutation only. It does not certify live public sync, external audit, public claims, formal N5, self-hosting, or definitive fixpoint.',
  };

  writeJson(outPath, report);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicationMutationAllowed=${report.publicationMutationAllowed}\n`);
  process.stdout.write('publicationAllowed=false\n');
  if (blockers.length) process.stdout.write(`blockers=${blockers.join(',')}\n`);
  if (!pass) process.exit(1);
}

main();
