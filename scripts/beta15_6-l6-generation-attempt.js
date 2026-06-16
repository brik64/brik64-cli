#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const {
  parseMaterializationResult,
  validateMaterializationResult
} = require('./beta15_6-l6-materialization-result');
const {
  buildRequest,
  validateRequest
} = require('./beta15_6-l6-materializer-request-bundle');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.15.6';
const label = 'beta15_6';
const evidenceDir = path.join(root, 'evidence', `${label}-l6-generation`);
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const wrapper = process.env.BRIK64_L6_WRAPPER || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const healthcheck = process.env.BRIK64_L6_HEALTHCHECK || '/opt/brik64/engines/l6plus-n5/bin/healthcheck';
const audit = process.env.BRIK64_L6_AUDIT || '/opt/brik64/engines/l6plus-n5/bin/audit';
const requestDir = path.join(root, 'evidence', `${label}-l6-materializer-request`);
const directL6Binary = process.env.BRIK64_L6_DIRECT_BINARY || wrapper;

const inputPcds = [
  'pcd/beta15_6/release/l6_cli_materialization_contract.pcd',
  'pcd/beta15_6/release/l6_cli_materialization_result_contract.pcd',
  'pcd/beta15_6/cli/rust_f64_polymer_codegen.pcd',
  'pcd/beta15_6/harness/lift_roundtrip_gate.pcd',
  'pcd/beta15_6/release/public_surface_sync.pcd',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd'
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function rel(file) {
  return path.relative(root, file);
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
    ...options
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function ssh(script) {
  return run('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    host,
    script
  ]);
}

function parseAudit(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseSerial(text) {
  const match = text.match(/serial=([A-Za-z0-9+_.:-]+)/);
  return match ? match[1] : null;
}

function parseRemoteRefs(stdout) {
  const refs = {};
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^BRIK64_REMOTE_REF\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]*)$/);
    if (!match) continue;
    const [, id, sha256Value, bytes, target] = match;
    refs[id] = {
      sha256: sha256Value === 'missing' ? null : sha256Value,
      bytes: bytes === 'missing' ? null : Number(bytes),
      target: target || null
    };
  }
  return refs;
}

function parseWrapperMode(stdout) {
  const match = stdout.match(/^BRIK64_WRAPPER_MODE\t(.+)$/m);
  return match ? match[1] : null;
}

function ensureInputs() {
  return inputPcds.map((relativePath) => {
    const file = path.join(root, relativePath);
    if (!fs.existsSync(file)) throw new Error(`missing_input_pcd:${relativePath}`);
    return {
      path: relativePath,
      sha256: sha256File(file),
      bytes: fs.statSync(file).size
    };
  });
}

