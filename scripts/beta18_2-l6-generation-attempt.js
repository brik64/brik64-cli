#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = process.env.BRIK64_CLI_ROOT ? path.resolve(process.env.BRIK64_CLI_ROOT) : path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (version !== '0.1.0-beta.18.2') throw new Error(`unsupported_beta18_2_family_version:${version}`);

const label = 'beta18_2';
const evidenceDir = path.join(root, 'evidence', `${label}-l6-generation`);
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const wrapper = process.env.BRIK64_L6_WRAPPER || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const healthcheck = process.env.BRIK64_L6_HEALTHCHECK || '/opt/brik64/engines/l6plus-n5/bin/healthcheck';
const audit = process.env.BRIK64_L6_AUDIT || '/opt/brik64/engines/l6plus-n5/bin/audit';
const skipRemote = process.env.BRIK64_L6_SKIP_REMOTE === '1';

const inputPaths = [
  'pcd/beta18_2/release/developer_assurance_loop_contract.pcd',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
  '.brik/manifest.json',
  'release/manifest.json',
];

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

function rel(file) {
  return path.relative(root, file);
}

function run(command, args) {
  const result = childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 4,
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function ssh(script) {
  if (skipRemote) return { status: 65, stdout: '', stderr: 'remote probe skipped by BRIK64_L6_SKIP_REMOTE=1' };
  return run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, script]);
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

function parseEndpoint(stdout) {
  const result = { endpointLine: null, resultLine: null, statusTag: null };
  for (const line of String(stdout || '').split(/\r?\n/)) {
    if (line.startsWith('BRIK64_L6_CLI_MATERIALIZER_ENDPOINT')) {
      const parts = line.split(/\t|\\t/);
      result.endpointLine = line;
      result.statusTag = parts[2] || null;
    }
    if (line.startsWith('BRIK64_L6_CLI_MATERIALIZATION_RESULT')) result.resultLine = line;
  }
  return result;
}

function parseRemoteRefs(stdout) {
  const refs = {};
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const match = line.match(/^BRIK64_REMOTE_REF\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]*)$/);
    if (!match) continue;
    const [, id, sha, bytes, target] = match;
    refs[id] = { sha256: sha === 'missing' ? null : sha, bytes: bytes === 'missing' ? null : Number(bytes), target: target || null };
  }
  return refs;
}

function parseFactoryStatus(stdout) {
  const result = { line: null, status: null, capabilities: [] };
  for (const line of String(stdout || '').split(/\r?\n/)) {
    if (!line.startsWith('BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY')) continue;
    result.line = line;
    const parts = line.split(/\t|\\t/).filter(Boolean);
    result.status = parts[1] || null;
    result.capabilities = String(parts[2] || '').split(',').filter(Boolean);
  }
  return result;
}

function parseFactoryResult(text) {
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.startsWith('BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT')) continue;
    const parts = line.split(/\t|\\t/);
    const payload = parts[1];
    if (!payload) return null;
    try {
      return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

function safeJoin(relativePath) {
  const normalized = path.normalize(String(relativePath || ''));
  if (!normalized || normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error(`unsafe_relative_path:${relativePath}`);
  }
  return path.join(root, normalized);
}

function collectFactoryInputs(inputs) {
  return inputs.map((item) => {
    const file = path.join(root, item.path);
    const content = fs.readFileSync(file);
    return {
      path: item.path,
      sha256: item.sha256,
      bytes: item.bytes,
      contentBase64: content.toString('base64'),
    };
  });
}

function buildFactoryRequest(inputs, pcdInputSetSha256, packageSha256, releaseManifestSha256) {
  return {
    schemaVersion: 'brik64.l6plus_pcd_artifact_factory_request.v1',
    version,
    artifactKind: 'cli',
    lane: 'cli_0_1_beta',
    iterId: 'beta18.2-developer-assurance-loop',
    sourceCommit: run('git', ['rev-parse', 'HEAD']).stdout.trim() || null,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
    },
    pcdInputSetSha256,
    requiredInputPcdPaths: inputs.map((item) => item.path),
    inputPcds: collectFactoryInputs(inputs),
    outputRefs: {
      generatedArtifact: `evidence/${label}-l6-generation/generated/brik64-cli-${version}.mjs`,
      packageManifest: `evidence/${label}-l6-generation/package.manifest.json`,
      releaseManifest: 'release/manifest.json',
    },
    outputArtifacts: {
      package: packageSha256 ? { path: `evidence/${label}-package/brik64-cli-${version}.tgz`, sha256: packageSha256 } : null,
      releaseManifest: releaseManifestSha256 ? { path: 'release/manifest.json', sha256: releaseManifestSha256 } : null,
    },
    requiredBindings: [
      'generatedByL6PlusN5',
      'generatedFromPcdPolymer',
      'pcdToArtifactHashBound',
      'artifactToPackageHashBound',
      'packageToReleaseManifestHashBound',
      'generationTraceSha256',
      'remoteWrapperSha256',
      'wrapperExecTargetSha256',
      'compositeSha256',
    ],
  };
}

