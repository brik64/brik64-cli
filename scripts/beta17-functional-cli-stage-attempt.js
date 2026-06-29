#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const {
  parseFunctionalCliStageResult,
  validateFunctionalCliStageResult,
} = require('./beta17-functional-cli-stage-result');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const evidenceDir = path.join(root, 'evidence', 'beta17-functional-cli-stage-attempt');
const resultEvidenceDir = path.join(root, 'evidence', 'beta17-functional-cli-stage-result');
const defaultRequestLinePath = path.join(root, 'evidence', 'beta17-functional-cli-stage-request', 'request.line');
const defaultRequestManifestPath = path.join(root, 'evidence', 'beta17-functional-cli-stage-request', 'request.manifest.json');
const defaultResultLinePath = path.join(resultEvidenceDir, 'result.line');
const requestLinePath = argValue('--request-line', defaultRequestLinePath);
const requestManifestPath = argValue('--request-manifest', defaultRequestManifestPath);
const suppliedResultLinePath = argValue('--result-line', process.env.BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT_LINE || '');
const resultLineText = argValue('--result-text', process.env.BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT || '');
const hydrateScript = path.join(root, 'scripts', 'beta17-functional-cli-stage-result-hydrate.js');
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const wrapper = process.env.BRIK64_L6_WRAPPER || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const skipRemote = process.env.BRIK64_L6_SKIP_REMOTE === '1';
const resultMarker = 'BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT';
const requiredEndpointCapability = 'beta17_functional_cli_stage_materializer';
const factoryRequestMarker = 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_REQUEST';
const factoryResultMarker = 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT';
const requiredFactoryCapability = 'l6plus_pcd_artifact_factory';
const attemptedRemoteCommands = [
  'beta17-functional-cli-stage-materialize',
  'functional-cli-stage-materialize',
  'beta17-fixpoint-functional-cli-stage-materialize',
];

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function rel(file) {
  return path.relative(root, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fileRef(file) {
  return {
    path: rel(file),
    sha256: sha256File(file),
    bytes: fs.statSync(file).size,
  };
}

function closedClaimBoundary() {
  return {
    publicReleaseAllowed: false,
    definitiveFixpointAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
    publicClaimsAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  };
}

function loadExpected() {
  const manifest = readJsonIfExists(requestManifestPath);
  if (!manifest) return {};
  return {
    pcdInputSetSha256: manifest.pcdInputSetSha256,
    functionalCliStageRequestSha256: manifest.requestLineSha256 || manifest.requestLine?.sha256,
    requiredInputPcdPaths: (manifest.inputPcds || []).map((item) => item.path),
  };
}

function readSuppliedResultLine() {
  if (resultLineText) return `${resultLineText.trim()}\n`;
  if (suppliedResultLinePath && fs.existsSync(suppliedResultLinePath)) {
    return fs.readFileSync(suppliedResultLinePath, 'utf8');
  }
  if (fs.existsSync(defaultResultLinePath)) return fs.readFileSync(defaultResultLinePath, 'utf8');
  return null;
}

function runHydration() {
  return childProcess.spawnSync(process.execPath, [
    hydrateScript,
    '--result-line',
    defaultResultLinePath,
    '--request-manifest',
    requestManifestPath,
  ], {
    cwd: root,
    env: { ...process.env, BRIK64_CLI_ROOT: root },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });
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
  return run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, script]);
}

function parseEndpointCapabilities(stdout) {
  const capabilities = [];
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const match = line.match(/^BRIK64_L6_CLI_MATERIALIZER_ENDPOINT(?:\t|\\t)installed(?:\t|\\t)(.+)$/);
    const factory = line.match(/^BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY(?:\t|\\t)(?:installed|available)(?:\t|\\t)(.+)$/);
    const items = match?.[1] || factory?.[1] || '';
    if (!items) continue;
    for (const item of items.split(',')) {
      const trimmed = item.trim();
      if (trimmed) capabilities.push(trimmed);
    }
  }
  return capabilities;
}

function parseResultLine(text) {
  return String(text || '').split(/\r?\n/).find((line) => line.startsWith(`${resultMarker}\t`)) || null;
}

function parseFactoryResultLine(text) {
  return String(text || '').split(/\r?\n/).find((line) => line.startsWith(`${factoryResultMarker}\t`)) || null;
}

