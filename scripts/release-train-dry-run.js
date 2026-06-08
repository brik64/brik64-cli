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

function packageVersion() {
  return readJson(path.join(root, 'package.json')).version;
}

function allowedStagedBlockers(version) {
  if (version === '0.1.0-beta.9') {
    return new Set([
      'github_release_decision_invalid:STAGED_BETA9_GITHUB_RELEASE_DRAFT',
      'curl_gcp_installer_decision_invalid:STAGED_BETA9_CURL_GCP_INSTALLER',
      'manifest_alignment_decision_invalid:PASS_BETA9_MANIFEST_STAGED_BLOCKED_ALIGNMENT',
      'live_verify_decision_invalid:BLOCKED_BETA9_LIVE_VERIFY'
    ]);
  }
  return new Set();
}

function stagedReadinessDetails(version, readiness) {
  const allowed = allowedStagedBlockers(version);
  const blockers = readiness?.blockers || [];
  const unexpected = blockers.filter((item) => !allowed.has(item));
  const missing = [...allowed].filter((item) => !blockers.includes(item));
  return {
    allowed,
    blockers,
    unexpected,
    missing,
    pass: Boolean(readiness)
      && readiness.decision === 'BLOCKED_BRIK64_CLI_BETA9_RELEASE_READINESS'
      && readiness.functionalGatesPassed === true
      && readiness.packageCandidateReady === true
      && unexpected.length === 0
      && missing.length === 0
  };
}

function runBeta9StagedReadiness() {
  const command = run('beta9_release_readiness', ['node', 'scripts/beta9-release-readiness-gate.js'], {
    stdoutLimit: 12000,
    stderrLimit: 12000
  });
  const readinessPath = path.join(root, 'evidence', 'beta9-release-readiness', 'report.json');
  const readiness = fs.existsSync(readinessPath) ? readJson(readinessPath) : null;
  const details = stagedReadinessDetails('0.1.0-beta.9', readiness);
  return {
    ...command,
    rc: details.pass ? 0 : command.rc,
    stagedBlockedAccepted: details.pass,
    expectedStagedBlockers: [...details.allowed],
    actualBlockers: details.blockers,
    unexpectedBlockers: details.unexpected,
    missingBlockers: details.missing
  };
}

function committedPackageShaGate(version) {
  const label = betaLabel(version);
  const script = `
const fs = require('fs');
const crypto = require('crypto');
const manifest = JSON.parse(fs.readFileSync('release/manifest.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('evidence/${label}-package/package.manifest.json', 'utf8'));
const tarballSha = crypto.createHash('sha256').update(fs.readFileSync(pkg.package.path)).digest('hex');
if (pkg.version !== manifest.version) {
  console.error('cli_package_version_drift:' + pkg.version + ':' + manifest.version);
  process.exit(1);
}
if (pkg.package.sha256 !== manifest.cli.package.sha256 || tarballSha !== manifest.cli.package.sha256) {
  console.error('cli_package_sha_drift:' + pkg.package.sha256 + ':' + tarballSha + ':' + manifest.cli.package.sha256);
  process.exit(1);
}
console.log('decision=PASS_COMMITTED_${label.toUpperCase()}_PACKAGE_SHA_GATE');
`;
  return run(`${label}_committed_package_sha`, ['node', '-e', script], {
    stdoutLimit: 12000,
    stderrLimit: 12000
  });
}

