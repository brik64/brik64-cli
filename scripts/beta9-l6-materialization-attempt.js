#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const remoteWork = process.env.BRIK64_L6_BETA9_MATERIALIZE_WORK || `/tmp/brik64-cli-beta9-materialize-${Date.now()}`;
const outDir = path.join(root, 'evidence', 'beta9-l6-materialization');
const reportFile = path.join(outDir, 'report.json');
const technicalSheetFile = path.join(outDir, 'technical-sheet.json');
const localGeneratedDir = path.join(outDir, 'generated');
const sourcePcd = path.join(root, 'pcd', 'cli_beta9_transpiler_contract.pcd');
const polymerPcd = path.join(root, 'pcd', 'cli_polymer.pcd');
const l6Binary = '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return `sha256:${sha256Buffer(fs.readFileSync(file))}`;
}

function sha256Json(value) {
  return `sha256:${sha256Buffer(JSON.stringify(value))}`;
}

function hashGeneratedFiles(files) {
  return `sha256:${sha256Buffer(JSON.stringify(files.map((file) => ({
    path: file.path,
    sha256: file.sha256,
    bytes: file.bytes
  }))))}`;
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
  const sourceHash = sha256File(sourcePcd).replace(/^sha256:/, '');
  const sheet = {
    schemaVersion: 'brik64.l6plus.technical_sheet.v1',
    productArtifact: 'BRIK64 CLI 0.1.0-beta.9',
    engine_id: 'l6_plus',
    claimAuthority: 'non_claim',
    public_claim_allowed: false,
    sourceHash,
    target: 'js_node',
    boundedDomains: {
      collections_ok: { kind: 'integer', min: 0, max: 1 },
      loops_bounded: { kind: 'integer', min: 0, max: 1 },
      types_ok: { kind: 'integer', min: 0, max: 1 },
      imports_ok: { kind: 'integer', min: 0, max: 1 },
      scaffolds_ok: { kind: 'integer', min: 0, max: 1 },
      gate_env_ok: { kind: 'integer', min: 0, max: 1 },
      l6_materialized: { kind: 'integer', min: 0, max: 1 },
      typed_interface_ok: { kind: 'integer', min: 0, max: 1 },
      list_subset_ok: { kind: 'integer', min: 0, max: 1 },
      map_subset_ok: { kind: 'integer', min: 0, max: 1 },
      repeat_subset_ok: { kind: 'integer', min: 0, max: 1 },
      target_scaffolds_ok: { kind: 'integer', min: 0, max: 1 },
      local_imports_ok: { kind: 'integer', min: 0, max: 1 },
      doctor_ok: { kind: 'integer', min: 0, max: 1 },
      release_readiness_ok: { kind: 'integer', min: 0, max: 1 }
    },
    normalization: {
      status: 'finite_boolean_domains',
      l5CertificateInheritance: 'forbidden',
      separatesRawAndNormalized: true
    },
    monomerTrace: [{ id: 1, family: 'control', op: 'FAIL_CLOSED_BRANCH_CHAIN' }],
    certificationLane: 'INTERNAL_BETA9_GENERATION_ATTEMPT',
    releaseEligible: false
  };
  sheet.technicalSheetHash = sha256Buffer(JSON.stringify(sheet, Object.keys(sheet).sort()));
  return sheet;
}

