#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const {
  parseMaterializationResult,
  validateMaterializationResult
} = require('./beta15_4-l6-materialization-result');
const {
  buildRequest,
  validateRequest
} = require('./beta15_4-l6-materializer-request-bundle');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.15.4';
const label = 'beta15_4';
const evidenceDir = path.join(root, 'evidence', `${label}-l6-generation`);
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const wrapper = process.env.BRIK64_L6_WRAPPER || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const healthcheck = process.env.BRIK64_L6_HEALTHCHECK || '/opt/brik64/engines/l6plus-n5/bin/healthcheck';
const audit = process.env.BRIK64_L6_AUDIT || '/opt/brik64/engines/l6plus-n5/bin/audit';
const requestDir = path.join(root, 'evidence', `${label}-l6-materializer-request`);

const inputPcds = [
  'pcd/beta15_4/release/l6_cli_materialization_contract.pcd',
  'pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd',
  'pcd/beta15_4/cli/rust_app_polymer_domain_codegen.pcd',
  'pcd/beta15_4/harness/rust_app_polymer_regression_gate.pcd',
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

function expectedMaterializationContext(inputs, remoteRefs) {
  const inputHashBody = `${inputs.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
  return {
    pcdInputSetSha256: sha256(inputHashBody),
    remoteWrapperSha256: remoteRefs.wrapper?.sha256 || null,
    wrapperExecTargetSha256: remoteRefs.wrapper_exec_target?.sha256 || null,
    requiredInputPcdPaths: inputs.map((item) => item.path),
    workspaceRoot: root,
  };
}

function materializationAttempts() {
  const requestLinePath = path.join(requestDir, 'request.line');
  const encoded = fs.readFileSync(requestLinePath, 'utf8').trim().split('\t')[1];
  return ['l6-cli-materialize', 'beta15.4-cli-materialize', 'compile', 'route2', 'materialize', 'emit'].map((command) => {
    const remote = [
      'set -euo pipefail',
      'tmp="$(mktemp /tmp/brik64-beta15-4-materializer-request.XXXXXX.json)"',
      `printf %s ${JSON.stringify(encoded)} | base64 -d > "$tmp"`,
      `${wrapper} ${command} "@@FILE:$tmp" || true`,
      'rm -f "$tmp"'
    ].join('; ');
    const result = ssh(remote);
    return {
      command: [wrapper, command, '@@FILE:<l6_cli_materialization_contract.pcd>'],
      status: result.status,
      stdout_sha256: sha256(result.stdout),
      stderr_sha256: sha256(result.stderr),
      observed: `${result.stdout}${result.stderr}`.trim().slice(0, 500) || null,
      materializationResult: parseMaterializationResult(`${result.stdout}\n${result.stderr}`)
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
    decision: 'PASS_BETA15_4_L6_MATERIALIZER_REQUEST_BUNDLE',
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
  const expectedContext = expectedMaterializationContext(inputs, remoteRefs);
  const acceptedAttempt = attempts
    .map((attempt) => ({
      attempt,
      validation: validateMaterializationResult(attempt.materializationResult, version, expectedContext)
    }))
    .find((entry) => entry.validation.accepted);
  const materialization = acceptedAttempt?.validation.normalized || null;

  writeJson(path.join(evidenceDir, 'l6plus_engine_manifest.json'), {
    schemaVersion: 'brik64.cli_beta15_4_l6plus_engine_probe.v1',
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
    schemaVersion: 'brik64.cli_beta15_4_l6_generated_artifact_manifest.v1',
    version,
    decision: materialization
      ? 'PASS_BETA15_4_L6_ARTIFACT_MATERIALIZATION'
      : 'BLOCKED_BETA15_4_L6_ARTIFACT_MATERIALIZATION',
    generatedByL6PlusN5: materialization?.generatedByL6PlusN5 === true,
    pcdToArtifactHashBound: materialization?.pcdToArtifactHashBound === true,
    artifactSha256: materialization?.generatedArtifactSha256 || null,
    blockers: materialization ? [] : blockers.filter((item) => item !== 'generated_artifact_missing'),
    requiredNextAction: materialization
      ? 'bind generated package and release manifest evidence'
      : 'add or expose a Beta15.4 CLI PCD/polymer materialization endpoint, then rerun generation from canonical PCD inputs',
    inputPcds: materialization?.inputPcds || inputs
  });

  writeJson(path.join(evidenceDir, 'package.manifest.json'), {
    schemaVersion: 'brik64.cli_beta15_4_l6_package_manifest.v1',
    version,
    decision: materialization
      ? 'PASS_BETA15_4_L6_PACKAGE_MANIFEST'
      : 'BLOCKED_BETA15_4_L6_PACKAGE_MANIFEST',
    artifactToPackageHashBound: materialization?.artifactToPackageHashBound === true,
    packageToReleaseManifestHashBound: materialization?.packageToReleaseManifestHashBound === true,
    packageSha256: materialization?.packageSha256 || null,
    releaseManifestSha256: materialization?.releaseManifestSha256 || null,
    releasePublicationAllowed: materialization !== null,
    blockers: materialization ? [] : ['generated_artifact_missing']
  });

  writeJson(path.join(evidenceDir, 'seal_report.json'), {
    schemaVersion: 'brik64.cli_beta15_4_l6_seal_report.v1',
    version,
    decision: materialization ? 'PASS_BETA15_4_L6_SEAL' : 'BLOCKED_BETA15_4_L6_SEAL',
    compositeSha256: materialization?.compositeSha256 || null,
    blockers: materialization ? [] : ['no_l6_generated_artifact_to_seal']
  });

  writeJson(path.join(evidenceDir, 'hashes.json'), {
    schemaVersion: 'brik64.cli_beta15_4_l6_hashes.v1',
    version,
    inputPcds: inputs,
    pcdInputSetSha256,
    generatedArtifact: materialization?.generatedArtifactSha256 || null,
    package: materialization?.packageSha256 || null,
    releaseManifest: materialization?.releaseManifestSha256 || null
  });

  const gateReport = {
    schemaVersion: 'brik64.cli_beta15_4_l6_generation_gate.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: materialization ? 'PASS_BETA15_4_L6_GENERATION_GATE' : 'BLOCKED_BETA15_4_L6_GENERATION_GATE',
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
    nextAction: 'implement or expose L6+N5 CLI artifact materializer for PCD/polymer -> artifact -> package -> release manifest before Beta15.4 publication'
  };
  writeJson(path.join(evidenceDir, 'gate-report.json'), gateReport);

  console.log(`decision=${gateReport.decision}`);
  console.log(`report=${rel(path.join(evidenceDir, 'gate-report.json'))}`);
  process.exit(materialization ? 0 : 2);
}

main();