function candidateBranchCommands(version) {
  if (version === '0.1.0-beta.9') {
    return [
      run('beta9_manifest_drift', ['node', 'scripts/beta9-manifest-drift-preflight.js']),
      runBeta9StagedReadiness()
    ];
  }
  if (version === '0.1.0-beta.10') {
    return [
      run('beta10_local_gate', ['npm', 'run', 'gate:beta10:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta10_local_package', ['npm', 'run', 'package:beta10:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta10_package_smoke', ['npm', 'run', 'smoke:beta10:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.11') {
    const runLiveL6Gate = process.env.GITHUB_ACTIONS !== 'true' || process.env.BRIK64_L6_LIVE_GATES === '1';
    return [
      run('beta11_semantic_polymerize', ['npm', 'run', 'gate:beta11:semantic-polymerize'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta11_rust_emitter_clean', ['npm', 'run', 'gate:beta11:rust-emitter-clean'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta11_doctor_empty_workspace', ['npm', 'run', 'gate:beta11:doctor-empty-workspace'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta11_adversarial', ['npm', 'run', 'gate:beta11:adversarial'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      ...(runLiveL6Gate
        ? [
            run('beta11_l6_materialization_attempt', ['npm', 'run', 'attempt:beta11:l6-materialization'], {
              stdoutLimit: 12000,
              stderrLimit: 12000
            }),
            run('beta11_l6_materialization', ['npm', 'run', 'gate:beta11:l6-materialization'], {
              stdoutLimit: 12000,
              stderrLimit: 12000
            })
          ]
        : [])
    ];
  }
  if (version === '0.1.0-beta.12') {
    return [
      run('beta12_semantic_polymerize', ['npm', 'run', 'gate:beta12:semantic-polymerize'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta12_rust_emitter_clean', ['npm', 'run', 'gate:beta12:rust-emitter-clean'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta12_doctor_empty_workspace', ['npm', 'run', 'gate:beta12:doctor-empty-workspace'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta12_adversarial', ['npm', 'run', 'gate:beta12:adversarial'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta12_package_smoke', ['npm', 'run', 'smoke:beta12:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.13') {
    return [
      run('beta13_source_lift', ['npm', 'run', 'gate:beta13:source-lift'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta13_local_package', ['npm', 'run', 'package:beta13:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta13_package_smoke', ['npm', 'run', 'smoke:beta13:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  const label = betaLabel(version);
  return label
    ? [run(`${label}_candidate_missing_dry_run_contract`, ['bash', '-lc', `echo "missing candidate dry-run contract for ${label}" >&2; exit 2`])]
    : [run('candidate_version_unsupported', ['bash', '-lc', `echo "unsupported candidate version ${version}" >&2; exit 2`])];
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
    const enforceSignature = manifest.state !== 'draft' || process.env.BRIK64_REQUIRE_GITHUB_VERIFIED_SIGNATURE === '1';
    return [
      run('beta8_compiler_functionality', ['bash', 'scripts/beta8-compiler-functionality-gate.sh']),
      run('beta8_adversarial', ['bash', 'scripts/beta8-adversarial-gate.sh']),
      run('beta8_local_package', ['bash', 'scripts/build-beta8-package.sh']),
      run('beta8_package_smoke', ['bash', 'scripts/beta8-package-smoke.sh']),
      ...(enforceSignature
        ? [run('beta8_github_verified_signature', ['node', 'scripts/beta8-github-verified-signature-gate.js'])]
        : []),
      ...(canAccessSiblingRepos
        ? []
        : [])
    ];
  }

  if (betaNumber(manifest.version) === 9) {
    return [
      run('beta9_typed_interface', ['npm', 'run', 'gate:beta9:typed-interface']),
      run('beta9_collections', ['npm', 'run', 'gate:beta9:collections']),
      run('beta9_maps', ['npm', 'run', 'gate:beta9:maps']),
      run('beta9_bounded_loops', ['npm', 'run', 'gate:beta9:bounded-loops']),
      run('beta9_scaffolds', ['npm', 'run', 'gate:beta9:scaffolds']),
      run('beta9_local_imports', ['npm', 'run', 'gate:beta9:local-imports']),
      run('beta9_doctor_ux', ['npm', 'run', 'gate:beta9:doctor-ux']),
      run('beta9_pcd_l6_materialization', ['npm', 'run', 'gate:beta9:pcd-l6-materialization']),
      run('beta9_package_smoke', ['npm', 'run', 'smoke:beta9:package']),
      ...(canAccessSiblingRepos
        ? [
            run('beta9_sdk_marketplaces', ['npm', 'run', 'gate:beta9:sdk-marketplaces']),
            run('beta9_skills_sync', ['npm', 'run', 'gate:beta9:skills-sync']),
            run('beta9_docs_web_changelog', ['npm', 'run', 'gate:beta9:docs-web-changelog'])
          ]
        : [])
    ];
  }

  if (betaNumber(manifest.version) === 10) {
    return candidateBranchCommands(manifest.version);
  }

  if (betaNumber(manifest.version) === 11 || betaNumber(manifest.version) === 12 || betaNumber(manifest.version) === 13) {
    return candidateBranchCommands(manifest.version);
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
  const currentPackageVersion = packageVersion();
  const candidateBranchMode = currentPackageVersion !== manifest.version;
  const allowDirty = process.argv.includes('--allow-dirty');
  const failures = [];
  const initialDirtyFiles = gitDirtyFiles();
  if (initialDirtyFiles.length > 0 && !allowDirty) failures.push(`initial_worktree_dirty:${initialDirtyFiles.length}`);

  const beta = betaNumber(manifest.version);
  const draft = manifest.state === 'draft';
  const runLiveL6Gate = process.env.GITHUB_ACTIONS !== 'true' || process.env.BRIK64_L6_LIVE_GATES === '1';
  const canAccessSiblingRepos = process.env.GITHUB_ACTIONS !== 'true';
  const commands = candidateBranchMode
    ? candidateBranchCommands(currentPackageVersion)
    : [
        ...(beta === 10
          ? candidateBranchCommands(manifest.version)
          : []),
        run('manifest_validate', ['node', 'scripts/release-manifest-validate.js', '--allow-dirty']),
        ...(beta === 6 && runLiveL6Gate
          ? [run('beta6_l6_hetzner_generation_gate', ['node', 'scripts/beta6-l6-hetzner-generation-gate.js'])]
          : []),
        run('smoke_tests', ['bash', '-lc', beta === 8 || beta === 9 || beta === 12 ? 'bash -x tests/smoke.sh' : 'BRIK64_RELEASE_GATES=1 bash -x tests/smoke.sh'], {
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
  if (!candidateBranchMode && (!validationReport || validationReport.manifestDigest !== manifestDigest)) {
    failures.push('manifest_validation_digest_missing_or_drift');
  }

  const requiredEvidence = [];
  if (candidateBranchMode) {
    const readinessPath = path.join(root, 'evidence', 'beta9-release-readiness', 'report.json');
    const readiness = fs.existsSync(readinessPath) ? readJson(readinessPath) : null;
    if (currentPackageVersion === '0.1.0-beta.9') {
      if (!readiness) {
        failures.push('candidate_readiness_missing:beta9');
      } else {
        const details = stagedReadinessDetails(currentPackageVersion, readiness);
        requiredEvidence.push({
          id: 'beta9_staged_readiness',
          path: 'evidence/beta9-release-readiness/report.json',
          expectedDecision: 'BLOCKED_BRIK64_CLI_BETA9_RELEASE_READINESS',
          actualDecision: readiness.decision,
          pass: details.pass,
          expectedStagedBlockers: [...details.allowed],
          actualBlockers: details.blockers,
          unexpectedBlockers: details.unexpected,
          missingBlockers: details.missing
        });
        if (readiness.decision !== 'BLOCKED_BRIK64_CLI_BETA9_RELEASE_READINESS') failures.push(`candidate_readiness_decision_invalid:${readiness.decision}`);
        if (readiness.functionalGatesPassed !== true) failures.push('candidate_functional_gates_not_passed');
        if (readiness.packageCandidateReady !== true) failures.push('candidate_package_not_ready');
        if (details.unexpected.length > 0) failures.push(`candidate_unexpected_blockers:${details.unexpected.join('|')}`);
        if (details.missing.length > 0) failures.push(`candidate_missing_expected_blockers:${details.missing.join('|')}`);
      }
    } else if (currentPackageVersion === '0.1.0-beta.10') {
      const beta10Path = path.join(root, 'evidence', 'beta10-local-gate', 'report.json');
      const beta10 = fs.existsSync(beta10Path) ? readJson(beta10Path) : null;
      const beta10PackagePath = path.join(root, 'evidence', 'beta10-package', 'package.manifest.json');
      const beta10Package = fs.existsSync(beta10PackagePath) ? readJson(beta10PackagePath) : null;
      const beta10PackageSmokePath = path.join(root, 'evidence', 'beta10-package-smoke', 'report.json');
      const beta10PackageSmoke = fs.existsSync(beta10PackageSmokePath) ? readJson(beta10PackageSmokePath) : null;
      requiredEvidence.push({
        id: 'beta10_local_gate',
        path: 'evidence/beta10-local-gate/report.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA10_LOCAL_GATE',
        actualDecision: beta10?.decision || null,
        pass: beta10?.decision === 'PASS_BRIK64_CLI_BETA10_LOCAL_GATE'
      });
      requiredEvidence.push({
        id: 'beta10_local_package',
        path: 'evidence/beta10-package/package.manifest.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA10_PACKAGE_BUILT',
        actualDecision: beta10Package?.decision || null,
        pass: beta10Package?.decision === 'PASS_BRIK64_CLI_BETA10_PACKAGE_BUILT'
      });
      requiredEvidence.push({
        id: 'beta10_package_smoke',
        path: 'evidence/beta10-package-smoke/report.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA10_LOCAL_PACKAGE_SMOKE',
        actualDecision: beta10PackageSmoke?.decision || null,
        pass: beta10PackageSmoke?.decision === 'PASS_BRIK64_CLI_BETA10_LOCAL_PACKAGE_SMOKE'
      });
      if (!beta10) failures.push('candidate_readiness_missing:beta10_local_gate');
      else if (beta10.decision !== 'PASS_BRIK64_CLI_BETA10_LOCAL_GATE') failures.push(`candidate_beta10_local_gate_invalid:${beta10.decision}`);
      if (!beta10Package) failures.push('candidate_readiness_missing:beta10_local_package');
      else if (beta10Package.decision !== 'PASS_BRIK64_CLI_BETA10_PACKAGE_BUILT') failures.push(`candidate_beta10_package_invalid:${beta10Package.decision}`);
      if (!beta10PackageSmoke) failures.push('candidate_readiness_missing:beta10_package_smoke');
      else if (beta10PackageSmoke.decision !== 'PASS_BRIK64_CLI_BETA10_LOCAL_PACKAGE_SMOKE') failures.push(`candidate_beta10_package_smoke_invalid:${beta10PackageSmoke.decision}`);
    }
  } else {
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
  }

  const report = {
    schemaVersion: 'brik64.release_train_dry_run_report.v1',
    releaseId: manifest.releaseId,
    version: manifest.version,
    packageVersion: currentPackageVersion,
    candidateBranchMode,
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
