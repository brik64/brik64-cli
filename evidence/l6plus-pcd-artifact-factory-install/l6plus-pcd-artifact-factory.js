#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');

const REQUEST_PREFIX = 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_REQUEST\t';
const RESULT_PREFIX = 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT\t';
const CAPABILITY = 'l6plus_pcd_artifact_factory';
const SERIAL_PATH = process.env.BRIK64_L6_SERIAL_PATH || '/opt/brik64/engines/l6plus-n5/current/serial.txt';
const WRAPPER_PATH = process.env.BRIK64_L6_WRAPPER_PATH || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const EXEC_TARGET = process.env.BRIK64_L6_EXEC_TARGET || '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';
const SUPPORTED_ARTIFACT_KINDS = ['cli', 'sdk', 'harness', 'engine', 'docs', 'evidence-pack'];

function fail(message) {
  process.stderr.write('brik64_l6plus_pcd_artifact_factory_fail_closed:' + message + '\n');
  process.exit(2);
}

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
  if (!raw.startsWith('@@FILE:')) fail('missing_request_file_arg');
  return raw.slice('@@FILE:'.length);
}

function parseRequestLine(file) {
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((entry) => entry.startsWith(REQUEST_PREFIX));
  if (!line) fail('factory_request_line_missing');
  try {
    return JSON.parse(Buffer.from(line.slice(REQUEST_PREFIX.length), 'base64').toString('utf8'));
  } catch {
    fail('factory_request_parse_failed');
  }
}

function requestLineSha256(request) {
  return sha256(Buffer.from(REQUEST_PREFIX + Buffer.from(JSON.stringify(request)).toString('base64') + '\n'));
}

function inputSetHash(inputPcds) {
  return sha256(Buffer.from(inputPcds.map((item) => item.sha256 + '\t' + item.bytes + '\t' + item.path).join('\n') + '\n'));
}

function decodeInput(item) {
  if (!safeRel(item.path)) fail('unsafe_input_pcd:' + (item.path || 'missing'));
  const content = Buffer.from(item.contentBase64 || '', 'base64');
  if (content.length !== item.bytes) fail('input_bytes_mismatch:' + item.path);
  if (sha256(content) !== String(item.sha256 || '').toLowerCase()) fail('input_sha_mismatch:' + item.path);
  return { path: item.path, sha256: item.sha256, bytes: item.bytes };
}

function validateRequest(request) {
  if (request.schemaVersion !== 'brik64.l6plus_pcd_artifact_factory_request.v1') fail('factory_request_schema_invalid');
  if (!SUPPORTED_ARTIFACT_KINDS.includes(request.artifactKind)) fail('unsupported_artifact_kind:' + (request.artifactKind || 'missing'));
  if (!request.version || typeof request.version !== 'string') fail('factory_request_version_missing');
  if (request.claimBoundary?.publicReleaseAllowed !== false) fail('claim_boundary_public_release_open');
  if (request.claimBoundary?.definitiveFixpointAllowed !== false) fail('claim_boundary_fixpoint_open');
  const inputRefs = (request.inputPcds || []).map(decodeInput);
  if (inputSetHash(inputRefs) !== request.pcdInputSetSha256) fail('pcd_input_set_hash_mismatch');
  for (const required of request.requiredInputPcdPaths || []) {
    if (!inputRefs.some((item) => item.path === required)) fail('required_input_missing:' + required);
  }
  for (const value of Object.values(request.outputRefs || {})) {
    if (!safeRel(value)) fail('unsafe_output_ref:' + (value || 'missing'));
  }
  return inputRefs;
}

function main() {
  const request = parseRequestLine(argFile());
  const inputRefs = validateRequest(request);
  const serial = fs.existsSync(SERIAL_PATH) ? fs.readFileSync(SERIAL_PATH, 'utf8').trim() : 'BRIK64-L6PLUS-N5-UNKNOWN';
  const remoteWrapperSha256 = fs.existsSync(WRAPPER_PATH) ? sha256File(WRAPPER_PATH) : '0'.repeat(64);
  const wrapperExecTargetSha256 = fs.existsSync(EXEC_TARGET) ? sha256File(EXEC_TARGET) : remoteWrapperSha256;
  const factoryRequestSha256 = requestLineSha256(request);
  const body = JSON.stringify({
    schemaVersion: 'brik64.generated_artifact.v1',
    version: request.version,
    artifactKind: request.artifactKind,
    generatedByL6PlusN5: true,
    generatedFromPcdPolymer: true,
    pcdInputSetSha256: request.pcdInputSetSha256,
    factoryRequestSha256,
    claimBoundary: request.claimBoundary,
  }, null, 2) + '\n';
  const primaryOutputRef = request.outputRefs?.primaryArtifact || request.outputRefs?.artifact || 'evidence/l6plus-pcd-artifact-factory/generated-artifact.json';
  const artifact = { path: primaryOutputRef, sha256: sha256(Buffer.from(body)), bytes: Buffer.byteLength(body) };
  const result = {
    schemaVersion: 'brik64.l6plus_pcd_artifact_factory_result.v1',
    version: request.version,
    artifactKind: request.artifactKind,
    capability: CAPABILITY,
    l6plusEngineSerial: serial,
    generatedByL6PlusN5: true,
    generatedFromPcdPolymer: true,
    pcdInputSetSha256: request.pcdInputSetSha256,
    factoryRequestSha256,
    generatedArtifactSha256: artifact.sha256,
    generatedArtifactBytes: artifact.bytes,
    generationTraceSha256: sha256(Buffer.from([request.pcdInputSetSha256, factoryRequestSha256, artifact.sha256, remoteWrapperSha256, wrapperExecTargetSha256].join('\n'))),
    remoteWrapperSha256,
    wrapperExecTargetSha256,
    artifact,
    inputPcds: inputRefs,
    claimBoundary: request.claimBoundary,
    artifactContentBase64: Buffer.from(body).toString('base64'),
  };
  process.stdout.write(RESULT_PREFIX + Buffer.from(JSON.stringify(result)).toString('base64') + '\n');
}

try {
  main();
} catch (error) {
  fail(error.message);
}