function runFactoryMaterialization(requestLine) {
  if (skipRemote) {
    return { status: 65, stdout: '', stderr: 'remote factory skipped by BRIK64_L6_SKIP_REMOTE=1', result: null };
  }
  const encoded = Buffer.from(requestLine).toString('base64');
  const remote = [
    'set -u',
    'tmp="$(mktemp /tmp/brik64-beta18-2-artifact-factory-request.XXXXXX.line)"',
    `printf %s ${JSON.stringify(encoded)} | base64 -d > "$tmp"`,
    `${wrapper} artifact-factory-materialize "@@FILE:$tmp"`,
    'rc=$?',
    'rm -f "$tmp"',
    'exit "$rc"',
  ].join('; ');
  const result = ssh(remote);
  return {
    ...result,
    result: parseFactoryResult(`${result.stdout}\n${result.stderr}`),
  };
}

function validateAndHydrateFactoryResult(result, request, packageSha256, releaseManifestSha256) {
  const blockers = [];
  if (!result) return { accepted: false, blockers: ['l6plus_artifact_factory_result_missing'], normalized: null };
  if (result.schemaVersion !== 'brik64.l6plus_pcd_artifact_factory_result.v1') blockers.push(`factory_result_schema_mismatch:${result.schemaVersion || 'missing'}`);
  if (result.version !== version) blockers.push(`factory_result_version_mismatch:${result.version || 'missing'}:${version}`);
  if (result.artifactKind !== 'cli') blockers.push(`factory_result_artifact_kind_mismatch:${result.artifactKind || 'missing'}`);
  if (result.generatedByL6PlusN5 !== true) blockers.push('factory_result_not_generated_by_l6plus_n5');
  if (result.generatedFromPcdPolymer !== true) blockers.push('factory_result_not_generated_from_pcd_polymer');
  if (result.pcdInputSetSha256 !== request.pcdInputSetSha256) blockers.push('factory_result_pcd_input_set_sha_mismatch');
  if (!result.generatedArtifactSha256) blockers.push('factory_result_generated_artifact_sha_missing');
  if (!result.artifactContentBase64) blockers.push('factory_result_artifact_content_missing');
  if (!result.factoryRequestSha256) blockers.push('factory_result_request_sha_missing');
  if (!result.generationTraceSha256) blockers.push('factory_result_generation_trace_sha_missing');

  const artifactPath = result.artifact?.path || request.outputRefs.generatedArtifact;
  let hydratedArtifact = null;
  if (result.artifactContentBase64 && artifactPath) {
    try {
      const content = Buffer.from(result.artifactContentBase64, 'base64');
      const contentSha = sha256(content);
      if (contentSha !== result.generatedArtifactSha256) blockers.push('factory_result_artifact_content_sha_mismatch');
      const target = safeJoin(artifactPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
      hydratedArtifact = { path: rel(target), sha256: contentSha, bytes: content.length };
    } catch (error) {
      blockers.push(`factory_result_hydration_failed:${error.message}`);
    }
  }

  const compositeSha256 = sha256([
    request.pcdInputSetSha256,
    result.factoryRequestSha256 || '',
    result.generatedArtifactSha256 || '',
    packageSha256 || '',
    releaseManifestSha256 || '',
  ].join('\n'));

  return {
    accepted: blockers.length === 0,
    blockers,
    normalized: blockers.length === 0 ? {
      generatedByL6PlusN5: true,
      generatedFromPcdPolymer: true,
      pcdToArtifactHashBound: true,
      artifactToPackageHashBound: Boolean(packageSha256),
      packageToReleaseManifestHashBound: Boolean(packageSha256 && releaseManifestSha256),
      packageSha256,
      releaseManifestSha256,
      pcdInputSetSha256: request.pcdInputSetSha256,
      factoryRequestSha256: result.factoryRequestSha256,
      generatedArtifactSha256: result.generatedArtifactSha256,
      generationTraceSha256: result.generationTraceSha256,
      remoteWrapperSha256: result.remoteWrapperSha256 || null,
      wrapperExecTargetSha256: result.wrapperExecTargetSha256 || null,
      compositeSha256,
      l6plusEngineSerial: result.l6plusEngineSerial || null,
      capability: result.capability || null,
      artifact: hydratedArtifact,
      inputPcds: Array.isArray(result.inputPcds) ? result.inputPcds : request.inputPcds.map(({ contentBase64, ...item }) => item),
      rawResultSha256: sha256(JSON.stringify(result)),
    } : null,
  };
}

function main() {
  fs.rmSync(evidenceDir, { recursive: true, force: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  const blockers = [];
  const inputs = [];
  for (const relativePath of inputPaths) {
    const file = path.join(root, relativePath);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      blockers.push(`missing_input:${relativePath}`);
      continue;
    }
    inputs.push({ path: relativePath, sha256: sha256File(file), bytes: fs.statSync(file).size });
  }
  const inputHashBody = `${inputs.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
  fs.writeFileSync(path.join(evidenceDir, 'input_pcd_hashes.tsv'), inputHashBody);

  const hostProbe = ssh(['set -u', `${healthcheck}`, `${wrapper} --version`, `${audit}`].join('; '));
  const endpointProbe = ssh(`${wrapper} endpoint-status || ${wrapper} cli-materializer-status || true`);
  const factoryStatusProbe = ssh(`${wrapper} artifact-factory-status || ${wrapper} pcd-artifact-factory-status || true`);
  const remoteRefProbe = ssh([
    'set -u',
    `printf 'BRIK64_REMOTE_REF\\twrapper\\t%s\\t%s\\t%s\\n' "$(sha256sum ${wrapper} 2>/dev/null | awk '{print $1}' || printf missing)" "$(stat -c %s ${wrapper} 2>/dev/null || printf missing)" "$(readlink -f ${wrapper} 2>/dev/null || printf ${wrapper})"`,
    `exec_target="$(awk '/^exec_target=/{gsub(/"/, "", $0); sub(/^exec_target=/, "", $0); print $0; exit} /^exec /{gsub(/"/, "", $2); print $2; exit}' ${wrapper} 2>/dev/null || true)"`,
    `if [ -n "$exec_target" ]; then printf 'BRIK64_REMOTE_REF\\twrapper_exec_target\\t%s\\t%s\\t%s\\n' "$(sha256sum "$exec_target" 2>/dev/null | awk '{print $1}' || printf missing)" "$(stat -c %s "$exec_target" 2>/dev/null || printf missing)" "$exec_target"; fi`,
  ].join('; '));
  const endpoint = parseEndpoint(endpointProbe.stdout);
  const factoryStatus = parseFactoryStatus(factoryStatusProbe.stdout);
  const advertisedTags = String(endpoint.statusTag || '').split(',').filter(Boolean);
  const supportsBeta18_2 = advertisedTags.includes('beta18_2_ready');
  const auditJson = parseJsonObject(hostProbe.stdout);

  if (hostProbe.status !== 0) blockers.push('remote_l6plus_probe_failed');
  if (!skipRemote && auditJson?.decision !== 'PASS') blockers.push('remote_l6plus_audit_not_pass');
  const packageManifestPath = path.join(root, 'evidence', 'beta18_2-package', 'package.manifest.json');
  const packageManifest = fs.existsSync(packageManifestPath) ? JSON.parse(fs.readFileSync(packageManifestPath, 'utf8')) : null;
  const releaseManifestPath = path.join(root, 'release', 'manifest.json');
  const releaseManifestSha256 = fs.existsSync(releaseManifestPath) ? sha256File(releaseManifestPath) : null;
  const packageSha256 = packageManifest?.package?.sha256 || null;
  if (!packageSha256) blockers.push('beta18_2_package_manifest_missing_package_sha');
  if (!releaseManifestSha256) blockers.push('release_manifest_missing');

  const pcdInputSetSha256 = sha256(inputHashBody);
  const request = buildFactoryRequest(inputs, pcdInputSetSha256, packageSha256, releaseManifestSha256);
  const requestLine = `BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`;
  const requestDir = path.join(root, 'evidence', `${label}-l6-materializer-request`);
  fs.rmSync(requestDir, { recursive: true, force: true });
  fs.mkdirSync(requestDir, { recursive: true });
  writeJson(path.join(requestDir, 'request.json'), request);
  fs.writeFileSync(path.join(requestDir, 'request.line'), requestLine);
  const factoryAttempt = blockers.length === 0 ? runFactoryMaterialization(requestLine) : { status: 1, stdout: '', stderr: 'skipped due local blockers', result: null };
  const factoryValidation = validateAndHydrateFactoryResult(factoryAttempt.result, request, packageSha256, releaseManifestSha256);
  const materialization = factoryValidation.accepted ? factoryValidation.normalized : null;
  if (blockers.length === 0 && !materialization) blockers.push(...factoryValidation.blockers);

  const uniqueBlockers = [...new Set(blockers)];
  const claimBoundary = {
    publicClaimsAllowed: false,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  };

  writeJson(path.join(evidenceDir, 'l6plus_engine_manifest.json'), {
    schemaVersion: 'brik64.cli_beta18_2_l6plus_engine_probe.v1',
    version,
    generatedAt: new Date().toISOString(),
    host,
    wrapper,
    endpointStatus: endpoint,
    advertisedTags,
    remoteRefs: parseRemoteRefs(remoteRefProbe.stdout),
    hostProbe: { status: hostProbe.status, auditDecision: auditJson?.decision || null, stdoutSha256: sha256(hostProbe.stdout), stderrSha256: sha256(hostProbe.stderr) },
    remoteRefProbe: { status: remoteRefProbe.status, stdoutSha256: sha256(remoteRefProbe.stdout), stderrSha256: sha256(remoteRefProbe.stderr) },
    endpointProbe: { status: endpointProbe.status, stdoutSha256: sha256(endpointProbe.stdout), stderrSha256: sha256(endpointProbe.stderr) },
    factoryStatusProbe: { status: factoryStatusProbe.status, stdoutSha256: sha256(factoryStatusProbe.stdout), stderrSha256: sha256(factoryStatusProbe.stderr), status: factoryStatus.status, capabilities: factoryStatus.capabilities },
    factoryRequest: {
      path: rel(path.join(requestDir, 'request.json')),
      sha256: sha256File(path.join(requestDir, 'request.json')),
      requestLinePath: rel(path.join(requestDir, 'request.line')),
      requestLineSha256: sha256File(path.join(requestDir, 'request.line')),
    },
    factoryAttempt: {
      status: factoryAttempt.status,
      stdoutSha256: sha256(factoryAttempt.stdout || ''),
      stderrSha256: sha256(factoryAttempt.stderr || ''),
      resultPresent: Boolean(factoryAttempt.result),
      validation: { accepted: factoryValidation.accepted, blockers: factoryValidation.blockers },
    },
    claimBoundary,
  });

  writeJson(path.join(evidenceDir, 'generated_artifact_manifest.json'), {
    schemaVersion: 'brik64.cli_beta18_2_l6_generated_artifact_manifest.v1',
    version,
    decision: materialization ? 'PASS_BETA18_2_L6_ARTIFACT_MATERIALIZATION' : 'BLOCKED_BETA18_2_L6_ARTIFACT_MATERIALIZATION',
    generatedByL6PlusN5: materialization?.generatedByL6PlusN5 === true,
    generatedFromPcdPolymer: materialization?.generatedFromPcdPolymer === true,
    pcdToArtifactHashBound: materialization?.pcdToArtifactHashBound === true,
    artifactSha256: materialization?.generatedArtifactSha256 || null,
    generationTraceSha256: materialization?.generationTraceSha256 || null,
    artifact: materialization?.artifact || null,
    blockers: uniqueBlockers,
    inputPcds: materialization?.inputPcds || inputs,
  });

  writeJson(path.join(evidenceDir, 'package.manifest.json'), {
    schemaVersion: 'brik64.cli_beta18_2_l6_package_manifest.v1',
    version,
    decision: materialization ? 'PASS_BETA18_2_L6_PACKAGE_MANIFEST' : 'BLOCKED_BETA18_2_L6_PACKAGE_MANIFEST',
    artifactToPackageHashBound: materialization?.artifactToPackageHashBound === true,
    packageToReleaseManifestHashBound: materialization?.packageToReleaseManifestHashBound === true,
    packageSha256: materialization?.packageSha256 || packageSha256,
    releaseManifestSha256: materialization?.releaseManifestSha256 || releaseManifestSha256,
    releasePublicationAllowed: materialization !== null,
    blockers: uniqueBlockers,
  });

  writeJson(path.join(evidenceDir, 'seal_report.json'), {
    schemaVersion: 'brik64.cli_beta18_2_l6_seal_report.v1',
    version,
    decision: materialization ? 'PASS_BETA18_2_L6_SEAL' : 'BLOCKED_BETA18_2_L6_SEAL',
    compositeSha256: materialization?.compositeSha256 || null,
    blockers: materialization ? [] : uniqueBlockers.length ? uniqueBlockers : ['no_l6_generated_artifact_to_seal'],
  });

  writeJson(path.join(evidenceDir, 'hashes.json'), {
    schemaVersion: 'brik64.cli_beta18_2_l6_hashes.v1',
    version,
    inputPcds: inputs,
    pcdInputSetSha256,
    generatedArtifact: materialization?.generatedArtifactSha256 || null,
    package: materialization?.packageSha256 || packageSha256,
    releaseManifest: materialization?.releaseManifestSha256 || releaseManifestSha256,
    factoryRequest: materialization?.factoryRequestSha256 || sha256File(path.join(requestDir, 'request.line')),
    generationTrace: materialization?.generationTraceSha256 || null,
    composite: materialization?.compositeSha256 || null,
  });

  writeJson(path.join(evidenceDir, 'gate-report.json'), {
    schemaVersion: 'brik64.cli_beta18_2_l6_generation_gate.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: materialization ? 'PASS_BETA18_2_L6_GENERATION_GATE' : 'BLOCKED_BETA18_2_L6_GENERATION_GATE',
    publicationAllowed: materialization !== null,
    releasePublicationAllowed: materialization !== null,
    claimBoundary,
    blockers: uniqueBlockers,
    remoteCapability: {
      endpointStatus: endpoint,
      advertisedTags,
      beta18_2Ready: supportsBeta18_2,
      artifactFactoryStatus: factoryStatus,
      artifactFactoryAccepted: materialization !== null,
    },
  });

  console.log(`${materialization ? 'PASS_BETA18_2_L6_GENERATION_GATE' : 'BLOCKED_BETA18_2_L6_GENERATION_GATE'} ${rel(path.join(evidenceDir, 'gate-report.json'))}`);
  if (!materialization) {
    for (const blocker of uniqueBlockers) console.error(blocker);
    process.exit(1);
  }
}

main();
