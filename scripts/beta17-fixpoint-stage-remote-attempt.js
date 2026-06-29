#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const { validateRequest } = require('./beta17-fixpoint-stage-request-bundle');
const { parseStageResult, validateStageResult } = require('./beta17-fixpoint-stage-result');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const evidenceDir = path.join(root, 'evidence', 'beta17-fixpoint-remote-attempt');
const requestPath = path.join(root, 'evidence', 'beta17-fixpoint-stage-request', 'request.json');
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const wrapper = process.env.BRIK64_L6_WRAPPER || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const healthcheck = process.env.BRIK64_L6_HEALTHCHECK || '/opt/brik64/engines/l6plus-n5/bin/healthcheck';
const audit = process.env.BRIK64_L6_AUDIT || '/opt/brik64/engines/l6plus-n5/bin/audit';
const skipRemote = process.env.BRIK64_L6_SKIP_REMOTE === '1';
const requiredEndpointCapability = 'beta17_fixpoint_stage_dispatcher';
const attemptedMaterializationCommands = [
  'beta17-fixpoint-stage-materialize',
  'fixpoint-stage-materialize',
  'materialize',
];
const requiredStageResultMarker = 'BRIK64_BETA17_FIXPOINT_STAGE_RESULT';
const remediationCommands = [
  'npm run provenance:beta17:fixpoint:materializer -- --materializer <generated-materializer.js> --pcd <canonical-input.pcd> --l6-serial <BRIK64-L6PLUS-N5-serial> --out <generated-materializer.provenance.json>',
  'npm run plan:beta17:fixpoint:remote-dispatcher -- --materializer <generated-materializer.js> --provenance <generated-materializer.provenance.json>',
  'npm run preflight:beta17:fixpoint:remote-dispatcher',
  'npm run install:beta17:fixpoint:remote-dispatcher -- --execute --confirm INSTALL_BETA17_FIXPOINT_DISPATCHER_NON_CLAIM',
  'npm run attempt:beta17:fixpoint:remote-stage',
  'npm run gate:beta17:fixpoint:remote-promotion',
  'npm run promote:beta17:fixpoint:remote-result',
  'npm run gate:beta17:fixpoint-readiness',
];

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

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function rel(file) {
  return path.relative(root, file);
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

function ssh(script) {
  if (skipRemote) {
    return {
      status: 65,
      stdout: '',
      stderr: 'remote probe skipped by BRIK64_L6_SKIP_REMOTE=1',
    };
  }
  return run('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    host,
    script,
  ]);
}

function parseJsonObject(text) {
  const source = String(text || '');
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseRemoteRefs(stdout) {
  const refs = {};
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const match = line.match(/^BRIK64_REMOTE_REF\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]*)$/);
    if (!match) continue;
    const [, id, sha256Value, bytes, target] = match;
    refs[id] = {
      sha256: sha256Value === 'missing' ? null : sha256Value,
      bytes: bytes === 'missing' ? null : Number(bytes),
      target: target || null,
    };
  }
  return refs;
}

function parseWrapperMode(stdout) {
  const match = String(stdout || '').match(/^BRIK64_WRAPPER_MODE\t(.+)$/m);
  return match ? match[1] : null;
}

function parseEndpointCapabilities(stdout) {
  const capabilities = [];
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const match = line.match(/^BRIK64_L6_CLI_MATERIALIZER_ENDPOINT(?:\t|\\t)installed(?:\t|\\t)(.+)$/);
    if (!match) continue;
    for (const item of match[1].split(',')) {
      const trimmed = item.trim();
      if (trimmed) capabilities.push(trimmed);
    }
  }
  return capabilities;
}

function requestLineSha256(request) {
  return sha256(`BRIK64_BETA17_FIXPOINT_STAGE_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`);
}

function readRequest() {
  if (!fs.existsSync(requestPath)) throw new Error(`missing_stage_request:${rel(requestPath)}`);
  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  const validation = validateRequest(request);
  if (!validation.accepted) throw new Error(`invalid_stage_request:${validation.blockers.join(',')}`);
  return request;
}

