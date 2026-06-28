#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateBeta17ExternalAuditReport } = require('./beta17-external-audit-report-validate');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta17-fixpoint-readiness');
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

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function existsJson(file, blockers, evidence, key) {
  if (!fs.existsSync(file)) {
    blockers.push(`missing_${key}:${rel(file)}`);
    return null;
  }
  evidence[key] = {
    path: rel(file),
    sha256: sha256File(file),
    sizeBytes: fs.statSync(file).size,
  };
  return readJson(file);
}

function boolAt(object, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, object) === true;
}

function rejectFixtureEvidence(report, key, blockers) {
  if (!report || typeof report !== 'object') return;
  if (boolAt(report, 'fixtureMaterializer') || boolAt(report, 'materialization.fixtureMaterializer') || boolAt(report, 'regeneration.fixtureMaterializer')) {
    blockers.push(`${key}_fixture_materializer_not_claim_bearing`);
  }
}

function checkHashList(file, blockers, evidence, key) {
  if (!fs.existsSync(file)) {
    blockers.push(`missing_${key}:${rel(file)}`);
    return;
  }
  const text = fs.readFileSync(file, 'utf8');
  const rows = text.split(/\r?\n/).filter(Boolean);
  evidence[key] = {
    path: rel(file),
    sha256: sha256File(file),
    rows: rows.length,
  };
  if (rows.length === 0) blockers.push(`${key}_empty:${rel(file)}`);
}

