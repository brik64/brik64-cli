const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQUIRED_VERSION = '0.1.0-beta.17';
const REQUIRED_MATERIALIZER_MODE = 'l6plus_fixpoint_stage_materializer';
const RESULT_PREFIX = 'BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t';

const REQUIRED_TRUE_FIELDS = [
  'generatedByL6PlusN5',
  'stage2GeneratedByStage1',
  'byteIdentical',
  'byteIdenticalSha256Match',
  'byteIdenticalSizeMatch',
  'harnessPass',
  'sealReportPass',
];

const REQUIRED_SHA_FIELDS = [
  'pcdInputSetSha256',
  'materializerRequestSha256',
  'stage1ArtifactSha256',
  'stage2ArtifactSha256',
  'compositeSha256',
  'generationTraceSha256',
  'remoteWrapperSha256',
  'wrapperExecTargetSha256',
];

const REQUIRED_FILE_REFS = [
  ['stage1Artifact', 'stage1ArtifactSha256'],
  ['stage2Artifact', 'stage2ArtifactSha256'],
  ['stage1Manifest', null],
  ['stage2Manifest', null],
  ['byteIdenticalReport', null],
  ['harnessReport', null],
  ['sealReport', null],
];

function parseStageResult(text) {
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

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function inputHashBody(inputPcds) {
  return `${inputPcds.map((item) => `${normalizeSha256(item.sha256)}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
}

function pcdInputSetSha256(inputPcds) {
  return sha256Text(inputHashBody(inputPcds));
}

function pathLooksUnsafe(value) {
  const text = String(value || '');
  return (
    text.startsWith('/') ||
    text.includes('\0') ||
    text.split(/[\\/]+/).some((segment) => segment === '..') ||
    /^https?:\/\//i.test(text)
  );
}

function blockerFieldName(refField) {
  return String(refField).replace(/\[[^\]]+\]/g, '').replace(/[^A-Za-z0-9_]/g, '_');
}

function validateStandaloneFileRef(ref, refField, expectedSha256, blockers, expected) {
  const blockerField = blockerFieldName(refField);
  if (!ref || typeof ref !== 'object') {
    blockers.push(`stage_result_${blockerField}_ref_missing`);
    return;
  }
  if (typeof ref.path !== 'string' || ref.path.length === 0 || pathLooksUnsafe(ref.path)) {
    blockers.push(`stage_result_${blockerField}_ref_path_invalid`);
  }
  if (!isSha256(ref.sha256)) {
    blockers.push(`stage_result_${blockerField}_ref_sha256_invalid`);
  }
  if (expectedSha256 && isSha256(ref.sha256) && isSha256(expectedSha256)) {
    if (normalizeSha256(ref.sha256) !== normalizeSha256(expectedSha256)) {
      blockers.push(`stage_result_${blockerField}_ref_sha256_mismatch`);
    }
  }
  if (typeof expected.workspaceRoot === 'string' && typeof ref.path === 'string' && !pathLooksUnsafe(ref.path)) {
    const root = path.resolve(expected.workspaceRoot);
    const resolved = path.resolve(root, ref.path);
    if (!(resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
      blockers.push(`stage_result_${blockerField}_ref_path_outside_workspace`);
    } else if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      blockers.push(`stage_result_${blockerField}_ref_file_missing:${ref.path}`);
    } else if (isSha256(ref.sha256) && sha256File(resolved) !== normalizeSha256(ref.sha256)) {
      blockers.push(`stage_result_${blockerField}_ref_file_sha256_mismatch:${ref.path}`);
    }
  }
}

function readWorkspaceJsonRef(ref, refField, blockers, expected) {
  if (typeof expected.workspaceRoot !== 'string' || !ref || typeof ref.path !== 'string' || pathLooksUnsafe(ref.path)) {
    return null;
  }
  const root = path.resolve(expected.workspaceRoot);
  const resolved = path.resolve(root, ref.path);
  if (!(resolved === root || resolved.startsWith(`${root}${path.sep}`))) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch {
    blockers.push(`stage_result_${blockerFieldName(refField)}_json_parse_failed:${ref.path}`);
    return null;
  }
}