function probeRemote() {
  const hostProbe = ssh(['set -u', `${healthcheck}`, `${wrapper} --version`, `${audit}`].join('; '));
  const remoteRefProbe = ssh([
    'set -u',
    `printf 'BRIK64_REMOTE_REF\\twrapper\\t%s\\t%s\\t%s\\n' "$(sha256sum ${wrapper} 2>/dev/null | awk '{print $1}' || printf missing)" "$(stat -c %s ${wrapper} 2>/dev/null || printf missing)" "$(readlink -f ${wrapper} 2>/dev/null || printf ${wrapper})"`,
    `exec_target="$(awk '/^exec_target=/{gsub(/"/, "", $0); sub(/^exec_target=/, "", $0); print $0; exit} /^exec /{gsub(/"/, "", $2); print $2; exit}' ${wrapper} 2>/dev/null || true)"`,
    `if [ -n "$exec_target" ]; then printf 'BRIK64_REMOTE_REF\\twrapper_exec_target\\t%s\\t%s\\t%s\\n' "$(sha256sum "$exec_target" 2>/dev/null | awk '{print $1}' || printf missing)" "$(stat -c %s "$exec_target" 2>/dev/null || printf missing)" "$exec_target"; fi`,
    `if grep -q 'BRIK64_BETA17_FIXPOINT_STAGE_ENDPOINT' ${wrapper} 2>/dev/null; then printf 'BRIK64_WRAPPER_MODE\\tbeta17_fixpoint_stage_dispatcher\\n'; elif sed -n '1,12p' ${wrapper} 2>/dev/null | grep -q '^exec '; then printf 'BRIK64_WRAPPER_MODE\\tshell_exec_only\\n'; else printf 'BRIK64_WRAPPER_MODE\\tunknown\\n'; fi`,
  ].join('; '));
  const endpointStatusProbe = ssh(`${wrapper} beta17-fixpoint-stage-status || ${wrapper} endpoint-status || true`);
  return {
    hostProbe,
    remoteRefProbe,
    endpointStatusProbe,
    auditJson: parseJsonObject(hostProbe.stdout),
    remoteRefs: parseRemoteRefs(remoteRefProbe.stdout),
    wrapperMode: parseWrapperMode(remoteRefProbe.stdout),
    endpointCapabilities: parseEndpointCapabilities(endpointStatusProbe.stdout),
  };
}

function attemptRemote(request) {
  if (skipRemote) return [];
  const encoded = Buffer.from(JSON.stringify(request)).toString('base64');
  return attemptedMaterializationCommands.map((command) => {
    const remote = [
      'set -u',
      'tmp="$(mktemp /tmp/brik64-beta17-fixpoint-stage-request.XXXXXX.json)"',
      `printf %s ${JSON.stringify(encoded)} | base64 -d > "$tmp"`,
      `${wrapper} ${command} "@@FILE:$tmp" || true`,
      'rm -f "$tmp"',
    ].join('; ');
    const result = ssh(remote);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    const stageResult = parseStageResult(combinedOutput);
    return {
      command: [wrapper, command, '@@FILE:<beta17-stage-request>'],
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      stdout_sha256: sha256(result.stdout),
      stderr_sha256: sha256(result.stderr),
      observed: `${result.stdout}${result.stderr}`.trim().slice(0, 500) || null,
      stageResult: stageResult ? { present: true, result: stageResult } : null,
    };
  });
}

function transcriptRef(file) {
  return {
    path: rel(file),
    sha256: sha256File(file),
    bytes: fs.statSync(file).size,
  };
}

