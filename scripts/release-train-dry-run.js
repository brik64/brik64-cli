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
  let text = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    text = fs.readFileSync(file, 'utf8');
    if (text.trim().length > 0) break;
    childProcess.spawnSync('node', ['-e', 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)']);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`json_parse_failed:${path.relative(root, file)}:${error.message}`);
  }
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

function committedSurfaceReportCommand() {
  const script = `
const fs = require('fs');
const required = [
  ['evidence/beta6-sdk-sync/report.json', 'PASS_SDK_BETA6_SYNC'],
  ['evidence/beta6-marketplace-packages/report.json', 'PASS_MARKETPLACE_PACKAGE_GATE'],
  ['evidence/beta6-skills-sync/report.json', 'PASS_SKILLS_BETA6_SYNC'],
  ['evidence/beta6-docs-web-sync/report.json', 'PASS_DOCS_WEB_BETA6_SYNC']
];
const failures = [];
for (const [file, decision] of required) {
  if (!fs.existsSync(file)) {
    failures.push('missing:' + file);
    continue;
  }
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (report.decision !== decision) failures.push(file + ':' + (report.decision || 'missing'));
}
if (failures.length) {
  console.error(failures.join(','));
  process.exit(1);
}
console.log('decision=PASS_BETA6_COMMITTED_SURFACE_REPORTS');
`;
  return run('beta6_committed_surface_reports', ['node', '-e', script]);
}

function betaNumber(version) {
  const match = String(version).match(/^0\.1\.0-beta\.(\d+)$/);
  return match ? Number(match[1]) : null;
}

function betaLabel(version) {
  const number = betaNumber(version);
  return Number.isInteger(number) ? `beta${number}` : null;
}

function manifestDrivenBetaCommands(manifest, canAccessSiblingRepos) {
  const label = betaLabel(manifest.version);
  if (!label) {
    return [
      run('release_surface_gate', ['node', 'scripts/beta5-release-surface-gate.js']),
      run('publication_preflight', ['node', 'scripts/beta5-publication-preflight.js'])
    ];
  }

  if (betaNumber(manifest.version) === 6) {
    return [
      run('beta6_local_package', ['node', 'scripts/build-beta6-package.js']),
      run('beta6_package_smoke', ['node', 'scripts/beta6-package-smoke.js']),
      ...(canAccessSiblingRepos
        ? [
            run('beta6_sdk_sync', ['node', 'scripts/beta6-sdk-sync-gate.js']),
            run('beta6_marketplace_packages', ['node', 'scripts/beta6-marketplace-package-gate.js'])
          ]
        : [committedSurfaceReportCommand()]),
      ...(manifest.state === 'draft'
        ? []
        : canAccessSiblingRepos
          ? [
              run('beta6_skills_sync', ['node', 'scripts/beta6-skills-sync-gate.js']),
              run('beta6_docs_web_sync', ['node', 'scripts/beta6-docs-web-sync-gate.js'])
            ]
          : [])
    ];
  }

  if (betaNumber(manifest.version) === 8) {
    return [
      run('beta8_compiler_functionality', ['bash', 'scripts/beta8-compiler-functionality-gate.sh']),
      run('beta8_adversarial', ['bash', 'scripts/beta8-adversarial-gate.sh']),
      run('beta8_local_package', ['bash', 'scripts/build-beta8-package.sh']),
      run('beta8_package_smoke', ['bash', 'scripts/beta8-package-smoke.sh']),
      ...(canAccessSiblingRepos
        ? []
        : [])
    ];
  }

  return [
    run(`${label}_feature_parity`, ['node', `scripts/${label}-feature-parity-gate.js`]),
    run(`${label}_local_package`, ['node', `scripts/build-${label}-package.js`]),
    run(`${label}_package_smoke`, ['node', `scripts/${label}-package-smoke.js`]),
    ...(canAccessSiblingRepos
      ? [
          run(`${label}_sdk_sync`, ['node', `scripts/${label}-sdk-sync-gate.js`]),
          run(`${label}_marketplace_packages`, ['node', `scripts/${label}-marketplace-package-gate.js`]),
          run(`${label}_skills_sync`, ['node', `scripts/${label}-skills-sync-gate.js`]),
          run(`${label}_docs_web_sync`, ['node', `scripts/${label}-docs-web-sync-gate.js`])
        ]
      : [])
  ];
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

  const beta = betaNumber(manifest.version);
  const draft = manifest.state === 'draft';
  const runLiveL6Gate = process.env.GITHUB_ACTIONS !== 'true' || process.env.BRIK64_L6_LIVE_GATES === '1';
  const canAccessSiblingRepos = process.env.GITHUB_ACTIONS !== 'true';
  const commands = [
    run('manifest_validate', ['node', 'scripts/release-manifest-validate.js', '--allow-dirty']),
    ...(beta === 6 && runLiveL6Gate
      ? [run('beta6_l6_hetzner_generation_gate', ['node', 'scripts/beta6-l6-hetzner-generation-gate.js'])]
      : []),
    run('smoke_tests', ['bash', '-lc', beta === 8 ? 'bash -x tests/smoke.sh' : 'BRIK64_RELEASE_GATES=1 bash -x tests/smoke.sh'], {
      stdoutLimit: 12000,
      stderrLimit: 12000
    }),
    ...manifestDrivenBetaCommands(manifest, canAccessSiblingRepos),
    ...(draft
      ? []
      : [
          run('sync_surfaces', ['node', 'scripts/release-train-sync-surfaces.js']),
          run('publish_plan', ['bash', '-lc', 'BRIK64_RELEASE_TRAIN_DRY_RUN_IN_PROGRESS=1 node scripts/release-train-publish-plan.js']),
          run('publish_execute_dry_run', ['node', 'scripts/release-train-publish-execute.js'])
        ])
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
  for (const command of commands.filter((item) => item.rc !== 0)) {
    process.stdout.write(`failed_command=${command.name}\n`);
    if (command.stdout) process.stdout.write(`stdout:\n${command.stdout}\n`);
    if (command.stderr) process.stdout.write(`stderr:\n${command.stderr}\n`);
  }
  if (failures.length > 0) process.exit(1);
}

main();