function firstShaValue(source, paths) {
  for (const pathSpec of paths) {
    const parts = pathSpec.split('.');
    let current = source;
    for (const part of parts) {
      current = current && typeof current === 'object' ? current[part] : undefined;
    }
    if (isSha256(current)) return normalizeSha256(current);
  }
  return null;
}

function validateStageResult(result, expected = {}) {
  const blockers = [];
  if (!result || typeof result !== 'object') {
    return { accepted: false, blockers: ['stage_result_missing_or_invalid'], normalized: null };
  }
  if (result.schemaVersion !== 'brik64.beta17_fixpoint_stage_result.v1') blockers.push('stage_result_schema_invalid');
  if (result.version !== REQUIRED_VERSION) blockers.push(`stage_result_version_mismatch:${result.version || 'missing'}`);
  if (typeof result.l6plusEngineSerial !== 'string' || !result.l6plusEngineSerial.startsWith('BRIK64-L6PLUS-N5-')) {
    blockers.push('stage_result_l6plus_engine_serial_invalid');
  }
  if (result.materializerMode !== REQUIRED_MATERIALIZER_MODE) blockers.push('stage_result_materializer_mode_invalid');
  for (const field of REQUIRED_TRUE_FIELDS) {
    if (result[field] !== true) blockers.push(`stage_result_${field}_not_true`);
  }
  for (const field of REQUIRED_SHA_FIELDS) {
    if (!isSha256(result[field])) {
      blockers.push(`stage_result_${field.replace(/Sha256$/, '_sha256').replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)}_invalid`);
    }
  }
  if (normalizeSha256(result.stage1ArtifactSha256) !== normalizeSha256(result.stage2ArtifactSha256)) {
    blockers.push('stage_result_stage1_stage2_sha256_mismatch');
  }
  if (!Number.isInteger(result.stage1ArtifactBytes) || result.stage1ArtifactBytes < 1) {
    blockers.push('stage_result_stage1_artifact_bytes_invalid');
  }
  if (!Number.isInteger(result.stage2ArtifactBytes) || result.stage2ArtifactBytes < 1) {
    blockers.push('stage_result_stage2_artifact_bytes_invalid');
  }
  if (
    Number.isInteger(result.stage1ArtifactBytes) &&
    Number.isInteger(result.stage2ArtifactBytes) &&
    result.stage1ArtifactBytes !== result.stage2ArtifactBytes
  ) {
    blockers.push('stage_result_stage1_stage2_size_mismatch');
  }
  if (!Number.isInteger(result.adversarialCases) || result.adversarialCases < 3) {
    blockers.push('stage_result_adversarial_cases_insufficient');
  }
  if (result.claimBoundary?.publicReleaseAllowed !== false) blockers.push('stage_result_claim_boundary_public_release_open');
  if (result.claimBoundary?.formalN5ClaimAllowed !== false) blockers.push('stage_result_claim_boundary_formal_n5_open');
  if (result.claimBoundary?.universalCorrectnessClaimAllowed !== false) blockers.push('stage_result_claim_boundary_universal_correctness_open');

  for (const [refField, hashField] of REQUIRED_FILE_REFS) {
    validateStandaloneFileRef(result[refField], refField, hashField ? result[hashField] : null, blockers, expected);
  }
  const stage1Manifest = readWorkspaceJsonRef(result.stage1Manifest, 'stage1Manifest', blockers, expected);
  if (stage1Manifest) {
    const boundStage1Sha = firstShaValue(stage1Manifest, [
      'stage1ArtifactSha256',
      'artifactSha256',
      'artifact.sha256',
      'materialization.artifactSha256',
      'bindings.stage1ArtifactSha256',
    ]);
    if (boundStage1Sha !== normalizeSha256(result.stage1ArtifactSha256)) {
      blockers.push('stage_result_stage1_manifest_artifact_sha256_mismatch');
    }
  }
  const stage2Manifest = readWorkspaceJsonRef(result.stage2Manifest, 'stage2Manifest', blockers, expected);
  if (stage2Manifest) {
    const boundStage2Sha = firstShaValue(stage2Manifest, [
      'stage2ArtifactSha256',
      'artifactSha256',
      'artifact.sha256',
      'regeneration.artifactSha256',
      'bindings.stage2ArtifactSha256',
    ]);
    const boundStage1Sha = firstShaValue(stage2Manifest, [
      'generatedFromStage1ArtifactSha256',
      'stage1ArtifactSha256',
      'regeneration.stage1ArtifactSha256',
      'bindings.stage1ArtifactSha256',
    ]);
    if (boundStage2Sha !== normalizeSha256(result.stage2ArtifactSha256)) {
      blockers.push('stage_result_stage2_manifest_artifact_sha256_mismatch');
    }
    if (boundStage1Sha !== normalizeSha256(result.stage1ArtifactSha256)) {
      blockers.push('stage_result_stage2_manifest_stage1_artifact_sha256_mismatch');
    }
  }
  for (const [field, blocker] of [
    ['pcdInputSetSha256', 'stage_result_pcd_input_set_sha256_mismatch'],
    ['materializerRequestSha256', 'stage_result_materializer_request_sha256_mismatch'],
    ['remoteWrapperSha256', 'stage_result_remote_wrapper_sha256_mismatch'],
    ['wrapperExecTargetSha256', 'stage_result_wrapper_exec_target_sha256_mismatch'],
  ]) {
    if (expected[field] && isSha256(result[field]) && normalizeSha256(result[field]) !== normalizeSha256(expected[field])) {
      blockers.push(blocker);
    }
  }
  if (!Array.isArray(result.inputPcds) || result.inputPcds.length === 0) {
    blockers.push('stage_result_input_pcds_missing');
  }
  if (Array.isArray(result.inputPcds)) {
    const actualPaths = new Set();
    let inputPcdSetHashEligible = true;
    for (const [index, item] of result.inputPcds.entries()) {
      if (!item || typeof item.path !== 'string' || !isSha256(item.sha256)) {
        blockers.push('stage_result_input_pcd_ref_invalid');
        inputPcdSetHashEligible = false;
        break;
      }
      if (!Number.isInteger(item.bytes) || item.bytes < 1) {
        blockers.push(`stage_result_input_pcd_${index}_bytes_invalid`);
        inputPcdSetHashEligible = false;
      }
      actualPaths.add(item.path);
      validateStandaloneFileRef(item, `input_pcd_${index}`, null, blockers, expected);
    }
    if (inputPcdSetHashEligible && pcdInputSetSha256(result.inputPcds) !== normalizeSha256(result.pcdInputSetSha256)) {
      blockers.push('stage_result_input_pcd_set_sha256_mismatch');
    }
    for (const requiredPath of expected.requiredInputPcdPaths || []) {
      if (!actualPaths.has(requiredPath)) blockers.push(`stage_result_required_input_pcd_missing:${requiredPath}`);
    }
  }

  return {
    accepted: blockers.length === 0,
    blockers,
    normalized: blockers.length === 0
      ? {
          ...result,
          pcdInputSetSha256: normalizeSha256(result.pcdInputSetSha256),
          materializerRequestSha256: normalizeSha256(result.materializerRequestSha256),
          stage1ArtifactSha256: normalizeSha256(result.stage1ArtifactSha256),
          stage2ArtifactSha256: normalizeSha256(result.stage2ArtifactSha256),
          compositeSha256: normalizeSha256(result.compositeSha256),
          generationTraceSha256: normalizeSha256(result.generationTraceSha256),
          remoteWrapperSha256: normalizeSha256(result.remoteWrapperSha256),
          wrapperExecTargetSha256: normalizeSha256(result.wrapperExecTargetSha256),
        }
      : null,
  };
}

module.exports = {
  parseStageResult,
  validateStageResult,
};
