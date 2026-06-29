#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'l6plus-pcd-artifact-factory-audit');
const reportPath = path.join(outDir, 'report.json');
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const wrapper = process.env.BRIK64_L6_WRAPPER || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const skipRemote = process.env.BRIK64_L6_SKIP_REMOTE === '1';
const fixtureStatusFile = argValue('--fixture-status-file', '');
const requiredCapability = 'l6plus_pcd_artifact_factory';
const requiredResultMarker = 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT';
const probeCommands = [
  ['artifact-factory-status'],
  ['pcd-artifact-factory-status'],
  ['factory-status'],
  ['materialize', '--help'],
  ['endpoint-status'],
];

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value || '');
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

function ssh(args) {
  if (skipRemote) {
    return { status: 65, stdout: '', stderr: 'remote probe skipped by BRIK64_L6_SKIP_REMOTE=1' };
  }
  return run('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    host,
    [wrapper, ...args.map((arg) => `'${String(arg).replace(/'/g, `'\\''`)}'`)].join(' '),
  ]);
}

function parseCapabilities(text) {
  const capabilities = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    const endpoint = line.match(/^BRIK64_L6_CLI_MATERIALIZER_ENDPOINT(?:\t|\\t)installed(?:\t|\\t)(.+)$/);
    const factory = line.match(/^BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY(?:\t|\\t)(?:installed|available)(?:\t|\\t)(.+)$/);
    for (const match of [endpoint, factory]) {
      if (!match) continue;
      for (const item of match[1].split(',')) {
        const trimmed = item.trim();
        if (trimmed) capabilities.add(trimmed);
      }
    }
    if (line.includes(requiredCapability)) capabilities.add(requiredCapability);
  }
  return [...capabilities].sort();
}

function hasResultMarker(text) {
  return String(text || '').includes(requiredResultMarker);
}

function transcriptRef(file) {
  return {
    path: rel(file),
    sha256: sha256(fs.readFileSync(file)),
    bytes: fs.statSync(file).size,
  };
}

function collectProbeOutputs() {
  if (fixtureStatusFile) {
    const body = fs.readFileSync(fixtureStatusFile, 'utf8');
    return [{
      command: ['fixture-status-file', fixtureStatusFile],
      status: 0,
      stdout: body,
      stderr: '',
    }];
  }
  return probeCommands.map((args) => ({
    command: [wrapper, ...args],
    ...ssh(args),
  }));
}

function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const transcriptDir = path.join(outDir, 'transcripts');
  const outputs = collectProbeOutputs();
  const probes = outputs.map((probe, index) => {
    const stdoutFile = path.join(transcriptDir, `probe-${index + 1}.stdout.txt`);
    const stderrFile = path.join(transcriptDir, `probe-${index + 1}.stderr.txt`);
    writeText(stdoutFile, probe.stdout);
    writeText(stderrFile, probe.stderr);
    const combined = `${probe.stdout}\n${probe.stderr}`;
    return {
      command: probe.command,
      status: probe.status,
      stdoutTranscript: transcriptRef(stdoutFile),
      stderrTranscript: transcriptRef(stderrFile),
      capabilities: parseCapabilities(combined),
      resultMarkerObserved: hasResultMarker(combined),
      unsupported: /unsupported_or_missing_input|unsupported/i.test(combined),
    };
  });
  const observedCapabilities = [...new Set(probes.flatMap((probe) => probe.capabilities))].sort();
  const blockers = [];
  if (!observedCapabilities.includes(requiredCapability)) {
    blockers.push(`l6plus_pcd_artifact_factory_capability_missing:${observedCapabilities.length ? observedCapabilities.join(',') : 'missing'}`);
  }
  if (!probes.some((probe) => probe.resultMarkerObserved)) {
    blockers.push(`l6plus_pcd_artifact_factory_result_marker_missing:${requiredResultMarker}`);
  }
  if (probes.some((probe) => probe.command.includes('factory-status') && probe.unsupported)) {
    blockers.push('l6plus_factory_status_unsupported');
  }
  const accepted = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.l6plus_pcd_artifact_factory_audit.v1',
    version: '0.1.0-beta.17',
    generatedAt: new Date().toISOString(),
    decision: accepted
      ? 'PASS_L6PLUS_PCD_ARTIFACT_FACTORY_AUDIT'
      : 'BLOCKED_L6PLUS_PCD_ARTIFACT_FACTORY_AUDIT',
    host,
    wrapper,
    skippedRemote: skipRemote,
    requiredCapability,
    requiredResultMarker,
    observedCapabilities,
    probes,
    blockers,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    nextAction: accepted
      ? 'route Beta17 functional CLI request through l6plus_pcd_artifact_factory'
      : 'replace version-specific wrapper routing with a general l6plus_pcd_artifact_factory capability before Beta17 materialization',
  };
  writeJson(reportPath, report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${rel(reportPath)}`);
  if (!accepted) for (const blocker of blockers) console.error(blocker);
  process.exit(accepted ? 0 : 2);
}

if (require.main === module) main();

module.exports = {
  parseCapabilities,
  requiredCapability,
  requiredResultMarker,
};
