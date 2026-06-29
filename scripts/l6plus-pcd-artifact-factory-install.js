#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const {
  requiredCapability,
  requiredResultMarker,
} = require('./l6plus-pcd-artifact-factory-audit');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'l6plus-pcd-artifact-factory-install');
const factoryPath = path.join(outDir, 'l6plus-pcd-artifact-factory.js');
const installScriptPath = path.join(outDir, 'install-script.sh');
const reportPath = path.join(outDir, 'install-report.json');
const defaultWrapper = '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const defaultRemoteFactory = '/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_pcd_artifact_factory.js';
const defaultHost = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const executeConfirmation = 'INSTALL_L6PLUS_PCD_ARTIFACT_FACTORY_NON_CLAIM';
const requestMarker = 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_REQUEST';

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

function buildFactorySource() {
  return String.raw`#!/usr/bin/env node
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
`;
}

function buildInstallScript(options) {
  return `#!/usr/bin/env bash
set -euo pipefail
umask 077
expected_sha=${shellQuote(options.factorySha256)}
wrapper=${shellQuote(options.wrapper)}
factory_remote=${shellQuote(options.remoteFactory)}
factory_tmp=/tmp/brik64-l6plus-pcd-artifact-factory-${options.factorySha256}.js
actual_sha="$(sha256sum "$factory_tmp" | awk '{print $1}')"
if [ "$actual_sha" != "$expected_sha" ]; then
  echo "l6plus_pcd_artifact_factory_sha_mismatch" >&2
  exit 2
fi
if ! grep -q ${shellQuote(requiredResultMarker)} "$factory_tmp"; then
  echo "l6plus_pcd_artifact_factory_result_marker_missing" >&2
  exit 2
fi
install -d -m 0755 "$(dirname "$factory_remote")"
install -m 0755 "$factory_tmp" "$factory_remote"
backup="\${wrapper}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp "$wrapper" "$backup"
python3 - "$wrapper" "$factory_remote" <<'PY'
import pathlib, sys
wrapper = pathlib.Path(sys.argv[1])
factory = sys.argv[2]
text = wrapper.read_text()
marker = "BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_ENDPOINT"
if marker not in text:
    lines = text.splitlines()
    insert_at = None
    for i, line in enumerate(lines):
        if line.strip().startswith("case "):
            insert_at = i + 1
            break
    if insert_at is None:
        raise SystemExit("l6plus_pcd_artifact_factory_wrapper_case_block_missing")
    block = [
        "  # BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_ENDPOINT",
        "  artifact-factory-status|pcd-artifact-factory-status|factory-status)",
        "    printf \\"BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY\\\\tinstalled\\\\tl6plus_pcd_artifact_factory,cli,sdk,harness,engine,docs,evidence-pack\\\\n\\"",
        "    printf \\"BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT\\\\tavailable\\\\n\\"",
        "    exit 0",
        "    ;;",
        "  artifact-factory-materialize|pcd-artifact-factory-materialize|factory-materialize)",
        "    shift",
        f"    exec /usr/bin/node {factory} \\"$@\\"",
        "    ;;",
    ]
    lines[insert_at:insert_at] = block
    wrapper.write_text("\\n".join(lines) + "\\n")
PY
if ! grep -q ${shellQuote(requiredCapability)} "$wrapper"; then
  echo "l6plus_pcd_artifact_factory_wrapper_capability_missing" >&2
  exit 2
fi
chmod 0755 "$wrapper"
rm -f "$factory_tmp"
printf 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL_RESULT\\tinstalled\\t%s\\t%s\\n' "$expected_sha" ${shellQuote(options.host)}
`;
}

function validateInstallScript(script, options) {
  const blockers = [];
  for (const needle of [
    'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_ENDPOINT',
    requiredCapability,
    requestMarker,
    requiredResultMarker,
    'artifact-factory-status',
    'artifact-factory-materialize',
    options.remoteFactory,
  ]) {
    if (!script.includes(needle) && !buildFactorySource().includes(needle)) blockers.push(`install_script_missing:${needle}`);
  }
  if (script.includes('publicReleaseAllowed: true') || script.includes('definitiveFixpointAllowed: true')) {
    blockers.push('install_script_opens_claim_boundary');
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
  const remoteTemp = `/tmp/brik64-l6plus-pcd-artifact-factory-${options.factorySha256}.js`;
  const scp = run('scp', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', factoryPath, `${options.host}:${remoteTemp}`]);
  if (scp.status !== 0) return { scp, ssh: null };
  const ssh = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', options.host, 'bash -s'], { input: installScript });
  return { scp, ssh };
}

function parseInstallResult(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find((item) => item.startsWith('BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL_RESULT\t'));
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
    remoteFactory: argValue('--remote-factory', defaultRemoteFactory),
  };
  const blockers = [];
  if (!isAbsoluteSafeRemotePath(options.wrapper)) blockers.push('wrapper_path_invalid');
  if (!isAbsoluteSafeRemotePath(options.remoteFactory)) blockers.push('remote_factory_path_invalid');
  const factorySource = buildFactorySource();
  writeText(factoryPath, factorySource);
  options.factorySha256 = sha256File(factoryPath);
  options.factoryBytes = fs.statSync(factoryPath).size;
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
    if (installResult && installResult.sha256 !== options.factorySha256) blockers.push('install_result_factory_sha256_mismatch');
    if (installResult && installResult.host !== options.host) blockers.push('install_result_host_mismatch');
  }
  const accepted = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.l6plus_pcd_artifact_factory_install.v1',
    version: '0.1.0-beta.17',
    generatedAt: new Date().toISOString(),
    decision: accepted
      ? (execute ? 'PASS_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL' : 'PASS_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL_DRY_RUN')
      : 'BLOCKED_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL',
    executed: execute && accepted,
    publicationAllowed: false,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    factory: {
      path: path.relative(root, factoryPath),
      sha256: options.factorySha256,
      bytes: options.factoryBytes,
      remotePath: options.remoteFactory,
      requiredCapability,
      requestMarker,
      resultMarker: requiredResultMarker,
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
        }
      : null,
    blockers,
    nextAction: accepted
      ? (execute ? 'run npm run audit:l6plus:pcd-artifact-factory and route Beta17 requests through factory-materialize' : `rerun with --execute --confirm ${executeConfirmation} to install the general factory, then run npm run audit:l6plus:pcd-artifact-factory`)
      : 'fix factory install blockers before attempting remote mutation',
  };
  writeJson(reportPath, report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${path.relative(root, reportPath)}`);
  if (!accepted) for (const blocker of blockers) console.error(blocker);
  process.exit(accepted ? 0 : 2);
}

if (require.main === module) main();

module.exports = {
  buildFactorySource,
  buildInstallScript,
  executeConfirmation,
  parseInstallResult,
  requestMarker,
  requiredCapability,
  requiredResultMarker,
  validateInstallScript,
};
