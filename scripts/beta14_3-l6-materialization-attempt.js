#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.14.3';
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const remoteWork = process.env.BRIK64_L6_BETA14_3_MATERIALIZE_WORK || `/tmp/brik64-cli-beta14_3-materialize-${Date.now()}`;
const pcdRoot = path.join(root, 'pcd', 'beta14_3');
const evidenceDir = path.join(root, 'evidence', 'beta14_3-l6-generation');
const generatedDir = path.join(evidenceDir, 'generated');
const localInputDir = path.join(evidenceDir, 'materialization-input');
const l6Binary = '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';
const l6SerialPath = '/opt/brik64/engines/l6plus-n5/current/serial.txt';

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
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

function listPcds() {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.pcd')) out.push(full);
    }
  }
  walk(pcdRoot);
  return out;
}

function technicalSheet(sourceHash, relPath) {
  const sheet = {
    schemaVersion: 'brik64.l6plus.technical_sheet.v1',
    productArtifact: `BRIK64 CLI ${version} PCD materialization unit`,
    source: relPath,
    engine_id: 'l6_plus',
    claimAuthority: 'non_claim',
    public_claim_allowed: false,
    sourceHash,
    target: 'js_node',
    boundedDomains: {
      command_id: { kind: 'integer', min: 0, max: 64 },
      encoded_state: { kind: 'integer', min: 0, max: 127 },
      monomer_id: { kind: 'integer', min: 0, max: 127 }
    },
    normalization: {
      status: 'finite_beta14_3_materialization_domains',
      l5CertificateInheritance: 'forbidden',
      separatesRawAndNormalized: true
    },
    monomerTrace: [{ id: 0, family: 'control', op: 'BOUNDED_IF_RETURN_CONTRACT' }],
    certificationLane: 'INTERNAL_BETA14_3_L6_MATERIALIZATION',
    releaseEligible: false
  };
  sheet.technicalSheetHash = sha256Buffer(JSON.stringify(sheet, Object.keys(sheet).sort()));
  return sheet;
}

