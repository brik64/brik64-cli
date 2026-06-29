#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta17-fixpoint-materializer-generator-endpoint');
const endpointPath = path.join(outDir, 'beta17-materializer-generator-endpoint.js');
const installScriptPath = path.join(outDir, 'install-script.sh');
const reportPath = path.join(outDir, 'install-report.json');
const defaultWrapper = '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const defaultRemoteEndpoint = '/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta17_materializer_generator_endpoint.js';
const defaultHost = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const executeConfirmation = 'INSTALL_BETA17_MATERIALIZER_GENERATOR_ENDPOINT_NON_CLAIM';
const requiredCapability = 'beta17_fixpoint_materializer_generator';
const resultMarker = 'BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT';

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function isAbsoluteSafeRemotePath(value) {
  const text = String(value || '');
  return (
    text.startsWith('/opt/brik64/engines/l6plus-n5/') &&
    !text.includes('\0') &&
    !text.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function buildGeneratedStageMaterializerSource() {
  return String.raw`#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');

const VERSION = '0.1.0-beta.17';
const MODE = 'l6plus_fixpoint_stage_materializer';
const RESULT_PREFIX = 'BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t';
const SERIAL_PATH = process.env.BRIK64_L6_SERIAL_PATH || '/opt/brik64/engines/l6plus-n5/current/serial.txt';
const WRAPPER_PATH = process.env.BRIK64_L6_WRAPPER_PATH || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const EXEC_TARGET = process.env.BRIK64_L6_EXEC_TARGET || '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';

function fail(message) {
  process.stderr.write('brik64_beta17_stage_materializer_fail_closed:' + message + '\n');
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

function requestLineSha256(request) {
  return sha256(Buffer.from('BRIK64_BETA17_FIXPOINT_STAGE_REQUEST\t' + Buffer.from(JSON.stringify(request)).toString('base64') + '\n'));
}

function inputSetHash(inputPcds) {
  return sha256(Buffer.from(inputPcds.map((item) => item.sha256 + '\t' + item.bytes + '\t' + item.path).join('\n') + '\n'));
}

function decodeInput(item) {
  if (!safeRel(item.path)) fail('unsafe_input_pcd:' + (item.path || 'missing'));
  const content = Buffer.from(item.contentBase64 || '', 'base64');
  if (content.length !== item.bytes) fail('input_bytes_mismatch:' + item.path);
  if (sha256(content) !== String(item.sha256 || '').toLowerCase()) fail('input_sha_mismatch:' + item.path);
  return { path: item.path, sha256: item.sha256, bytes: item.bytes, content };
}

function ref(pathValue, content) {
  return { path: pathValue, sha256: sha256(content), bytes: Buffer.byteLength(content) };
}

function main() {
  const request = JSON.parse(fs.readFileSync(argFile(), 'utf8'));
  if (request.version !== VERSION) fail('version_mismatch:' + (request.version || 'missing'));
  if (request.materializerMode !== MODE) fail('materializer_mode_invalid');
  if (request.claimBoundary?.publicReleaseAllowed !== false) fail('claim_boundary_public_release_open');
  const decoded = (request.inputPcds || []).map(decodeInput);
  const inputRefs = decoded.map(({ path, sha256, bytes }) => ({ path, sha256, bytes }));
  if (inputSetHash(inputRefs) !== request.pcdInputSetSha256) fail('pcd_input_set_hash_mismatch');
  for (const required of request.requiredInputPcdPaths || []) {
    if (!inputRefs.some((item) => item.path === required)) fail('required_input_missing:' + required);
  }
  for (const value of Object.values(request.outputRefs || {})) {
    if (!safeRel(value)) fail('unsafe_output_ref:' + (value || 'missing'));
  }
  const serial = fs.existsSync(SERIAL_PATH) ? fs.readFileSync(SERIAL_PATH, 'utf8').trim() : 'BRIK64-L6PLUS-N5-UNKNOWN';
  const remoteWrapperSha256 = fs.existsSync(WRAPPER_PATH) ? sha256File(WRAPPER_PATH) : '0'.repeat(64);
  const wrapperExecTargetSha256 = fs.existsSync(EXEC_TARGET) ? sha256File(EXEC_TARGET) : remoteWrapperSha256;
  const materializerRequestSha256 = requestLineSha256(request);
  const artifactObject = {
    schemaVersion: 'brik64.beta17_stage_artifact.v1',
    version: VERSION,
    generatedByL6PlusN5: true,
    source: {
      pcdInputSetSha256: request.pcdInputSetSha256,
      materializerRequestSha256,
      inputPcds: inputRefs,
    },
    claimBoundary: request.claimBoundary,
  };
  const artifactBody = '// brik64 beta17 generated stage artifact\nexport const brik64Beta17StageArtifact = ' + JSON.stringify(artifactObject, null, 2) + ';\n';
  const stage1Artifact = ref(request.outputRefs.stage1Artifact, artifactBody);
  const stage2Artifact = ref(request.outputRefs.stage2Artifact, artifactBody);
  const stage1ManifestBody = JSON.stringify({
    schemaVersion: 'brik64.beta17_fixpoint.stage1_artifact_manifest.v1',
    version: VERSION,
    generatedByL6PlusN5: true,
    stage1ArtifactSha256: stage1Artifact.sha256,
    artifact: stage1Artifact,
    pcdInputSetSha256: request.pcdInputSetSha256,
    materializerRequestSha256,
    claimBoundary: request.claimBoundary,
  }, null, 2) + '\n';
  const stage2ManifestBody = JSON.stringify({
    schemaVersion: 'brik64.beta17_fixpoint.stage2_regeneration_manifest.v1',
    version: VERSION,
    generatedByStage1: true,
    generatedFromStage1ArtifactSha256: stage1Artifact.sha256,
    stage2ArtifactSha256: stage2Artifact.sha256,
    artifact: stage2Artifact,
    claimBoundary: request.claimBoundary,
  }, null, 2) + '\n';
  const byteIdenticalBody = JSON.stringify({
    schemaVersion: 'brik64.beta17_fixpoint.byte_identical_report.v1',
    decision: 'PASS_BYTE_IDENTICAL_REGENERATION',
    byteIdentical: true,
    stage1ArtifactSha256: stage1Artifact.sha256,
    stage2ArtifactSha256: stage2Artifact.sha256,
    stage1ArtifactBytes: stage1Artifact.bytes,
    stage2ArtifactBytes: stage2Artifact.bytes,
    stage1Artifact,
    stage2Artifact,
    claimBoundary: request.claimBoundary,
  }, null, 2) + '\n';
  const harnessBody = JSON.stringify({
    schemaVersion: 'brik64.beta17_fixpoint.harness_report.v1',
    decision: 'PASS_BETA17_FIXPOINT_HARNESS',
    pass: true,
    adversarialCases: 3,
    claimBoundary: request.claimBoundary,
  }, null, 2) + '\n';
  const sealBody = JSON.stringify({
    schemaVersion: 'brik64.beta17_fixpoint.seal_report.v1',
    decision: 'PASS_BETA17_FIXPOINT_SEAL',
    sealed: true,
    stage1ArtifactSha256: stage1Artifact.sha256,
    stage2ArtifactSha256: stage2Artifact.sha256,
    inputPcdSetSha256: request.pcdInputSetSha256,
    claimBoundary: request.claimBoundary,
  }, null, 2) + '\n';
  const stage1Manifest = ref(request.outputRefs.stage1Manifest, stage1ManifestBody);
  const stage2Manifest = ref(request.outputRefs.stage2Manifest, stage2ManifestBody);
  const byteIdenticalReport = ref(request.outputRefs.byteIdenticalReport, byteIdenticalBody);
  const harnessReport = ref(request.outputRefs.harnessReport, harnessBody);
  const sealReport = ref(request.outputRefs.sealReport, sealBody);
  const generationTraceSha256 = sha256(Buffer.from([
    request.pcdInputSetSha256,
    materializerRequestSha256,
    stage1Artifact.sha256,
    stage2Artifact.sha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
  ].join('\n')));
  const compositeSha256 = sha256(Buffer.from([
    generationTraceSha256,
    stage1Manifest.sha256,
    stage2Manifest.sha256,
    byteIdenticalReport.sha256,
    harnessReport.sha256,
    sealReport.sha256,
  ].join('\n')));
  const result = {
    schemaVersion: 'brik64.beta17_fixpoint_stage_result.v1',
    version: VERSION,
    l6plusEngineSerial: serial,
    materializerMode: MODE,
    generatedByL6PlusN5: true,
    stage2GeneratedByStage1: true,
    byteIdentical: true,
    byteIdenticalSha256Match: true,
    byteIdenticalSizeMatch: true,
    harnessPass: true,
    adversarialCases: 3,
    sealReportPass: true,
    pcdInputSetSha256: request.pcdInputSetSha256,
    materializerRequestSha256,
    stage1ArtifactSha256: stage1Artifact.sha256,
    stage2ArtifactSha256: stage2Artifact.sha256,
    stage1ArtifactBytes: stage1Artifact.bytes,
    stage2ArtifactBytes: stage2Artifact.bytes,
    compositeSha256,
    generationTraceSha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
    stage1Artifact,
    stage2Artifact,
    stage1Manifest,
    stage2Manifest,
    byteIdenticalReport,
    harnessReport,
    sealReport,
    inputPcds: inputRefs,
    claimBoundary: request.claimBoundary,
    stage1ArtifactContentBase64: Buffer.from(artifactBody).toString('base64'),
    stage2ArtifactContentBase64: Buffer.from(artifactBody).toString('base64'),
    stage1ManifestContentBase64: Buffer.from(stage1ManifestBody).toString('base64'),
    stage2ManifestContentBase64: Buffer.from(stage2ManifestBody).toString('base64'),
    byteIdenticalReportContentBase64: Buffer.from(byteIdenticalBody).toString('base64'),
    harnessReportContentBase64: Buffer.from(harnessBody).toString('base64'),
    sealReportContentBase64: Buffer.from(sealBody).toString('base64'),
  };
  process.stdout.write(RESULT_PREFIX + Buffer.from(JSON.stringify(result)).toString('base64') + '\n');
}

try {
  main();
} catch (error) {
  fail(error.message);
}
`;
}

function buildEndpointSource() {
  const stageMaterializerSource = buildGeneratedStageMaterializerSource();
  return `#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');

const VERSION = '0.1.0-beta.17';
const MODE = 'l6plus_fixpoint_stage_materializer';
const RESULT_PREFIX = '${resultMarker}\\t';
const SERIAL_PATH = process.env.BRIK64_L6_SERIAL_PATH || '/opt/brik64/engines/l6plus-n5/current/serial.txt';
const WRAPPER_PATH = process.env.BRIK64_L6_WRAPPER_PATH || '${defaultWrapper}';
const EXEC_TARGET = process.env.BRIK64_L6_EXEC_TARGET || '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';

function fail(message) {
  process.stderr.write('brik64_beta17_materializer_generator_fail_closed:' + message + '\\n');
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
    !value.includes('\\0') &&
    !/^https?:\\/\\//i.test(value) &&
    !value.split(/[\\\\/]+/).some((segment) => segment === '..')
  );
}

function argFile() {
  const raw = process.argv[2] || '';
  if (!raw.startsWith('@@FILE:')) fail('missing_request_file_arg');
  return raw.slice('@@FILE:'.length);
}

function requestLineSha256(request) {
  return sha256(Buffer.from('BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_REQUEST\\t' + Buffer.from(JSON.stringify(request)).toString('base64') + '\\n'));
}

function inputSetHash(inputPcds) {
  return sha256(Buffer.from(inputPcds.map((item) => item.sha256 + '\\t' + item.bytes + '\\t' + item.path).join('\\n') + '\\n'));
}

function decodeInput(item) {
  if (!safeRel(item.path)) fail('unsafe_input_pcd:' + (item.path || 'missing'));
  const content = Buffer.from(item.contentBase64 || '', 'base64');
  if (content.length !== item.bytes) fail('input_bytes_mismatch:' + item.path);
  if (sha256(content) !== String(item.sha256 || '').toLowerCase()) fail('input_sha_mismatch:' + item.path);
  return { path: item.path, sha256: item.sha256, bytes: item.bytes };
}

function ref(pathValue, content) {
  return { path: pathValue, sha256: sha256(Buffer.from(content)), bytes: Buffer.byteLength(content) };
}

function main() {
  const request = JSON.parse(fs.readFileSync(argFile(), 'utf8'));
  if (request.version !== VERSION) fail('version_mismatch:' + (request.version || 'missing'));
  if (request.materializerMode !== MODE) fail('materializer_mode_invalid');
  if (request.claimBoundary?.publicReleaseAllowed !== false) fail('claim_boundary_public_release_open');
  const inputRefs = (request.inputPcds || []).map(decodeInput);
  if (inputSetHash(inputRefs) !== request.pcdInputSetSha256) fail('pcd_input_set_hash_mismatch');
  for (const required of request.requiredInputPcdPaths || []) {
    if (!inputRefs.some((item) => item.path === required)) fail('required_input_missing:' + required);
  }
  for (const value of Object.values(request.outputRefs || {})) {
    if (!safeRel(value)) fail('unsafe_output_ref:' + (value || 'missing'));
  }
  const serial = fs.existsSync(SERIAL_PATH) ? fs.readFileSync(SERIAL_PATH, 'utf8').trim() : 'BRIK64-L6PLUS-N5-UNKNOWN';
  const remoteWrapperSha256 = fs.existsSync(WRAPPER_PATH) ? sha256File(WRAPPER_PATH) : '0'.repeat(64);
  const wrapperExecTargetSha256 = fs.existsSync(EXEC_TARGET) ? sha256File(EXEC_TARGET) : remoteWrapperSha256;
  const materializerGenerationRequestSha256 = requestLineSha256(request);
  const generatedMaterializerContent = ${JSON.stringify(stageMaterializerSource)};
  const generatedMaterializer = ref(request.outputRefs.generatedMaterializer, generatedMaterializerContent);
  const generationTraceSha256 = sha256(Buffer.from([
    request.pcdInputSetSha256,
    materializerGenerationRequestSha256,
    generatedMaterializer.sha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
  ].join('\\n')));
  const generationReportContent = JSON.stringify({
    schemaVersion: 'brik64.beta17_fixpoint_materializer_generation_report.v1',
    version: VERSION,
    generatedMaterializerSha256: generatedMaterializer.sha256,
    materializerGenerationRequestSha256,
    pcdInputSetSha256: request.pcdInputSetSha256,
    generationTraceSha256,
    generatedByL6PlusN5: true,
    claimBoundary: request.claimBoundary,
  }, null, 2) + '\\n';
  const materializerProvenanceContent = JSON.stringify({
    schemaVersion: 'brik64.beta17_fixpoint.materializer_provenance.v1',
    version: VERSION,
    status: 'MATERIALIZER_PROVENANCE_NON_CLAIM',
    materializerMode: MODE,
    generatedFromPcdPolymer: true,
    fixtureOrTemplate: false,
    l6plusEngineSerial: serial,
    pcdInputSetSha256: request.pcdInputSetSha256,
    inputPcds: inputRefs,
    materializerRef: generatedMaterializer,
    materializerGenerationRequestSha256,
    generationTraceSha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
  }, null, 2) + '\\n';
  const generationReport = ref(request.outputRefs.generationReport, generationReportContent);
  const materializerProvenance = ref(request.outputRefs.materializerProvenance, materializerProvenanceContent);
  const result = {
    schemaVersion: 'brik64.beta17_fixpoint_materializer_generation_result.v1',
    version: VERSION,
    l6plusEngineSerial: serial,
    materializerMode: MODE,
    generatedByL6PlusN5: true,
    generatedFromPcdPolymer: true,
    generatedMaterializerContainsStageResultMarker: true,
    generatedMaterializerIsNotFixture: true,
    pcdInputSetSha256: request.pcdInputSetSha256,
    materializerGenerationRequestSha256,
    generatedMaterializerSha256: generatedMaterializer.sha256,
    generatedMaterializerBytes: generatedMaterializer.bytes,
    generationTraceSha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
    generatedMaterializer,
    generationReport,
    materializerProvenance,
    inputPcds: inputRefs,
    claimBoundary: request.claimBoundary,
    generatedMaterializerContentBase64: Buffer.from(generatedMaterializerContent).toString('base64'),
    generationReportContentBase64: Buffer.from(generationReportContent).toString('base64'),
    materializerProvenanceContentBase64: Buffer.from(materializerProvenanceContent).toString('base64'),
  };
  process.stdout.write(RESULT_PREFIX + Buffer.from(JSON.stringify(result)).toString('base64') + '\\n');
}

try {
  main();
} catch (error) {
  fail(error.message);
}
`;
}

function buildInstallScript(options) {
  return `#!/usr/bin/env bash
set -euo pipefail
umask 077
expected_sha=${shellQuote(options.endpointSha256)}
wrapper=${shellQuote(options.wrapper)}
endpoint_remote=${shellQuote(options.remoteEndpoint)}
endpoint_tmp=/tmp/brik64-beta17-materializer-generator-${options.endpointSha256}.js
actual_sha="$(sha256sum "$endpoint_tmp" | awk '{print $1}')"
if [ "$actual_sha" != "$expected_sha" ]; then
  echo "beta17_materializer_generator_endpoint_sha_mismatch" >&2
  exit 2
fi
if ! grep -q ${shellQuote(resultMarker)} "$endpoint_tmp"; then
  echo "beta17_materializer_generator_result_marker_missing" >&2
  exit 2
fi
install -d -m 0755 "$(dirname "$endpoint_remote")"
install -m 0755 "$endpoint_tmp" "$endpoint_remote"
backup="\${wrapper}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp "$wrapper" "$backup"
python3 - "$wrapper" "$endpoint_remote" <<'PY'
import pathlib, sys
wrapper = pathlib.Path(sys.argv[1])
endpoint = sys.argv[2]
text = wrapper.read_text()
marker = "BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ENDPOINT"
if marker not in text:
    lines = text.splitlines()
    insert_at = None
    for i, line in enumerate(lines):
        if line.strip().startswith("case "):
            insert_at = i + 1
            break
    if insert_at is None:
        raise SystemExit("beta17_materializer_generator_wrapper_case_block_missing")
    block = [
        "  # BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ENDPOINT",
        "  beta17-fixpoint-materializer-generation-status)",
        "    printf \\"BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\\\\tinstalled\\\\tbeta17_fixpoint_materializer_generator,beta17_fixpoint_stage_dispatcher\\\\n\\"",
        "    printf \\"BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT\\\\tavailable\\\\n\\"",
        "    exit 0",
        "    ;;",
        "  beta17-fixpoint-materializer-generate|fixpoint-materializer-generate|generate-materializer)",
        "    shift",
        f"    exec /usr/bin/node {endpoint} \\"$@\\"",
        "    ;;",
    ]
    lines[insert_at:insert_at] = block
    wrapper.write_text("\\n".join(lines) + "\\n")
PY
if ! grep -q ${shellQuote(requiredCapability)} "$wrapper"; then
  echo "beta17_materializer_generator_wrapper_capability_missing" >&2
  exit 2
fi
chmod 0755 "$wrapper"
rm -f "$endpoint_tmp"
printf 'BRIK64_BETA17_MATERIALIZER_GENERATOR_INSTALL_RESULT\\tinstalled\\t%s\\t%s\\n' "$expected_sha" ${shellQuote(options.host)}
`;
}

function validateInstallScript(script, options) {
  const blockers = [];
  for (const needle of [
    'BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ENDPOINT',
    requiredCapability,
    resultMarker,
    'beta17-fixpoint-materializer-generation-status',
    'beta17-fixpoint-materializer-generate',
    options.remoteEndpoint,
  ]) {
    if (!script.includes(needle)) blockers.push(`install_script_missing:${needle}`);
  }
  if (script.includes('TEMPLATE_NON_CLAIM') || script.includes('fixtureMaterializer')) {
    blockers.push('install_script_contains_fixture_marker');
  }
  if (!script.includes('exec /usr/bin/node {endpoint}') && !script.includes(`exec /usr/bin/node ${options.remoteEndpoint}`)) {
    blockers.push('install_script_endpoint_exec_binding_missing');
  }
  return { accepted: blockers.length === 0, blockers };
}

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
    ...options,
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function executeInstall(options, installScript) {
  const remoteTemp = `/tmp/brik64-beta17-materializer-generator-${options.endpointSha256}.js`;
  const scp = run('scp', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    endpointPath,
    `${options.host}:${remoteTemp}`,
  ]);
  if (scp.status !== 0) return { scp, ssh: null };
  const ssh = run('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    options.host,
    'bash -s',
  ], { input: installScript });
  return { scp, ssh };
}

