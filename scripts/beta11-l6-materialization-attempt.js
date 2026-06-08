#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const remoteWork = process.env.BRIK64_L6_BETA11_MATERIALIZE_WORK || `/tmp/brik64-cli-beta11-materialize-${Date.now()}`;
const outDir = path.join(root, 'evidence', 'beta11-l6-materialization');
const reportFile = path.join(outDir, 'report.json');
const technicalSheetFile = path.join(outDir, 'technical-sheet.json');
const generatedDir = path.join(outDir, 'generated');
const sourcePcd = path.join(root, 'pcd', 'cli_beta11_semantic_polymer_contract.pcd');
const adversarialReport = path.join(root, 'evidence', 'beta11-adversarial', 'report.json');
const l6Binary = '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';
const l6SerialPath = '/opt/brik64/engines/l6plus-n5/current/serial.txt';

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return `sha256:${sha256Buffer(fs.readFileSync(file))}`;
}

function sha256Json(value) {
  return `sha256:${sha256Buffer(JSON.stringify(value))}`;
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

function pcdInventory() {
  const dir = path.join(root, 'pcd');
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.pcd'))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      return { path: rel(file), sha256: sha256File(file) };
    });
}

function technicalSheet() {
  const sheet = {
    schemaVersion: 'brik64.l6plus.technical_sheet.v1',
    productArtifact: 'BRIK64 CLI 0.1.0-beta.11',
    engine_id: 'l6_plus',
    claimAuthority: 'non_claim',
    public_claim_allowed: false,
    sourceHash: sha256File(sourcePcd).replace(/^sha256:/, ''),
    target: 'js_node',
    boundedDomains: {
      semantic_polymer_ok: { kind: 'integer', min: 0, max: 1 },
      fail_closed_ok: { kind: 'integer', min: 0, max: 1 },
      manifest_ok: { kind: 'integer', min: 0, max: 1 },
      audit_ok: { kind: 'integer', min: 0, max: 1 },
      release_ok: { kind: 'integer', min: 0, max: 1 }
    },
    normalization: {
      status: 'finite_boolean_domains',
      l5CertificateInheritance: 'forbidden',
      separatesRawAndNormalized: true
    },
    monomerTrace: [{ id: 1, family: 'control', op: 'FAIL_CLOSED_BRANCH_CHAIN' }],
    certificationLane: 'INTERNAL_BETA11_GENERATION_ATTEMPT',
    releaseEligible: false
  };
  sheet.technicalSheetHash = sha256Buffer(JSON.stringify(sheet, Object.keys(sheet).sort()));
  return sheet;
}

