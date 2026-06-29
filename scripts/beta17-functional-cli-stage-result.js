const crypto = require('crypto');

const REQUIRED_VERSION = '0.1.0-beta.17';
const REQUIRED_MATERIALIZER_MODE = 'l6plus_functional_cli_stage_materializer';
const RESULT_PREFIX = 'BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT\t';
const MIN_ARTIFACT_BYTES = 50000;

const REQUIRED_TRUE_FIELDS = [
  'generatedByL6PlusN5',
  'generatedFromPcdPolymer',
  'nodeEntrypointPresent',
  'versionBound',
  'argvHandlingPresent',
  'commandDispatcherPresent',
  'functionalStageMinSizePass',
  'functionalStageArtifactGatePass',
  'packageCandidateReferencesArtifact',
  'publicClaimBoundaryClosed',
];

const REQUIRED_SHA_FIELDS = [
  'pcdInputSetSha256',
  'functionalCliStageRequestSha256',
  'stage1ArtifactSha256',
  'generationTraceSha256',
  'remoteWrapperSha256',
  'wrapperExecTargetSha256',
];

const REQUIRED_TEXT_MARKERS = [
  '#!/usr/bin/env node',
  REQUIRED_VERSION,
  'process.argv',
];

const REQUIRED_SEMANTIC_MARKERS = [
  'certify',
  'verify',
  'emit',
  'polymerize',
  'lift',
  'monomers',
  'engine status',
];

function parseFunctionalCliStageResult(text) {
  const line = String(text || '').split(/\r?\n/).find((entry) => entry.startsWith(RESULT_PREFIX));
  if (!line) return null;
  const encoded = line.slice(RESULT_PREFIX.length);
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.replace(/^sha256:/, ''));
}