function emptyBlockedReport(blocker, extra = {}) {
  return {
    schemaVersion: 'brik64.beta9_pcd_l6_materialization_report.v1',
    generatedAt: new Date().toISOString(),
    decision: 'BLOCKED_BETA9_PCD_L6_MATERIALIZATION',
    version: '0.1.0-beta.9',
    lane: 'cli_0_1_beta',
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
  fs.rmSync(localGeneratedDir, { recursive: true, force: true });
  fs.mkdirSync(localGeneratedDir, { recursive: true });
  for (const file of [sourcePcd, polymerPcd]) {
    if (!fs.existsSync(file)) {
      writeJson(reportFile, emptyBlockedReport(`missing_input:${rel(file)}`));
      process.exit(2);
    }
  }

  const inventory = pcdInventory();
  const expectedHashes = {
    pcdInventoryHash: sha256Json(inventory),
    cliPolymerHash: sha256File(polymerPcd),
    beta9ContractHash: sha256File(sourcePcd)
  };
  writeJson(technicalSheetFile, technicalSheet());

  let sshSetupOk = false;
  try {
    ssh(`rm -rf '${remoteWork}' && mkdir -p '${remoteWork}/out'`);
    sshSetupOk = true;
    scpTo(sourcePcd, `${remoteWork}/cli_beta9_transpiler_contract.pcd`);
    scpTo(polymerPcd, `${remoteWork}/cli_polymer.pcd`);
    scpTo(technicalSheetFile, `${remoteWork}/technical-sheet.json`);
  } catch (error) {
    writeJson(reportFile, emptyBlockedReport('l6_remote_access_failed', {
      host,
      remoteWork,
      remote: {
        setupOk: sshSetupOk,
        error: String(error.message || error).slice(0, 500)
      },
      hashes: expectedHashes,
      inputs: { pcdInventory: inventory }
    }));
    process.stdout.write(`decision=BLOCKED_BETA9_PCD_L6_MATERIALIZATION\nreport=${rel(reportFile)}\nblockers=l6_remote_access_failed\n`);
    process.exit(2);
  }

  const remoteScript = [
    'set +e',
    `echo "REMOTE_HOST=$(hostname)" > '${remoteWork}/stdout.txt'`,
    `echo "REMOTE_L6_VERSION=$(${l6Binary} --l6plus-version 2>&1 | tr '\\n' ';')" >> '${remoteWork}/stdout.txt'`,
    `${l6Binary} --technical-sheet '${remoteWork}/technical-sheet.json' build '${remoteWork}/cli_beta9_transpiler_contract.pcd' --target js --output '${remoteWork}/out' >> '${remoteWork}/stdout.txt' 2> '${remoteWork}/stderr.txt'`,
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
    const localFile = path.join(localGeneratedDir, localName);
    scpFrom(remoteFile, localFile);
    generatedFiles.push({
      path: rel(localFile),
      sha256: sha256File(localFile),
      bytes: fs.statSync(localFile).size
    });
  }
  const blockers = [];
  if (rc !== 0) blockers.push('l6_beta9_contract_materialization_failed');
  if (/route-2 bounded emitter currently supports exactly one parameter|general compile\/certify path is fail-closed|route2_bounded_only/i.test(stderr + stdout)) {
    blockers.push('l6_general_compile_route2_bounded_only');
  }
  if (remoteOutFiles.length === 0) blockers.push('l6_beta9_no_artifact_emitted');
  blockers.push('beta9_package_hash_not_bound');
  blockers.push('beta9_release_manifest_hash_not_bound');

  const generatedArtifactHash = generatedFiles.length > 0
    ? hashGeneratedFiles(generatedFiles)
    : null;
  const decision = blockers.length === 0
    ? 'PASS_BETA9_PCD_L6_MATERIALIZATION'
    : 'BLOCKED_BETA9_PCD_L6_MATERIALIZATION';

  const report = {
    schemaVersion: 'brik64.beta9_pcd_l6_materialization_report.v1',
    generatedAt: new Date().toISOString(),
    decision,
    version: '0.1.0-beta.9',
    productArtifact: 'BRIK64 CLI 0.1.0-beta.9',
    lane: 'cli_0_1_beta',
    generationClaim: 'assisted_generation_non_claim',
    releaseEligible: false,
    host,
    remoteWork,
    factory: {
      serial: 'BRIK64-L6PLUS-N5-20260605-BETA6MP-660de957',
      stage1Hash: 'sha256:660de957ccd0ace57ce2a34eb4c0b60baf1912993f2f814eb91ce28978a72ea4'
    },
    hashes: {
      ...expectedHashes,
      generatedArtifactHash,
      packageHash: null,
      releaseManifestHash: null
    },
    inputs: {
      pcdInventory: inventory,
      sourcePcd: { path: rel(sourcePcd), sha256: sha256File(sourcePcd) },
      cliPolymer: { path: rel(polymerPcd), sha256: sha256File(polymerPcd) },
      technicalSheet: { path: rel(technicalSheetFile), sha256: sha256File(technicalSheetFile) },
      generatedFiles
    },
    remote: {
      rc,
      stdout: rel(localFiles.stdout),
      stdoutSha256: sha256File(localFiles.stdout),
      stderr: rel(localFiles.stderr),
      stderrSha256: sha256File(localFiles.stderr),
      outFiles: remoteOutFiles,
      checksums: rel(localFiles.sha256sums),
      checksumsSha256: sha256File(localFiles.sha256sums)
    },
    claimBoundary: {
      publicClaimsAllowed: false,
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
      pureBrik64ChainClaimAllowed: false
    },
    blockers: [...new Set(blockers)],
    requiredNextAction: decision === 'PASS_BETA9_PCD_L6_MATERIALIZATION'
      ? 'Run beta9 release readiness, package and atomic publication gates.'
      : 'Upgrade/deploy L6+N5 materialization path and bind generated artifact, package and release manifest hashes before beta9 publication.'
  };
  writeJson(reportFile, report);
  process.stdout.write(`decision=${decision}\n`);
  process.stdout.write(`report=${rel(reportFile)}\n`);
  if (report.blockers.length) process.stdout.write(`blockers=${report.blockers.join(',')}\n`);
  process.exit(decision === 'PASS_BETA9_PCD_L6_MATERIALIZATION' ? 0 : 2);
}

main();
