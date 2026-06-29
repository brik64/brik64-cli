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

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
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

function isSafeRelativePath(ref) {
  if (typeof ref !== 'string' || ref.length === 0) return false;
  if (path.isAbsolute(ref)) return false;
  const normalized = path.normalize(ref);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) return false;
  return normalized === ref || normalized.replaceAll(path.sep, '/') === ref;
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ''));
}

function checkHashList(file, blockers, evidence, key) {
  if (!fs.existsSync(file)) {
    blockers.push(`missing_${key}:${rel(file)}`);
    return;
  }
  const text = fs.readFileSync(file, 'utf8');
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row && !row.startsWith('#'));
  evidence[key] = {
    path: rel(file),
    sha256: sha256File(file),
    rows: rows.length,
  };
  if (rows.length === 0) blockers.push(`${key}_empty:${rel(file)}`);
  rows.forEach((row, index) => {
    const parts = row.split(/\t/);
    if (parts.length !== 2) {
      blockers.push(`${key}_invalid_row:${index + 1}`);
      return;
    }
    const [pcdRef, expectedSha] = parts;
    if (!isSafeRelativePath(pcdRef)) {
      blockers.push(`${key}_unsafe_path:${index + 1}:${pcdRef || 'missing'}`);
      return;
    }
    if (!isSha256(expectedSha)) {
      blockers.push(`${key}_invalid_sha256:${index + 1}:${expectedSha || 'missing'}`);
      return;
    }
    const pcdFile = path.join(root, pcdRef);
    if (!fs.existsSync(pcdFile) || !fs.statSync(pcdFile).isFile()) {
      blockers.push(`${key}_missing_file:${pcdRef}`);
      return;
    }
    const actualSha = sha256File(pcdFile);
    if (actualSha.toLowerCase() !== expectedSha.toLowerCase()) {
      blockers.push(`${key}_sha256_mismatch:${pcdRef}`);
    }
  });
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

function checkPromotedFileRef(remotePromotion, promotedKey, evidence, blockers) {
  const promoted = remotePromotion?.promoted?.[promotedKey];
  if (!promoted || typeof promoted !== 'object') {
    blockers.push(`remote_promotion_missing_promoted_ref:${promotedKey}`);
    return;
  }
  if (!isSafeRelativePath(promoted.path)) {
    blockers.push(`remote_promotion_ref_path_unsafe:${promotedKey}:${promoted.path || 'missing'}`);
    return;
  }
  if (!isSha256(promoted.sha256)) {
    blockers.push(`remote_promotion_ref_sha256_invalid:${promotedKey}`);
    return;
  }
  const source = promoted.source;
  if (!source || typeof source !== 'object') {
    blockers.push(`remote_promotion_missing_source_ref:${promotedKey}`);
    return;
  }
  if (!isSafeRelativePath(source.path)) {
    blockers.push(`remote_promotion_source_path_unsafe:${promotedKey}:${source.path || 'missing'}`);
  }
  if (String(source.sha256 || '').toLowerCase() !== String(promoted.sha256 || '').toLowerCase()) {
    blockers.push(`remote_promotion_source_sha256_mismatch:${promotedKey}`);
  }
  const target = promoted.target;
  if (!target || typeof target !== 'object') {
    blockers.push(`remote_promotion_missing_target_ref:${promotedKey}`);
    return;
  }
  if (target.path !== promoted.path) {
    blockers.push(`remote_promotion_target_path_mismatch:${promotedKey}`);
  }
  if (String(target.sha256 || '').toLowerCase() !== String(promoted.sha256 || '').toLowerCase()) {
    blockers.push(`remote_promotion_target_sha256_mismatch:${promotedKey}`);
  }
  if (!Number.isInteger(target.bytes) || target.bytes < 1) {
    blockers.push(`remote_promotion_target_bytes_invalid:${promotedKey}`);
  }
  const file = path.join(root, promoted.path);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    blockers.push(`remote_promotion_ref_file_missing:${promotedKey}:${promoted.path}`);
    return;
  }
  const actualSha = sha256File(file);
  const actualSize = fs.statSync(file).size;
  evidence[`remote_promotion_${promotedKey}`] = {
    path: promoted.path,
    sha256: actualSha,
    sizeBytes: actualSize,
  };
  if (actualSha.toLowerCase() !== String(promoted.sha256 || '').toLowerCase()) {
    blockers.push(`remote_promotion_ref_file_sha256_mismatch:${promotedKey}:${promoted.path}`);
  }
  if (Number.isInteger(target?.bytes) && actualSize !== target.bytes) {
    blockers.push(`remote_promotion_target_bytes_mismatch:${promotedKey}:${promoted.path}`);
  }
}

function valueAt(object, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, object);
}