function parseEmbeddedFunctionalResultLine(factoryLine) {
  if (!factoryLine) return null;
  try {
    const decoded = JSON.parse(Buffer.from(factoryLine.slice(`${factoryResultMarker}\t`.length), 'base64').toString('utf8'));
    if (typeof decoded.targetResultLineBase64 === 'string') {
      return Buffer.from(decoded.targetResultLineBase64, 'base64').toString('utf8');
    }
    if (typeof decoded.targetResultLine === 'string') return decoded.targetResultLine;
  } catch {
    return null;
  }
  return null;
}

function writeTranscript(file, text) {
  writeText(file, text || '');
  return fileRef(file);
}

function decodeRequestLine() {
  const line = fs.readFileSync(requestLinePath, 'utf8').trim();
  const encoded = line.split(/\t/)[1] || '';
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}

function buildFactoryRequestLine() {
  const request = decodeRequestLine();
  const expected = loadExpected();
  const factoryRequest = {
    schemaVersion: 'brik64.l6plus_pcd_artifact_factory_request.v1',
    version: request.version,
    artifactKind: 'cli',
    lane: request.lane,
    iterId: request.iterId,
    sourceCommit: request.sourceCommit,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
      publicClaimsAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
    },
    pcdInputSetSha256: request.pcdInputSetSha256,
    sourceFunctionalCliStageRequestSha256: expected.functionalCliStageRequestSha256,
    requiredInputPcdPaths: request.requiredInputPcdPaths,
    inputPcds: request.inputPcds,
    outputRefs: {
      primaryArtifact: request.outputRefs?.stage1Artifact || 'evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs',
      stage1Manifest: request.outputRefs?.stage1Manifest || 'evidence/beta17-fixpoint/stage1_artifact_manifest.json',
      functionalStageReport: request.outputRefs?.functionalStageReport || 'evidence/beta17-fixpoint-functional-stage-artifact/report.json',
      packageManifest: request.outputRefs?.packageManifest || 'evidence/beta17-package/package.manifest.json',
    },
    requirements: {
      sourceRequestSchema: request.schemaVersion,
      sourceRequiredResultLine: request.requiredResultLine,
      functionalRequirements: request.functionalRequirements,
      requiredBindings: request.requiredBindings,
    },
  };
  return `${factoryRequestMarker}\t${Buffer.from(JSON.stringify(factoryRequest)).toString('base64')}\n`;
}

