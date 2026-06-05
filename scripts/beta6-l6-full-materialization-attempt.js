#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const remoteWork = process.env.BRIK64_L6_BETA6_MATERIALIZE_WORK || `/tmp/brik64-cli-beta6-full-materialize-${Date.now()}`;
const outDir = path.join(root, 'evidence', 'beta6-l6-full-materialization-attempt');
const sourcePcd = path.join(root, 'pcd', 'beta6_package_harness.pcd');
const contractPcd = path.join(root, 'pcd', 'l6_full_cli_generation_factory.pcd');
const fullContractReport = path.join(root, 'evidence', 'beta6-l6-full-generation-contract', 'report.json');
const hetznerReport = path.join(root, 'evidence', 'beta6-l6-hetzner-generation', 'report.json');
const technicalSheetFile = path.join(outDir, 'technical-sheet.json');
const l6Binary = '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(file) {
  return fs.readFileSync(file);
}

function rel(file) {
  return path.relative(root, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: options.encoding || 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe']
  });
}

function ssh(script) {
  return run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', host, script]);
}

function scpTo(local, remote) {
  run('scp', ['-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', local, `${host}:${remote}`], { stdio: 'ignore' });
}

function scpFrom(remote, local) {
  run('scp', ['-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', `${host}:${remote}`, local], { stdio: 'ignore' });
}

function technicalSheet(sourceBuffer) {
  const sheet = {
    schemaVersion: 'brik64.l6plus.technical_sheet.v1',
    productArtifact: 'BRIK64 CLI 0.1.0-beta.6',
    engine_id: 'l6_plus',
    claimAuthority: 'non_claim',
    public_claim_allowed: false,
    sourceHash: sha256(sourceBuffer),
    target: 'js_node',
    boundedDomains: {
      inputs_present: { kind: 'integer', min: 0, max: 1 },
      l6_ready: { kind: 'integer', min: 0, max: 1 },
      hashes_bound: { kind: 'integer', min: 0, max: 1 },
      manifests_bound: { kind: 'integer', min: 0, max: 1 }
    },
    normalization: {
      status: 'finite_boolean_domains',
      l5CertificateInheritance: 'forbidden',
      separatesRawAndNormalized: true
    },
    monomerTrace: [{ id: 1, family: 'control', op: 'FAIL_CLOSED_BRANCH_CHAIN' }],
    certificationLane: 'INTERNAL_GENERATION_ATTEMPT',
    releaseEligible: false
  };
  sheet.technicalSheetHash = sha256(JSON.stringify(sheet, Object.keys(sheet).sort()));
  return sheet;
}

function requiredInputs() {
  return [sourcePcd, contractPcd, fullContractReport, hetznerReport].map((file) => {
    if (!fs.existsSync(file)) throw new Error(`missing_materialization_input:${rel(file)}`);
    return {
      path: rel(file),
      sha256: sha256(read(file)),
      bytes: fs.statSync(file).size
    };
  });
}