function blocked(blockers, extra = {}) {
  return {
    schemaVersion: 'brik64.beta14_3_l6_materialization_attempt.v1',
    generatedAt: new Date().toISOString(),
    version,
    decision: 'BLOCKED_BETA14_3_L6_MATERIALIZATION',
    releaseEligible: false,
    publicationAllowed: false,
    generationClaim: 'assisted_generation_non_claim',
    blockers: [...new Set(blockers)],
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

function copyTree(src, dst) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}

function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.rmSync(generatedDir, { recursive: true, force: true });
  fs.rmSync(localInputDir, { recursive: true, force: true });
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.mkdirSync(localInputDir, { recursive: true });

  if (!fs.existsSync(pcdRoot)) {
    const report = blocked(['pcd_beta14_3_root_missing']);
    writeJson(path.join(evidenceDir, 'materialization-attempt-report.json'), report);
    process.exit(2);
  }

  const pcds = listPcds();
  const sourceInventory = pcds.map((file) => ({
    path: rel(file),
    sha256: sha256File(file),
    bytes: fs.statSync(file).size
  }));
  fs.writeFileSync(
    path.join(evidenceDir, 'input_pcd_hashes.tsv'),
    `${sourceInventory.map((item) => `${item.sha256}\t${item.path}`).join('\n')}\n`
  );

  const inputPcdDir = path.join(localInputDir, 'pcd');
  const inputSheetDir = path.join(localInputDir, 'technical-sheets');
  copyTree(pcdRoot, inputPcdDir);
  fs.mkdirSync(inputSheetDir, { recursive: true });
  const units = [];
  for (const file of pcds) {
    const relativeFromPcdRoot = path.relative(pcdRoot, file);
    const unitId = relativeFromPcdRoot.replace(/\.pcd$/, '').replace(/[^A-Za-z0-9]+/g, '_');
    const sourceHash = sha256File(file);
    const sheet = technicalSheet(sourceHash, rel(file));
    const sheetFile = path.join(inputSheetDir, `${unitId}.json`);
    writeJson(sheetFile, sheet);
    units.push({
      id: unitId,
      source: relativeFromPcdRoot,
      sourcePath: rel(file),
      sourceSha256: sourceHash,
      technicalSheet: path.relative(localInputDir, sheetFile),
      technicalSheetSha256: sha256File(sheetFile)
    });
  }
  writeJson(path.join(localInputDir, 'units.json'), { version, units });

  const archive = path.join(os.tmpdir(), `brik64-beta14_3-l6-input-${Date.now()}.tgz`);
  run('tar', ['-C', localInputDir, '-czf', archive, '.']);

  try {
    ssh(`rm -rf '${remoteWork}' && mkdir -p '${remoteWork}/input' '${remoteWork}/out'`);
    scpTo(archive, `${remoteWork}/input.tgz`);
    ssh(`tar -xzf '${remoteWork}/input.tgz' -C '${remoteWork}/input'`);
  } catch (error) {
    const report = blocked(['l6_remote_access_failed'], {
      host,
      remoteWork,
      error: String(error.message || error).slice(0, 1000),
      sourceInventory
    });
    writeJson(path.join(evidenceDir, 'materialization-attempt-report.json'), report);
    process.stdout.write(`decision=${report.decision}\nblockers=${report.blockers.join(',')}\n`);
    process.exit(2);
  } finally {
    fs.rmSync(archive, { force: true });
  }

  const remoteScript = [
    'set +e',
    `echo "REMOTE_HOST=$(hostname)" > '${remoteWork}/stdout.txt'`,
    `echo "REMOTE_L6_SERIAL=$(cat '${l6SerialPath}' 2>/dev/null)" >> '${remoteWork}/stdout.txt'`,
    `echo "REMOTE_L6_VERSION=$(${l6Binary} --l6plus-version 2>&1 | tr '\\n' ';')" >> '${remoteWork}/stdout.txt'`,
    `node - <<'NODE' '${remoteWork}' '${l6Binary}'`,
    "const fs = require('fs');",
    "const path = require('path');",
    'const { spawnSync } = require("child_process");',
    'const [remoteWork, l6Binary] = process.argv.slice(2);',
    "const units = JSON.parse(fs.readFileSync(path.join(remoteWork, 'input', 'units.json'), 'utf8')).units;",
    'let failures = 0;',
    'for (const unit of units) {',
    "  const source = path.join(remoteWork, 'input', 'pcd', unit.source);",
    "  const sheet = path.join(remoteWork, 'input', unit.technicalSheet);",
    "  const out = path.join(remoteWork, 'out', unit.id);",
    '  fs.mkdirSync(out, { recursive: true });',
    "  const res = spawnSync(l6Binary, ['--technical-sheet', sheet, 'build', source, '--target', 'js', '--output', out], { encoding: 'utf8' });",
    "  fs.writeFileSync(path.join(out, 'stdout.txt'), res.stdout || '');",
    "  fs.writeFileSync(path.join(out, 'stderr.txt'), res.stderr || '');",
    "  fs.writeFileSync(path.join(out, 'rc.txt'), String(res.status ?? 255));",
    '  if ((res.status ?? 255) !== 0) failures += 1;',
    '}',
    "fs.writeFileSync(path.join(remoteWork, 'compile-failures.txt'), String(failures));",
    'NODE',
    `find '${remoteWork}/out' -type f | sort > '${remoteWork}/out-files.txt'`,
    `if [ -s '${remoteWork}/out-files.txt' ]; then sha256sum $(cat '${remoteWork}/out-files.txt') > '${remoteWork}/SHA256SUMS'; else : > '${remoteWork}/SHA256SUMS'; fi`,
    `tar -C '${remoteWork}/out' -czf '${remoteWork}/out.tgz' .`,
    'exit 0'
  ].join('\n');

  ssh(remoteScript);

  const localRemote = {
    stdout: path.join(evidenceDir, 'materialization-stdout.txt'),
    outFiles: path.join(evidenceDir, 'materialization-out-files.txt'),
    sha256sums: path.join(evidenceDir, 'materialization-SHA256SUMS'),
    failures: path.join(evidenceDir, 'materialization-failures.txt'),
    outArchive: path.join(evidenceDir, 'materialization-out.tgz')
  };
  scpFrom(`${remoteWork}/stdout.txt`, localRemote.stdout);
  scpFrom(`${remoteWork}/out-files.txt`, localRemote.outFiles);
  scpFrom(`${remoteWork}/SHA256SUMS`, localRemote.sha256sums);
  scpFrom(`${remoteWork}/compile-failures.txt`, localRemote.failures);
  scpFrom(`${remoteWork}/out.tgz`, localRemote.outArchive);

  fs.rmSync(generatedDir, { recursive: true, force: true });
  fs.mkdirSync(generatedDir, { recursive: true });
  run('tar', ['-xzf', localRemote.outArchive, '-C', generatedDir]);

  const generatedFiles = [];
  function walkGenerated(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkGenerated(full);
      else if (entry.isFile()) generatedFiles.push({
        path: rel(full),
        sha256: sha256File(full),
        bytes: fs.statSync(full).size
      });
    }
  }
  walkGenerated(generatedDir);

  const generatedJs = generatedFiles.filter((file) => file.path.endsWith('.js') && !file.path.endsWith('/stdout.txt') && !file.path.endsWith('/stderr.txt'));
  const generatedCerts = generatedFiles.filter((file) => file.path.endsWith('.cert.json'));
  const compileFailures = Number(fs.readFileSync(localRemote.failures, 'utf8').trim() || '0');
  const blockers = [];
  if (pcds.length !== 147) blockers.push(`beta14_3_input_pcd_count_invalid:${pcds.length}`);
  if (compileFailures !== 0) blockers.push(`l6_unit_compile_failures:${compileFailures}`);
  if (generatedJs.length !== pcds.length) blockers.push(`l6_generated_js_count_invalid:${generatedJs.length}:${pcds.length}`);
  if (generatedCerts.length !== pcds.length) blockers.push(`l6_generated_cert_count_invalid:${generatedCerts.length}:${pcds.length}`);

  const compositeHash = sha256Buffer(JSON.stringify({
    sourceInventory,
    generatedJs,
    generatedCerts
  }));
  const decision = blockers.length === 0 ? 'PASS_BETA14_3_L6_MATERIALIZATION' : 'BLOCKED_BETA14_3_L6_MATERIALIZATION';
  const attemptReport = {
    schemaVersion: 'brik64.beta14_3_l6_materialization_attempt.v1',
    generatedAt: new Date().toISOString(),
    version,
    decision,
    releaseEligible: false,
    publicationAllowed: false,
    generationClaim: 'assisted_generation_non_claim',
    host,
    remoteWork,
    sourceInventory,
    generatedFiles,
    generatedJsCount: generatedJs.length,
    generatedCertCount: generatedCerts.length,
    compileFailures,
    hashes: {
      sourceInventoryHash: sha256Buffer(JSON.stringify(sourceInventory)),
      generatedArtifactCompositeHash: compositeHash
    },
    remote: {
      stdout: rel(localRemote.stdout),
      outFiles: rel(localRemote.outFiles),
      checksums: rel(localRemote.sha256sums),
      failures: rel(localRemote.failures),
      outArchive: rel(localRemote.outArchive),
      outArchiveSha256: sha256File(localRemote.outArchive)
    },
    blockers,
    claimBoundary: {
      publicClaimsAllowed: false,
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
      pureBrik64ChainClaimAllowed: false
    }
  };
  writeJson(path.join(evidenceDir, 'materialization-attempt-report.json'), attemptReport);

  const artifactManifest = {
    schemaVersion: 'brik64.beta14_3_generated_artifact_manifest.v1',
    version,
    artifactStatus: blockers.length === 0 ? 'GENERATED_BY_L6' : 'BLOCKED_L6_MATERIALIZATION',
    publicationAllowed: false,
    inputPcdCount: pcds.length,
    generatedJsCount: generatedJs.length,
    generatedCertCount: generatedCerts.length,
    generatedArtifactCompositeHash: compositeHash,
    generatedFiles,
    materializationAttempt: {
      path: 'evidence/beta14_3-l6-generation/materialization-attempt-report.json',
      decision
    },
    blockers
  };
  writeJson(path.join(evidenceDir, 'generated_artifact_manifest.json'), artifactManifest);

  const seal = {
    schemaVersion: 'brik64.beta14_3_seal_report.v1',
    version,
    decision: blockers.length === 0 ? 'PASS_BETA14_3_L6_SEAL' : 'BLOCKED_PENDING_FULL_L6_CLI_MATERIALIZATION',
    publicationAllowed: false,
    generationClaim: 'assisted_generation_non_claim',
    inputPcdCount: pcds.length,
    generatedJsCount: generatedJs.length,
    generatedCertCount: generatedCerts.length,
    generatedArtifactCompositeHash: compositeHash,
    materializationAttempt: 'evidence/beta14_3-l6-generation/materialization-attempt-report.json',
    blockers,
    claimBoundary: {
      publicClaimsAllowed: false,
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false
    }
  };
  writeJson(path.join(evidenceDir, 'seal_report.json'), seal);

  process.stdout.write(`decision=${decision}\n`);
  process.stdout.write(`generated_js=${generatedJs.length}\n`);
  process.stdout.write(`generated_certs=${generatedCerts.length}\n`);
  if (blockers.length) {
    process.stdout.write(`blockers=${blockers.join(',')}\n`);
    process.exit(2);
  }
}

main();
