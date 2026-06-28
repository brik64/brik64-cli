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
  };
}

function attemptRemote(request) {
  if (skipRemote) return [];
  const encoded = Buffer.from(JSON.stringify(request)).toString('base64');
  return ['beta17-fixpoint-stage-materialize', 'fixpoint-stage-materialize', 'materialize'].map((command) => {
    const remote = [
      'set -u',
      'tmp="$(mktemp /tmp/brik64-beta17-fixpoint-stage-request.XXXXXX.json)"',
      `printf %s ${JSON.stringify(encoded)} | base64 -d > "$tmp"`,
      `${wrapper} ${command} "@@FILE:$tmp" || true`,
      'rm -f "$tmp"',
    ].join('; ');
    const result = ssh(remote);
    const stageResult = parseStageResult(`${result.stdout}\n${result.stderr}`);
    return {
      command: [wrapper, command, '@@FILE:<beta17-stage-request>'],
      status: result.status,
      stdout_sha256: sha256(result.stdout),
      stderr_sha256: sha256(result.stderr),
      observed: `${result.stdout}${result.stderr}`.trim().slice(0, 500) || null,
      stageResult: stageResult ? { present: true } : null,
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
  if (!skipRemote && remote.wrapperMode !== 'beta17_fixpoint_stage_dispatcher') {
    blockers.push(`remote_l6plus_wrapper_mode_not_beta17_stage:${remote.wrapperMode || 'missing'}`);
  }
  const attempts = request ? attemptRemote(request) : [];
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
  const validations = attempts.map((attempt) => {
    const raw = attempt.observed || '';
    const stageResult = parseStageResult(raw);
    const validation = validateStageResult(stageResult, expectedContext);
    return { ...attempt, stageResultValidation: validation };
  });
  const accepted = validations.find((attempt) => attempt.stageResultValidation.accepted);
  if (!accepted) blockers.push('remote_l6plus_beta17_stage_result_unavailable');
  const uniqueBlockers = [...new Set(blockers)];
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
        stdout_sha256: sha256(remote.hostProbe.stdout),
        stderr_sha256: sha256(remote.hostProbe.stderr),
        auditDecision: remote.auditJson?.decision || null,
      },
      remoteRefProbe: {
        status: remote.remoteRefProbe.status,
        stdout_sha256: sha256(remote.remoteRefProbe.stdout),
        stderr_sha256: sha256(remote.remoteRefProbe.stderr),
      },
      endpointStatusProbe: {
        status: remote.endpointStatusProbe.status,
        stdout_sha256: sha256(remote.endpointStatusProbe.stdout),
        stderr_sha256: sha256(remote.endpointStatusProbe.stderr),
      },
      wrapperMode: remote.wrapperMode,
      remoteRefs: remote.remoteRefs,
    },
    expectedContext,
    attempts: validations,
    blockers: uniqueBlockers,
    nextAction: accepted
      ? 'promote accepted remote result into evidence/beta17-fixpoint after independent audit'
      : 'deploy a real beta17 fixpoint stage dispatcher on the L6+N5 host and rerun this attempt',
  };
  writeJson(path.join(evidenceDir, 'report.json'), report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${rel(path.join(evidenceDir, 'report.json'))}`);
  if (!accepted) {
    for (const blocker of uniqueBlockers) console.error(blocker);
  }
  process.exit(accepted ? 0 : 2);
}

try {
  main();
} catch (error) {
  console.error(`beta17_remote_attempt_fail_closed:${error.message}`);
  process.exit(2);
}