function tryRemoteRequest() {
  const transcriptDir = path.join(evidenceDir, 'transcripts');
  if (!fs.existsSync(requestLinePath)) {
    return {
      skipped: true,
      reason: 'missing_request_line',
      attempts: [],
      resultLine: null,
      transcripts: {},
    };
  }
  if (skipRemote) {
    return {
      skipped: true,
      reason: 'remote_skipped_by_BRIK64_L6_SKIP_REMOTE',
      attempts: [],
      resultLine: null,
      transcripts: {},
    };
  }

  const statusProbe = ssh(`${wrapper} beta17-functional-cli-stage-status || ${wrapper} endpoint-status || true`);
  const factoryStatusProbe = ssh(`${wrapper} artifact-factory-status || ${wrapper} pcd-artifact-factory-status || ${wrapper} factory-status || true`);
  const transcripts = {
    endpointStatusStdout: writeTranscript(path.join(transcriptDir, 'endpoint-status.stdout.txt'), statusProbe.stdout),
    endpointStatusStderr: writeTranscript(path.join(transcriptDir, 'endpoint-status.stderr.txt'), statusProbe.stderr),
    factoryStatusStdout: writeTranscript(path.join(transcriptDir, 'factory-status.stdout.txt'), factoryStatusProbe.stdout),
    factoryStatusStderr: writeTranscript(path.join(transcriptDir, 'factory-status.stderr.txt'), factoryStatusProbe.stderr),
  };
  const capabilities = [
    ...new Set([
      ...parseEndpointCapabilities(statusProbe.stdout),
      ...parseEndpointCapabilities(factoryStatusProbe.stdout),
    ]),
  ];
  const requestEncoded = fs.readFileSync(requestLinePath, 'utf8').trim().split(/\t/)[1] || '';
  const attempts = [];
  let resultLine = parseResultLine(`${statusProbe.stdout}\n${statusProbe.stderr}`);
  let factoryResultLine = parseFactoryResultLine(`${factoryStatusProbe.stdout}\n${factoryStatusProbe.stderr}`);
  let factoryAttempt = null;
  if (!resultLine && capabilities.includes(requiredFactoryCapability)) {
    const factoryLine = buildFactoryRequestLine();
    const factoryEncoded = factoryLine.trim().split(/\t/)[1] || '';
    const remote = [
      'set -u',
      'tmp="$(mktemp /tmp/brik64-l6plus-pcd-artifact-factory-request.XXXXXX.line)"',
      `printf '%s\\n' '${factoryRequestMarker}\t${factoryEncoded}' > "$tmp"`,
      `${wrapper} artifact-factory-materialize "@@FILE:$tmp" || true`,
      'rm -f "$tmp"',
    ].join('; ');
    const executed = ssh(remote);
    const stdoutRef = writeTranscript(path.join(transcriptDir, 'factory-attempt.stdout.txt'), executed.stdout);
    const stderrRef = writeTranscript(path.join(transcriptDir, 'factory-attempt.stderr.txt'), executed.stderr);
    factoryResultLine = parseFactoryResultLine(`${executed.stdout}\n${executed.stderr}`);
    resultLine = parseResultLine(`${executed.stdout}\n${executed.stderr}`)
      || parseEmbeddedFunctionalResultLine(factoryResultLine)
      || resultLine;
    factoryAttempt = {
      command: [wrapper, 'artifact-factory-materialize', '@@FILE:<pcd-artifact-factory-request-line>'],
      status: executed.status,
      stdout_sha256: stdoutRef.sha256,
      stderr_sha256: stderrRef.sha256,
      stdoutTranscript: stdoutRef,
      stderrTranscript: stderrRef,
      factoryResultLineObserved: Boolean(factoryResultLine),
      functionalCliStageResultLineObserved: Boolean(parseResultLine(`${executed.stdout}\n${executed.stderr}`) || parseEmbeddedFunctionalResultLine(factoryResultLine)),
    };
  }
  for (const [index, command] of attemptedRemoteCommands.entries()) {
    if (resultLine) break;
    const remote = [
      'set -u',
      'tmp="$(mktemp /tmp/brik64-beta17-functional-cli-stage-request.XXXXXX.line)"',
      `printf '%s\\n' 'BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_REQUEST\t${requestEncoded}' > "$tmp"`,
      `${wrapper} ${command} "@@FILE:$tmp" || true`,
      'rm -f "$tmp"',
    ].join('; ');
    const executed = ssh(remote);
    const stdoutRef = writeTranscript(path.join(transcriptDir, `remote-attempt-${index + 1}.stdout.txt`), executed.stdout);
    const stderrRef = writeTranscript(path.join(transcriptDir, `remote-attempt-${index + 1}.stderr.txt`), executed.stderr);
    const observedResultLine = parseResultLine(`${executed.stdout}\n${executed.stderr}`);
    attempts.push({
      command: [wrapper, command, '@@FILE:<functional-cli-stage-request-line>'],
      status: executed.status,
      stdout_sha256: stdoutRef.sha256,
      stderr_sha256: stderrRef.sha256,
      stdoutTranscript: stdoutRef,
      stderrTranscript: stderrRef,
      resultLineObserved: Boolean(observedResultLine),
    });
    if (observedResultLine) resultLine = observedResultLine;
  }
  return {
    skipped: false,
    endpointCapabilities: capabilities,
    requiredFactoryCapability,
    factoryAttempt,
    factoryResultLineObserved: Boolean(factoryResultLine),
    attempts,
    resultLine,
    transcripts,
  };
}

