#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'release', 'manifest.json');
const outDir = path.join(root, 'evidence', 'release-train-dry-run');

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

function run(name, args, options = {}) {
  const startedAt = Date.now();
  const result = childProcess.spawnSync(args[0], args.slice(1), {
    cwd: root,
    encoding: 'utf8',
    env: process.env
  });
  return {
    name,
    command: args.join(' '),
    rc: result.status,
    elapsedMs: Date.now() - startedAt,
    stdout: (result.stdout || '').slice(0, options.stdoutLimit || 4000),
    stderr: (result.stderr || '').slice(0, options.stderrLimit || 4000)
  };
}

function gitDirtyFiles() {
  const status = childProcess.execFileSync('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8'
  });
  return status
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter((file) => ![
      'evidence/release-manifest-validate/report.json',
      'evidence/release-train-dry-run/report.json'
    ].includes(file));
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifestText = readText(manifestPath);
  const manifest = JSON.parse(manifestText);
  const manifestDigest = sha256(manifestText);
  const allowDirty = process.argv.includes('--allow-dirty');
  const failures = [];
  const initialDirtyFiles = gitDirtyFiles();
  if (initialDirtyFiles.length > 0 && !allowDirty) failures.push(`initial_worktree_dirty:${initialDirtyFiles.length}`);

  const commands = [
    run('manifest_validate', ['node', 'scripts/release-manifest-validate.js', '--allow-dirty']),
    run('smoke_tests', ['npm', 'test']),
    run('release_surface_gate', ['node', 'scripts/beta5-release-surface-gate.js']),
    run('publication_preflight', ['node', 'scripts/beta5-publication-preflight.js']),
    run('sync_surfaces', ['node', 'scripts/release-train-sync-surfaces.js']),
    run('publish_plan', ['node', 'scripts/release-train-publish-plan.js']),
    run('publish_execute_dry_run', ['node', 'scripts/release-train-publish-execute.js'])
  ];

  for (const command of commands) {
    if (command.rc !== 0) failures.push(`command_failed:${command.name}:${command.rc}`);
  }

  const validationReportPath = path.join(root, 'evidence', 'release-manifest-validate', 'report.json');
  const validationReport = fs.existsSync(validationReportPath) ? readJson(validationReportPath) : null;
  if (!validationReport || validationReport.manifestDigest !== manifestDigest) failures.push('manifest_validation_digest_missing_or_drift');

  const requiredEvidence = [];
  for (const item of manifest.verification.requiredEvidence) {
    const evidencePath = path.join(root, item.path);
    if (!fs.existsSync(evidencePath)) {
      failures.push(`evidence_missing:${item.id}`);
      continue;
    }
    const evidence = readJson(evidencePath);
    requiredEvidence.push({
      id: item.id,
      path: item.path,
      expectedDecision: item.decision,
      actualDecision: evidence.decision,
      pass: evidence.decision === item.decision
    });
    if (evidence.decision !== item.decision) failures.push(`evidence_decision_drift:${item.id}`);
  }

  const report = {
    schemaVersion: 'brik64.release_train_dry_run_report.v1',
    releaseId: manifest.releaseId,
    version: manifest.version,
    channel: manifest.channel,
    state: manifest.state,
    manifestDigest,
    decision: failures.length === 0 ? 'PASS_RELEASE_TRAIN_DRY_RUN' : 'FAIL_RELEASE_TRAIN_DRY_RUN',
    publicationAllowed: false,
    boundary: 'Dry-run only. This workflow validates manifest, tests and evidence but never publishes public artifacts.',
    initialDirtyFiles,
    commands,
    requiredEvidence,
    failures
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write('publicationAllowed=false\n');
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
