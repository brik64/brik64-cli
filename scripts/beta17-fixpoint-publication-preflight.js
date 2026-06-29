#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = process.env.BRIK64_BETA17_VERSION || '0.1.0-beta.17';
const manifestPath = argValue('--manifest', path.join(root, 'release', 'manifest.json'));
const outPath = argValue('--out', path.join(root, 'evidence', 'beta17-fixpoint-publication-preflight', 'report.json'));

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fileInfo(file) {
  const bytes = fs.statSync(file).size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return { bytes, sha256 };
}

function rel(file) {
  return path.relative(root, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function safeJoin(ref) {
  if (!ref || typeof ref !== 'string') return null;
  const resolved = path.resolve(root, ref);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

function closedClaimBoundary() {
  return {
    publicReleaseAllowed: false,
    definitiveFixpointAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
    publicClaimsAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  };
}

function passClaimBoundary() {
  return {
    publicReleaseAllowed: true,
    definitiveFixpointAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
    publicClaimsAllowed: true,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  };
}

function requireReport(checks, id, file, expectedDecision) {
  const item = {
    id,
    path: rel(file),
    expectedDecision,
    exists: fs.existsSync(file),
    pass: false,
  };
  if (!item.exists) {
    item.blocker = `${id}_missing:${rel(file)}`;
    checks.push(item);
    return item;
  }
  const report = readJson(file);
  const info = fileInfo(file);
  item.decision = report.decision || null;
  item.sha256 = info.sha256;
  item.bytes = info.bytes;
  item.pass = report.decision === expectedDecision;
  if (!item.pass) item.blocker = `${id}_not_pass:${report.decision || 'missing_decision'}`;
  item.blockers = Array.isArray(report.blockers) ? report.blockers : [];
  checks.push(item);
  return item;
}

function requiredEvidenceFiles() {
  return [
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
}

function nextActions(blockers) {
  const actions = [];
  if (blockers.some((b) => b.startsWith('release_manifest_') || b.startsWith('package_json_version_mismatch'))) {
    actions.push('Promote release/manifest.json and package metadata to 0.1.0-beta.17 as a candidate, with exact package path, bytes and SHA-256.');
  }
  if (blockers.some((b) => b.includes('cli_package_') || b.includes('package_manifest_'))) {
    actions.push('Generate the Beta17 package tarball and package.manifest.json from the L6+N5 materialized artifact, then seal SHA256SUMS.');
  }
  if (blockers.some((b) => b.includes('readiness'))) {
    actions.push('Refresh Beta17 fixpoint readiness evidence and rerun gate:beta17:fixpoint-readiness.');
  }
  if (blockers.some((b) => b.includes('public_surface_sync'))) {
    actions.push('Run the release train dry-run, sync public surfaces to Beta17, run live verify, then rerun sync:beta17:fixpoint:public-surfaces.');
  }
  if (blockers.some((b) => b.includes('external_audit'))) {
    actions.push('Run the external audit from a clean public install after public-surface sync passes, then rerun gate:beta17:fixpoint:external-audit-status.');
  }
  if (actions.length === 0) actions.push('Run release:train:dry-run and keep this preflight report with the publication evidence pack.');
  return actions;
}

function main() {
  const checks = [];
  const blockers = [];
  const warnings = [];
  let manifest = null;

  if (!fs.existsSync(manifestPath)) {
    blockers.push(`release_manifest_missing:${rel(manifestPath)}`);
  } else {
    manifest = readJson(manifestPath);
    const manifestCheck = {
      id: 'release_manifest',
      path: rel(manifestPath),
      exists: true,
      version: manifest.version || null,
      releaseId: manifest.releaseId || null,
      state: manifest.state || null,
      pass: true,
    };
    if (manifest.version !== version) {
      manifestCheck.pass = false;
      blockers.push(`release_manifest_version_mismatch:${manifest.version || 'missing'}`);
    }
    if (manifest.releaseId !== `brik64-${version}`) {
      manifestCheck.pass = false;
      blockers.push(`release_manifest_id_mismatch:${manifest.releaseId || 'missing'}`);
    }
    if (!['candidate', 'public'].includes(manifest.state)) {
      manifestCheck.pass = false;
      blockers.push(`release_manifest_state_not_candidate_or_public:${manifest.state || 'missing'}`);
    }
    checks.push(manifestCheck);

    const packageRef = manifest.cli?.package || {};
    const packagePath = safeJoin(packageRef.path);
    const packageCheck = {
      id: 'cli_package',
      path: packageRef.path || null,
      exists: Boolean(packagePath && fs.existsSync(packagePath)),
      pass: false,
      expectedSha256: packageRef.sha256 || null,
      expectedBytes: packageRef.bytes || null,
    };
    if (!packagePath) {
      blockers.push(`cli_package_path_unsafe_or_missing:${packageRef.path || 'missing'}`);
    } else if (!fs.existsSync(packagePath)) {
      blockers.push(`cli_package_missing:${packageRef.path}`);
    } else {
      const info = fileInfo(packagePath);
      packageCheck.sha256 = info.sha256;
      packageCheck.bytes = info.bytes;
      const shaPass = info.sha256 === packageRef.sha256;
      const bytesPass = info.bytes === packageRef.bytes;
      packageCheck.pass = shaPass && bytesPass;
      if (!shaPass) blockers.push('cli_package_sha256_mismatch');
      if (!bytesPass) blockers.push('cli_package_bytes_mismatch');
    }
    checks.push(packageCheck);

    const packageManifestPath = packageRef.path
      ? safeJoin(path.join(path.dirname(packageRef.path), 'package.manifest.json'))
      : null;
    const packageManifestCheck = {
      id: 'package_manifest',
      path: packageManifestPath ? rel(packageManifestPath) : null,
      exists: Boolean(packageManifestPath && fs.existsSync(packageManifestPath)),
      pass: false,
    };
    if (!packageManifestPath) {
      blockers.push('package_manifest_path_unavailable');
    } else if (!fs.existsSync(packageManifestPath)) {
      blockers.push(`package_manifest_missing:${rel(packageManifestPath)}`);
    } else {
      const packageManifest = readJson(packageManifestPath);
      packageManifestCheck.version = packageManifest.version || null;
      packageManifestCheck.decision = packageManifest.decision || null;
      packageManifestCheck.package = packageManifest.package || null;
      const isCandidateManifest = manifest.state === 'candidate';
      packageManifestCheck.releaseEligible = packageManifest.releaseEligible === true;
      packageManifestCheck.publicationAllowed = packageManifest.publicationAllowed === true;
      packageManifestCheck.candidateReady = packageManifest.releaseEligible === true
        && (packageManifest.publicationAllowed === true || (isCandidateManifest && packageManifest.publicationAllowed === false));
      packageManifestCheck.pass = packageManifest.version === version
        && packageManifest.package?.path === packageRef.path
        && packageManifest.package?.sha256 === packageRef.sha256
        && packageManifest.package?.bytes === packageRef.bytes
        && packageManifest.releaseEligible === true
        && (packageManifest.publicationAllowed === true || (isCandidateManifest && packageManifest.publicationAllowed === false));
      if (packageManifest.version !== version) blockers.push(`package_manifest_version_mismatch:${packageManifest.version || 'missing'}`);
      if (packageManifest.package?.path !== packageRef.path) blockers.push('package_manifest_package_path_mismatch');
      if (packageManifest.package?.sha256 !== packageRef.sha256) blockers.push('package_manifest_package_sha256_mismatch');
      if (packageManifest.package?.bytes !== packageRef.bytes) blockers.push('package_manifest_package_bytes_mismatch');
      if (packageManifest.releaseEligible !== true) blockers.push('package_manifest_release_eligible_false');
      if (packageManifest.publicationAllowed !== true && !isCandidateManifest) blockers.push('package_manifest_publication_allowed_false');
      if (packageManifest.publicationAllowed === false && isCandidateManifest) {
        warnings.push('package_manifest_candidate_publication_closed');
      }
    }
    checks.push(packageManifestCheck);
  }

  const packageJsonPath = path.join(root, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = readJson(packageJsonPath);
    const packageJsonCheck = {
      id: 'package_json',
      path: rel(packageJsonPath),
      version: packageJson.version || null,
      pass: packageJson.version === version,
    };
    if (!packageJsonCheck.pass) blockers.push(`package_json_version_mismatch:${packageJson.version || 'missing'}`);
    checks.push(packageJsonCheck);
  } else {
    blockers.push('package_json_missing');
  }

  for (const ref of requiredEvidenceFiles()) {
    const file = path.join(root, ref);
    const check = { id: `evidence:${ref}`, path: ref, exists: fs.existsSync(file), pass: false };
    if (!check.exists) {
      blockers.push(`required_evidence_missing:${ref}`);
    } else {
      const info = fileInfo(file);
      check.sha256 = info.sha256;
      check.bytes = info.bytes;
      check.pass = true;
    }
    checks.push(check);
  }

  const readiness = requireReport(
    checks,
    'readiness',
    path.join(root, 'evidence', 'beta17-fixpoint-readiness', 'report.json'),
    'PASS_BETA17_FIXPOINT_READINESS_GATE'
  );
  const publicSync = requireReport(
    checks,
    'public_surface_sync',
    path.join(root, 'evidence', 'beta17-fixpoint', 'public_surface_sync_report.json'),
    'PASS_BETA17_PUBLIC_SURFACE_SYNC'
  );
  const externalAuditStatus = requireReport(
    checks,
    'external_audit_status',
    path.join(root, 'evidence', 'beta17-fixpoint-external-audit-status', 'report.json'),
    'PASS_BETA17_EXTERNAL_AUDIT_STATUS_GATE'
  );
  for (const reportCheck of [readiness, publicSync, externalAuditStatus]) {
    if (reportCheck.blocker) blockers.push(reportCheck.blocker);
    for (const blocker of reportCheck.blockers || []) blockers.push(`${reportCheck.id}:${blocker}`);
  }

  if (manifest?.claimBoundary) {
    const boundary = manifest.claimBoundary;
    for (const key of ['formalN5ClaimAllowed', 'fixpointClaimAllowed', 'selfHostingClaimAllowed', 'rustIndependenceClaimAllowed']) {
      if (boundary[key] === true) blockers.push(`manifest_claim_boundary_overreach:${key}`);
    }
  } else if (manifest) {
    warnings.push('manifest_claim_boundary_missing');
  }

  const uniqueBlockers = [...new Set(blockers)];
  const pass = uniqueBlockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.publication_preflight.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: pass ? 'PASS_BETA17_PUBLICATION_PREFLIGHT' : 'BLOCKED_BETA17_PUBLICATION_PREFLIGHT',
    publicationAllowed: pass,
    releaseId: manifest?.releaseId || null,
    manifestVersion: manifest?.version || null,
    checks,
    blockers: uniqueBlockers,
    warnings,
    nextActions: nextActions(uniqueBlockers),
    claimBoundary: pass ? passClaimBoundary() : closedClaimBoundary(),
    boundary: 'Non-mutating preflight only. PASS means the repo evidence is ready for the release train; it does not itself publish public surfaces or prove formal N5.',
  };

  writeJson(outPath, report);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicationAllowed=${report.publicationAllowed}\n`);
  if (uniqueBlockers.length > 0) process.stdout.write(`blockers=${uniqueBlockers.join(',')}\n`);
  if (warnings.length > 0) process.stdout.write(`warnings=${warnings.join(',')}\n`);
  if (!pass) process.exit(1);
}

main();
