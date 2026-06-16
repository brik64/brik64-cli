#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.15.4';
const label = 'beta15_4';
const requestDir = path.join(root, 'evidence', `${label}-l6-materializer-request`);
const requestJsonPath = path.join(requestDir, 'request.json');
const requestLinePath = path.join(requestDir, 'request.line');
const requestManifestPath = path.join(requestDir, 'request.manifest.json');
const checksumsPath = path.join(requestDir, 'SHA256SUMS');

const inputPcdPaths = [
  'pcd/beta15_4/release/l6_cli_materialization_contract.pcd',
  'pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd',
  'pcd/beta15_4/cli/rust_app_polymer_domain_codegen.pcd',
  'pcd/beta15_4/harness/rust_app_polymer_regression_gate.pcd',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
];

const outputRefs = {
  generatedArtifact: 'evidence/beta15_4-l6-generation/generated/brik64-cli.mjs',
  package: 'evidence/beta15_4-package/brik64-cli-0.1.0-beta.15.4.tar.gz',
  releaseManifest: 'release/manifest.json',
  sealReport: 'evidence/beta15_4-l6-generation/seal_report.json',
};

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

function safeRelativePath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.includes('\0') &&
    !/^https?:\/\//i.test(value) &&
    !value.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function gitSha() {
  const result = childProcess.spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function collectInputPcds() {
  return inputPcdPaths.map((relativePath) => {
    if (!safeRelativePath(relativePath)) throw new Error(`unsafe_input_pcd_path:${relativePath}`);
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error(`missing_input_pcd:${relativePath}`);
    }
    const content = fs.readFileSync(absolutePath);
    return {
      path: relativePath,
      sha256: sha256(content),
      bytes: content.length,
      contentBase64: content.toString('base64'),
    };
  });
}

