#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = process.env.BRIK64_BETA17_VERSION || '0.1.0-beta.17';
const minBytes = Number(process.env.BRIK64_BETA17_MIN_FUNCTIONAL_STAGE_BYTES || 50000);
const manifestPath = argValue('--stage1-manifest', path.join(root, 'evidence', 'beta17-fixpoint', 'stage1_artifact_manifest.json'));
const outPath = argValue('--out', path.join(root, 'evidence', 'beta17-fixpoint-functional-stage-artifact', 'report.json'));

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function isSafeRelativePath(ref) {
  if (typeof ref !== 'string' || ref.length === 0) return false;
  if (path.isAbsolute(ref)) return false;
  const normalized = path.normalize(ref);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) return false;
  return normalized === ref || normalized.replaceAll(path.sep, '/') === ref;
}

function rel(file) {
  return path.relative(root, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function closedClaimBoundary() {
  return {
    publicReleaseAllowed: false,
    definitiveFixpointAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
    publicClaimsAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  };
}

function runArtifact(artifactPath, args = []) {
  const result = childProcess.spawnSync(process.execPath, [artifactPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      BRIK64_NO_BANNER: '1',
      NO_COLOR: '1',
    },
    timeout: 10_000,
  });
  return {
    rc: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function parseJsonOutput(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function main() {
  const blockers = [];
  const checks = {};
  let manifest = null;
  let artifactRef = null;
  let artifactPath = null;
  let artifactText = '';
  let artifactBytes = 0;
  let artifactSha256 = null;

  if (!fs.existsSync(manifestPath)) {
    blockers.push(`missing_stage1_artifact_manifest:${rel(manifestPath)}`);
  } else {
    manifest = readJson(manifestPath);
    checks.stage1ManifestVersion = manifest.version === version;
    checks.generatedByL6PlusN5 = manifest.generatedByL6PlusN5 === true;
    if (!checks.stage1ManifestVersion) blockers.push(`stage1_manifest_version_mismatch:${manifest.version || 'missing'}`);
    if (!checks.generatedByL6PlusN5) blockers.push('stage1_not_generated_by_l6plus_n5');

    artifactRef = manifest.artifact?.path || null;
    if (!isSafeRelativePath(artifactRef)) {
      blockers.push(`stage1_artifact_path_unsafe_or_missing:${artifactRef || 'missing'}`);
    } else {
      artifactPath = path.join(root, artifactRef);
      if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
        blockers.push(`stage1_artifact_missing:${artifactRef}`);
      } else {
        artifactBytes = fs.statSync(artifactPath).size;
        artifactSha256 = sha256File(artifactPath);
        artifactText = fs.readFileSync(artifactPath, 'utf8');
        checks.artifactShaMatches = artifactSha256 === manifest.artifact?.sha256;
        checks.artifactBytesMatch = artifactBytes === manifest.artifact?.bytes;
        checks.artifactMinSize = artifactBytes >= minBytes;
        checks.nodeEntrypoint = artifactText.startsWith('#!/usr/bin/env node');
        checks.versionBound = artifactText.includes(version);
        checks.argvHandling = artifactText.includes('process.argv');
        checks.commandDispatcher = /case\s+['"`][a-z0-9:_-]+['"`]|commands\s*=|commandHandlers\s*=|new Map\(/i.test(artifactText);
        checks.noCandidateOnlyMessage = !artifactText.includes('candidate package is not public-release eligible yet');
        const versionRun = runArtifact(artifactPath, ['--version']);
        const helpRun = runArtifact(artifactPath, ['--help']);
        const engineRun = runArtifact(artifactPath, ['engine', 'status', '--json']);
        const monomersRun = runArtifact(artifactPath, ['monomers', 'list', '--json']);
        const baseCommandRuns = new Map([
          ['certify', runArtifact(artifactPath, ['certify'])],
          ['verify', runArtifact(artifactPath, ['verify'])],
          ['emit', runArtifact(artifactPath, ['emit'])],
          ['polymerize', runArtifact(artifactPath, ['polymerize'])],
          ['lift', runArtifact(artifactPath, ['lift'])],
        ]);
        const engineJson = parseJsonOutput(engineRun.stdout);
        const monomersJson = parseJsonOutput(monomersRun.stdout);
        checks.execVersion = versionRun.rc === 0 && versionRun.stdout === version;
        checks.execHelp = helpRun.rc === 0 && /certify|verify|emit|polymerize|lift|monomers|engine/i.test(helpRun.stdout);
        checks.execEngineStatusJson = engineRun.rc === 0
          && engineJson
          && engineJson.engine === 'L4+N5'
          && engineJson.runtimeProfile === 'l4plus_n5_local'
          && engineJson.localRuntime === 'available';
        checks.execMonomersListJson = monomersRun.rc === 0
          && monomersJson
          && (
            (Array.isArray(monomersJson.monomers) && monomersJson.monomers.length >= 64)
            || Number(monomersJson.totalCount || monomersJson.total || 0) >= 64
          );
        checks.execBaseCommands = {};
        for (const [name, run] of baseCommandRuns.entries()) {
          checks.execBaseCommands[name] = run.rc === 0 && run.stdout.includes(`${name} command`);
        }
        if (!checks.artifactShaMatches) blockers.push('stage1_artifact_sha256_mismatch');
        if (!checks.artifactBytesMatch) blockers.push('stage1_artifact_bytes_mismatch');
        if (!checks.artifactMinSize) blockers.push(`stage1_artifact_too_small:${artifactBytes}:${minBytes}`);
        if (!checks.nodeEntrypoint) blockers.push('stage1_artifact_missing_node_entrypoint');
        if (!checks.versionBound) blockers.push(`stage1_artifact_missing_version:${version}`);
        if (!checks.argvHandling) blockers.push('stage1_artifact_missing_argv_handling');
        if (!checks.commandDispatcher) blockers.push('stage1_artifact_missing_command_dispatcher');
        if (!checks.noCandidateOnlyMessage) blockers.push('stage1_artifact_candidate_only_stub');
        if (!checks.execVersion) blockers.push(`stage1_artifact_exec_version_failed:${versionRun.rc}:${versionRun.stdout || versionRun.stderr || 'empty'}`);
        if (!checks.execHelp) blockers.push(`stage1_artifact_exec_help_failed:${helpRun.rc}:${helpRun.stdout || helpRun.stderr || 'empty'}`);
        if (!checks.execEngineStatusJson) blockers.push(`stage1_artifact_exec_engine_status_json_failed:${engineRun.rc}:${engineRun.stdout || engineRun.stderr || 'empty'}`);
        if (!checks.execMonomersListJson) blockers.push(`stage1_artifact_exec_monomers_list_json_failed:${monomersRun.rc}:${monomersRun.stdout || monomersRun.stderr || 'empty'}`);
        for (const [name, passed] of Object.entries(checks.execBaseCommands)) {
          if (!passed) {
            const run = baseCommandRuns.get(name);
            blockers.push(`stage1_artifact_exec_base_command_failed:${name}:${run.rc}:${run.stdout || run.stderr || 'empty'}`);
          }
        }
      }
    }
  }

  const pass = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.functional_stage_artifact_gate.v1',
    generatedAt: new Date().toISOString(),
    version,
    decision: pass ? 'PASS_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE' : 'BLOCKED_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE',
    releaseEligibleStageArtifact: pass,
    minBytes,
    artifact: artifactRef
      ? {
          path: artifactRef,
          sha256: artifactSha256,
          bytes: artifactBytes,
          expectedSha256: manifest?.artifact?.sha256 || null,
          expectedBytes: manifest?.artifact?.bytes || null,
        }
      : null,
    checks,
    blockers,
    claimBoundary: closedClaimBoundary(),
    nextAction: pass
      ? 'Use this report as one input to package eligibility; public sync and external audit are still required.'
      : 'Regenerate Stage1 through L6+N5 as a full CLI artifact, not a metadata/stub module.',
  };
  writeJson(outPath, report);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`releaseEligibleStageArtifact=${report.releaseEligibleStageArtifact}\n`);
  if (blockers.length > 0) process.stdout.write(`blockers=${blockers.join(',')}\n`);
  if (!pass) process.exit(1);
}

main();
