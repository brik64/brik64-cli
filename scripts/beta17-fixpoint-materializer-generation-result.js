const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQUIRED_VERSION = '0.1.0-beta.17';
const REQUIRED_MATERIALIZER_MODE = 'l6plus_fixpoint_stage_materializer';
const RESULT_PREFIX = 'BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT\t';
const REQUIRED_STAGE_RESULT_MARKER = 'BRIK64_BETA17_FIXPOINT_STAGE_RESULT';

const REQUIRED_TRUE_FIELDS = [
  'generatedByL6PlusN5',
  'generatedFromPcdPolymer',
  'generatedMaterializerContainsStageResultMarker',
  'generatedMaterializerIsNotFixture',
];

const REQUIRED_SHA_FIELDS = [
  'pcdInputSetSha256',
  'materializerGenerationRequestSha256',
  'generatedMaterializerSha256',
  'generationTraceSha256',
  'remoteWrapperSha256',
  'wrapperExecTargetSha256',
];

function parseMaterializerGenerationResult(text) {
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

function sha256File(file) {
  return sha256(fs.readFileSync(file));
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

function blockerFieldName(refField) {
  return String(refField).replace(/\[[^\]]+\]/g, '').replace(/[^A-Za-z0-9_]/g, '_');
}

function validateFileRef(ref, refField, expectedSha256, blockers, expected) {
  const blockerField = blockerFieldName(refField);
  if (!ref || typeof ref !== 'object') {
    blockers.push(`materializer_generation_${blockerField}_ref_missing`);
    return null;
  }
  if (typeof ref.path !== 'string' || pathLooksUnsafe(ref.path)) {
    blockers.push(`materializer_generation_${blockerField}_ref_path_invalid`);
  }
  if (!isSha256(ref.sha256)) {
    blockers.push(`materializer_generation_${blockerField}_ref_sha256_invalid`);
  }
  if (!Number.isInteger(ref.bytes) || ref.bytes < 1) {
    blockers.push(`materializer_generation_${blockerField}_ref_bytes_invalid`);
  }
  if (expectedSha256 && isSha256(ref.sha256) && normalizeSha256(ref.sha256) !== normalizeSha256(expectedSha256)) {
    blockers.push(`materializer_generation_${blockerField}_ref_sha256_mismatch`);
  }
  if (typeof expected.workspaceRoot !== 'string' || typeof ref.path !== 'string' || pathLooksUnsafe(ref.path)) {
    return null;
  }
  const root = path.resolve(expected.workspaceRoot);
  const resolved = path.resolve(root, ref.path);
  if (!(resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
    blockers.push(`materializer_generation_${blockerField}_ref_path_outside_workspace`);
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    blockers.push(`materializer_generation_${blockerField}_ref_file_missing:${ref.path}`);
    return null;
  }
  const stat = fs.statSync(resolved);
  if (isSha256(ref.sha256) && sha256File(resolved) !== normalizeSha256(ref.sha256)) {
    blockers.push(`materializer_generation_${blockerField}_ref_file_sha256_mismatch:${ref.path}`);
  }
  if (Number.isInteger(ref.bytes) && stat.size !== ref.bytes) {
    blockers.push(`materializer_generation_${blockerField}_ref_file_bytes_mismatch:${ref.path}`);
  }
  return resolved;
}

function readJsonRef(ref, refField, blockers, expected) {
  const resolved = validateFileRef(ref, refField, null, blockers, expected);
  if (!resolved) return null;
  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch {
    blockers.push(`materializer_generation_${blockerFieldName(refField)}_json_parse_failed:${ref.path}`);
    return null;
  }
}

function validateMaterializerContent(ref, blockers, expected) {
  const resolved = validateFileRef(ref, 'generatedMaterializer', null, blockers, expected);
  if (!resolved) return;
  const content = fs.readFileSync(resolved, 'utf8');
  if (!content.includes(REQUIRED_STAGE_RESULT_MARKER)) {
    blockers.push('materializer_generation_generated_materializer_missing_stage_result_marker');
  }
  if (content.includes('<base64-json>')) {
    blockers.push('materializer_generation_generated_materializer_placeholder_marker');
  }
  if (/fixtureMaterializer|FIXTURE_MATERIALIZER|TEMPLATE_NON_CLAIM/i.test(content)) {
    blockers.push('materializer_generation_generated_materializer_fixture_or_template_content');
  }
}

function validateMaterializerGenerationResult(result, expected = {}) {
  const blockers = [];
  if (!result || typeof result !== 'object') {
    return { accepted: false, blockers: ['materializer_generation_result_missing_or_invalid'], normalized: null };
  }
  if (result.schemaVersion !== 'brik64.beta17_fixpoint_materializer_generation_result.v1') {
    blockers.push('materializer_generation_result_schema_invalid');
  }
  if (result.version !== REQUIRED_VERSION) {
    blockers.push(`materializer_generation_result_version_mismatch:${result.version || 'missing'}`);
  }
  if (typeof result.l6plusEngineSerial !== 'string' || !result.l6plusEngineSerial.startsWith('BRIK64-L6PLUS-N5-')) {
    blockers.push('materializer_generation_l6plus_engine_serial_invalid');
  }
  if (result.materializerMode !== REQUIRED_MATERIALIZER_MODE) {
    blockers.push('materializer_generation_materializer_mode_invalid');
  }
  for (const field of REQUIRED_TRUE_FIELDS) {
    if (result[field] !== true) blockers.push(`materializer_generation_${field}_not_true`);
  }
  for (const field of REQUIRED_SHA_FIELDS) {
    if (!isSha256(result[field])) {
      blockers.push(`materializer_generation_${field.replace(/Sha256$/, '_sha256').replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)}_invalid`);
    }
  }
  if (!Number.isInteger(result.generatedMaterializerBytes) || result.generatedMaterializerBytes < 1) {
    blockers.push('materializer_generation_generated_materializer_bytes_invalid');
  }
  if (result.claimBoundary?.publicReleaseAllowed !== false) {
    blockers.push('materializer_generation_claim_boundary_public_release_open');
  }
  if (result.claimBoundary?.definitiveFixpointAllowed !== false) {
    blockers.push('materializer_generation_claim_boundary_fixpoint_open');
  }
  if (result.claimBoundary?.formalN5ClaimAllowed !== false) {
    blockers.push('materializer_generation_claim_boundary_formal_n5_open');
  }
  if (result.claimBoundary?.universalCorrectnessClaimAllowed !== false) {
    blockers.push('materializer_generation_claim_boundary_universal_correctness_open');
  }

  validateFileRef(result.generatedMaterializer, 'generatedMaterializer', result.generatedMaterializerSha256, blockers, expected);
  validateFileRef(result.generationReport, 'generationReport', null, blockers, expected);
  if (result.materializerProvenance) {
    validateFileRef(result.materializerProvenance, 'materializerProvenance', null, blockers, expected);
  }
  if (typeof expected.workspaceRoot === 'string') {
    validateMaterializerContent(result.generatedMaterializer, blockers, expected);
  }
  const generationReport = readJsonRef(result.generationReport, 'generationReport', blockers, expected);
  if (generationReport) {
    if (generationReport.generatedMaterializerSha256 && normalizeSha256(generationReport.generatedMaterializerSha256) !== normalizeSha256(result.generatedMaterializerSha256)) {
      blockers.push('materializer_generation_report_materializer_sha256_mismatch');
    }
    if (generationReport.materializerGenerationRequestSha256 && normalizeSha256(generationReport.materializerGenerationRequestSha256) !== normalizeSha256(result.materializerGenerationRequestSha256)) {
      blockers.push('materializer_generation_report_request_sha256_mismatch');
    }
  }

  for (const [field, blocker] of [
    ['pcdInputSetSha256', 'materializer_generation_pcd_input_set_sha256_mismatch'],
    ['materializerGenerationRequestSha256', 'materializer_generation_request_sha256_mismatch'],
    ['remoteWrapperSha256', 'materializer_generation_remote_wrapper_sha256_mismatch'],
    ['wrapperExecTargetSha256', 'materializer_generation_wrapper_exec_target_sha256_mismatch'],
  ]) {
    if (expected[field] && isSha256(result[field]) && normalizeSha256(result[field]) !== normalizeSha256(expected[field])) {
      blockers.push(blocker);
    }
  }

  if (!Array.isArray(result.inputPcds) || result.inputPcds.length === 0) {
    blockers.push('materializer_generation_input_pcds_missing');
  }
  if (Array.isArray(result.inputPcds)) {
    const actualPaths = new Set();
    let inputSetEligible = true;
    for (const [index, item] of result.inputPcds.entries()) {
      if (!item || typeof item.path !== 'string' || !isSha256(item.sha256)) {
        blockers.push('materializer_generation_input_pcd_ref_invalid');
        inputSetEligible = false;
        break;
      }
      if (!Number.isInteger(item.bytes) || item.bytes < 1) {
        blockers.push(`materializer_generation_input_pcd_${index}_bytes_invalid`);
        inputSetEligible = false;
      }
      actualPaths.add(item.path);
      validateFileRef(item, `input_pcd_${index}`, null, blockers, expected);
    }
    if (inputSetEligible && pcdInputSetSha256(result.inputPcds) !== normalizeSha256(result.pcdInputSetSha256)) {
      blockers.push('materializer_generation_input_pcd_set_sha256_mismatch');
    }
    for (const requiredPath of expected.requiredInputPcdPaths || []) {
      if (!actualPaths.has(requiredPath)) blockers.push(`materializer_generation_required_input_pcd_missing:${requiredPath}`);
    }
  }

  return {
    accepted: blockers.length === 0,
    blockers,
    normalized: blockers.length === 0
      ? {
          ...result,
          pcdInputSetSha256: normalizeSha256(result.pcdInputSetSha256),
          materializerGenerationRequestSha256: normalizeSha256(result.materializerGenerationRequestSha256),
          generatedMaterializerSha256: normalizeSha256(result.generatedMaterializerSha256),
          generationTraceSha256: normalizeSha256(result.generationTraceSha256),
          remoteWrapperSha256: normalizeSha256(result.remoteWrapperSha256),
          wrapperExecTargetSha256: normalizeSha256(result.wrapperExecTargetSha256),
        }
      : null,
  };
}

module.exports = {
  parseMaterializerGenerationResult,
  validateMaterializerGenerationResult,
  REQUIRED_STAGE_RESULT_MARKER,
};