function pcdInputSetSha256(inputPcds) {
  const body = `${inputPcds.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
  return sha256(body);
}

function buildRequest() {
  const inputPcds = collectInputPcds();
  for (const refPath of Object.values(outputRefs)) {
    if (!safeRelativePath(refPath)) throw new Error(`unsafe_output_ref:${refPath}`);
  }
  return {
    schemaVersion: 'brik64.l6plus_cli_materializer_request.v1',
    version,
    lane: 'cli_0_1_beta',
    iterId: 'beta15.4-l6-cli-materializer-request',
    materializerMode: 'l6plus_pcd_polymer_materializer',
    sourceCommit: gitSha(),
    claimBoundary: {
      publicClaimsAllowed: false,
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
    },
    requiredResultLine: 'BRIK64_L6_CLI_MATERIALIZATION_RESULT\\t<base64-json>',
    requiredResultSchema: 'brik64.l6plus_cli_materialization_result.v1',
    requiredResultVersion: version,
    pcdInputSetSha256: pcdInputSetSha256(inputPcds),
    requiredInputPcdPaths: inputPcds.map((item) => item.path),
    inputPcds,
    outputRefs,
    requiredBindings: [
      'generatedByL6PlusN5',
      'pcdToArtifactHashBound',
      'artifactToPackageHashBound',
      'packageToReleaseManifestHashBound',
      'sealReportPass',
      'generationTraceSha256',
      'remoteWrapperSha256',
      'wrapperExecTargetSha256',
      'compositeSha256',
    ],
  };
}

function validateRequest(request) {
  const blockers = [];
  if (!request || typeof request !== 'object') blockers.push('request_missing_or_invalid');
  if (request?.schemaVersion !== 'brik64.l6plus_cli_materializer_request.v1') blockers.push('request_schema_invalid');
  if (request?.version !== version) blockers.push(`request_version_mismatch:${request?.version || 'missing'}`);
  if (request?.materializerMode !== 'l6plus_pcd_polymer_materializer') blockers.push('request_materializer_mode_invalid');
  if (!Array.isArray(request?.inputPcds) || request.inputPcds.length !== inputPcdPaths.length) {
    blockers.push('request_input_pcds_incomplete');
  }
  const paths = new Set();
  for (const [index, item] of (request?.inputPcds || []).entries()) {
    if (!safeRelativePath(item?.path)) blockers.push(`request_input_pcd_${index}_path_invalid`);
    if (!/^[a-f0-9]{64}$/i.test(item?.sha256 || '')) blockers.push(`request_input_pcd_${index}_sha256_invalid`);
    if (!Number.isInteger(item?.bytes) || item.bytes < 1) blockers.push(`request_input_pcd_${index}_bytes_invalid`);
    if (typeof item?.contentBase64 !== 'string' || item.contentBase64.length === 0) {
      blockers.push(`request_input_pcd_${index}_content_missing`);
      continue;
    }
    const content = Buffer.from(item.contentBase64, 'base64');
    if (content.length !== item.bytes) blockers.push(`request_input_pcd_${index}_bytes_mismatch`);
    if (sha256(content) !== String(item.sha256 || '').toLowerCase()) {
      blockers.push(`request_input_pcd_${index}_content_sha256_mismatch`);
    }
    paths.add(item.path);
  }
  for (const requiredPath of inputPcdPaths) {
    if (!paths.has(requiredPath)) blockers.push(`request_required_input_pcd_missing:${requiredPath}`);
  }
  if (request?.pcdInputSetSha256 !== pcdInputSetSha256(request?.inputPcds || [])) {
    blockers.push('request_pcd_input_set_sha256_mismatch');
  }
  for (const [name, refPath] of Object.entries(request?.outputRefs || {})) {
    if (!safeRelativePath(refPath)) blockers.push(`request_output_ref_invalid:${name}`);
  }
  return {
    accepted: blockers.length === 0,
    blockers,
  };
}

function writeBundle() {
  fs.rmSync(requestDir, { recursive: true, force: true });
  fs.mkdirSync(requestDir, { recursive: true });
  const request = buildRequest();
  const validation = validateRequest(request);
  if (!validation.accepted) {
    throw new Error(`invalid_generated_request:${validation.blockers.join(',')}`);
  }
  writeJson(requestJsonPath, request);
  const encoded = Buffer.from(JSON.stringify(request)).toString('base64');
  fs.writeFileSync(requestLinePath, `BRIK64_L6_CLI_MATERIALIZATION_REQUEST\t${encoded}\n`);
  const files = [requestJsonPath, requestLinePath];
  const checksums = files
    .map((file) => `${sha256File(file)}  ${path.relative(requestDir, file)}`)
    .join('\n');
  fs.writeFileSync(checksumsPath, `${checksums}\n`);
  const manifest = {
    schemaVersion: 'brik64.l6plus_cli_materializer_request_manifest.v1',
    version,
    decision: 'PASS_BETA15_4_L6_MATERIALIZER_REQUEST_BUNDLE',
    request: {
      path: path.relative(root, requestJsonPath),
      sha256: sha256File(requestJsonPath),
      bytes: fs.statSync(requestJsonPath).size,
    },
    requestLine: {
      path: path.relative(root, requestLinePath),
      sha256: sha256File(requestLinePath),
      bytes: fs.statSync(requestLinePath).size,
    },
    pcdInputSetSha256: request.pcdInputSetSha256,
    inputPcds: request.inputPcds.map(({ path: itemPath, sha256: itemSha256, bytes }) => ({
      path: itemPath,
      sha256: itemSha256,
      bytes,
    })),
    claimBoundary: request.claimBoundary,
  };
  writeJson(requestManifestPath, manifest);
  console.log(`decision=${manifest.decision}`);
  console.log(`manifest=${path.relative(root, requestManifestPath)}`);
}

function verifyBundle() {
  const request = JSON.parse(fs.readFileSync(requestJsonPath, 'utf8'));
  const validation = validateRequest(request);
  console.log(validation.accepted ? 'PASS beta15.4 L6 materializer request bundle' : 'FAIL beta15.4 L6 materializer request bundle');
  if (!validation.accepted) {
    console.log(validation.blockers.join('\n'));
    process.exit(2);
  }
}

if (require.main === module) {
  if (process.argv.includes('--verify')) {
    verifyBundle();
  } else {
    writeBundle();
  }
}

module.exports = {
  buildRequest,
  validateRequest,
};
