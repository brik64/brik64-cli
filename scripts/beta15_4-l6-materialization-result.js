const REQUIRED_TRUE_FIELDS = [
  'generatedByL6PlusN5',
  'pcdToArtifactHashBound',
  'artifactToPackageHashBound',
  'packageToReleaseManifestHashBound',
  'sealReportPass',
];

function parseMaterializationResult(text) {
  const source = String(text || '');
  const line = source
    .split(/\r?\n/)
    .find((entry) => entry.startsWith('BRIK64_L6_CLI_MATERIALIZATION_RESULT\t'));
  if (!line) return null;
  const encoded = line.split('\t')[1] || '';
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

function validateMaterializationResult(result, version) {
  const blockers = [];
  if (!result || typeof result !== 'object') {
    return {
      accepted: false,
      blockers: ['materialization_result_missing_or_invalid'],
    };
  }

  if (result.version !== version) blockers.push(`materialization_result_version_mismatch:${result.version || 'missing'}`);
  for (const field of REQUIRED_TRUE_FIELDS) {
    if (result[field] !== true) blockers.push(`materialization_result_${field}_not_true`);
  }
  if (!isSha256(result.generatedArtifactSha256)) blockers.push('materialization_result_generated_artifact_sha256_invalid');
  if (!isSha256(result.packageSha256)) blockers.push('materialization_result_package_sha256_invalid');
  if (!isSha256(result.releaseManifestSha256)) blockers.push('materialization_result_release_manifest_sha256_invalid');
  if (!isSha256(result.compositeSha256)) blockers.push('materialization_result_composite_sha256_invalid');
  if (!Array.isArray(result.inputPcds) || result.inputPcds.length === 0) {
    blockers.push('materialization_result_input_pcds_missing');
  }
  if (Array.isArray(result.inputPcds)) {
    for (const item of result.inputPcds) {
      if (!item || typeof item.path !== 'string' || !isSha256(item.sha256)) {
        blockers.push('materialization_result_input_pcd_ref_invalid');
        break;
      }
    }
  }

  return {
    accepted: blockers.length === 0,
    blockers,
    normalized: blockers.length === 0
      ? {
          ...result,
          generatedArtifactSha256: normalizeSha256(result.generatedArtifactSha256),
          packageSha256: normalizeSha256(result.packageSha256),
          releaseManifestSha256: normalizeSha256(result.releaseManifestSha256),
          compositeSha256: normalizeSha256(result.compositeSha256),
          inputPcds: result.inputPcds.map((item) => ({
            ...item,
            sha256: normalizeSha256(item.sha256),
          })),
        }
      : null,
  };
}

module.exports = {
  parseMaterializationResult,
  validateMaterializationResult,
};
