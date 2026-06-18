#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');

const VERSION_FAMILY = /^0\.1\.0-beta\.15\.7(?:\.\d+)?$/;
const SERIAL_PATH = process.env.BRIK64_L6_SERIAL_PATH || '/opt/brik64/engines/l6plus-n5/current/serial.txt';
const WRAPPER_PATH = process.env.BRIK64_L6_WRAPPER_PATH || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const EXEC_TARGET = process.env.BRIK64_L6_EXEC_TARGET || '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function safeRel(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.includes('\0') &&
    !/^https?:\/\//i.test(value) &&
    !value.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function argFile() {
  const raw = process.argv[2] || '';
  if (!raw.startsWith('@@FILE:')) {
    throw new Error('missing_request_file_arg');
  }
  return raw.slice('@@FILE:'.length);
}

function requestLineSha256(request) {
  return sha256(`BRIK64_L6_CLI_MATERIALIZATION_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`);
}

function ref(pathValue, content) {
  return {
    path: pathValue,
    sha256: sha256(content),
    bytes: Buffer.byteLength(content),
  };
}

function requestVersion(request) {
  const value = request.version || 'missing';
  if (!VERSION_FAMILY.test(value)) throw new Error(`version_mismatch:${value}`);
  return value;
}

function main() {
  const requestPath = argFile();
  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  const version = requestVersion(request);
  if (request.materializerMode !== 'l6plus_pcd_polymer_materializer') throw new Error('materializer_mode_invalid');
  for (const item of request.inputPcds || []) {
    if (!safeRel(item.path)) throw new Error(`unsafe_input_pcd:${item.path || 'missing'}`);
    const content = Buffer.from(item.contentBase64 || '', 'base64');
    if (content.length !== item.bytes) throw new Error(`input_bytes_mismatch:${item.path}`);
    if (sha256(content) !== String(item.sha256 || '').toLowerCase()) throw new Error(`input_sha_mismatch:${item.path}`);
  }
  const requiredInputs = [
    'pcd/beta15_7/release/l6_cli_materialization_contract.pcd',
    'pcd/beta15_7/release/l6_cli_materialization_result_contract.pcd',
  ];
  const requestPaths = new Set((request.inputPcds || []).map((item) => item.path));
  for (const requiredPath of requiredInputs) {
    if (!requestPaths.has(requiredPath)) throw new Error(`required_beta15_7_pcd_missing:${requiredPath}`);
  }
  for (const name of ['generatedArtifact', 'package', 'releaseManifest', 'sealReport']) {
    if (!safeRel(request.outputRefs?.[name])) throw new Error(`unsafe_output_ref:${name}`);
  }
  const packageArtifact = request.outputArtifacts?.package;
  const releaseArtifact = request.outputArtifacts?.releaseManifest;
  if (!packageArtifact || !/^[a-f0-9]{64}$/i.test(packageArtifact.sha256 || '')) throw new Error('package_artifact_hash_missing');
  if (!releaseArtifact || !/^[a-f0-9]{64}$/i.test(releaseArtifact.sha256 || '')) throw new Error('release_manifest_hash_missing');

  const serial = fs.existsSync(SERIAL_PATH) ? fs.readFileSync(SERIAL_PATH, 'utf8').trim() : 'BRIK64-L6PLUS-N5-UNKNOWN';
  const remoteWrapperSha256 = sha256File(WRAPPER_PATH);
  const wrapperExecTargetSha256 = sha256File(EXEC_TARGET);
  const materializerRequestSha256 = requestLineSha256(request);
  const generatedArtifactObject = {
    schemaVersion: 'brik64.cli_beta15_7_l6_generated_artifact.v1',
    version,
    materializerMode: 'l6plus_pcd_polymer_materializer',
    generatedBy: 'l6plus_n5_remote_cli_materializer_endpoint',
    source: {
      pcdInputSetSha256: request.pcdInputSetSha256,
      materializerRequestSha256,
      inputPcds: (request.inputPcds || []).map(({ path, sha256, bytes }) => ({ path, sha256, bytes })),
    },
    outputBindings: {
      package: packageArtifact,
      releaseManifest: releaseArtifact,
    },
    claimBoundary: request.claimBoundary,
  };
  const generatedArtifactContent = `// brik64 generated materialization unit\nexport const brik64CliMaterialization = ${JSON.stringify(generatedArtifactObject, null, 2)};\n`;
  const generatedArtifact = ref(request.outputRefs.generatedArtifact, generatedArtifactContent);
  const generationTraceSha256 = sha256([
    request.pcdInputSetSha256,
    materializerRequestSha256,
    generatedArtifact.sha256,
    packageArtifact.sha256,
    releaseArtifact.sha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
  ].join('\n'));
  const compositeSha256 = sha256([
    request.pcdInputSetSha256,
    materializerRequestSha256,
    generatedArtifact.sha256,
    packageArtifact.sha256,
    releaseArtifact.sha256,
    generationTraceSha256,
  ].join('\n'));
  const sealObject = {
    schemaVersion: 'brik64.cli_beta15_7_l6_seal_report.v1',
    version,
    decision: 'PASS_BETA15_7_L6_SEAL',
    compositeSha256,
    generationTraceSha256,
    claimBoundary: request.claimBoundary,
    blockers: [],
  };
  const sealContent = `${JSON.stringify(sealObject, null, 2)}\n`;
  const sealReport = ref(request.outputRefs.sealReport, sealContent);
  const result = {
    schemaVersion: 'brik64.l6plus_cli_materialization_result.v1',
    version,
    l6plusEngineSerial: serial,
    materializerMode: 'l6plus_pcd_polymer_materializer',
    generatedByL6PlusN5: true,
    pcdToArtifactHashBound: true,
    artifactToPackageHashBound: true,
    packageToReleaseManifestHashBound: true,
    sealReportPass: true,
    generatedArtifactSha256: generatedArtifact.sha256,
    packageSha256: packageArtifact.sha256,
    releaseManifestSha256: releaseArtifact.sha256,
    compositeSha256,
    generationTraceSha256,
    pcdInputSetSha256: request.pcdInputSetSha256,
    materializerRequestSha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
    generatedArtifact,
    package: packageArtifact,
    releaseManifest: releaseArtifact,
    sealReport,
    inputPcds: (request.inputPcds || []).map(({ path, sha256, bytes }) => ({ path, sha256, bytes })),
    generatedArtifactContentBase64: Buffer.from(generatedArtifactContent).toString('base64'),
    sealReportContentBase64: Buffer.from(sealContent).toString('base64'),
    claimBoundary: request.claimBoundary,
  };
  process.stdout.write(`BRIK64_L6_CLI_MATERIALIZATION_RESULT\t${Buffer.from(JSON.stringify(result)).toString('base64')}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`brik64_l6plus_fail_closed:${error.message}\n`);
  process.exit(2);
}
