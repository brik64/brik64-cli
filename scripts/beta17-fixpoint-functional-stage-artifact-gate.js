#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const os = require('os');

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

function runArtifact(artifactPath, args = [], options = {}) {
  const result = childProcess.spawnSync(process.execPath, [artifactPath, ...args], {
    cwd: options.cwd || root,
    encoding: 'utf8',
    env: {
      ...process.env,
      BRIK64_NO_BANNER: '1',
      NO_COLOR: '1',
      BRIK64_CONFIG_HOME: options.configHome || process.env.BRIK64_CONFIG_HOME || path.join(os.tmpdir(), 'brik64-beta17-functional-stage-config'),
    },
    timeout: 10_000,
  });
  return {
    rc: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function writePcd(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function runSemanticSmoke(artifactPath) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta17-stage-semantic-'));
  const configHome = path.join(work, '.config');
  const validPcd = path.join(work, 'program.pcd');
  const invalidPcd = path.join(work, 'invalid.pcd');
  writePcd(validPcd, `// brik64.pcd_file.v1
PC sample {
  domain input: i64 [0, 255];
  fn sample(input: i64) -> i64 {
    if (input == 0) {
      return 1;
    }
    return 2;
  }
}
`);
  writePcd(invalidPcd, `PC bad {
  fn bad(input: i64) -> i64 {
    return 1;
  }
}
`);
  const init = runArtifact(artifactPath, ['init'], { cwd: work, configHome });
  const invalidCertify = runArtifact(artifactPath, ['certify', 'invalid.pcd'], { cwd: work, configHome });
  const certify = runArtifact(artifactPath, ['certify', 'program.pcd'], { cwd: work, configHome });
  const verify = runArtifact(artifactPath, ['verify', 'program.pcd', '--json'], { cwd: work, configHome });
  const emitTs = runArtifact(artifactPath, ['emit', 'program.pcd', '--target', 'ts', '--out', 'out-ts', '--tests'], { cwd: work, configHome });
  const emitPy = runArtifact(artifactPath, ['emit', 'program.pcd', '--target', 'python', '--out', 'out-python', '--tests'], { cwd: work, configHome });
  const polymer = runArtifact(artifactPath, ['polymerize', 'program.pcd', '--inline', '--root', 'sample', '--out', 'polymer.pcd', '--json'], { cwd: work, configHome });
  const liftInput = path.join(work, 'source.js');
  fs.writeFileSync(liftInput, 'function score(x) { if (x > 10) return x - 1; return x + 1; }\n');
  const lift = runArtifact(artifactPath, ['lift', 'js', 'source.js', '--preview'], { cwd: work, configHome });
  return {
    work,
    init,
    invalidCertify,
    certify,
    verify,
    emitTs,
    emitPy,
    polymer,
    lift,
    files: {
      cert: fs.existsSync(path.join(work, 'program.pcd.cert.json')),
      tsProgram: fs.existsSync(path.join(work, 'out-ts', 'program', 'program.mjs')),
      tsTest: fs.existsSync(path.join(work, 'out-ts', 'program', 'program.test.mjs')),
      pyProgram: fs.existsSync(path.join(work, 'out-python', 'brik64_generated_program', 'program.py')),
      pyTest: fs.existsSync(path.join(work, 'out-python', 'tests', 'test_program.py')),
      polymer: fs.existsSync(path.join(work, 'polymer.pcd')),
      polymerManifest: fs.existsSync(path.join(work, 'polymer.pcd.manifest.json')),
    },
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
        checks.execVersion = versionRun.rc === 0 && versionRun.stdout.includes(version);
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
          checks.execBaseCommands[name] = !run.stdout.includes(`${name} command`)
            && !run.stderr.includes(`${name} command`)
            && (run.rc !== 0 || run.stdout.length > 0 || run.stderr.length > 0);
        }
        const semanticSmoke = runSemanticSmoke(artifactPath);
        checks.semanticSmoke = {
          init: semanticSmoke.init.rc === 0,
          invalidCertifyFailClosed: semanticSmoke.invalidCertify.rc !== 0 && /missing_pcd_header|legacy_format_detected|missing_pc_block/.test(`${semanticSmoke.invalidCertify.stdout}\n${semanticSmoke.invalidCertify.stderr}`),
          certify: semanticSmoke.certify.rc === 0 && semanticSmoke.files.cert,
          verifyJson: semanticSmoke.verify.rc === 0 && /"status":\s*"PASS"|"verificationStatus":\s*"PASS"/.test(semanticSmoke.verify.stdout),
          emitTs: semanticSmoke.emitTs.rc === 0 && semanticSmoke.files.tsProgram && semanticSmoke.files.tsTest,
          emitPython: semanticSmoke.emitPy.rc === 0 && semanticSmoke.files.pyProgram && semanticSmoke.files.pyTest,
          polymerize: semanticSmoke.polymer.rc === 0 && semanticSmoke.files.polymer && semanticSmoke.files.polymerManifest,
          liftPreview: semanticSmoke.lift.rc === 0 && /lift|candidate|preview|schemaVersion/i.test(semanticSmoke.lift.stdout),
          workdir: semanticSmoke.work,
        };
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
        for (const [name, passed] of Object.entries(checks.semanticSmoke)) {
          if (name === 'workdir') continue;
          if (!passed) blockers.push(`stage1_artifact_semantic_smoke_failed:${name}`);
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