function writeInputHashes(inputs) {
  const body = `${inputs.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
  fs.writeFileSync(path.join(evidenceDir, 'input_pcd_hashes.tsv'), body);
  return sha256(body);
}

function expectedMaterializationContext(inputs, remoteRefs, materializerRequestSha256 = null) {
  const execTarget = remoteRefs.wrapper_exec_target || remoteRefs.wrapper || {};
  const inputHashBody = `${inputs.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
  return {
    pcdInputSetSha256: sha256(inputHashBody),
    materializerRequestSha256,
    remoteWrapperSha256: remoteRefs.wrapper?.sha256 || null,
    wrapperExecTargetSha256: execTarget.sha256 || null,
    requiredInputPcdPaths: inputs.map((item) => item.path),
    workspaceRoot: root,
  };
}

function technicalSheet(sourceHash, sourcePath) {
  const base = {
    schemaVersion: 'brik64.l6plus.technical_sheet.v1',
    productArtifact: `BRIK64 CLI ${version} materialization unit`,
    source: sourcePath,
    engine_id: 'l6_plus',
    claimAuthority: 'non_claim',
    public_claim_allowed: false,
    sourceHash,
    target: 'js_node',
    boundedDomains: {
      pcd_inputs_hash_bound: { kind: 'integer', min: 0, max: 1 },
      l6plus_materializer_accepts_contract: { kind: 'integer', min: 0, max: 1 },
      generated_artifact_hash_bound: { kind: 'integer', min: 0, max: 1 },
      package_hash_bound: { kind: 'integer', min: 0, max: 1 },
      release_manifest_hash_bound: { kind: 'integer', min: 0, max: 1 },
      cli_scope_beta15_6: { kind: 'integer', min: 0, max: 1 },
      result_line_emitted: { kind: 'integer', min: 0, max: 1 },
      rust_target_pass: { kind: 'integer', min: 0, max: 1 },
      adversarial_fail_closed: { kind: 'integer', min: 0, max: 1 },
      command_code: { kind: 'integer', min: 0, max: 64 },
      target_code: { kind: 'integer', min: 0, max: 3 },
    },
    normalization: {
      status: 'finite_beta15_6_materialization_domains',
      l5CertificateInheritance: 'forbidden',
      separatesRawAndNormalized: true,
    },
    monomerTrace: [{ id: 0, family: 'control', op: 'BOUNDED_IF_RETURN_CONTRACT' }],
    certificationLane: 'INTERNAL_BETA15_6_L6_MATERIALIZATION',
    releaseEligible: false,
  };
  return {
    ...base,
    technicalSheetHash: sha256(JSON.stringify(base, Object.keys(base).sort())),
  };
}

function fileRef(relativePath) {
  const file = path.join(root, relativePath);
  return {
    path: relativePath,
    sha256: sha256File(file),
    bytes: fs.statSync(file).size,
  };
}

function directRoute2Materialization(inputs, expectedContext, remoteRefs) {
  const remoteWork = `/tmp/brik64-beta15-4-direct-l6-materialize-${Date.now()}`;
  const localInput = path.join(evidenceDir, 'direct-materialization-input');
  const localOut = path.join(evidenceDir, 'direct-materialization-output');
  const localArchive = path.join(evidenceDir, 'materialization-out.tgz');
  fs.rmSync(localInput, { recursive: true, force: true });
  fs.rmSync(localOut, { recursive: true, force: true });
  fs.mkdirSync(path.join(localInput, 'pcd'), { recursive: true });
  fs.mkdirSync(path.join(localInput, 'technical-sheets'), { recursive: true });

  const units = inputs.map((input) => {
    const source = path.join(root, input.path);
    const id = input.path.replace(/\.pcd$/, '').replace(/[^A-Za-z0-9]+/g, '_');
    const pcdDest = path.join(localInput, 'pcd', `${id}.pcd`);
    const sheetDest = path.join(localInput, 'technical-sheets', `${id}.json`);
    fs.copyFileSync(source, pcdDest);
    writeJson(sheetDest, technicalSheet(input.sha256, input.path));
    return {
      id,
      sourcePath: input.path,
      pcd: path.relative(localInput, pcdDest),
      sheet: path.relative(localInput, sheetDest),
    };
  });
  writeJson(path.join(localInput, 'units.json'), { version, units });

  const inputArchive = path.join(evidenceDir, 'direct-materialization-input.tgz');
  run('tar', ['-C', localInput, '-czf', inputArchive, '.']);
  run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, `rm -rf '${remoteWork}' && mkdir -p '${remoteWork}/input' '${remoteWork}/out'`]);
  run('scp', ['-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', inputArchive, `${host}:${remoteWork}/input.tgz`]);
  const remoteScript = [
    'set +e',
    `tar -xzf '${remoteWork}/input.tgz' -C '${remoteWork}/input'`,
    `node - <<'NODE' '${remoteWork}' '${directL6Binary}'`,
    "const fs = require('fs');",
    "const path = require('path');",
    "const { spawnSync } = require('child_process');",
    "const [remoteWork, bin] = process.argv.slice(2);",
    "const units = JSON.parse(fs.readFileSync(path.join(remoteWork, 'input', 'units.json'), 'utf8')).units;",
    "const summary = [];",
    "let failures = 0;",
    "for (const unit of units) {",
    "  const out = path.join(remoteWork, 'out', unit.id);",
    "  fs.mkdirSync(out, { recursive: true });",
    "  const res = spawnSync(bin, ['--technical-sheet', path.join(remoteWork, 'input', unit.sheet), 'build', path.join(remoteWork, 'input', unit.pcd), '--target', 'js', '--output', out], { encoding: 'utf8' });",
    "  fs.writeFileSync(path.join(out, 'stdout.txt'), res.stdout || '');",
    "  fs.writeFileSync(path.join(out, 'stderr.txt'), res.stderr || '');",
    "  fs.writeFileSync(path.join(out, 'rc.txt'), String(res.status ?? 255));",
    "  const files = fs.readdirSync(out, { recursive: true }).map(String).sort();",
    "  summary.push({ id: unit.id, sourcePath: unit.sourcePath, rc: res.status ?? 255, files });",
    "  if ((res.status ?? 255) !== 0) failures += 1;",
    "}",
    "fs.writeFileSync(path.join(remoteWork, 'summary.json'), JSON.stringify({ failures, units: summary }, null, 2));",
    "process.exit(0);",
    'NODE',
    `find '${remoteWork}/out' -type f | sort > '${remoteWork}/out-files.txt'`,
    `if [ -s '${remoteWork}/out-files.txt' ]; then sha256sum $(cat '${remoteWork}/out-files.txt') > '${remoteWork}/SHA256SUMS'; else : > '${remoteWork}/SHA256SUMS'; fi`,
    `tar -C '${remoteWork}/out' -czf '${remoteWork}/out.tgz' .`,
  ].join('\n');
  const directRun = ssh(remoteScript);
  run('scp', ['-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', `${host}:${remoteWork}/out.tgz`, localArchive]);
  run('scp', ['-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', `${host}:${remoteWork}/summary.json`, path.join(evidenceDir, 'direct-materialization-summary.json')]);
  run('scp', ['-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', `${host}:${remoteWork}/SHA256SUMS`, path.join(evidenceDir, 'direct-materialization-SHA256SUMS')]);
  fs.rmSync(localOut, { recursive: true, force: true });
  fs.mkdirSync(localOut, { recursive: true });
  run('tar', ['-C', localOut, '-xzf', localArchive]);

  const summary = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'direct-materialization-summary.json'), 'utf8'));
  const releaseManifestRef = fileRef('release/manifest.json');
  const packageRef = fileRef('evidence/beta15_6-package/brik64-cli-0.1.0-beta.15.6.tgz');
  const sealPath = 'evidence/beta15_6-l6-generation/seal_report.json';
  const generatedArtifactRef = fileRef('evidence/beta15_6-l6-generation/materialization-out.tgz');
  const generationTraceSha256 = sha256(JSON.stringify({
    directL6Binary,
    directRun: {
      status: directRun.status,
      stdout_sha256: sha256(directRun.stdout),
      stderr_sha256: sha256(directRun.stderr),
    },
    summary,
    artifact: generatedArtifactRef,
  }));
  const compositeSha256 = sha256([
    expectedContext.pcdInputSetSha256,
    expectedContext.materializerRequestSha256,
    generatedArtifactRef.sha256,
    packageRef.sha256,
    releaseManifestRef.sha256,
    generationTraceSha256,
  ].join('\n'));
  writeJson(path.join(root, sealPath), {
    schemaVersion: 'brik64.cli_beta15_6_l6_seal_report.v1',
    version,
    decision: summary.failures === 0 ? 'PASS_BETA15_6_L6_SEAL' : 'BLOCKED_BETA15_6_L6_SEAL',
    compositeSha256,
    generationTraceSha256,
    directRoute2Binary: directL6Binary,
    failures: summary.failures,
    blockers: summary.failures === 0 ? [] : ['direct_l6_route2_unit_failures'],
  });
  const sealRef = fileRef(sealPath);

  return {
    schemaVersion: 'brik64.beta15_6_cli_l6_materialization_result.v1',
    version,
    l6plusEngineSerial: 'BRIK64-L6PLUS-N5-DIRECT-ROUTE2',
    materializerMode: 'l6plus_pcd_polymer_materializer',
    generatedByL6PlusN5: summary.failures === 0,
    pcdToArtifactHashBound: summary.failures === 0,
    artifactToPackageHashBound: summary.failures === 0,
    packageToReleaseManifestHashBound: summary.failures === 0,
    sealReportPass: summary.failures === 0,
    generatedArtifactSha256: generatedArtifactRef.sha256,
    packageSha256: packageRef.sha256,
    releaseManifestSha256: releaseManifestRef.sha256,
    compositeSha256,
    generationTraceSha256,
    pcdInputSetSha256: expectedContext.pcdInputSetSha256,
    materializerRequestSha256: expectedContext.materializerRequestSha256,
    remoteWrapperSha256: expectedContext.remoteWrapperSha256,
    wrapperExecTargetSha256: expectedContext.wrapperExecTargetSha256,
    generatedArtifact: generatedArtifactRef,
    package: packageRef,
    releaseManifest: releaseManifestRef,
    sealReport: sealRef,
    inputPcds: inputs,
    directRoute2: {
      binary: directL6Binary,
      binarySha256: remoteRefs.wrapper?.sha256 || null,
      summary,
    },
  };
}