function persistProbeTranscripts(remote) {
  const transcriptDir = path.join(evidenceDir, 'transcripts');
  const files = {
    hostProbeStdout: path.join(transcriptDir, 'host-probe.stdout.txt'),
    hostProbeStderr: path.join(transcriptDir, 'host-probe.stderr.txt'),
    remoteRefStdout: path.join(transcriptDir, 'remote-ref.stdout.txt'),
    remoteRefStderr: path.join(transcriptDir, 'remote-ref.stderr.txt'),
    endpointStatusStdout: path.join(transcriptDir, 'endpoint-status.stdout.txt'),
    endpointStatusStderr: path.join(transcriptDir, 'endpoint-status.stderr.txt'),
  };
  writeText(files.hostProbeStdout, remote.hostProbe.stdout);
  writeText(files.hostProbeStderr, remote.hostProbe.stderr);
  writeText(files.remoteRefStdout, remote.remoteRefProbe.stdout);
  writeText(files.remoteRefStderr, remote.remoteRefProbe.stderr);
  writeText(files.endpointStatusStdout, remote.endpointStatusProbe.stdout);
  writeText(files.endpointStatusStderr, remote.endpointStatusProbe.stderr);
  return Object.fromEntries(Object.entries(files).map(([key, file]) => [key, transcriptRef(file)]));
}

function persistAttemptTranscripts(attempts) {
  const transcriptDir = path.join(evidenceDir, 'transcripts');
  return attempts.map((attempt, index) => {
    const stdoutFile = path.join(transcriptDir, `attempt-${index + 1}.stdout.txt`);
    const stderrFile = path.join(transcriptDir, `attempt-${index + 1}.stderr.txt`);
    const resultFile = path.join(transcriptDir, `attempt-${index + 1}.stage-result.json`);
    writeText(stdoutFile, attempt.stdout || '');
    writeText(stderrFile, attempt.stderr || '');
    if (attempt.stageResult?.result) {
      writeJson(resultFile, attempt.stageResult.result);
    }
    return {
      ...attempt,
      stdout: undefined,
      stderr: undefined,
      stageResult: attempt.stageResult?.result
        ? { present: true, resultRef: transcriptRef(resultFile) }
        : attempt.stageResult,
      stageResultRaw: attempt.stageResult?.result || null,
      stdoutTranscript: transcriptRef(stdoutFile),
      stderrTranscript: transcriptRef(stderrFile),
    };
  });
}