function main() {
  fs.rmSync(evidenceDir, { recursive: true, force: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  const blockers = [];
  const requestLineExists = fs.existsSync(requestLinePath);
  const requestManifestExists = fs.existsSync(requestManifestPath);
  if (!requestLineExists) blockers.push(`missing_functional_cli_stage_request_line:${rel(requestLinePath)}`);
  if (!requestManifestExists) blockers.push(`missing_functional_cli_stage_request_manifest:${rel(requestManifestPath)}`);

  const explicitResultLine = readSuppliedResultLine();
  const remoteAttempt = explicitResultLine ? null : tryRemoteRequest();
  const resultLine = explicitResultLine || remoteAttempt?.resultLine || null;
  let result = null;
  let validation = { accepted: false, blockers: [] };
  let hydration = null;
  if (!resultLine) {
    blockers.push('functional_cli_stage_result_unavailable');
    if (remoteAttempt && !remoteAttempt.skipped) {
      const capabilities = remoteAttempt.endpointCapabilities || [];
      if (!capabilities.includes(requiredEndpointCapability)) {
        blockers.push(`remote_l6plus_functional_cli_stage_endpoint_missing:${capabilities.length ? capabilities.join(',') : 'missing'}`);
      }
      if (capabilities.includes(requiredFactoryCapability) && remoteAttempt.factoryResultLineObserved) {
        blockers.push('remote_l6plus_factory_result_not_functional_cli_stage_result');
      }
      if ((remoteAttempt.attempts || []).length > 0 && !remoteAttempt.attempts.some((attempt) => attempt.resultLineObserved)) {
        blockers.push('remote_l6plus_functional_cli_stage_result_not_emitted');
      }
    }
  } else {
    result = parseFunctionalCliStageResult(resultLine);
    if (!result) {
      blockers.push('functional_cli_stage_result_parse_failed');
    } else {
      validation = validateFunctionalCliStageResult(result, loadExpected());
      if (!validation.accepted) blockers.push(...validation.blockers);
    }
  }

  if (requestLineExists && requestManifestExists && validation.accepted && resultLine) {
    writeText(defaultResultLinePath, resultLine.endsWith('\n') ? resultLine : `${resultLine}\n`);
    const hydrate = runHydration();
    hydration = {
      status: hydrate.status === null ? 1 : hydrate.status,
      stdout_sha256: sha256(hydrate.stdout || ''),
      stderr_sha256: sha256(hydrate.stderr || ''),
      stdout: (hydrate.stdout || '').slice(0, 1000),
      stderr: (hydrate.stderr || '').slice(0, 1000),
    };
    if (hydration.status !== 0) blockers.push(`functional_cli_stage_hydration_failed:${hydration.status}`);
  }

  const accepted = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_functional_cli_stage_attempt.v1',
    generatedAt: new Date().toISOString(),
    version: '0.1.0-beta.17',
    decision: accepted
      ? 'PASS_BETA17_FUNCTIONAL_CLI_STAGE_ATTEMPT'
      : 'BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_ATTEMPT',
    hydrated: accepted,
    publicationAllowed: false,
    claimBoundary: closedClaimBoundary(),
    request: requestLineExists
      ? {
          requestLine: fileRef(requestLinePath),
          requestManifest: requestManifestExists ? fileRef(requestManifestPath) : null,
        }
      : null,
    result: resultLine
      ? {
          source: explicitResultLine
            ? suppliedResultLinePath || (fs.existsSync(defaultResultLinePath) ? rel(defaultResultLinePath) : 'inline')
            : 'remote-l6plus-attempt',
          sha256: sha256(resultLine),
          parsed: Boolean(result),
          validation,
        }
      : null,
    remoteAttempt,
    remoteEndpointContract: {
      requiredEndpointCapability,
      attemptedRemoteCommands,
      requiredResultMarker: resultMarker,
      nonAcceptableSubstitutes: [
        'healthy L6+N5 host without functional CLI stage endpoint',
        'beta15.7 or beta16 materializer readiness endpoints',
        'metadata-only Beta17 stage artifact result',
        'manual artifact patch without L6+N5 result line',
      ],
    },
    hydration,
    blockers: [...new Set(blockers)],
    nextAction: accepted
      ? 'run package:beta17:fixpoint:candidate, gate:beta17:fixpoint:functional-stage-artifact and preflight:beta17:fixpoint:publication'
      : 'obtain a valid BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT from L6+N5 and rerun attempt:beta17:functional-cli-stage',
  };
  writeJson(path.join(evidenceDir, 'report.json'), report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${rel(path.join(evidenceDir, 'report.json'))}`);
  if (!accepted) for (const blocker of report.blockers) console.error(blocker);
  process.exit(accepted ? 0 : 2);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`beta17_functional_cli_stage_attempt_fail_closed:${error.message}`);
    process.exit(2);
  }
}

module.exports = {
  loadExpected,
  closedClaimBoundary,
  attemptedRemoteCommands,
  requiredEndpointCapability,
  parseEndpointCapabilities,
};
