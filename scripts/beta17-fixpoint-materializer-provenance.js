#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = '0.1.0-beta.17';
const defaultOutPath = path.join(root, 'evidence', 'beta17-fixpoint-remote-dispatcher', 'materializer-provenance.json');
const defaultInputPcdPaths = [
  'pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd',
  'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
];

function valuesFor(name) {
  const values = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
      index += 1;
    }
  }
  return values;
}

function argValue(name, fallback) {
  const values = valuesFor(name);
  return values.length > 0 ? values[values.length - 1] : fallback;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function safeWorkspacePath(value) {
  const text = String(value || '');
  return (
    text.length > 0 &&
    !text.startsWith('/') &&
    !text.includes('\0') &&
    !/^https?:\/\//i.test(text) &&
    !text.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function fileRef(relativePath, label) {
  if (!safeWorkspacePath(relativePath)) throw new Error(`${label}_path_invalid:${relativePath}`);
  const absolute = path.resolve(root, relativePath);
  const workspace = path.resolve(root);
  if (!(absolute === workspace || absolute.startsWith(`${workspace}${path.sep}`))) {
    throw new Error(`${label}_path_outside_workspace:${relativePath}`);
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`${label}_file_missing:${relativePath}`);
  }
  const stat = fs.statSync(absolute);
  return {
    path: relativePath,
    sha256: sha256File(absolute),
    bytes: stat.size,
  };
}

function inputHashBody(inputPcds) {
  return `${inputPcds.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
}

function pcdInputSetSha256(inputPcds) {
  return sha256(inputHashBody(inputPcds));
}

function buildProvenance(options) {
  const materializerRef = fileRef(options.materializer, 'materializer');
  const inputPcds = options.inputPcds.map((pcdPath) => fileRef(pcdPath, 'input_pcd'));
  if (inputPcds.length === 0) throw new Error('input_pcds_missing');
  return {
    schemaVersion: 'brik64.beta17_fixpoint.materializer_provenance.v1',
    version,
    status: 'MATERIALIZER_PROVENANCE_NON_CLAIM',
    materializerMode: 'l6plus_fixpoint_stage_materializer',
    generatedFromPcdPolymer: true,
    fixtureOrTemplate: false,
    l6plusEngineSerial: options.l6plusEngineSerial,
    pcdInputSetSha256: pcdInputSetSha256(inputPcds),
    inputPcds,
    materializerRef,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
  };
}

function validateProvenance(provenance) {
  const blockers = [];
  if (!provenance || typeof provenance !== 'object') blockers.push('provenance_missing_or_invalid');
  if (provenance?.schemaVersion !== 'brik64.beta17_fixpoint.materializer_provenance.v1') blockers.push('provenance_schema_invalid');
  if (provenance?.version !== version) blockers.push(`provenance_version_mismatch:${provenance?.version || 'missing'}`);
  if (provenance?.status !== 'MATERIALIZER_PROVENANCE_NON_CLAIM') blockers.push('provenance_status_not_non_claim');
  if (provenance?.materializerMode !== 'l6plus_fixpoint_stage_materializer') blockers.push('provenance_materializer_mode_invalid');
  if (provenance?.generatedFromPcdPolymer !== true) blockers.push('provenance_not_generated_from_pcd_polymer');
  if (provenance?.fixtureOrTemplate === true) blockers.push('provenance_fixture_or_template_not_allowed');
  if (typeof provenance?.l6plusEngineSerial !== 'string' || !provenance.l6plusEngineSerial.startsWith('BRIK64-L6PLUS-N5-')) {
    blockers.push('provenance_l6plus_serial_invalid');
  }
  if (!Array.isArray(provenance?.inputPcds) || provenance.inputPcds.length === 0) blockers.push('provenance_input_pcds_missing');
  for (const [index, item] of (provenance?.inputPcds || []).entries()) {
    if (!safeWorkspacePath(item?.path)) blockers.push(`provenance_input_pcd_${index}_path_invalid`);
    if (!/^[a-f0-9]{64}$/i.test(item?.sha256 || '')) blockers.push(`provenance_input_pcd_${index}_sha256_invalid`);
    if (!Number.isInteger(item?.bytes) || item.bytes < 1) blockers.push(`provenance_input_pcd_${index}_bytes_invalid`);
  }
  if (Array.isArray(provenance?.inputPcds) && provenance.pcdInputSetSha256 !== pcdInputSetSha256(provenance.inputPcds)) {
    blockers.push('provenance_pcd_input_set_sha256_mismatch');
  }
  if (!provenance?.materializerRef || typeof provenance.materializerRef !== 'object') blockers.push('provenance_materializer_ref_missing');
  if (!safeWorkspacePath(provenance?.materializerRef?.path)) blockers.push('provenance_materializer_ref_path_invalid');
  if (!/^[a-f0-9]{64}$/i.test(provenance?.materializerRef?.sha256 || '')) blockers.push('provenance_materializer_ref_sha256_invalid');
  if (!Number.isInteger(provenance?.materializerRef?.bytes) || provenance.materializerRef.bytes < 1) {
    blockers.push('provenance_materializer_ref_bytes_invalid');
  }
  if (provenance?.claimBoundary?.publicReleaseAllowed !== false) blockers.push('provenance_claim_boundary_public_release_open');
  if (provenance?.claimBoundary?.definitiveFixpointAllowed !== false) blockers.push('provenance_claim_boundary_fixpoint_open');
  if (provenance?.claimBoundary?.formalN5ClaimAllowed !== false) blockers.push('provenance_claim_boundary_formal_n5_open');
  if (provenance?.claimBoundary?.universalCorrectnessClaimAllowed !== false) blockers.push('provenance_claim_boundary_universal_correctness_open');
  return { accepted: blockers.length === 0, blockers };
}

function main() {
  const materializer = argValue('--materializer', null);
  const outPath = path.resolve(argValue('--out', defaultOutPath));
  const l6plusEngineSerial = argValue('--l6-serial', 'BRIK64-L6PLUS-N5-PENDING');
  const inputPcds = valuesFor('--pcd');
  const options = {
    materializer,
    l6plusEngineSerial,
    inputPcds: inputPcds.length > 0 ? inputPcds : defaultInputPcdPaths,
  };
  const blockers = [];
  let provenance = null;
  if (!materializer) blockers.push('materializer_argument_missing');
  try {
    if (blockers.length === 0) {
      provenance = buildProvenance(options);
      blockers.push(...validateProvenance(provenance).blockers);
      if (blockers.length === 0) writeJson(outPath, provenance);
    }
  } catch (error) {
    blockers.push(error.message);
  }
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.materializer_provenance_report.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: blockers.length === 0
      ? 'PASS_BETA17_FIXPOINT_MATERIALIZER_PROVENANCE'
      : 'BLOCKED_BETA17_FIXPOINT_MATERIALIZER_PROVENANCE',
    publicationAllowed: false,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    provenance: provenance
      ? {
          path: path.relative(root, outPath),
          materializerRef: provenance.materializerRef,
          pcdInputSetSha256: provenance.pcdInputSetSha256,
          inputPcdCount: provenance.inputPcds.length,
        }
      : null,
    blockers: [...new Set(blockers)],
    nextAction: blockers.length === 0
      ? 'use this provenance with plan:beta17:fixpoint:remote-dispatcher --provenance'
      : 'provide a materializer file and real PCD inputs, then regenerate provenance',
  };
  const reportPath = path.join(path.dirname(outPath), 'materializer-provenance-report.json');
  writeJson(reportPath, report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${path.relative(root, reportPath)}`);
  for (const blocker of report.blockers) console.error(blocker);
  process.exit(blockers.length === 0 ? 0 : 2);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`beta17_materializer_provenance_fail_closed:${error.message}`);
    process.exit(2);
  }
}

module.exports = {
  buildProvenance,
  pcdInputSetSha256,
  validateProvenance,
};