function firstValueAt(object, dottedPaths) {
  for (const dottedPath of dottedPaths) {
    const value = valueAt(object, dottedPath);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function checkPublicSurfaceSyncReport(publicSync, checks, blockers) {
  checks.publicSurfaceSyncPass = publicSync.decision === 'PASS_BETA17_PUBLIC_SURFACE_SYNC'
    || publicSync.status === 'PASS'
    || publicSync.synced === true;
  if (!checks.publicSurfaceSyncPass) {
    blockers.push(`public_surface_sync_not_pass:${publicSync.decision || publicSync.status || 'missing'}`);
    return;
  }
  const requiredSurfaces = [
    'cli_installer',
    'cli_manifest',
    'docs',
    'web_changelog',
    'skills',
  ];
  const surfaces = Array.isArray(publicSync.surfaceChecks)
    ? publicSync.surfaceChecks
    : Array.isArray(publicSync.surfaces)
      ? publicSync.surfaces
      : [];
  if (surfaces.length === 0) {
    blockers.push('public_surface_sync_checks_missing');
    return;
  }
  for (const surfaceId of requiredSurfaces) {
    const surface = surfaces.find((entry) => entry && entry.id === surfaceId);
    if (!surface) {
      blockers.push(`public_surface_sync_missing:${surfaceId}`);
      continue;
    }
    if (surface.pass !== true && surface.synced !== true) {
      blockers.push(`public_surface_sync_surface_not_pass:${surfaceId}`);
    }
    if (surface.version !== '0.1.0-beta.17') {
      blockers.push(`public_surface_sync_version_mismatch:${surfaceId}:${surface.version || 'missing'}`);
    }
  }
}

function checkEvidencePackManifest(manifest, evidence, blockers) {
  if (!manifest || typeof manifest !== 'object') return;
  if (manifest.schemaVersion !== 'brik64.beta17_fixpoint.evidence_pack_manifest.v1') {
    blockers.push(`evidence_pack_manifest_schema_invalid:${manifest.schemaVersion || 'missing'}`);
  }
  if (manifest.version !== '0.1.0-beta.17') {
    blockers.push(`evidence_pack_manifest_version_mismatch:${manifest.version || 'missing'}`);
  }
  if (
    manifest.claimBoundary?.publicReleaseAllowed !== false
    || manifest.claimBoundary?.definitiveFixpointAllowed !== false
    || manifest.claimBoundary?.formalN5ClaimAllowed !== false
    || manifest.claimBoundary?.universalCorrectnessClaimAllowed !== false
  ) {
    blockers.push('evidence_pack_manifest_claim_boundary_open');
  }
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (files.length === 0) {
    blockers.push('evidence_pack_manifest_files_empty');
    return;
  }
  const refs = new Map(files.map((entry) => [entry.path, entry.sha256]));
  const expectedPackSha256 = sha256Text(`${JSON.stringify({ files }, null, 2)}\n`);
  if (String(manifest.packSha256 || '').toLowerCase() !== expectedPackSha256.toLowerCase()) {
    blockers.push('evidence_pack_manifest_pack_sha256_mismatch');
  }
  for (const evidenceKey of [
    'canonical_motor_manifest',
    'canonical_harness_manifest',
    'input_pcd_hashes',
    'stage1_artifact_manifest',
    'stage2_regeneration_manifest',
    'byte_identical_report',
    'harness_report',
    'seal_report',
    'remote_promotion_manifest',
    'public_surface_sync_report',
    'external_audit_report',
  ]) {
    const evaluated = evidence[evidenceKey];
    if (!evaluated) continue;
    const manifestSha = refs.get(evaluated.path);
    if (!manifestSha) {
      blockers.push(`evidence_pack_manifest_missing_ref:${evaluated.path}`);
    } else if (String(manifestSha).toLowerCase() !== String(evaluated.sha256).toLowerCase()) {
      blockers.push(`evidence_pack_manifest_sha256_mismatch:${evaluated.path}`);
    }
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
  const evidencePackManifest = existsJson(
    path.join(fixpointDir, 'evidence_pack_manifest.json'),
    blockers,
    evidence,
    'evidence_pack_manifest'
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
  if (evidencePackManifest) {
    checkEvidencePackManifest(evidencePackManifest, evidence, blockers);
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
    checkPromotedFileRef(remotePromotion, 'stage1Artifact', evidence, blockers);
    checkPromotedFileRef(remotePromotion, 'stage2Artifact', evidence, blockers);
  }
  if (byteIdentity) {
    const byteStage1Sha = firstValueAt(byteIdentity, [
      'stage1ArtifactSha256',
      'stage1.sha256',
      'comparison.stage1ArtifactSha256',
      'bindings.stage1ArtifactSha256',
    ]);
    const byteStage2Sha = firstValueAt(byteIdentity, [
      'stage2ArtifactSha256',
      'stage2.sha256',
      'comparison.stage2ArtifactSha256',
      'bindings.stage2ArtifactSha256',
    ]);
    const byteStage1Bytes = Number(firstValueAt(byteIdentity, [
      'stage1ArtifactBytes',
      'stage1.bytes',
      'comparison.stage1ArtifactBytes',
      'bindings.stage1ArtifactBytes',
    ]));
    const byteStage2Bytes = Number(firstValueAt(byteIdentity, [
      'stage2ArtifactBytes',
      'stage2.bytes',
      'comparison.stage2ArtifactBytes',
      'bindings.stage2ArtifactBytes',
    ]));
    const promotedStage1Size = evidence.remote_promotion_stage1Artifact?.sizeBytes;
    const promotedStage2Size = evidence.remote_promotion_stage2Artifact?.sizeBytes;
    checks.byteIdentityBindsStage1Artifact = isSha256(byteStage1Sha)
      && evidence.remote_promotion_stage1Artifact?.sha256 === String(byteStage1Sha).toLowerCase();
    checks.byteIdentityBindsStage2Artifact = isSha256(byteStage2Sha)
      && evidence.remote_promotion_stage2Artifact?.sha256 === String(byteStage2Sha).toLowerCase();
    checks.byteIdentityStageSizesMatch = Number.isInteger(byteStage1Bytes)
      && Number.isInteger(byteStage2Bytes)
      && byteStage1Bytes === promotedStage1Size
      && byteStage2Bytes === promotedStage2Size
      && byteStage1Bytes === byteStage2Bytes;
    if (!checks.byteIdentityBindsStage1Artifact) blockers.push('byte_identity_stage1_artifact_sha256_mismatch');
    if (!checks.byteIdentityBindsStage2Artifact) blockers.push('byte_identity_stage2_artifact_sha256_mismatch');
    if (!checks.byteIdentityStageSizesMatch) blockers.push('byte_identity_stage_artifact_size_mismatch');
  }
  if (stage1) {
    const stage1ArtifactSha = firstValueAt(stage1, [
      'stage1ArtifactSha256',
      'artifactSha256',
      'artifact.sha256',
      'materialization.artifactSha256',
      'bindings.stage1ArtifactSha256',
    ]);
    checks.stage1ManifestBindsArtifact = isSha256(stage1ArtifactSha)
      && evidence.remote_promotion_stage1Artifact?.sha256 === String(stage1ArtifactSha).toLowerCase();
    if (!checks.stage1ManifestBindsArtifact) blockers.push('stage1_manifest_artifact_sha256_mismatch');
  }
  if (stage2) {
    const stage2ArtifactSha = firstValueAt(stage2, [
      'stage2ArtifactSha256',
      'artifactSha256',
      'artifact.sha256',
      'regeneration.artifactSha256',
      'bindings.stage2ArtifactSha256',
    ]);
    const generatedFromStage1Sha = firstValueAt(stage2, [
      'generatedFromStage1ArtifactSha256',
      'stage1ArtifactSha256',
      'regeneration.stage1ArtifactSha256',
      'bindings.stage1ArtifactSha256',
    ]);
    checks.stage2ManifestBindsArtifact = isSha256(stage2ArtifactSha)
      && evidence.remote_promotion_stage2Artifact?.sha256 === String(stage2ArtifactSha).toLowerCase();
    checks.stage2ManifestBindsStage1Artifact = isSha256(generatedFromStage1Sha)
      && evidence.remote_promotion_stage1Artifact?.sha256 === String(generatedFromStage1Sha).toLowerCase();
    if (!checks.stage2ManifestBindsArtifact) blockers.push('stage2_manifest_artifact_sha256_mismatch');
    if (!checks.stage2ManifestBindsStage1Artifact) blockers.push('stage2_manifest_stage1_artifact_sha256_mismatch');
  }
  if (seal) {
    const sealedStage1Sha = firstValueAt(seal, ['stage1ArtifactSha256', 'seal.stage1ArtifactSha256', 'bindings.stage1ArtifactSha256']);
    const sealedStage2Sha = firstValueAt(seal, ['stage2ArtifactSha256', 'seal.stage2ArtifactSha256', 'bindings.stage2ArtifactSha256']);
    const sealedInputSha = firstValueAt(seal, ['inputPcdSetSha256', 'pcdInputSetSha256', 'seal.inputPcdSetSha256', 'bindings.inputPcdSetSha256']);
    checks.sealBindsStage1Artifact = isSha256(sealedStage1Sha)
      && evidence.remote_promotion_stage1Artifact?.sha256 === String(sealedStage1Sha).toLowerCase();
    checks.sealBindsStage2Artifact = isSha256(sealedStage2Sha)
      && evidence.remote_promotion_stage2Artifact?.sha256 === String(sealedStage2Sha).toLowerCase();
    checks.sealBindsInputPcdSet = isSha256(sealedInputSha)
      && evidence.input_pcd_hashes?.sha256 === String(sealedInputSha).toLowerCase();
    if (!checks.sealBindsStage1Artifact) blockers.push('seal_stage1_artifact_sha256_mismatch');
    if (!checks.sealBindsStage2Artifact) blockers.push('seal_stage2_artifact_sha256_mismatch');
    if (!checks.sealBindsInputPcdSet) blockers.push('seal_input_pcd_set_sha256_mismatch');
  }
  if (publicSync) {
    checkPublicSurfaceSyncReport(publicSync, checks, blockers);
  }
  if (externalAudit) {
    const externalAuditValidation = validateBeta17ExternalAuditReport(externalAudit, { rootDir: root });
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
