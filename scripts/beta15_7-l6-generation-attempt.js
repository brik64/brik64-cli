#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const {
  parseMaterializationResult,
  validateMaterializationResult,
} = require('./beta15_6-l6-materialization-result');

const scriptRoot = path.resolve(__dirname, '..');
const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : scriptRoot;
const version = '0.1.0-beta.15.7';
const label = 'beta15_7';
const evidenceDir = path.join(root, 'evidence', `${label}-l6-generation`);
const requestDir = path.join(root, 'evidence', `${label}-l6-materializer-request`);
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const wrapper = process.env.BRIK64_L6_WRAPPER || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const healthcheck = process.env.BRIK64_L6_HEALTHCHECK || '/opt/brik64/engines/l6plus-n5/bin/healthcheck';
const audit = process.env.BRIK64_L6_AUDIT || '/opt/brik64/engines/l6plus-n5/bin/audit';
const skipRemote = process.env.BRIK64_L6_SKIP_REMOTE === '1';

const inputPcdPaths = [
  'pcd/beta15_7/release/l6_cli_materialization_contract.pcd',
  'pcd/beta15_7/release/l6_cli_materialization_result_contract.pcd',
  'pcd/beta15/l6plus_materialization_command.contract.json',
  'pcd/beta15/manifest.json',
  'pcd/beta15/cli_polymer.pcd',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
];

const outputRefs = {
  generatedArtifact: 'evidence/beta15_7-l6-generation/generated/brik64-cli.mjs',
  package: 'evidence/beta15_7-package/brik64-cli-0.1.0-beta.15.7.tgz',
  releaseManifest: 'release/manifest.json',
  sealReport: 'evidence/beta15_7-l6-generation/seal_report.json',
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function safeJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
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

function ssh(script) {
  if (skipRemote) {
    return {
      status: 65,
      stdout: '',
      stderr: 'remote probe skipped by BRIK64_L6_SKIP_REMOTE=1',
    };
  }
  return run('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    host,
    script,
  ]);
}

function parseJsonObject(text) {
  const source = String(text || '');
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseSerial(text) {
  const match = String(text || '').match(/serial=([A-Za-z0-9+_.:-]+)/);
  return match ? match[1] : null;
}

function parseRemoteRefs(stdout) {
  const refs = {};
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const match = line.match(/^BRIK64_REMOTE_REF\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]*)$/);
    if (!match) continue;
    const [, id, sha256Value, bytes, target] = match;
    refs[id] = {
      sha256: sha256Value === 'missing' ? null : sha256Value,
      bytes: bytes === 'missing' ? null : Number(bytes),
      target: target || null,
    };
  }
  return refs;
}

function parseWrapperMode(stdout) {
  const match = String(stdout || '').match(/^BRIK64_WRAPPER_MODE\t(.+)$/m);
  return match ? match[1] : null;
}

function parseEndpointStatus(stdout) {
  const result = {
    endpointLine: null,
    resultLine: null,
    statusTag: null,
  };
  for (const line of String(stdout || '').split(/\r?\n/)) {
    if (line.startsWith('BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\t') || line.startsWith('BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\\t')) {
      const parts = line.split(/\t|\\t/);
      result.endpointLine = line;
      result.statusTag = parts[2] || null;
    }
    if (line.startsWith('BRIK64_L6_CLI_MATERIALIZATION_RESULT\t') || line.startsWith('BRIK64_L6_CLI_MATERIALIZATION_RESULT\\t')) {
      result.resultLine = line;
    }
  }
  return result;
}

