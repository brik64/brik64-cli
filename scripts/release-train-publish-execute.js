#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'release', 'manifest.json');
const planPath = path.join(root, 'evidence', 'release-train-publish-plan', 'report.json');
const outDir = path.join(root, 'evidence', 'release-train-publish-execute');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function gitOutput(args) {
  return childProcess.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function gitRawOutput(args) {
  return childProcess.execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function commandExists(binary) {
  if (binary.includes('/')) {
    const resolved = path.isAbsolute(binary) ? binary : path.join(root, binary);
    return fs.existsSync(resolved);
  }
  const result = childProcess.spawnSync('bash', ['-lc', `command -v ${quoteShell(binary)} >/dev/null 2>&1`], {
    cwd: root,
    encoding: 'utf8'
  });
  return result.status === 0;
}

function quoteShell(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function pathExists(candidate) {
  if (!candidate) return true;
  if (candidate.includes('*')) {
    const result = childProcess.spawnSync('bash', ['-lc', `compgen -G ${quoteShell(candidate)} >/dev/null`], {
      cwd: root,
      encoding: 'utf8'
    });
    return result.status === 0;
  }
  return fs.existsSync(candidate);
}

function collectCommandPreflight(command) {
  const failures = [];
  const line = command.command;
  const firstToken = line.trim().split(/\s+/)[0];
  if (firstToken && !commandExists(firstToken)) failures.push(`binary_missing:${command.name}:${firstToken}`);

  const pathPatterns = [
    /\/Users\/carlosjperez\/[^\s"'`]+/g,
    /\bscripts\/release\/[^\s"'`]+/g,
    /\bevidence\/release-train-sync\/[^\s"'`]+/g,
    /\brelease\/manifest\.json\b/g,
    /\bCHANGELOG\.md\b/g
  ];
  for (const pattern of pathPatterns) {
    const matches = line.match(pattern) || [];
    for (const match of matches) {
      const resolved = path.isAbsolute(match) ? match : path.join(root, match);
      if (!pathExists(resolved)) failures.push(`path_missing:${command.name}:${match}`);
    }
  }

  return failures;
}

function runCommand(command) {
  const startedAt = Date.now();
  const result = childProcess.spawnSync('bash', ['-lc', command.command], {
    cwd: root,
    encoding: 'utf8',
    env: process.env
  });
  return {
    name: command.name,
    rc: result.status,
    elapsedMs: Date.now() - startedAt,
    stdout: (result.stdout || '').slice(0, 4000),
    stderr: (result.stderr || '').slice(0, 4000)
  };
}

function normalizeGitStatusPath(line) {
  return line.length > 3 ? line.slice(3) : line.trim();
}

function isAllowedGeneratedDirtyFile(file) {
  if (file === 'gha-creds-44279868204c1543.json') return true;
  if (/^gha-creds-[a-f0-9]+\.json$/.test(file)) return true;
  if (/^evidence\/beta\d+-(adversarial|compiler-functionality|github-verified-signature|l6-factory-bridge|local-candidate|package-smoke|package|publication-preflight|release-checksums)\//.test(file)) {
    return true;
  }
  return [
    'evidence/beta5-l6-factory-bridge/',
    'evidence/beta5-local-candidate/',
    'evidence/beta5-package-smoke/',
    'evidence/beta5-package/',
    'evidence/beta5-publication-preflight/',
    'evidence/beta9-public-surfaces/',
    'evidence/beta9-release-readiness/',
    'evidence/release-manifest-validate/',
    'evidence/release-github-verified-signature/',
    'evidence/release-train-dry-run/',
    'evidence/release-train-live-verify/',
    'evidence/release-train-publish-execute/',
    'evidence/release-train-publish-plan/',
    'evidence/release-train-sync/'
  ].some((prefix) => file.startsWith(prefix));
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifestText = readText(manifestPath);
  const manifest = JSON.parse(manifestText);
  const manifestDigest = sha256(manifestText);
  const plan = readJson(planPath);
  const publishRequested = process.argv.includes('--publish');
  const expectedDigest = process.env.BRIK64_RELEASE_MANIFEST_DIGEST || '';
  const failures = [];
  const warnings = [];
  const blockers = [];
  const commandPreflight = [];
  const executed = [];

  if (expectedDigest && expectedDigest !== manifestDigest) failures.push('manifest_digest_input_drift');
  if (plan.manifestDigest !== manifestDigest) failures.push('plan_manifest_digest_drift');
  if (plan.version !== manifest.version) failures.push('plan_version_drift');

  const status = gitRawOutput(['status', '--porcelain']);
  const dirtyFiles = status
    .split('\n')
    .filter(Boolean)
    .map(normalizeGitStatusPath)
    .filter((file) => !isAllowedGeneratedDirtyFile(file));
  if (dirtyFiles.length > 0 && publishRequested) failures.push(`worktree_dirty:${dirtyFiles.length}`);
  if (dirtyFiles.length > 0 && !publishRequested) warnings.push(`worktree_dirty_dry_run:${dirtyFiles.length}`);

  if (publishRequested && plan.decision !== 'PASS_PUBLISH_PREFLIGHT_READY_TO_MUTATE') {
    failures.push(`publish_plan_not_mutation_ready:${plan.decision}`);
  }
  if (!publishRequested && plan.decision !== 'PASS_PUBLISH_PLAN_DRY_RUN') {
    warnings.push(`dry_run_plan_not_plain_dry_run:${plan.decision}`);
  }

  const mutationCommands = (plan.commands || []).filter((command) => command.mutatesPublicSurface);
  const verifierCommands = (plan.commands || []).filter((command) => !command.mutatesPublicSurface);
  for (const command of [...mutationCommands, ...verifierCommands]) {
    const commandFailures = collectCommandPreflight(command);
    commandPreflight.push({
      name: command.name,
      mutatesPublicSurface: command.mutatesPublicSurface,
      pass: commandFailures.length === 0,
      failures: commandFailures
    });
    if (publishRequested) failures.push(...commandFailures);
    else blockers.push(...commandFailures);
  }

  if (publishRequested && failures.length === 0) {
    for (const command of mutationCommands) {
      const result = runCommand(command);
      executed.push(result);
      if (result.rc !== 0) {
        failures.push(`command_failed:${command.name}:${result.rc}`);
        break;
      }
    }
    if (failures.length === 0) {
      for (const command of verifierCommands) {
        const result = runCommand(command);
        executed.push(result);
        if (result.rc !== 0) {
          failures.push(`post_publish_command_failed:${command.name}:${result.rc}`);
          break;
        }
      }
    }
  }

  const report = {
    schemaVersion: 'brik64.release_train_publish_execute_report.v1',
    releaseId: manifest.releaseId,
    version: manifest.version,
    manifestDigest,
    sourceHead: gitOutput(['rev-parse', '--short', 'HEAD']),
    publishRequested,
    publicationMutated: publishRequested && executed.some((item) => item.rc === 0),
    decision: failures.length === 0
      ? publishRequested
        ? 'PASS_RELEASE_TRAIN_PUBLISH_EXECUTE'
        : blockers.length === 0
          ? 'PASS_RELEASE_TRAIN_PUBLISH_EXECUTE_DRY_RUN'
          : 'PASS_RELEASE_TRAIN_PUBLISH_EXECUTE_DRY_RUN_WITH_BLOCKERS'
      : 'FAIL_RELEASE_TRAIN_PUBLISH_EXECUTE',
    boundary: publishRequested
      ? 'Mutation mode executes ordered publication commands after full preflight.'
      : 'Dry-run mode validates the ordered publication commands and never mutates public surfaces.',
    dirtyFiles,
    commandPreflight,
    executed,
    blockers,
    failures,
    warnings
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicationMutated=${report.publicationMutated}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (warnings.length > 0) process.stdout.write(`warnings=${warnings.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