function checkPromotedRef(remotePromotion, promotedKey, evidenceKey, evidence, blockers) {
  const promoted = remotePromotion?.promoted?.[promotedKey];
  if (!promoted || typeof promoted !== 'object') {
    blockers.push(`remote_promotion_missing_promoted_ref:${promotedKey}`);
    return;
  }
  const evaluated = evidence[evidenceKey];
  if (!evaluated) {
    blockers.push(`remote_promotion_missing_evaluated_ref:${evidenceKey}`);
    return;
  }
  if (promoted.path !== evaluated.path) {
    blockers.push(`remote_promotion_ref_path_mismatch:${promotedKey}:${promoted.path || 'missing'}:${evaluated.path}`);
  }
  if (String(promoted.sha256 || '').toLowerCase() !== String(evaluated.sha256 || '').toLowerCase()) {
    blockers.push(`remote_promotion_ref_sha256_mismatch:${promotedKey}`);
  }
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const packageJson = readJson(path.join(root, 'package.json'));
  const version = argValue('--version', packageJson.version);
  const expectedVersion = '0.1.0-beta.17';
  const fixpointDir = path.join(root, 'evidence', 'beta17-fixpoint');
  const blockers = [];
  const checks = {};
  const evidence = {};

  if (version !== expectedVersion) {
    blockers.push(`beta17_version_context_required:${version}`);
  }

  if (!fs.existsSync(fixpointDir)) {
    blockers.push(`missing_fixpoint_evidence_dir:${rel(fixpointDir)}`);
  }

  const canonicalMotor = existsJson(
    path.join(fixpointDir, 'canonical_motor_manifest.json'),
    blockers,
    evidence,
    'canonical_motor_manifest'
  );
  const canonicalHarness = existsJson(
    path.join(fixpointDir, 'canonical_harness_manifest.json'),
    blockers,
    evidence,
    'canonical_harness_manifest'
  );
  checkHashList(path.join(fixpointDir, 'input_pcd_hashes.tsv'), blockers, evidence, 'input_pcd_hashes');

  const stage1 = existsJson(
    path.join(fixpointDir, 'stage1_artifact_manifest.json'),
    blockers,
    evidence,
    'stage1_artifact_manifest'
  );
  const stage2 = existsJson(
    path.join(fixpointDir, 'stage2_regeneration_manifest.json'),
    blockers,
    evidence,
    'stage2_regeneration_manifest'
  );
  const byteIdentity = existsJson(
    path.join(fixpointDir, 'byte_identical_report.json'),
    blockers,
    evidence,
    'byte_identical_report'
  );
  const harness = existsJson(
    path.join(fixpointDir, 'harness_report.json'),
    blockers,
    evidence,
    'harness_report'
  );
  const seal = existsJson(
    path.join(fixpointDir, 'seal_report.json'),
    blockers,
    evidence,
    'seal_report'
  );
  const remotePromotion = existsJson(
    path.join(fixpointDir, 'remote_promotion_manifest.json'),
    blockers,
    evidence,
    'remote_promotion_manifest'
  );
  const publicSync = existsJson(
    path.join(fixpointDir, 'public_surface_sync_report.json'),
    blockers,
    evidence,
    'public_surface_sync_report'
  );
  const externalAudit = existsJson(
    path.join(fixpointDir, 'external_audit_report.json'),
    blockers,
    evidence,
    'external_audit_report'
  );

  if (canonicalMotor) {
    checks.canonicalMotorPcdBound = boolAt(canonicalMotor, 'pcdBound') || boolAt(canonicalMotor, 'canonical.pcdBound');
    if (!checks.canonicalMotorPcdBound) blockers.push('canonical_motor_not_pcd_bound');
  }
  if (canonicalHarness) {
    checks.canonicalHarnessPcdBound = boolAt(canonicalHarness, 'pcdBound') || boolAt(canonicalHarness, 'canonical.pcdBound');
    if (!checks.canonicalHarnessPcdBound) blockers.push('canonical_harness_not_pcd_bound');
  }
  if (stage1) {
    rejectFixtureEvidence(stage1, 'stage1', blockers);
    checks.stage1GeneratedByL6 = boolAt(stage1, 'generatedByL6PlusN5') || boolAt(stage1, 'materialization.generatedByL6PlusN5');
    checks.stage1VersionMatches = stage1.version === expectedVersion || stage1.cliVersion === expectedVersion;
    if (!checks.stage1GeneratedByL6) blockers.push('stage1_not_generated_by_l6plus_n5');
    if (!checks.stage1VersionMatches) blockers.push(`stage1_version_mismatch:${stage1.version || stage1.cliVersion || 'missing'}`);
  }
  if (stage2) {
    rejectFixtureEvidence(stage2, 'stage2', blockers);
    checks.stage2GeneratedByStage1 = boolAt(stage2, 'generatedByStage1') || boolAt(stage2, 'regeneration.generatedByStage1');
    checks.stage2VersionMatches = stage2.version === expectedVersion || stage2.cliVersion === expectedVersion;
    if (!checks.stage2GeneratedByStage1) blockers.push('stage2_not_regenerated_by_stage1');
    if (!checks.stage2VersionMatches) blockers.push(`stage2_version_mismatch:${stage2.version || stage2.cliVersion || 'missing'}`);
  }
  if (byteIdentity) {
    rejectFixtureEvidence(byteIdentity, 'byte_identity', blockers);
    checks.byteIdentical = byteIdentity.decision === 'PASS_BYTE_IDENTICAL_REGENERATION'
      || byteIdentity.byteIdentical === true
      || boolAt(byteIdentity, 'comparison.byteIdentical');
    if (!checks.byteIdentical) blockers.push(`byte_identity_not_proven:${byteIdentity.decision || 'missing'}`);
  }
  if (harness) {
    rejectFixtureEvidence(harness, 'harness', blockers);
    checks.harnessPass = harness.decision === 'PASS_BETA17_FIXPOINT_HARNESS'
      || harness.status === 'PASS'
      || harness.pass === true;
    checks.harnessHasAdversarial = Number(harness.adversarialCases || harness.adversarial?.cases || 0) >= 3;
    if (!checks.harnessPass) blockers.push(`harness_not_pass:${harness.decision || harness.status || 'missing'}`);
    if (!checks.harnessHasAdversarial) blockers.push('harness_missing_adversarial_triad');
  }
  if (seal) {
    rejectFixtureEvidence(seal, 'seal', blockers);
    checks.sealPass = seal.decision === 'PASS_BETA17_FIXPOINT_SEAL'
      || seal.status === 'PASS'
      || seal.sealed === true;
    if (!checks.sealPass) blockers.push(`seal_not_pass:${seal.decision || seal.status || 'missing'}`);
  }
  if (remotePromotion) {
    rejectFixtureEvidence(remotePromotion, 'remote_promotion', blockers);
    checks.remotePromotionPass = remotePromotion.decision === 'PASS_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION';
    checks.remotePromotionClaimsClosed = remotePromotion.claimBoundary?.definitiveFixpointAllowed === false
      && remotePromotion.claimBoundary?.publicReleaseAllowed === false
      && remotePromotion.claimBoundary?.formalN5ClaimAllowed === false
      && remotePromotion.claimBoundary?.universalCorrectnessClaimAllowed === false;
    if (!checks.remotePromotionPass) {
      blockers.push(`remote_promotion_not_pass:${remotePromotion.decision || 'missing'}`);
    }
    if (!checks.remotePromotionClaimsClosed) blockers.push('remote_promotion_claim_boundary_open');
    for (const [promotedKey, evidenceKey] of [
      ['stage1ArtifactManifest', 'stage1_artifact_manifest'],
      ['stage2RegenerationManifest', 'stage2_regeneration_manifest'],
      ['byteIdenticalReport', 'byte_identical_report'],
      ['harnessReport', 'harness_report'],
      ['sealReport', 'seal_report'],
    ]) {
      checkPromotedRef(remotePromotion, promotedKey, evidenceKey, evidence, blockers);
    }
  }
  if (publicSync) {
    checks.publicSurfaceSyncPass = publicSync.decision === 'PASS_BETA17_PUBLIC_SURFACE_SYNC'
      || publicSync.status === 'PASS'
      || publicSync.synced === true;
    if (!checks.publicSurfaceSyncPass) blockers.push(`public_surface_sync_not_pass:${publicSync.decision || publicSync.status || 'missing'}`);
  }
  if (externalAudit) {
    const externalAuditValidation = validateBeta17ExternalAuditReport(externalAudit);
    Object.assign(checks, externalAuditValidation.checks);
    blockers.push(...externalAuditValidation.blockers);
  }

  const report = {
    schemaVersion: 'brik64.beta17_fixpoint_readiness_gate.v1',
    generatedAt: new Date().toISOString(),
    version,
    expectedVersion,
    decision: blockers.length === 0
      ? 'PASS_BETA17_FIXPOINT_READINESS_GATE'
      : 'BLOCKED_BETA17_FIXPOINT_READINESS_GATE',
    claimBoundary: {
      definitiveFixpointAllowed: blockers.length === 0,
      publicReleaseAllowed: blockers.length === 0,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    requirements: [
      'canonical motor PCD/polymer manifest',
      'canonical harness PCD/polymer manifest',
      'input PCD hash list',
      'Stage1 artifact generated by L6+N5',
      'Stage2 artifact regenerated by Stage1',
      'byte-identical Stage1/Stage2 comparison',
      'harness with adversarial triad',
      'seal report',
      'remote promotion manifest',
      'public surface sync report',
      'external audit report'
    ],
    evidence,
    checks,
    blockers,
  };

  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.decision} ${rel(outPath)}`);
  if (blockers.length > 0) {
    for (const blocker of blockers) console.error(blocker);
    process.exit(1);
  }
}

main();
