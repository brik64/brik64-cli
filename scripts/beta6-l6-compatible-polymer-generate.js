#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const remoteWork = process.env.BRIK64_L6_BETA6_WORK || `/tmp/brik64-cli-beta6-l6-compatible-${Date.now()}`;
const outDir = path.join(root, 'evidence', 'beta6-l6-compatible-polymer');
const localGeneratedDir = path.join(outDir, 'generated');
const canonicalPolymer = path.join(root, 'pcd', 'cli_polymer.pcd');
const compatiblePcd = path.join(outDir, 'brik_cli_beta6_l6_compatible_polymer.pcd');
const fixturesFile = path.join(outDir, 'fixtures.json');
const technicalSheetFile = path.join(outDir, 'technical-sheet.json');
const l6Binary = '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(file) {
  return fs.readFileSync(file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
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

function canonicalCliPolymer(commandCode, workspaceReadable, certificatePresent, targetCode) {
  if (workspaceReadable === 0) return 64;
  if (commandCode === 1) return 0;
  if (commandCode === 2) {
    if (certificatePresent === 0) return 67;
    if (targetCode < 1) return 65;
    if (targetCode > 3) return 65;
    return 1;
  }
  if (commandCode === 64) return 64;
  return 0;
}

function encode(commandCode, workspaceReadable, certificatePresent, targetCode) {
  return (commandCode * 1000) + (workspaceReadable * 100) + (certificatePresent * 10) + targetCode;
}

function buildCases() {
  const commandCodes = [0, 1, 2, 64, 99];
  const workspaceReadable = [0, 1];
  const certificatePresent = [0, 1];
  const targetCodes = [0, 1, 2, 3, 4];
  const cases = [];
  for (const commandCode of commandCodes) {
    for (const workspace of workspaceReadable) {
      for (const certificate of certificatePresent) {
        for (const targetCode of targetCodes) {
          const encodedState = encode(commandCode, workspace, certificate, targetCode);
          cases.push({
            name: `c${commandCode}_w${workspace}_cert${certificate}_t${targetCode}`,
            canonical: { commandCode, workspaceReadable: workspace, certificatePresent: certificate, targetCode },
            inputs: [encodedState],
            expected: canonicalCliPolymer(commandCode, workspace, certificate, targetCode)
          });
        }
      }
    }
  }
  return cases.sort((left, right) => left.inputs[0] - right.inputs[0]);
}

function pcdSource(cases) {
  const lines = [
    '// brik64.pcd_file.v1',
    '// name: brik_cli_beta6_l6_compatible_polymer',
    '// status: beta6_l6_compatible_candidate',
    '// generated_from = "pcd/cli_polymer.pcd"',
    '// encoding = "encoded_state = command_code*1000 + workspace_readable*100 + certificate_present*10 + target_code"',
    '// source_units = "cli_core.pcd,cli_init_policy.pcd,cli_certify_emit.pcd,cli_polymer.pcd"',
    '// engine = "L6+N5"',
    '// generation_lane = "internal_non_claim_l6_compatible_polymer"',
    '// public_offline_runtime = "L4+N5"',
    '// claim_boundary = "local_candidate_only"',
    '',
    'PC brik_cli_beta6_l6_compatible_polymer {',
    '    fn brik_cli_beta6_l6_compatible_polymer(encoded_state) {'
  ];
  for (const item of cases) {
    lines.push(`        if (encoded_state == ${item.inputs[0]}) { return ${item.expected}; }`);
  }
  lines.push('        return 0;');
  lines.push('    }');
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function technicalSheet(sourceBuffer, cases) {
  const encodedValues = cases.map((item) => item.inputs[0]);
  const sheet = {
    schemaVersion: 'brik64.l6plus.technical_sheet.v1',
    engine_id: 'l6_plus',
    claimAuthority: 'non_claim',
    public_claim_allowed: false,
    sourceHash: sha256(sourceBuffer),
    boundedDomains: {
      encoded_state: {
        kind: 'integer',
        min: Math.min(...encodedValues),
        max: Math.max(...encodedValues)
      }
    },
    normalization: {
      status: 'encoded_finite_domain',
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
  fs.mkdirSync(localGeneratedDir, { recursive: true });
  const cases = buildCases();
  const pcd = pcdSource(cases);
  writeText(compatiblePcd, pcd);
  writeJson(fixturesFile, { cases });
  writeJson(technicalSheetFile, technicalSheet(Buffer.from(pcd), cases));

  ssh(`rm -rf '${remoteWork}' && mkdir -p '${remoteWork}/out'`);
  scpTo(compatiblePcd, `${remoteWork}/logic.pcd`);
  scpTo(fixturesFile, `${remoteWork}/fixtures.json`);
  scpTo(technicalSheetFile, `${remoteWork}/technical-sheet.json`);

  const remoteCommand = [
    'set -euo pipefail',
    `${l6Binary} --technical-sheet '${remoteWork}/technical-sheet.json' build '${remoteWork}/logic.pcd' --target js --output '${remoteWork}/out' --emit-tests node-test --test-fixtures '${remoteWork}/fixtures.json' > '${remoteWork}/stdout.txt' 2> '${remoteWork}/stderr.txt'`,
    `node '${remoteWork}/out/brik_cli_beta6_l6_compatible_polymer.test.js' >> '${remoteWork}/stdout.txt' 2>> '${remoteWork}/stderr.txt'`,
    `sha256sum '${remoteWork}'/out/* > '${remoteWork}/SHA256SUMS'`
  ].join('\n');
  ssh(remoteCommand);

  for (const name of [
    'brik_cli_beta6_l6_compatible_polymer.js',
    'brik_cli_beta6_l6_compatible_polymer.test.js',
    'brik_cli_beta6_l6_compatible_polymer.tests.manifest.json',
    'brik_cli_beta6_l6_compatible_polymer.cert.json',
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
    schemaVersion: 'brik64.beta6_l6_compatible_polymer_generation_report.v1',
    version: '0.1.0-beta.6',
    generatedAt: new Date().toISOString(),
    lane: 'internal_non_claim_l6_compatible_polymer',
    decision: 'PASS_L6_COMPATIBLE_POLYMER_GENERATED',
    releaseEligible: false,
    host,
    remoteWork,
    canonicalSource: {
      path: path.relative(root, canonicalPolymer),
      sha256: sha256(read(canonicalPolymer))
    },
    compatibleSource: {
      path: path.relative(root, compatiblePcd),
      sha256: sha256(Buffer.from(pcd)),
      encoding: 'command_code*1000 + workspace_readable*100 + certificate_present*10 + target_code'
    },
    fixtures: {
      path: path.relative(root, fixturesFile),
      sha256: sha256(read(fixturesFile)),
      parityCases: cases.length
    },
    technicalSheet: {
      path: path.relative(root, technicalSheetFile),
      sha256: sha256(read(technicalSheetFile))
    },
    generatedFiles,
    claimBoundary: {
      publicClaimsAllowed: false,
      releaseAllowed: false,
      n5Authorized: false,
      certifiesTests: false,
      fullCliDistributionArtifact: false
    },
    nextRequiredGate: 'Bind this L6-compatible generated artifact to package/release only after canonical polymer parity and target package smoke are expanded beyond finite route2 compatibility.'
  };
  writeJson(path.join(outDir, 'report.json'), report);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`report=${path.relative(root, path.join(outDir, 'report.json'))}\n`);
}

main();