function safeRelativePath(value) {
  const text = String(value || '');
  return (
    text.length > 0 &&
    !text.startsWith('/') &&
    !text.includes('\0') &&
    !/^https?:\/\//i.test(text) &&
    !text.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function hydrateReturnedArtifact(result, refName, contentField, blockers) {
  if (!result || typeof result !== 'object') return;
  const ref = result[refName];
  const encoded = result[contentField];
  if (!ref || typeof ref !== 'object' || typeof encoded !== 'string') return;
  if (!safeRelativePath(ref.path)) {
    blockers.push(`materialization_result_${refName}_hydrate_path_invalid`);
    return;
  }
  let content;
  try {
    content = Buffer.from(encoded, 'base64');
  } catch {
    blockers.push(`materialization_result_${refName}_hydrate_base64_invalid`);
    return;
  }
  if (sha256(content) !== String(ref.sha256 || '').replace(/^sha256:/, '').toLowerCase()) {
    blockers.push(`materialization_result_${refName}_hydrate_sha256_mismatch`);
    return;
  }
  const target = path.resolve(root, ref.path);
  const resolvedRoot = path.resolve(root);
  if (!(target === resolvedRoot || target.startsWith(`${resolvedRoot}${path.sep}`))) {
    blockers.push(`materialization_result_${refName}_hydrate_path_outside_workspace`);
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function hydrateMaterializationResult(result) {
  const blockers = [];
  hydrateReturnedArtifact(result, 'generatedArtifact', 'generatedArtifactContentBase64', blockers);
  hydrateReturnedArtifact(result, 'sealReport', 'sealReportContentBase64', blockers);
  return blockers;
}

function collectInputs(blockers) {
  const inputs = [];
  for (const relativePath of inputPcdPaths) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      blockers.push(`missing_input_pcd:${relativePath}`);
      continue;
    }
    const content = fs.readFileSync(absolutePath);
    inputs.push({
      path: relativePath,
      sha256: sha256(content),
      bytes: content.length,
      contentBase64: content.toString('base64'),
    });
  }
  return inputs;
}

function inputHashBody(inputs) {
  return `${inputs.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
}

function writeInputHashes(inputs) {
  const body = inputHashBody(inputs);
  fs.writeFileSync(path.join(evidenceDir, 'input_pcd_hashes.tsv'), body);
  return sha256(body);
}

function expectedContext(inputs, materializerRequestSha256, remoteRefs) {
  const execTarget = remoteRefs.wrapper_exec_target || remoteRefs.wrapper || {};
  return {
    pcdInputSetSha256: sha256(inputHashBody(inputs)),
    materializerRequestSha256,
    remoteWrapperSha256: remoteRefs.wrapper?.sha256 || null,
    wrapperExecTargetSha256: execTarget.sha256 || null,
    requiredInputPcdPaths: inputs.map((item) => item.path),
    workspaceRoot: root,
  };
}

function buildRequest(inputs, pcdInputSetSha256, blockers) {
  const releaseManifestPath = path.join(root, outputRefs.releaseManifest);
  const releaseManifest = safeJson(releaseManifestPath);
  if (!releaseManifest) {
    blockers.push('release_manifest_missing_or_invalid');
  } else if (releaseManifest.version !== version) {
    blockers.push(`release_manifest_version_mismatch:${releaseManifest.version || 'missing'}:${version}`);
  }

  const packagePath = path.join(root, outputRefs.package);
  const packageArtifact = fs.existsSync(packagePath) && fs.statSync(packagePath).isFile()
    ? {
        path: outputRefs.package,
        sha256: sha256File(packagePath),
        bytes: fs.statSync(packagePath).size,
      }
    : null;
  if (!packageArtifact) blockers.push(`missing_package_artifact:${outputRefs.package}`);

  return {
    schemaVersion: 'brik64.l6plus_cli_materializer_request.v1',
    version,
    lane: 'cli_0_1_beta',
    iterId: 'beta15.7-l6-cli-materializer-request',
    materializerMode: 'l6plus_pcd_polymer_materializer',
    sourceCommit: gitSha(),
    claimBoundary: {
      publicClaimsAllowed: false,
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
    },
    requiredResultLine: 'BRIK64_L6_CLI_MATERIALIZATION_RESULT\\t<base64-json>',
    requiredResultSchema: 'brik64.l6plus_cli_materialization_result.v1',
    requiredResultVersion: version,
    pcdInputSetSha256,
    requiredInputPcdPaths: inputs.map((item) => item.path),
    inputPcds: inputs,
    outputRefs,
    outputArtifacts: {
      ...(packageArtifact ? { package: packageArtifact } : {}),
      ...(releaseManifest
        ? {
            releaseManifest: {
              path: outputRefs.releaseManifest,
              sha256: sha256File(releaseManifestPath),
              bytes: fs.statSync(releaseManifestPath).size,
            },
          }
        : {}),
    },
    requiredBindings: [
      'generatedByL6PlusN5',
      'pcdToArtifactHashBound',
      'artifactToPackageHashBound',
      'packageToReleaseManifestHashBound',
      'sealReportPass',
      'generationTraceSha256',
      'remoteWrapperSha256',
      'wrapperExecTargetSha256',
      'compositeSha256',
    ],
  };
}

function gitSha() {
  const result = run('git', ['rev-parse', 'HEAD']);
  return result.status === 0 ? result.stdout.trim() : null;
}

function probeRemote() {
  const hostProbe = ssh(['set -u', `${healthcheck}`, `${wrapper} --version`, `${audit}`].join('; '));
  const remoteRefProbe = ssh([
    'set -u',
    `printf 'BRIK64_REMOTE_REF\\twrapper\\t%s\\t%s\\t%s\\n' "$(sha256sum ${wrapper} 2>/dev/null | awk '{print $1}' || printf missing)" "$(stat -c %s ${wrapper} 2>/dev/null || printf missing)" "$(readlink -f ${wrapper} 2>/dev/null || printf ${wrapper})"`,
    `exec_target="$(awk '/^exec_target=/{gsub(/"/, "", $0); sub(/^exec_target=/, "", $0); print $0; exit} /^exec /{gsub(/"/, "", $2); print $2; exit}' ${wrapper} 2>/dev/null || true)"`,
    `if [ -n "$exec_target" ]; then printf 'BRIK64_REMOTE_REF\\twrapper_exec_target\\t%s\\t%s\\t%s\\n' "$(sha256sum "$exec_target" 2>/dev/null | awk '{print $1}' || printf missing)" "$(stat -c %s "$exec_target" 2>/dev/null || printf missing)" "$exec_target"; fi`,
    `if grep -q 'BRIK64_L6_CLI_MATERIALIZER_ENDPOINT' ${wrapper} 2>/dev/null; then printf 'BRIK64_WRAPPER_MODE\\tcli_materializer_dispatcher\\n'; elif sed -n '1,12p' ${wrapper} 2>/dev/null | grep -q '^exec '; then printf 'BRIK64_WRAPPER_MODE\\tshell_exec_only\\n'; else printf 'BRIK64_WRAPPER_MODE\\tunknown\\n'; fi`,
  ].join('; '));
  const endpointStatusProbe = ssh(`${wrapper} endpoint-status || ${wrapper} cli-materializer-status || true`);
  return {
    hostProbe,
    remoteRefProbe,
    endpointStatusProbe,
    auditJson: parseJsonObject(hostProbe.stdout),
    remoteRefs: parseRemoteRefs(remoteRefProbe.stdout),
    wrapperMode: parseWrapperMode(remoteRefProbe.stdout),
    endpointStatus: parseEndpointStatus(endpointStatusProbe.stdout),
  };
}

function materializationAttempts(requestLinePath, context) {
  if (skipRemote) return [];
  const encoded = fs.readFileSync(requestLinePath, 'utf8').trim().split('\t')[1];
  return ['l6-cli-materialize', 'beta15.7-cli-materialize', 'materialize', 'compile'].map((command) => {
    const remote = [
      'set -u',
      'tmp="$(mktemp /tmp/brik64-beta15-7-materializer-request.XXXXXX.json)"',
      `printf %s ${JSON.stringify(encoded)} | base64 -d > "$tmp"`,
      `${wrapper} ${command} "@@FILE:$tmp" || true`,
      'rm -f "$tmp"',
    ].join('; ');
    const result = ssh(remote);
    const materializationResult = parseMaterializationResult(`${result.stdout}\n${result.stderr}`);
    const hydrateBlockers = hydrateMaterializationResult(materializationResult);
    const validation = validateMaterializationResult(materializationResult, version, context);
    if (hydrateBlockers.length > 0) {
      validation.accepted = false;
      validation.blockers = [...new Set([...(validation.blockers || []), ...hydrateBlockers])];
      validation.normalized = null;
    }
    return {
      command: [wrapper, command, '@@FILE:<beta15.7-materializer-request>'],
      status: result.status,
      stdout_sha256: sha256(result.stdout),
      stderr_sha256: sha256(result.stderr),
      observed: `${result.stdout}${result.stderr}`.trim().slice(0, 500) || null,
      materializationResult: materializationResult ? { present: true } : null,
      materializationValidation: validation,
    };
  });
}

function main() {
  fs.rmSync(evidenceDir, { recursive: true, force: true });
  fs.rmSync(requestDir, { recursive: true, force: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(requestDir, { recursive: true });

  const blockers = [];
  const inputs = collectInputs(blockers);
  const pcdInputSetSha256 = writeInputHashes(inputs);
  const request = buildRequest(inputs, pcdInputSetSha256, blockers);
  const requestJsonPath = path.join(requestDir, 'request.json');
  const requestLinePath = path.join(requestDir, 'request.line');
  const requestManifestPath = path.join(requestDir, 'request.manifest.json');
  writeJson(requestJsonPath, request);
  fs.writeFileSync(requestLinePath, `BRIK64_L6_CLI_MATERIALIZATION_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`);
  writeJson(requestManifestPath, {
    schemaVersion: 'brik64.l6plus_cli_materializer_request_manifest.v1',
    version,
    decision: blockers.length === 0
      ? 'PASS_BETA15_7_L6_MATERIALIZER_REQUEST_BUNDLE'
      : 'BLOCKED_BETA15_7_L6_MATERIALIZER_REQUEST_BUNDLE',
    request: {
      path: rel(requestJsonPath),
      sha256: sha256File(requestJsonPath),
      bytes: fs.statSync(requestJsonPath).size,
    },
    requestLine: {
      path: rel(requestLinePath),
      sha256: sha256File(requestLinePath),
      bytes: fs.statSync(requestLinePath).size,
    },
    pcdInputSetSha256,
    inputPcds: inputs.map(({ path: itemPath, sha256: itemSha256, bytes }) => ({
      path: itemPath,
      sha256: itemSha256,
      bytes,
    })),
    blockers,
    claimBoundary: request.claimBoundary,
  });

  const remote = probeRemote();
  const context = expectedContext(inputs, sha256File(requestLinePath), remote.remoteRefs);
  const attempts = blockers.length === 0 ? materializationAttempts(requestLinePath, context) : [];
  const accepted = attempts.find((attempt) => attempt.materializationValidation.accepted);
  const materialization = accepted?.materializationValidation.normalized || null;
  const versionMismatchAttempt = attempts.find((attempt) => /version_mismatch:0\.1\.0-beta\.15\.7/.test(attempt.observed || ''));

  if (remote.hostProbe.status !== 0) blockers.push('remote_l6plus_probe_failed');
  if (!skipRemote && remote.auditJson?.decision !== 'PASS') blockers.push('remote_l6plus_audit_not_pass');
  if (versionMismatchAttempt) blockers.push('remote_l6plus_materializer_version_not_supported:0.1.0-beta.15.7');
  if (remote.endpointStatus.statusTag && remote.endpointStatus.statusTag !== 'beta15_7_ready') {
    blockers.push(`remote_l6plus_materializer_endpoint_status:${remote.endpointStatus.statusTag}`);
  }
  if (remote.wrapperMode === 'shell_exec_only' && !materialization) blockers.push('remote_l6plus_wrapper_has_no_cli_materializer_interface');
  if (!materialization) blockers.push('remote_l6plus_materialization_contract_unavailable');
  if (!materialization) blockers.push('generated_artifact_missing');

  const uniqueBlockers = [...new Set(blockers)];
  writeJson(path.join(evidenceDir, 'l6plus_engine_manifest.json'), {
    schemaVersion: 'brik64.cli_beta15_7_l6plus_engine_probe.v1',
    version,
    generatedAt: new Date().toISOString(),
    host,
    serial: parseSerial(remote.hostProbe.stdout),
    claimBoundary: {
      publicClaimsAllowed: false,
      n5FormalClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
    },
    hostProbe: {
      status: remote.hostProbe.status,
      stdout_sha256: sha256(remote.hostProbe.stdout),
      stderr_sha256: sha256(remote.hostProbe.stderr),
      auditDecision: remote.auditJson?.decision || null,
      skipped: skipRemote,
    },
    remoteRefProbe: {
      status: remote.remoteRefProbe.status,
      stdout_sha256: sha256(remote.remoteRefProbe.stdout),
      stderr_sha256: sha256(remote.remoteRefProbe.stderr),
      skipped: skipRemote,
    },
    endpointStatusProbe: {
      status: remote.endpointStatusProbe.status,
      stdout_sha256: sha256(remote.endpointStatusProbe.stdout),
      stderr_sha256: sha256(remote.endpointStatusProbe.stderr),
      skipped: skipRemote,
      statusTag: remote.endpointStatus.statusTag,
    },
    remoteRefs: remote.remoteRefs,
    wrapperMode: remote.wrapperMode,
    materializerRequest: {
      path: rel(requestManifestPath),
      sha256: sha256File(requestManifestPath),
      requestLineSha256: sha256File(requestLinePath),
      accepted: uniqueBlockers.length === 0,
    },
  });

  writeJson(path.join(evidenceDir, 'generated_artifact_manifest.json'), {
    schemaVersion: 'brik64.cli_beta15_7_l6_generated_artifact_manifest.v1',
    version,
    decision: materialization
      ? 'PASS_BETA15_7_L6_ARTIFACT_MATERIALIZATION'
      : 'BLOCKED_BETA15_7_L6_ARTIFACT_MATERIALIZATION',
    generatedByL6PlusN5: materialization?.generatedByL6PlusN5 === true,
    pcdToArtifactHashBound: materialization?.pcdToArtifactHashBound === true,
    artifactSha256: materialization?.generatedArtifactSha256 || null,
    blockers: materialization ? [] : uniqueBlockers,
    inputPcds: materialization?.inputPcds || inputs,
  });

  writeJson(path.join(evidenceDir, 'package.manifest.json'), {
    schemaVersion: 'brik64.cli_beta15_7_l6_package_manifest.v1',
    version,
    decision: materialization
      ? 'PASS_BETA15_7_L6_PACKAGE_MANIFEST'
      : 'BLOCKED_BETA15_7_L6_PACKAGE_MANIFEST',
    artifactToPackageHashBound: materialization?.artifactToPackageHashBound === true,
    packageToReleaseManifestHashBound: materialization?.packageToReleaseManifestHashBound === true,
    packageSha256: materialization?.packageSha256 || null,
    releaseManifestSha256: materialization?.releaseManifestSha256 || null,
    releasePublicationAllowed: materialization !== null,
    blockers: materialization ? [] : uniqueBlockers,
  });

  writeJson(path.join(evidenceDir, 'seal_report.json'), {
    schemaVersion: 'brik64.cli_beta15_7_l6_seal_report.v1',
    version,
    decision: materialization ? 'PASS_BETA15_7_L6_SEAL' : 'BLOCKED_BETA15_7_L6_SEAL',
    compositeSha256: materialization?.compositeSha256 || null,
    blockers: materialization ? [] : ['no_l6_generated_artifact_to_seal'],
  });

  writeJson(path.join(evidenceDir, 'hashes.json'), {
    schemaVersion: 'brik64.cli_beta15_7_l6_hashes.v1',
    version,
    inputPcds: inputs,
    pcdInputSetSha256,
    generatedArtifact: materialization?.generatedArtifactSha256 || null,
    package: materialization?.packageSha256 || null,
    releaseManifest: materialization?.releaseManifestSha256 || null,
  });

  const gateReport = {
    schemaVersion: 'brik64.cli_beta15_7_l6_generation_gate.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: materialization ? 'PASS_BETA15_7_L6_GENERATION_GATE' : 'BLOCKED_BETA15_7_L6_GENERATION_GATE',
    publicationAllowed: materialization !== null,
    releasePublicationAllowed: materialization !== null,
    claimBoundary: {
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
    },
    blockers: uniqueBlockers,
    remoteCapability: {
      wrapperMode: remote.wrapperMode,
      wrapper: remote.remoteRefs.wrapper || null,
      wrapperExecTarget: remote.remoteRefs.wrapper_exec_target || null,
      endpointStatus: remote.endpointStatus,
      materializerContractAccepted: materialization !== null,
      expectedMaterializationContext: context,
    },
    attempts,
    nextAction: materialization
      ? 'bind Beta15.7 package and release manifest to public release train'
      : 'build Beta15.7 package and release manifest, then expose L6+N5 CLI artifact materializer for PCD/polymer -> artifact -> package -> release manifest',
  };
  writeJson(path.join(evidenceDir, 'gate-report.json'), gateReport);

  console.log(`decision=${gateReport.decision}`);
  console.log(`report=${rel(path.join(evidenceDir, 'gate-report.json'))}`);
  if (!materialization) {
    for (const blocker of uniqueBlockers) console.error(blocker);
  }
  process.exit(materialization ? 0 : 2);
}

main();
