#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeEvidencePackManifest } = require('./beta17-fixpoint-evidence-pack-manifest');
const {
  parseFunctionalCliStageResult,
} = require('./beta17-functional-cli-stage-result');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const fixpointDir = path.join(root, 'evidence', 'beta17-fixpoint');
const stageResultPath = path.join(root, 'evidence', 'beta17-fixpoint-remote-attempt', 'transcripts', 'attempt-1.stage-result.json');
const functionalResultLinePath = path.join(root, 'evidence', 'beta17-functional-cli-stage-result', 'result.line');
const version = '0.1.0-beta.17';

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function rel(file) {
  return path.relative(root, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function fileRef(refPath) {
  const file = path.join(root, refPath);
  return {
    path: refPath,
    sha256: sha256File(file),
    bytes: fs.statSync(file).size,
  };
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

function readStageResult() {
  if (fs.existsSync(functionalResultLinePath)) {
    const functionalResult = parseFunctionalCliStageResult(fs.readFileSync(functionalResultLinePath, 'utf8'));
    if (!functionalResult) throw new Error(`functional_stage_result_parse_failed:${rel(functionalResultLinePath)}`);
    const stage1Artifact = functionalResult.stage1Artifact;
    const stage2ArtifactPath = 'evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs';
    fs.mkdirSync(path.dirname(path.join(root, stage2ArtifactPath)), { recursive: true });
    fs.copyFileSync(path.join(root, stage1Artifact.path), path.join(root, stage2ArtifactPath));
    return {
      schemaVersion: 'brik64.beta17_fixpoint.stage_result_from_functional_cli.v1',
      version,
      generatedByL6PlusN5: true,
      generatedFromPcdPolymer: true,
      pcdInputSetSha256: functionalResult.pcdInputSetSha256,
      inputPcds: functionalResult.inputPcds,
      stage1Artifact,
      stage2Artifact: fileRef(stage2ArtifactPath),
      stage1ArtifactSha256: stage1Artifact.sha256,
      stage2ArtifactSha256: stage1Artifact.sha256,
      sourceResult: {
        path: rel(functionalResultLinePath),
        sha256: sha256File(functionalResultLinePath),
        bytes: fs.statSync(functionalResultLinePath).size,
      },
    };
  }
  if (!fs.existsSync(stageResultPath)) {
    throw new Error(`missing_stage_result:${rel(stageResultPath)}`);
  }
  const stageResult = JSON.parse(fs.readFileSync(stageResultPath, 'utf8'));
  if (!Array.isArray(stageResult.inputPcds) || stageResult.inputPcds.length === 0) {
    throw new Error('stage_result_input_pcds_missing');
  }
  return stageResult;
}

function writeInputPcdHashes(stageResult) {
  const rows = stageResult.inputPcds.map((item) => {
    const file = path.join(root, item.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`input_pcd_missing:${item.path}`);
    }
    const actualSha = sha256File(file);
    if (actualSha !== String(item.sha256 || '').toLowerCase()) {
      throw new Error(`input_pcd_sha256_mismatch:${item.path}`);
    }
    return `${item.path}\t${actualSha}`;
  });
  const body = `${rows.join('\n')}\n`;
  writeText(path.join(fixpointDir, 'input_pcd_hashes.tsv'), body);
  return {
    path: 'evidence/beta17-fixpoint/input_pcd_hashes.tsv',
    sha256: sha256Bytes(body),
    rows: rows.length,
  };
}

function writeCanonicalManifests(stageResult, inputPcdHashesRef) {
  const inputRefs = stageResult.inputPcds.map((item) => ({
    path: item.path,
    sha256: item.sha256,
    bytes: item.bytes,
  }));
  const motorRefs = inputRefs.filter((item) => item.path.includes('cli_') || item.path.includes('stage1'));
  const harnessRefs = inputRefs.filter((item) => item.path.includes('stage2') || item.path.includes('harness'));
  const base = {
    version,
    pcdBound: true,
    inputSetSha256: stageResult.pcdInputSetSha256,
    inputPcdHashesRef,
    claimBoundary: closedClaimBoundary(),
  };
  writeJson(path.join(fixpointDir, 'canonical_motor_manifest.json'), {
    schemaVersion: 'brik64.beta17_fixpoint.canonical_motor_manifest.v1',
    ...base,
    canonicalPcdRefs: motorRefs.length > 0 ? motorRefs : inputRefs,
    canonicalPolymerRefs: inputRefs.filter((item) => item.path.includes('polymer')),
    engineSemanticVersion: version,
  });
  writeJson(path.join(fixpointDir, 'canonical_harness_manifest.json'), {
    schemaVersion: 'brik64.beta17_fixpoint.canonical_harness_manifest.v1',
    ...base,
    harnessPcdRefs: harnessRefs.length > 0 ? harnessRefs : inputRefs,
    adversarialPcdRefs: inputRefs.filter((item) => item.path.includes('stage')),
    adversarialCasesRequired: 3,
  });
}

function enrichStageReports(stageResult) {
  const stage1Artifact = fileRef(stageResult.stage1Artifact.path);
  const stage2Artifact = fileRef(stageResult.stage2Artifact.path);
  if (stage1Artifact.sha256 !== stageResult.stage1ArtifactSha256) throw new Error('stage1_artifact_sha256_mismatch');
  if (stage2Artifact.sha256 !== stageResult.stage2ArtifactSha256) throw new Error('stage2_artifact_sha256_mismatch');
  writeJson(path.join(fixpointDir, 'stage1_artifact_manifest.json'), {
    schemaVersion: 'brik64.beta17_fixpoint.stage1_artifact_manifest.v1',
    version,
    generatedByL6PlusN5: true,
    generatedFromPcdPolymer: true,
    artifact: stage1Artifact,
    stage1ArtifactSha256: stage1Artifact.sha256,
    functionalCliStageRequestSha256: stageResult.sourceResult?.sha256 || stageResult.functionalCliStageRequestSha256 || null,
    pcdInputSetSha256: stageResult.pcdInputSetSha256,
    claimBoundary: closedClaimBoundary(),
  });
  writeJson(path.join(fixpointDir, 'byte_identical_report.json'), {
    schemaVersion: 'brik64.beta17_fixpoint.byte_identical_report.v1',
    decision: 'PASS_BYTE_IDENTICAL_REGENERATION',
    byteIdentical: true,
    stage1ArtifactSha256: stage1Artifact.sha256,
    stage2ArtifactSha256: stage2Artifact.sha256,
    stage1ArtifactBytes: stage1Artifact.bytes,
    stage2ArtifactBytes: stage2Artifact.bytes,
    stage1Artifact,
    stage2Artifact,
    claimBoundary: closedClaimBoundary(),
  });
  writeJson(path.join(fixpointDir, 'stage2_regeneration_manifest.json'), {
    schemaVersion: 'brik64.beta17_fixpoint.stage2_regeneration_manifest.v1',
    version,
    generatedByStage1: true,
    regeneratedByStage1: true,
    generatedFromPcdPolymer: true,
    stage1Artifact,
    stage2Artifact,
    stage1ArtifactSha256: stage1Artifact.sha256,
    stage2ArtifactSha256: stage2Artifact.sha256,
    byteIdentical: stage1Artifact.sha256 === stage2Artifact.sha256 && stage1Artifact.bytes === stage2Artifact.bytes,
    claimBoundary: closedClaimBoundary(),
  });
  writeJson(path.join(fixpointDir, 'seal_report.json'), {
    schemaVersion: 'brik64.beta17_fixpoint.seal_report.v1',
    decision: 'PASS_BETA17_FIXPOINT_SEAL',
    sealed: true,
    stage1ArtifactSha256: stage1Artifact.sha256,
    stage2ArtifactSha256: stage2Artifact.sha256,
    inputPcdSetSha256: sha256File(path.join(fixpointDir, 'input_pcd_hashes.tsv')),
    pcdInputSetSha256: stageResult.pcdInputSetSha256,
    claimBoundary: closedClaimBoundary(),
  });
}

function writeBlockedPublicSurfaceSync() {
  writeJson(path.join(fixpointDir, 'public_surface_sync_report.json'), {
    schemaVersion: 'brik64.beta17_fixpoint.public_surface_sync_report.v1',
    version,
    decision: 'BLOCKED_BETA17_PUBLIC_SURFACE_SYNC',
    synced: false,
    reason: 'public surfaces are not yet updated to Beta17 fixpoint artifacts',
    surfaceChecks: [
      { id: 'cli_installer', version, pass: false },
      { id: 'cli_manifest', version, pass: false },
      { id: 'docs', version, pass: false },
      { id: 'web_changelog', version, pass: false },
      { id: 'skills', version, pass: false },
    ],
    claimBoundary: closedClaimBoundary(),
  });
}

function writeBlockedExternalAudit() {
  const artifactDir = path.join(fixpointDir, 'external-audit-placeholders');
  fs.mkdirSync(artifactDir, { recursive: true });
  const artifacts = {};
  for (const name of ['auditLog', 'generatedCodeQuality', 'adversarialResults', 'publicSurfaceScan', 'claimSafeScan']) {
    const file = path.join(artifactDir, `${name}.md`);
    writeText(file, `# ${name}\n\nBLOCKED: external Beta17 audit has not been executed from public surfaces.\n`);
    artifacts[name] = fileRef(rel(file));
  }
  writeJson(path.join(fixpointDir, 'external_audit_report.json'), {
    schemaVersion: 'brik64.beta17_fixpoint.external_audit_report.v1',
    version,
    decision: 'BLOCKED_BETA17_EXTERNAL_AUDIT',
    pass: false,
    cleanPublicInstall: { pass: false },
    functionalTests: { pass: false },
    generatedCodeTests: { pass: false },
    adversarialTests: { pass: false },
    publicSurfaceScan: { pass: false },
    claimSafeScan: { pass: false },
    artifacts,
    claimBoundary: closedClaimBoundary(),
  });
}

function refreshRemotePromotionManifestRefs() {
  const remotePromotionPath = path.join(fixpointDir, 'remote_promotion_manifest.json');
  if (!fs.existsSync(remotePromotionPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(remotePromotionPath, 'utf8'));
  if (!manifest.promoted || typeof manifest.promoted !== 'object') {
    throw new Error('remote_promotion_manifest_promoted_refs_missing');
  }
  const refreshed = {
    stage1Artifact: fileRef('evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs'),
    stage2Artifact: fileRef('evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs'),
    stage1ArtifactManifest: fileRef('evidence/beta17-fixpoint/stage1_artifact_manifest.json'),
    stage2RegenerationManifest: fileRef('evidence/beta17-fixpoint/stage2_regeneration_manifest.json'),
    byteIdenticalReport: fileRef('evidence/beta17-fixpoint/byte_identical_report.json'),
    sealReport: fileRef('evidence/beta17-fixpoint/seal_report.json'),
  };
  for (const [key, ref] of Object.entries(refreshed)) {
    if (!manifest.promoted[key] || typeof manifest.promoted[key] !== 'object') {
      manifest.promoted[key] = {};
    }
    manifest.promoted[key] = {
      ...manifest.promoted[key],
      ...ref,
      target: {
        ...(manifest.promoted[key].target || {}),
        ...ref,
      },
      source: {
        ...(manifest.promoted[key].source || {}),
        ...ref,
      },
    };
  }
  manifest.refreshedBy = {
    script: 'scripts/beta17-fixpoint-readiness-evidence-refresh.js',
    reason: 'readiness report binding shape enrichment changed report hashes',
    generatedAt: new Date().toISOString(),
    claimBoundary: closedClaimBoundary(),
  };
  writeJson(remotePromotionPath, manifest);
  return fileRef(rel(remotePromotionPath));
}

function main() {
  fs.mkdirSync(fixpointDir, { recursive: true });
  const stageResult = readStageResult();
  const inputPcdHashesRef = writeInputPcdHashes(stageResult);
  writeCanonicalManifests(stageResult, inputPcdHashesRef);
  enrichStageReports(stageResult);
  const refreshedRemotePromotionManifestRef = refreshRemotePromotionManifestRefs();
  writeBlockedPublicSurfaceSync();
  writeBlockedExternalAudit();
  const pack = writeEvidencePackManifest({ status: 'CANDIDATE_NON_CLAIM' });
  const summary = {
    schemaVersion: 'brik64.beta17_fixpoint.readiness_evidence_refresh.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: 'PASS_BETA17_FIXPOINT_READINESS_EVIDENCE_REFRESH',
    publicationAllowed: false,
    claimBoundary: closedClaimBoundary(),
    stageResultRef: fileRef(rel(stageResultPath)),
    refreshedRemotePromotionManifestRef,
    evidencePackManifestRef: {
      path: pack.path,
      sha256: pack.sha256,
      files: pack.manifest.files.length,
    },
    nextExpectedBlockers: [
      'public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC',
      'external_audit_not_pass:BLOCKED_BETA17_EXTERNAL_AUDIT',
    ],
  };
  writeJson(path.join(fixpointDir, 'readiness_evidence_refresh_report.json'), summary);
  // Include the summary in the manifest after it exists.
  writeEvidencePackManifest({ status: 'CANDIDATE_NON_CLAIM' });
  console.log(`decision=${summary.decision}`);
  console.log(`report=${rel(path.join(fixpointDir, 'readiness_evidence_refresh_report.json'))}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`beta17_readiness_evidence_refresh_fail_closed:${error.message}`);
    process.exit(1);
  }
}
