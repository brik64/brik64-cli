#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const { safeRelativePath } = require('./beta17-fixpoint-stage-request-bundle');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = '0.1.0-beta.17';
const label = 'beta17-functional-cli-stage-request';
const requestDir = path.join(root, 'evidence', label);
const requestJsonPath = path.join(requestDir, 'request.json');
const requestLinePath = path.join(requestDir, 'request.line');
const requestManifestPath = path.join(requestDir, 'request.manifest.json');
const checksumsPath = path.join(requestDir, 'SHA256SUMS');
const requiredResultMarker = 'BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT';

const inputPcdPaths = [
  'pcd/beta17/release/functional_cli_stage_materialization_contract.pcd',
  'pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd',
  'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
];

const outputRefs = {
  stage1Artifact: 'evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs',
  stage1Manifest: 'evidence/beta17-fixpoint/stage1_artifact_manifest.json',
  functionalStageReport: 'evidence/beta17-fixpoint-functional-stage-artifact/report.json',
  packageManifest: 'evidence/beta17-package/package.manifest.json',
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

function gitSha() {
  const result = childProcess.spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function collectInputPcds(paths = inputPcdPaths) {
  return paths.map((relativePath) => {
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

function inputHashBody(inputPcds) {
  return `${inputPcds.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
}

function pcdInputSetSha256(inputPcds) {
  return sha256(inputHashBody(inputPcds));
}

function requestLineSha256(request) {
  return sha256(`${requiredResultMarker.replace('_RESULT', '_REQUEST')}\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`);
}

function buildRequest(options = {}) {
  const inputPcds = collectInputPcds(options.inputPcdPaths || inputPcdPaths);
  const refs = { ...outputRefs, ...(options.outputRefs || {}) };
  for (const [name, refPath] of Object.entries(refs)) {
    if (!safeRelativePath(refPath)) throw new Error(`unsafe_output_ref:${name}:${refPath}`);
  }
  return {
    schemaVersion: 'brik64.beta17_functional_cli_stage_request.v1',
    version,
    lane: 'l6plus_n5_self_host_fixpoint',
    iterId: 'beta17-functional-cli-stage-materialization',
    requestType: 'generate_beta17_functional_cli_stage_artifact',
    materializerMode: 'l6plus_functional_cli_stage_materializer',
    sourceCommit: gitSha(),
    status: 'REQUEST_NON_CLAIM',
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      publicClaimsAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
    },
    requiredResultLine: `${requiredResultMarker}\\t<base64-json>`,
    requiredResultSchema: 'brik64.beta17_functional_cli_stage_result.v1',
    requiredResultVersion: version,
    pcdInputSetSha256: pcdInputSetSha256(inputPcds),
    requiredInputPcdPaths: inputPcds.map((item) => item.path),
    inputPcds,
    outputRefs: refs,
    functionalRequirements: {
      minArtifactBytes: 50000,
      requiredTextMarkers: [
        '#!/usr/bin/env node',
        '0.1.0-beta.17',
        'process.argv',
      ],
      requiredExecutableChecks: [
        {
          name: 'execVersion',
          args: ['--version'],
          stdoutEquals: '0.1.0-beta.17',
        },
        {
          name: 'execHelp',
          args: ['--help'],
          stdoutIncludes: ['certify', 'verify', 'emit', 'polymerize', 'lift', 'monomers', 'engine'],
        },
        {
          name: 'execEngineStatusJson',
          args: ['engine', 'status', '--json'],
          jsonEquals: {
            engine: 'L4+N5',
            runtimeProfile: 'l4plus_n5_local',
            localRuntime: 'available',
          },
        },
        {
          name: 'execMonomersListJson',
          args: ['monomers', 'list', '--json'],
          minTotalCount: 64,
        },
      ],
      requiredSemanticMarkers: [
        'command dispatcher',
        'certify command',
        'verify command',
        'emit command',
        'polymerize command',
        'lift command',
        'monomers command',
        'engine status command',
      ],
    },
    requiredBindings: [
      'generatedByL6PlusN5',
      'generatedFromPcdPolymer',
      'stage1ArtifactSha256',
      'stage1ArtifactBytes',
      'nodeEntrypointPresent',
      'versionBound',
      'argvHandlingPresent',
      'commandDispatcherPresent',
      'functionalStageMinSizePass',
      'execVersionPass',
      'execHelpPass',
      'execEngineStatusJsonPass',
      'execMonomersListJsonPass',
      'functionalStageArtifactGatePass',
      'packageCandidateReferencesArtifact',
      'publicClaimBoundaryClosed',
    ],
  };
}

function validateRequest(request) {
  const blockers = [];
  if (!request || typeof request !== 'object') blockers.push('request_missing_or_invalid');
  if (request?.schemaVersion !== 'brik64.beta17_functional_cli_stage_request.v1') blockers.push('request_schema_invalid');
  if (request?.version !== version) blockers.push(`request_version_mismatch:${request?.version || 'missing'}`);
  if (request?.lane !== 'l6plus_n5_self_host_fixpoint') blockers.push('request_lane_invalid');
  if (request?.requestType !== 'generate_beta17_functional_cli_stage_artifact') blockers.push('request_type_invalid');
  if (request?.materializerMode !== 'l6plus_functional_cli_stage_materializer') blockers.push('request_materializer_mode_invalid');
  if (request?.status !== 'REQUEST_NON_CLAIM') blockers.push('request_status_not_non_claim');
  if (request?.requiredResultLine !== `${requiredResultMarker}\\t<base64-json>`) blockers.push('request_result_line_invalid');
  if (request?.claimBoundary?.publicReleaseAllowed !== false) blockers.push('claim_boundary_public_release_open');
  if (request?.claimBoundary?.definitiveFixpointAllowed !== false) blockers.push('claim_boundary_fixpoint_open');
  if (request?.claimBoundary?.formalN5ClaimAllowed !== false) blockers.push('claim_boundary_formal_n5_open');
  if (request?.claimBoundary?.selfHostingClaimAllowed !== false) blockers.push('claim_boundary_self_hosting_open');
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
    } else {
      const content = Buffer.from(item.contentBase64, 'base64');
      if (content.length !== item.bytes) blockers.push(`request_input_pcd_${index}_bytes_mismatch`);
      if (sha256(content) !== String(item.sha256 || '').toLowerCase()) {
        blockers.push(`request_input_pcd_${index}_content_sha256_mismatch`);
      }
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
  for (const name of Object.keys(outputRefs)) {
    if (!request?.outputRefs || !safeRelativePath(request.outputRefs[name])) {
      blockers.push(`request_output_ref_missing:${name}`);
    }
  }
  if (!Number.isInteger(request?.functionalRequirements?.minArtifactBytes) || request.functionalRequirements.minArtifactBytes < 50000) {
    blockers.push('request_min_artifact_bytes_too_low');
  }
  for (const marker of ['#!/usr/bin/env node', '0.1.0-beta.17', 'process.argv']) {
    if (!Array.isArray(request?.functionalRequirements?.requiredTextMarkers) || !request.functionalRequirements.requiredTextMarkers.includes(marker)) {
      blockers.push(`request_required_text_marker_missing:${marker}`);
    }
  }
  const executableChecks = request?.functionalRequirements?.requiredExecutableChecks;
  if (!Array.isArray(executableChecks) || executableChecks.length < 4) {
    blockers.push('request_required_executable_checks_incomplete');
  } else {
    const checkNames = new Set(executableChecks.map((item) => item?.name));
    for (const name of ['execVersion', 'execHelp', 'execEngineStatusJson', 'execMonomersListJson']) {
      if (!checkNames.has(name)) blockers.push(`request_required_executable_check_missing:${name}`);
    }
  }
  for (const marker of ['command dispatcher', 'certify command', 'verify command', 'emit command']) {
    if (!Array.isArray(request?.functionalRequirements?.requiredSemanticMarkers) || !request.functionalRequirements.requiredSemanticMarkers.includes(marker)) {
      blockers.push(`request_required_semantic_marker_missing:${marker}`);
    }
  }
  for (const binding of [
    'generatedByL6PlusN5',
    'generatedFromPcdPolymer',
    'stage1ArtifactSha256',
    'nodeEntrypointPresent',
    'argvHandlingPresent',
    'commandDispatcherPresent',
    'execVersionPass',
    'execHelpPass',
    'execEngineStatusJsonPass',
    'execMonomersListJsonPass',
    'functionalStageArtifactGatePass',
    'packageCandidateReferencesArtifact',
    'publicClaimBoundaryClosed',
  ]) {
    if (!Array.isArray(request?.requiredBindings) || !request.requiredBindings.includes(binding)) {
      blockers.push(`request_required_binding_missing:${binding}`);
    }
  }
  return { accepted: blockers.length === 0, blockers };
}

function writeBundle() {
  fs.rmSync(requestDir, { recursive: true, force: true });
  fs.mkdirSync(requestDir, { recursive: true });
  const request = buildRequest();
  const validation = validateRequest(request);
  if (!validation.accepted) throw new Error(`invalid_generated_request:${validation.blockers.join(',')}`);
  writeJson(requestJsonPath, request);
  const marker = requiredResultMarker.replace('_RESULT', '_REQUEST');
  const encoded = Buffer.from(JSON.stringify(request)).toString('base64');
  fs.writeFileSync(requestLinePath, `${marker}\t${encoded}\n`);
  const files = [requestJsonPath, requestLinePath];
  fs.writeFileSync(
    checksumsPath,
    `${files.map((file) => `${sha256File(file)}  ${path.relative(requestDir, file)}`).join('\n')}\n`
  );
  const manifest = {
    schemaVersion: 'brik64.beta17_functional_cli_stage_request_manifest.v1',
    version,
    decision: 'PASS_BETA17_FUNCTIONAL_CLI_STAGE_REQUEST_BUNDLE',
    status: 'REQUEST_NON_CLAIM',
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
    requestLineSha256: requestLineSha256(request),
    pcdInputSetSha256: request.pcdInputSetSha256,
    inputPcds: request.inputPcds.map(({ path: itemPath, sha256: itemSha256, bytes }) => ({
      path: itemPath,
      sha256: itemSha256,
      bytes,
    })),
    outputRefs: request.outputRefs,
    functionalRequirements: request.functionalRequirements,
    claimBoundary: request.claimBoundary,
  };
  writeJson(requestManifestPath, manifest);
  console.log(`decision=${manifest.decision}`);
  console.log(`manifest=${path.relative(root, requestManifestPath)}`);
}

function verifyBundle() {
  const request = JSON.parse(fs.readFileSync(requestJsonPath, 'utf8'));
  const validation = validateRequest(request);
  console.log(validation.accepted ? 'PASS beta17 functional CLI stage request bundle' : 'FAIL beta17 functional CLI stage request bundle');
  if (!validation.accepted) {
    console.log(validation.blockers.join('\n'));
    process.exit(2);
  }
}

if (require.main === module) {
  try {
    if (process.argv.includes('--verify')) verifyBundle();
    else writeBundle();
  } catch (error) {
    console.error(`beta17_functional_cli_stage_request_fail_closed:${error.message}`);
    process.exit(2);
  }
}

module.exports = {
  buildRequest,
  validateRequest,
  requestLineSha256,
  requiredResultMarker,
};