function normalizeSha256(value) {
  return String(value || '').replace(/^sha256:/, '').toLowerCase();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function pathLooksUnsafe(value) {
  const text = String(value || '');
  return (
    text.length === 0 ||
    text.startsWith('/') ||
    text.includes('\0') ||
    text.split(/[\\/]+/).some((segment) => segment === '..') ||
    /^https?:\/\//i.test(text)
  );
}

function inputHashBody(inputPcds) {
  return `${inputPcds.map((item) => `${normalizeSha256(item.sha256)}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
}

function pcdInputSetSha256(inputPcds) {
  return sha256(inputHashBody(inputPcds));
}

function validateRefShape(ref, field, expectedSha256, expectedBytes, blockers) {
  if (!ref || typeof ref !== 'object') {
    blockers.push(`functional_cli_stage_${field}_ref_missing`);
    return;
  }
  if (typeof ref.path !== 'string' || pathLooksUnsafe(ref.path)) {
    blockers.push(`functional_cli_stage_${field}_ref_path_invalid`);
  }
  if (!isSha256(ref.sha256)) {
    blockers.push(`functional_cli_stage_${field}_ref_sha256_invalid`);
  } else if (expectedSha256 && normalizeSha256(ref.sha256) !== normalizeSha256(expectedSha256)) {
    blockers.push(`functional_cli_stage_${field}_ref_sha256_mismatch`);
  }
  if (!Number.isInteger(ref.bytes) || ref.bytes < 1) {
    blockers.push(`functional_cli_stage_${field}_ref_bytes_invalid`);
  } else if (Number.isInteger(expectedBytes) && ref.bytes !== expectedBytes) {
    blockers.push(`functional_cli_stage_${field}_ref_bytes_mismatch`);
  }
}

function decodeArtifact(result, blockers) {
  if (typeof result.stage1ArtifactBase64 !== 'string' || result.stage1ArtifactBase64.length === 0) {
    blockers.push('functional_cli_stage_artifact_base64_missing');
    return null;
  }
  let artifact;
  try {
    artifact = Buffer.from(result.stage1ArtifactBase64, 'base64');
  } catch {
    blockers.push('functional_cli_stage_artifact_base64_invalid');
    return null;
  }
  if (artifact.length === 0) {
    blockers.push('functional_cli_stage_artifact_base64_empty');
    return null;
  }
  return artifact;
}

function validateArtifactContent(result, artifact, blockers) {
  const artifactText = artifact.toString('utf8');
  const artifactSha256 = sha256(artifact);
  if (artifactSha256 !== normalizeSha256(result.stage1ArtifactSha256)) {
    blockers.push('functional_cli_stage_artifact_sha256_mismatch');
  }
  if (artifact.length !== result.stage1ArtifactBytes) {
    blockers.push('functional_cli_stage_artifact_bytes_mismatch');
  }
  if (artifact.length < MIN_ARTIFACT_BYTES) {
    blockers.push(`functional_cli_stage_artifact_too_small:${artifact.length}:${MIN_ARTIFACT_BYTES}`);
  }
  for (const marker of REQUIRED_TEXT_MARKERS) {
    if (!artifactText.includes(marker)) blockers.push(`functional_cli_stage_artifact_missing_text_marker:${marker}`);
  }
  for (const marker of REQUIRED_SEMANTIC_MARKERS) {
    if (!artifactText.toLowerCase().includes(marker)) {
      blockers.push(`functional_cli_stage_artifact_missing_semantic_marker:${marker}`);
    }
  }
  if (artifactText.includes('candidate package is not public-release eligible yet')) {
    blockers.push('functional_cli_stage_artifact_candidate_only_stub');
  }
}

function validateFunctionalCliStageResult(result, expected = {}) {
  const blockers = [];
  if (!result || typeof result !== 'object') {
    return { accepted: false, blockers: ['functional_cli_stage_result_missing_or_invalid'], normalized: null };
  }
  if (result.schemaVersion !== 'brik64.beta17_functional_cli_stage_result.v1') blockers.push('functional_cli_stage_result_schema_invalid');
  if (result.version !== REQUIRED_VERSION) blockers.push(`functional_cli_stage_result_version_mismatch:${result.version || 'missing'}`);
  if (typeof result.l6plusEngineSerial !== 'string' || !result.l6plusEngineSerial.startsWith('BRIK64-L6PLUS-N5-')) {
    blockers.push('functional_cli_stage_l6plus_engine_serial_invalid');
  }
  if (result.materializerMode !== REQUIRED_MATERIALIZER_MODE) blockers.push('functional_cli_stage_materializer_mode_invalid');
  for (const field of REQUIRED_TRUE_FIELDS) {
    if (result[field] !== true) blockers.push(`functional_cli_stage_${field}_not_true`);
  }
  for (const field of REQUIRED_SHA_FIELDS) {
    if (!isSha256(result[field])) {
      blockers.push(`functional_cli_stage_${field.replace(/Sha256$/, '_sha256').replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)}_invalid`);
    }
  }
  if (!Number.isInteger(result.stage1ArtifactBytes) || result.stage1ArtifactBytes < 1) {
    blockers.push('functional_cli_stage_artifact_bytes_invalid');
  }
  if (result.claimBoundary?.publicReleaseAllowed !== false) blockers.push('functional_cli_stage_claim_boundary_public_release_open');
  if (result.claimBoundary?.definitiveFixpointAllowed !== false) blockers.push('functional_cli_stage_claim_boundary_fixpoint_open');
  if (result.claimBoundary?.formalN5ClaimAllowed !== false) blockers.push('functional_cli_stage_claim_boundary_formal_n5_open');
  if (result.claimBoundary?.universalCorrectnessClaimAllowed !== false) blockers.push('functional_cli_stage_claim_boundary_universal_correctness_open');
  if (result.claimBoundary?.selfHostingClaimAllowed !== false) blockers.push('functional_cli_stage_claim_boundary_self_hosting_open');
  if (result.claimBoundary?.rustIndependenceClaimAllowed !== false) blockers.push('functional_cli_stage_claim_boundary_rust_independence_open');

  const artifact = decodeArtifact(result, blockers);
  if (artifact) validateArtifactContent(result, artifact, blockers);
  validateRefShape(result.stage1Artifact, 'stage1Artifact', result.stage1ArtifactSha256, result.stage1ArtifactBytes, blockers);
  validateRefShape(result.stage1Manifest, 'stage1Manifest', null, null, blockers);
  validateRefShape(result.functionalStageReport, 'functionalStageReport', null, null, blockers);
  validateRefShape(result.packageManifest, 'packageManifest', null, null, blockers);

  for (const [field, blocker] of [
    ['pcdInputSetSha256', 'functional_cli_stage_pcd_input_set_sha256_mismatch'],
    ['functionalCliStageRequestSha256', 'functional_cli_stage_request_sha256_mismatch'],
    ['remoteWrapperSha256', 'functional_cli_stage_remote_wrapper_sha256_mismatch'],
    ['wrapperExecTargetSha256', 'functional_cli_stage_wrapper_exec_target_sha256_mismatch'],
  ]) {
    if (expected[field] && isSha256(result[field]) && normalizeSha256(result[field]) !== normalizeSha256(expected[field])) {
      blockers.push(blocker);
    }
  }

  if (!Array.isArray(result.inputPcds) || result.inputPcds.length === 0) {
    blockers.push('functional_cli_stage_input_pcds_missing');
  }
  if (Array.isArray(result.inputPcds)) {
    const paths = new Set();
    let hashEligible = true;
    for (const [index, item] of result.inputPcds.entries()) {
      if (!item || typeof item.path !== 'string' || pathLooksUnsafe(item.path) || !isSha256(item.sha256)) {
        blockers.push(`functional_cli_stage_input_pcd_${index}_ref_invalid`);
        hashEligible = false;
        continue;
      }
      if (!Number.isInteger(item.bytes) || item.bytes < 1) {
        blockers.push(`functional_cli_stage_input_pcd_${index}_bytes_invalid`);
        hashEligible = false;
      }
      paths.add(item.path);
    }
    if (hashEligible && pcdInputSetSha256(result.inputPcds) !== normalizeSha256(result.pcdInputSetSha256)) {
      blockers.push('functional_cli_stage_input_pcd_set_sha256_mismatch');
    }
    for (const requiredPath of expected.requiredInputPcdPaths || []) {
      if (!paths.has(requiredPath)) blockers.push(`functional_cli_stage_required_input_pcd_missing:${requiredPath}`);
    }
  }

  return {
    accepted: blockers.length === 0,
    blockers,
    normalized: blockers.length === 0
      ? {
          ...result,
          pcdInputSetSha256: normalizeSha256(result.pcdInputSetSha256),
          functionalCliStageRequestSha256: normalizeSha256(result.functionalCliStageRequestSha256),
          stage1ArtifactSha256: normalizeSha256(result.stage1ArtifactSha256),
          generationTraceSha256: normalizeSha256(result.generationTraceSha256),
          remoteWrapperSha256: normalizeSha256(result.remoteWrapperSha256),
          wrapperExecTargetSha256: normalizeSha256(result.wrapperExecTargetSha256),
        }
      : null,
  };
}

module.exports = {
  parseFunctionalCliStageResult,
  validateFunctionalCliStageResult,
  decodeStage1Artifact: (result) => decodeArtifact(result, []),
  RESULT_PREFIX,
};