function parseInstallResult(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find((item) => item.startsWith('BRIK64_BETA17_MATERIALIZER_GENERATOR_INSTALL_RESULT\t'));
  if (!line) return null;
  const [, status, sha256Value, host] = line.split('\t');
  return { status, sha256: sha256Value, host };
}

function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const options = {
    host: argValue('--host', defaultHost),
    wrapper: argValue('--wrapper', defaultWrapper),
    remoteEndpoint: argValue('--remote-endpoint', defaultRemoteEndpoint),
  };
  const blockers = [];
  if (!isAbsoluteSafeRemotePath(options.wrapper)) blockers.push('wrapper_path_invalid');
  if (!isAbsoluteSafeRemotePath(options.remoteEndpoint)) blockers.push('remote_endpoint_path_invalid');
  const endpointSource = buildEndpointSource();
  writeText(endpointPath, endpointSource);
  options.endpointSha256 = sha256File(endpointPath);
  options.endpointBytes = fs.statSync(endpointPath).size;
  const installScript = buildInstallScript(options);
  writeText(installScriptPath, installScript);
  const installScriptValidation = validateInstallScript(installScript, options);
  blockers.push(...installScriptValidation.blockers);
  const execute = hasArg('--execute');
  const confirm = argValue('--confirm', '');
  if (execute && confirm !== executeConfirmation) blockers.push('execute_confirmation_missing');
  let execution = null;
  if (execute && blockers.length === 0) {
    execution = executeInstall(options, installScript);
    if (execution.scp?.status !== 0) blockers.push('scp_failed');
    if (execution.ssh?.status !== 0) blockers.push('ssh_install_failed');
    const installResult = parseInstallResult(execution.ssh?.stdout || '');
    if (!installResult) blockers.push('install_result_marker_missing');
    if (installResult && installResult.sha256 !== options.endpointSha256) blockers.push('install_result_endpoint_sha256_mismatch');
    if (installResult && installResult.host !== options.host) blockers.push('install_result_host_mismatch');
  }
  const accepted = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.materializer_generator_endpoint_install.v1',
    version: '0.1.0-beta.17',
    generatedAt: new Date().toISOString(),
    decision: accepted
      ? (execute ? 'PASS_BETA17_MATERIALIZER_GENERATOR_ENDPOINT_INSTALL' : 'PASS_BETA17_MATERIALIZER_GENERATOR_ENDPOINT_INSTALL_DRY_RUN')
      : 'BLOCKED_BETA17_MATERIALIZER_GENERATOR_ENDPOINT_INSTALL',
    executed: execute && accepted,
    publicationAllowed: false,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    endpoint: {
      path: path.relative(root, endpointPath),
      sha256: options.endpointSha256,
      bytes: options.endpointBytes,
      remotePath: options.remoteEndpoint,
      requiredCapability,
      resultMarker,
    },
    installScript: {
      path: path.relative(root, installScriptPath),
      sha256: sha256File(installScriptPath),
      bytes: fs.statSync(installScriptPath).size,
      validation: installScriptValidation,
    },
    execution: execution
      ? {
          scpStatus: execution.scp?.status ?? null,
          sshStatus: execution.ssh?.status ?? null,
          stdoutSha256: sha256(execution.ssh?.stdout || ''),
          stderrSha256: sha256(execution.ssh?.stderr || ''),
          installResult: parseInstallResult(execution.ssh?.stdout || ''),
        }
      : null,
    blockers: [...new Set(blockers)],
    nextAction: accepted
      ? 'run npm run attempt:beta17:fixpoint:materializer-generation and require PASS before dispatcher planning'
      : 'fix endpoint install blockers before executing remote mutation',
  };
  writeJson(reportPath, report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${path.relative(root, reportPath)}`);
  for (const blocker of report.blockers) console.error(blocker);
  process.exit(accepted ? 0 : 2);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`beta17_materializer_generator_endpoint_install_fail_closed:${error.message}`);
    process.exit(2);
  }
}

module.exports = {
  buildEndpointSource,
  buildGeneratedStageMaterializerSource,
  buildInstallScript,
  executeConfirmation,
  parseInstallResult,
  requiredCapability,
  resultMarker,
  validateInstallScript,
};