function main() {
  fs.rmSync(evidenceDir, { recursive: true, force: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  const blockers = [];
  let request = null;
  try {
    request = readRequest();
  } catch (error) {
    blockers.push(error.message);
  }
  const remote = probeRemote();
  if (remote.hostProbe.status !== 0) blockers.push('remote_l6plus_probe_failed');
  if (!skipRemote && remote.auditJson?.decision !== 'PASS') blockers.push('remote_l6plus_audit_not_pass');
  if (!skipRemote && remote.wrapperMode !== requiredEndpointCapability) {
    blockers.push(`remote_l6plus_wrapper_mode_not_beta17_stage:${remote.wrapperMode || 'missing'}`);
  }
  if (!skipRemote && !remote.endpointCapabilities.includes(requiredEndpointCapability)) {
    const capabilities = remote.endpointCapabilities.length > 0 ? remote.endpointCapabilities.join(',') : 'missing';
    blockers.push(`remote_l6plus_beta17_stage_endpoint_missing:${capabilities}`);
  }
  const attempts = request ? attemptRemote(request) : [];
  const persistedAttempts = persistAttemptTranscripts(attempts);
  const expectedContext = request
    ? {
        workspaceRoot: root,
        pcdInputSetSha256: request.pcdInputSetSha256,
        materializerRequestSha256: requestLineSha256(request),
        remoteWrapperSha256: remote.remoteRefs.wrapper?.sha256 || null,
        wrapperExecTargetSha256: (remote.remoteRefs.wrapper_exec_target || remote.remoteRefs.wrapper || {}).sha256 || null,
        requiredInputPcdPaths: request.requiredInputPcdPaths,
      }
    : {};
  const validations = persistedAttempts.map((attempt) => {
    const stageResult = attempt.stageResultRaw || null;
    const validation = validateStageResult(stageResult, expectedContext);
    const { stageResultRaw, ...reportAttempt } = attempt;
    return { ...reportAttempt, stageResultValidation: validation };
  });
  const accepted = validations.find((attempt) => attempt.stageResultValidation.accepted);
  if (!accepted) blockers.push('remote_l6plus_beta17_stage_result_unavailable');
  const uniqueBlockers = [...new Set(blockers)];
  const probeTranscripts = persistProbeTranscripts(remote);
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.remote_attempt.v1',
    version: '0.1.0-beta.17',
    generatedAt: new Date().toISOString(),
    decision: accepted
      ? 'PASS_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT'
      : 'BLOCKED_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT',
    publicationAllowed: false,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    host,
    skipped: skipRemote,
    remoteEndpointContract: {
      requiredEndpointCapability,
      requiredWrapperMode: requiredEndpointCapability,
      attemptedMaterializationCommands,
      requiredStageResultMarker,
      remediationCommands,
      installHint: [
        `install ${requiredEndpointCapability} in the L6+N5 wrapper`,
        `back it with a non-fixture L6+N5 materializer that emits ${requiredStageResultMarker}`,
        'bind Stage1 and Stage2 artifacts, byte identity, harness, seal, input PCD set and materializer request SHA-256',
        'keep publicationAllowed=false until the promoted result, public surface sync and external audit pass',
      ],
      nonAcceptableSubstitutes: [
        'healthy L6+N5 host audit without beta17 dispatcher',
        'beta15.7 or beta16 materializer endpoint',
        'fixture or TEMPLATE_NON_CLAIM stage result',
        'manual artifact patch not regenerated from PCD/polymer through L6+N5',
      ],
    },
    request: request
      ? {
          path: rel(requestPath),
          sha256: sha256File(requestPath),
          pcdInputSetSha256: request.pcdInputSetSha256,
        }
      : null,
    remote: {
      hostProbe: {
        status: remote.hostProbe.status,
        stdout_sha256: probeTranscripts.hostProbeStdout.sha256,
        stderr_sha256: probeTranscripts.hostProbeStderr.sha256,
        auditDecision: remote.auditJson?.decision || null,
      },
      remoteRefProbe: {
        status: remote.remoteRefProbe.status,
        stdout_sha256: probeTranscripts.remoteRefStdout.sha256,
        stderr_sha256: probeTranscripts.remoteRefStderr.sha256,
      },
      endpointStatusProbe: {
        status: remote.endpointStatusProbe.status,
        stdout_sha256: probeTranscripts.endpointStatusStdout.sha256,
        stderr_sha256: probeTranscripts.endpointStatusStderr.sha256,
      },
      wrapperMode: remote.wrapperMode,
      endpointCapabilities: remote.endpointCapabilities,
      remoteRefs: remote.remoteRefs,
      transcripts: probeTranscripts,
    },
    expectedContext,
    attempts: validations,
    blockers: uniqueBlockers,
    nextAction: accepted
      ? 'promote accepted remote result into evidence/beta17-fixpoint after independent audit'
      : `deploy ${requiredEndpointCapability} on the L6+N5 host, ensure it emits ${requiredStageResultMarker}, and rerun this attempt`,
  };
  writeJson(path.join(evidenceDir, 'report.json'), report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${rel(path.join(evidenceDir, 'report.json'))}`);
  if (!accepted) {
    for (const blocker of uniqueBlockers) console.error(blocker);
  }
  process.exit(accepted ? 0 : 2);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`beta17_remote_attempt_fail_closed:${error.message}`);
    process.exit(2);
  }
}

module.exports = {
  attemptedMaterializationCommands,
  parseEndpointCapabilities,
  parseRemoteRefs,
  parseWrapperMode,
  requiredEndpointCapability,
  requiredStageResultMarker,
  remediationCommands,
};