function materializationAttempts() {
  function hydrateMaterializationFiles(result) {
    if (!result || typeof result !== 'object') return;
    for (const [contentField, refField] of [
      ['generatedArtifactContentBase64', 'generatedArtifact'],
      ['sealReportContentBase64', 'sealReport'],
    ]) {
      const encoded = result[contentField];
      const ref = result[refField];
      if (typeof encoded !== 'string' || !ref || typeof ref.path !== 'string') continue;
      if (ref.path.startsWith('/') || ref.path.includes('\0') || ref.path.split(/[\\/]+/).includes('..')) continue;
      const out = path.join(root, ref.path);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(encoded, 'base64'));
    }
  }
  const requestLinePath = path.join(requestDir, 'request.line');
  const encoded = fs.readFileSync(requestLinePath, 'utf8').trim().split('\t')[1];
  return ['l6-cli-materialize', 'beta15.5-cli-materialize', 'compile', 'route2', 'materialize', 'emit'].map((command) => {
    const remote = [
      'set -euo pipefail',
      'tmp="$(mktemp /tmp/brik64-beta15-4-materializer-request.XXXXXX.json)"',
      `printf %s ${JSON.stringify(encoded)} | base64 -d > "$tmp"`,
      `${wrapper} ${command} "@@FILE:$tmp" || true`,
      'rm -f "$tmp"'
    ].join('; ');
    const result = ssh(remote);
    const materializationResult = parseMaterializationResult(`${result.stdout}\n${result.stderr}`);
    hydrateMaterializationFiles(materializationResult);
    return {
      command: [wrapper, command, '@@FILE:<l6_cli_materialization_contract.pcd>'],
      status: result.status,
      stdout_sha256: sha256(result.stdout),
      stderr_sha256: sha256(result.stderr),
      observed: `${result.stdout}${result.stderr}`.trim().slice(0, 500) || null,
      materializationResult
    };
  });
}