function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const inputs = requiredInputs();
  writeJson(technicalSheetFile, technicalSheet(read(sourcePcd)));

  ssh(`rm -rf '${remoteWork}' && mkdir -p '${remoteWork}/out'`);
  scpTo(sourcePcd, `${remoteWork}/beta6_package_harness.pcd`);
  scpTo(technicalSheetFile, `${remoteWork}/technical-sheet.json`);

  const remoteScript = [
    'set +e',
    `echo "REMOTE_HOST=$(hostname)" > '${remoteWork}/stdout.txt'`,
    `echo "REMOTE_L6_VERSION=$(${l6Binary} --l6plus-version 2>&1 | tr '\\n' ';')" >> '${remoteWork}/stdout.txt'`,
    `${l6Binary} --technical-sheet '${remoteWork}/technical-sheet.json' build '${remoteWork}/beta6_package_harness.pcd' --target js --output '${remoteWork}/out' >> '${remoteWork}/stdout.txt' 2> '${remoteWork}/stderr.txt'`,
    'rc=$?',
    `echo "$rc" > '${remoteWork}/rc.txt'`,
    `find '${remoteWork}/out' -maxdepth 2 -type f -print > '${remoteWork}/out-files.txt'`,
    `if [ -n "$(cat '${remoteWork}/out-files.txt')" ]; then sha256sum $(cat '${remoteWork}/out-files.txt') > '${remoteWork}/SHA256SUMS'; else : > '${remoteWork}/SHA256SUMS'; fi`,
    'exit 0'
  ].join('\n');
  ssh(remoteScript);

  const localFiles = {
    stdout: path.join(outDir, 'remote-stdout.txt'),
    stderr: path.join(outDir, 'remote-stderr.txt'),
    rc: path.join(outDir, 'remote-rc.txt'),
    outFiles: path.join(outDir, 'remote-out-files.txt'),
    sha256sums: path.join(outDir, 'remote-SHA256SUMS')
  };
  scpFrom(`${remoteWork}/stdout.txt`, localFiles.stdout);
  scpFrom(`${remoteWork}/stderr.txt`, localFiles.stderr);
  scpFrom(`${remoteWork}/rc.txt`, localFiles.rc);
  scpFrom(`${remoteWork}/out-files.txt`, localFiles.outFiles);
  scpFrom(`${remoteWork}/SHA256SUMS`, localFiles.sha256sums);

  const rc = Number(fs.readFileSync(localFiles.rc, 'utf8').trim());
  const stderr = fs.readFileSync(localFiles.stderr, 'utf8');
  const stdout = fs.readFileSync(localFiles.stdout, 'utf8');
  const remoteOutFiles = fs.readFileSync(localFiles.outFiles, 'utf8').split('\n').filter(Boolean);
  const blockers = [];
  if (rc !== 0) blockers.push('l6_full_cli_harness_materialization_failed');
  if (/route-2 bounded emitter currently supports exactly one parameter|general compile\/certify path is fail-closed|route2_bounded_only/i.test(stderr + stdout)) {
    blockers.push('l6_general_compile_route2_bounded_only');
  }
  if (remoteOutFiles.length === 0) blockers.push('l6_full_cli_harness_no_artifact_emitted');

  const decision = blockers.length === 0
    ? 'PASS_BETA6_L6_FULL_HARNESS_MATERIALIZED'
    : 'BLOCKED_BETA6_L6_FULL_HARNESS_MATERIALIZATION';
  const report = {
    schemaVersion: 'brik64.beta6_l6_full_materialization_attempt.v1',
    version: '0.1.0-beta.6',
    productArtifact: 'BRIK64 CLI 0.1.0-beta.6',
    generatedAt: new Date().toISOString(),
    lane: 'l6_full_generation_attempt_non_claim',
    host,
    remoteWork,
    decision,
    releaseEligible: false,
    inputs,
    technicalSheet: {
      path: rel(technicalSheetFile),
      sha256: sha256(read(technicalSheetFile))
    },
    remote: {
      rc,
      stdout: rel(localFiles.stdout),
      stdoutSha256: sha256(read(localFiles.stdout)),
      stderr: rel(localFiles.stderr),
      stderrSha256: sha256(read(localFiles.stderr)),
      outFiles: remoteOutFiles,
      checksums: rel(localFiles.sha256sums),
      checksumsSha256: sha256(read(localFiles.sha256sums))
    },
    blockers: [...new Set(blockers)],
    requiredNextAction: decision === 'PASS_BETA6_L6_FULL_HARNESS_MATERIALIZED'
      ? 'Bind emitted harness artifact into package/release manifest and continue beta6 artifact generation.'
      : 'Upgrade or deploy the serialized L6+N5 full-generation path so it can materialize multi-parameter BRIK64 CLI beta6 harness PCDs.'
  };
  writeJson(path.join(outDir, 'report.json'), report);
  process.stdout.write(`decision=${decision}\n`);
  process.stdout.write(`report=${rel(path.join(outDir, 'report.json'))}\n`);
  if (decision !== 'PASS_BETA6_L6_FULL_HARNESS_MATERIALIZED') {
    process.stdout.write(`blockers=${report.blockers.join(',')}\n`);
    process.exitCode = 2;
  }
}

main();