function blockedReport(blocker, extra = {}) {
  return {
    schemaVersion: 'brik64.beta11_pcd_l6_materialization_report.v1',
    generatedAt: new Date().toISOString(),
    decision: 'BLOCKED_BETA11_PCD_L6_MATERIALIZATION',
    version: '0.1.0-beta.11',
    lane: 'cli_0_1_beta11',
    generationClaim: 'assisted_generation_non_claim',
    releaseEligible: false,
    blockers: [blocker],
    claimBoundary: {
      publicClaimsAllowed: false,
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
      pureBrik64ChainClaimAllowed: false
    },
    ...extra
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(generatedDir, { recursive: true, force: true });
  fs.mkdirSync(generatedDir, { recursive: true });
  for (const file of [sourcePcd, adversarialReport]) {
    if (!fs.existsSync(file)) {
      writeJson(reportFile, blockedReport(`missing_input:${rel(file)}`));
      process.exit(2);
    }
  }

  const inventory = pcdInventory();
  const expectedHashes = {
    pcdInventoryHash: sha256Json(inventory),
    beta11ContractHash: sha256File(sourcePcd),
    adversarialReportHash: sha256File(adversarialReport)
  };
  writeJson(technicalSheetFile, technicalSheet());

  try {
    ssh(`rm -rf '${remoteWork}' && mkdir -p '${remoteWork}/out'`);
    scpTo(sourcePcd, `${remoteWork}/cli_beta11_semantic_polymer_contract.pcd`);
    scpTo(technicalSheetFile, `${remoteWork}/technical-sheet.json`);
  } catch (error) {
    writeJson(reportFile, blockedReport('l6_remote_access_failed', {
      host,
      remoteWork,
      remote: { error: String(error.message || error).slice(0, 500) },
      hashes: expectedHashes,
      inputs: { pcdInventory: inventory }
    }));
    process.stdout.write(`decision=BLOCKED_BETA11_PCD_L6_MATERIALIZATION\nreport=${rel(reportFile)}\nblockers=l6_remote_access_failed\n`);
    process.exit(2);
  }

  const remoteScript = [
    'set +e',
    `echo "REMOTE_HOST=$(hostname)" > '${remoteWork}/stdout.txt'`,
    `echo "REMOTE_L6_SERIAL=$(cat '${l6SerialPath}' 2>/dev/null)" >> '${remoteWork}/stdout.txt'`,
    `echo "REMOTE_L6_VERSION=$(${l6Binary} --l6plus-version 2>&1 | tr '\\n' ';')" >> '${remoteWork}/stdout.txt'`,
    `${l6Binary} --technical-sheet '${remoteWork}/technical-sheet.json' build '${remoteWork}/cli_beta11_semantic_polymer_contract.pcd' --target js --output '${remoteWork}/out' >> '${remoteWork}/stdout.txt' 2> '${remoteWork}/stderr.txt'`,
    'rc=$?',
    `echo "$rc" > '${remoteWork}/rc.txt'`,
    `find '${remoteWork}/out' -maxdepth 2 -type f -print | sort > '${remoteWork}/out-files.txt'`,
    `if [ -s '${remoteWork}/out-files.txt' ]; then sha256sum $(cat '${remoteWork}/out-files.txt') > '${remoteWork}/SHA256SUMS'; else : > '${remoteWork}/SHA256SUMS'; fi`,
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
  const stdout = fs.readFileSync(localFiles.stdout, 'utf8');
  const stderr = fs.readFileSync(localFiles.stderr, 'utf8');
  const remoteOutFiles = fs.readFileSync(localFiles.outFiles, 'utf8').split('\n').filter(Boolean);
  const generatedFiles = [];
  for (const remoteFile of remoteOutFiles) {
    const localName = path.basename(remoteFile);
    const localFile = path.join(generatedDir, localName);
    scpFrom(remoteFile, localFile);
    generatedFiles.push({ path: rel(localFile), sha256: sha256File(localFile), bytes: fs.statSync(localFile).size });
  }
  const jsArtifact = generatedFiles.find((file) => file.path.endsWith('.js'));
  const certArtifact = generatedFiles.find((file) => file.path.endsWith('.cert.json'));
  const blockers = [];
  if (rc !== 0) blockers.push('l6_beta11_contract_materialization_failed');
  if (!jsArtifact) blockers.push('l6_beta11_generated_js_missing');
  if (!certArtifact) blockers.push('l6_beta11_generated_cert_missing');

  const report = {
    schemaVersion: 'brik64.beta11_pcd_l6_materialization_report.v1',
    generatedAt: new Date().toISOString(),
    decision: blockers.length === 0 ? 'PASS_BETA11_PCD_L6_MATERIALIZATION' : 'BLOCKED_BETA11_PCD_L6_MATERIALIZATION',
    version: '0.1.0-beta.11',
    lane: 'cli_0_1_beta11',
    generationClaim: 'assisted_generation_non_claim',
    releaseEligible: false,
    blockers,
    factory: {
      host,
      serial: (stdout.match(/BRIK64-L6PLUS-N5-[A-Za-z0-9-]+/) || [null])[0],
      stdout: rel(localFiles.stdout),
      stderr: rel(localFiles.stderr),
      rc
    },
    hashes: {
      ...expectedHashes,
      generatedArtifactHash: jsArtifact?.sha256 || null,
      generatedCertificateHash: certArtifact?.sha256 || null
    },
    generatedFiles,
    inputs: { pcdInventory: inventory },
    claimBoundary: {
      publicClaimsAllowed: false,
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
      pureBrik64ChainClaimAllowed: false
    }
  };
  writeJson(reportFile, report);
  process.stdout.write(`decision=${report.decision}\nreport=${rel(reportFile)}\n`);
  if (blockers.length) {
    process.stdout.write(`blockers=${blockers.join(',')}\n`);
    process.exit(2);
  }
}

main();
