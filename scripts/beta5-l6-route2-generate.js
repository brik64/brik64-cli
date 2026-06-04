#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const remoteWork = process.env.BRIK64_L6_ROUTE2_WORK || `/tmp/brik64-cli-beta5-l6-route2-${Date.now()}`;
const outDir = path.join(root, 'evidence', 'beta5-l6-route2');
const pcdFile = path.join(root, 'pcd', 'cli_beta5_route2.pcd');
const fixturesFile = path.join(outDir, 'fixtures.json');
const localGeneratedDir = path.join(outDir, 'generated');
const l6Binary = '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(file) {
  return fs.readFileSync(file);
}

function writeJson(file, value) {
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
  const sourceHash = sha256(sourceBuffer);
  const sheet = {
    schemaVersion: 'brik64.l6plus.technical_sheet.v1',
    engine_id: 'l6_plus',
    claimAuthority: 'non_claim',
    public_claim_allowed: false,
    sourceHash,
    boundedDomains: { command_id: { kind: 'integer', min: 0, max: 99 } },
    normalization: {
      status: 'already_normalized',
      l5CertificateInheritance: 'forbidden',
      separatesRawAndNormalized: true
    },
    monomerTrace: [{ id: 1, family: 'control', op: 'BOUNDED_BRANCH_TABLE' }],
    externalBoundaries: [],
    certificationLane: 'INTERNAL_COMPARISON',
    phi_c: 1,
    canonical: true
  };
  sheet.technicalSheetHash = sha256(JSON.stringify(sheet, Object.keys(sheet).sort()));
  return sheet;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(localGeneratedDir, { recursive: true });
  const pcd = read(pcdFile);
  const sheetFile = path.join(outDir, 'technical-sheet.json');
  writeJson(sheetFile, technicalSheet(pcd));

  ssh(`rm -rf '${remoteWork}' && mkdir -p '${remoteWork}/out'`);
  scpTo(pcdFile, `${remoteWork}/logic.pcd`);
  scpTo(fixturesFile, `${remoteWork}/fixtures.json`);
  scpTo(sheetFile, `${remoteWork}/technical-sheet.json`);

  const remoteCommand = [
    'set -euo pipefail',
    `${l6Binary} --technical-sheet '${remoteWork}/technical-sheet.json' build '${remoteWork}/logic.pcd' --target js --output '${remoteWork}/out' --emit-tests node-test --test-fixtures '${remoteWork}/fixtures.json' > '${remoteWork}/stdout.txt' 2> '${remoteWork}/stderr.txt'`,
    `node '${remoteWork}/out/brik_cli_beta5_route2.test.js' >> '${remoteWork}/stdout.txt' 2>> '${remoteWork}/stderr.txt'`,
    `sha256sum '${remoteWork}'/out/* > '${remoteWork}/SHA256SUMS'`
  ].join('\n');
  ssh(remoteCommand);

  for (const name of [
    'brik_cli_beta5_route2.js',
    'brik_cli_beta5_route2.test.js',
    'brik_cli_beta5_route2.tests.manifest.json',
    'brik_cli_beta5_route2.cert.json',
    'fixtures.json'
  ]) {
    scpFrom(`${remoteWork}/out/${name}`, path.join(localGeneratedDir, name));
  }
  scpFrom(`${remoteWork}/stdout.txt`, path.join(outDir, 'remote-stdout.txt'));
  scpFrom(`${remoteWork}/stderr.txt`, path.join(outDir, 'remote-stderr.txt'));
  scpFrom(`${remoteWork}/SHA256SUMS`, path.join(outDir, 'remote-SHA256SUMS'));

  const generatedFiles = fs.readdirSync(localGeneratedDir).sort().map((name) => {
    const file = path.join(localGeneratedDir, name);
    return {
      path: path.relative(root, file),
      sha256: sha256(read(file)),
      bytes: fs.statSync(file).size
    };
  });
  const report = {
    schemaVersion: 'brik64.cli_beta5_l6_route2_generation_report.v1',
    version: '0.1.0-beta.5',
    generatedAt: new Date().toISOString(),
    lane: 'internal_non_claim_l6_route2',
    decision: 'PASS_L6_ROUTE2_GENERATED',
    releaseEligible: false,
    host,
    remoteWork,
    sourcePcd: {
      path: path.relative(root, pcdFile),
      sha256: sha256(pcd)
    },
    fixtures: {
      path: path.relative(root, fixturesFile),
      sha256: sha256(read(fixturesFile))
    },
    technicalSheet: {
      path: path.relative(root, sheetFile),
      sha256: sha256(read(sheetFile))
    },
    generatedFiles,
    claimBoundary: {
      publicClaimsAllowed: false,
      n5Authorized: false,
      certifiesTests: false
    }
  };
  writeJson(path.join(outDir, 'generation-report.json'), report);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`report=${path.relative(root, path.join(outDir, 'generation-report.json'))}\n`);
}

main();