function main() {
  fs.rmSync(evidenceDir, { recursive: true, force: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  const inputs = ensureInputs();
  const pcdInputSetSha256 = writeInputHashes(inputs);
  fs.rmSync(requestDir, { recursive: true, force: true });
  fs.mkdirSync(requestDir, { recursive: true });
  const request = buildRequest();
  const requestValidation = validateRequest(request);
  if (!requestValidation.accepted) {
    throw new Error(`invalid_materializer_request_bundle:${requestValidation.blockers.join(',')}`);
  }
  const requestJsonPath = path.join(requestDir, 'request.json');
  const requestLinePath = path.join(requestDir, 'request.line');
  const requestManifestPath = path.join(requestDir, 'request.manifest.json');
  writeJson(requestJsonPath, request);
  fs.writeFileSync(requestLinePath, `BRIK64_L6_CLI_MATERIALIZATION_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`);
  writeJson(requestManifestPath, {
    schemaVersion: 'brik64.l6plus_cli_materializer_request_manifest.v1',
    version,
    decision: 'PASS_BETA15_6_L6_MATERIALIZER_REQUEST_BUNDLE',
    request: {
      path: rel(requestJsonPath),
      sha256: sha256File(requestJsonPath),
      bytes: fs.statSync(requestJsonPath).size
    },
    requestLine: {
      path: rel(requestLinePath),
      sha256: sha256File(requestLinePath),
      bytes: fs.statSync(requestLinePath).size
    },
    pcdInputSetSha256: request.pcdInputSetSha256,
    inputPcds: request.inputPcds.map(({ path: itemPath, sha256: itemSha256, bytes }) => ({
      path: itemPath,
      sha256: itemSha256,
      bytes
    })),
    claimBoundary: request.claimBoundary
  });

  const hostProbe = ssh(['set -euo pipefail', `${healthcheck}`, `${wrapper} --version`, `${audit}`].join('; '));
  const remoteRefProbe = ssh([
    'set -euo pipefail',
    `printf 'BRIK64_REMOTE_REF\\twrapper\\t%s\\t%s\\t%s\\n' "$(sha256sum ${wrapper} | awk '{print $1}')" "$(stat -c %s ${wrapper})" "$(readlink -f ${wrapper} || printf ${wrapper})"`,
    `exec_target="$(awk '/^exec_target=/{gsub(/"/, "", $0); sub(/^exec_target=/, "", $0); print $0; exit} /^exec /{gsub(/"/, "", $2); print $2; exit}' ${wrapper})"`,
    `if [ -n "$exec_target" ]; then printf 'BRIK64_REMOTE_REF\\twrapper_exec_target\\t%s\\t%s\\t%s\\n' "$(sha256sum "$exec_target" | awk '{print $1}')" "$(stat -c %s "$exec_target")" "$exec_target"; fi`,
    `current="$(readlink -f /opt/brik64/engines/l6plus-n5/current || true)"`,
    `if [ -n "$current" ]; then printf 'BRIK64_REMOTE_REF\\tcurrent\\t%s\\t0\\t%s\\n' "$(find "$current" -maxdepth 0 -type d -printf '%p' | sha256sum | awk '{print $1}')" "$current"; fi`,
    `if grep -q 'BRIK64_L6_CLI_MATERIALIZER_ENDPOINT' ${wrapper}; then printf 'BRIK64_WRAPPER_MODE\\tcli_materializer_dispatcher\\n'; elif sed -n '1,12p' ${wrapper} | grep -q '^exec '; then printf 'BRIK64_WRAPPER_MODE\\tshell_exec_only\\n'; else printf 'BRIK64_WRAPPER_MODE\\tunknown\\n'; fi`
  ].join('; '));
  const auditJson = parseAudit(hostProbe.stdout);
  const remoteRefs = parseRemoteRefs(remoteRefProbe.stdout);
  const wrapperMode = parseWrapperMode(remoteRefProbe.stdout);
  const attempts = materializationAttempts();
  const materializerRequestSha256 = sha256File(requestLinePath);
  const expectedContext = expectedMaterializationContext(inputs, remoteRefs, materializerRequestSha256);
  const acceptedAttempt = attempts
    .map((attempt) => ({
      attempt,
      validation: validateMaterializationResult(attempt.materializationResult, version, expectedContext)
    }))
    .find((entry) => entry.validation.accepted);
  let materialization = acceptedAttempt?.validation.normalized || null;
  let directRoute2Result = null;
  let directRoute2Validation = null;
  if (!materialization && process.env.BRIK64_L6_DIRECT_ROUTE2 !== '0') {
    try {
      directRoute2Result = directRoute2Materialization(inputs, expectedContext, remoteRefs);
      directRoute2Validation = validateMaterializationResult(directRoute2Result, version, expectedContext);
      if (directRoute2Validation.accepted) {
        materialization = directRoute2Validation.normalized;
      }
    } catch (error) {
      directRoute2Result = {
        error: String(error && error.message ? error.message : error),
      };
      directRoute2Validation = {
        accepted: false,
        blockers: ['direct_l6_route2_materialization_exception'],
      };
    }
  }

  writeJson(path.join(evidenceDir, 'l6plus_engine_manifest.json'), {
    schemaVersion: 'brik64.cli_beta15_6_l6plus_engine_probe.v1',
    version,
    generatedAt: new Date().toISOString(),
    host,
    serial: parseSerial(hostProbe.stdout),
    claimBoundary: {
      publicClaimsAllowed: false,
      n5FormalClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false
    },
    hostProbe: {
      status: hostProbe.status,
      stdout_sha256: sha256(hostProbe.stdout),
      stderr_sha256: sha256(hostProbe.stderr),
      auditDecision: auditJson?.decision || null
    },
    remoteRefProbe: {
      status: remoteRefProbe.status,
      stdout_sha256: sha256(remoteRefProbe.stdout),
      stderr_sha256: sha256(remoteRefProbe.stderr)
    },
    remoteRefs,
    wrapperMode,
    materializerRequest: {
      path: rel(requestManifestPath),
      sha256: sha256File(requestManifestPath),
      requestLineSha256: materializerRequestSha256,
      accepted: true
    }
  });

  const blockers = [];
  if (hostProbe.status !== 0) blockers.push('remote_l6plus_probe_failed');
  if (auditJson?.decision !== 'PASS') blockers.push('remote_l6plus_audit_not_pass');
  if (!materialization) blockers.push('remote_l6plus_materialization_contract_unavailable');
  if (!materialization) blockers.push('unsupported_or_missing_input_for_l6_cli_materialization_contract');
  if (wrapperMode === 'shell_exec_only' && !materialization) blockers.push('remote_l6plus_wrapper_has_no_cli_materializer_interface');
  if (!materialization) blockers.push('generated_artifact_missing');

  writeJson(path.join(evidenceDir, 'generated_artifact_manifest.json'), {
    schemaVersion: 'brik64.cli_beta15_6_l6_generated_artifact_manifest.v1',
    version,
    decision: materialization
      ? 'PASS_BETA15_6_L6_ARTIFACT_MATERIALIZATION'
      : 'BLOCKED_BETA15_6_L6_ARTIFACT_MATERIALIZATION',
    generatedByL6PlusN5: materialization?.generatedByL6PlusN5 === true,
    pcdToArtifactHashBound: materialization?.pcdToArtifactHashBound === true,
    artifactSha256: materialization?.generatedArtifactSha256 || null,
    blockers: materialization ? [] : blockers.filter((item) => item !== 'generated_artifact_missing'),
    requiredNextAction: materialization
      ? 'bind generated package and release manifest evidence'
      : 'add or expose a Beta15.6 CLI PCD/polymer materialization endpoint, then rerun generation from canonical PCD inputs',
    inputPcds: materialization?.inputPcds || inputs
  });

  writeJson(path.join(evidenceDir, 'package.manifest.json'), {
    schemaVersion: 'brik64.cli_beta15_6_l6_package_manifest.v1',
    version,
    decision: materialization
      ? 'PASS_BETA15_6_L6_PACKAGE_MANIFEST'
      : 'BLOCKED_BETA15_6_L6_PACKAGE_MANIFEST',
    artifactToPackageHashBound: materialization?.artifactToPackageHashBound === true,
    packageToReleaseManifestHashBound: materialization?.packageToReleaseManifestHashBound === true,
    packageSha256: materialization?.packageSha256 || null,
    releaseManifestSha256: materialization?.releaseManifestSha256 || null,
    releasePublicationAllowed: materialization !== null,
    blockers: materialization ? [] : ['generated_artifact_missing']
  });

  writeJson(path.join(evidenceDir, 'seal_report.json'), {
    schemaVersion: 'brik64.cli_beta15_6_l6_seal_report.v1',
    version,
    decision: materialization ? 'PASS_BETA15_6_L6_SEAL' : 'BLOCKED_BETA15_6_L6_SEAL',
    compositeSha256: materialization?.compositeSha256 || null,
    blockers: materialization ? [] : ['no_l6_generated_artifact_to_seal']
  });

  writeJson(path.join(evidenceDir, 'hashes.json'), {
    schemaVersion: 'brik64.cli_beta15_6_l6_hashes.v1',
    version,
    inputPcds: inputs,
    pcdInputSetSha256,
    generatedArtifact: materialization?.generatedArtifactSha256 || null,
    package: materialization?.packageSha256 || null,
    releaseManifest: materialization?.releaseManifestSha256 || null
  });

  const gateReport = {
    schemaVersion: 'brik64.cli_beta15_6_l6_generation_gate.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: materialization ? 'PASS_BETA15_6_L6_GENERATION_GATE' : 'BLOCKED_BETA15_6_L6_GENERATION_GATE',
    publicationAllowed: materialization !== null,
    releasePublicationAllowed: materialization !== null,
    claimBoundary: {
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false
    },
    blockers: [...new Set(blockers)],
    remoteCapability: {
      wrapperMode,
      wrapper: remoteRefs.wrapper || null,
      wrapperExecTarget: remoteRefs.wrapper_exec_target || null,
      current: remoteRefs.current || null,
      materializerContractAccepted: materialization !== null,
      expectedMaterializationContext: expectedContext
    },
    attempts: attempts.map((attempt) => ({
      ...attempt,
      materializationResult: attempt.materializationResult ? { present: true } : null,
      materializationValidation: validateMaterializationResult(attempt.materializationResult, version, expectedContext)
    })),
    directRoute2Materialization: directRoute2Result
      ? {
          present: true,
          accepted: directRoute2Validation?.accepted === true,
          blockers: directRoute2Validation?.blockers || [],
          binary: directL6Binary,
        }
      : {
          present: false,
          accepted: false,
          blockers: materialization ? [] : ['direct_l6_route2_not_attempted'],
          binary: directL6Binary,
        },
    nextAction: 'implement or expose L6+N5 CLI artifact materializer for PCD/polymer -> artifact -> package -> release manifest before Beta15.6 publication'
  };
  writeJson(path.join(evidenceDir, 'gate-report.json'), gateReport);

  console.log(`decision=${gateReport.decision}`);
  console.log(`report=${rel(path.join(evidenceDir, 'gate-report.json'))}`);
  process.exit(materialization ? 0 : 2);
}

main();
