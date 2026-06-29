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

function fileEvidenceRef(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return {
      path: path.relative(root, file),
      sha256: null,
      bytes: null,
    };
  }
  const bytes = fs.readFileSync(file);
  return {
    path: path.relative(root, file),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  };
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
    .map((line) => String(line || '').replace(/^[ MADRCU?!]{1,2}\s+/, ''))
    .filter((file) => !isAllowedGeneratedEvidenceDirtyFile(file));
}

function isAllowedGeneratedEvidenceDirtyFile(file) {
  return [
    'evidence/beta16_1-full-release-audit/report.json',
    'evidence/cli-l6-generation-required/report.json',
    'evidence/release-flow-audit/report.json',
    'evidence/release-github-verified-signature/report.json',
    'evidence/release-manifest-validate/report.json',
    'evidence/release-train-dry-run/report.json',
    'evidence/release-train-publish-execute/report.json',
    'evidence/release-train-publish-plan/report.json',
    'evidence/release-train-sync/changelog.md',
    'evidence/release-train-sync/report.json',
    'evidence/release-train-sync/sync-payload.json'
  ].includes(file);
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
  const match = String(version).match(/^0\.1\.0-beta\.(\d+)(?:\.\d+)*$/);
  return match ? Number(match[1]) : null;
}

function betaLabel(version) {
  const match = String(version).match(/^0\.1\.0-beta\.(\d+)(?:\.(\d+))?(?:\.\d+)*$/);
  if (!match) return null;
  return match[2] ? `beta${match[1]}_${match[2]}` : `beta${match[1]}`;
}

function isBeta15_7Family(version) {
  return /^0\.1\.0-beta\.15\.7(?:\.\d+)?$/.test(String(version));
}

function packageVersion() {
  return readJson(path.join(root, 'package.json')).version;
}

function isPullRequestDryRun() {
  return process.env.GITHUB_ACTIONS === 'true'
    && process.env.GITHUB_EVENT_NAME === 'pull_request'
    && process.env.BRIK64_ENFORCE_CLI_L6_GENERATION !== '1';
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
	  if (pkg.version !== '${version}' || pkg.releaseEligible !== false || pkg.claimBoundary?.publicReleaseAllowed !== false) {
	    console.error('cli_package_version_drift:' + pkg.version + ':' + manifest.version);
	    process.exit(1);
	  }
	}
	if (pkg.package.sha256 !== tarballSha) {
	  console.error('cli_package_internal_sha_drift:' + pkg.package.sha256 + ':' + tarballSha);
	  process.exit(1);
	}
	if (pkg.version === manifest.version && manifest.state !== 'draft' && tarballSha !== manifest.cli.package.sha256) {
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

function cliL6GenerationRequiredGate() {
  if (isPullRequestDryRun()) {
    return run('cli_l6_generation_required_deferred_for_pr', ['node', '-e', `
      console.log('decision=DEFERRED_CLI_L6_GENERATION_REQUIRED_GATE_FOR_PULL_REQUEST');
      console.log('reason=publication workflows and local release dry-runs enforce this gate');
    `]);
  }
  return run('cli_l6_generation_required', ['npm', 'run', 'gate:cli:l6-generation-required'], {
    stdoutLimit: 12000,
    stderrLimit: 12000
  });
}

function beta15_4L6MaterializerGapReportPath() {
  return process.env.BRIK64_BETA15_4_L6_GAP_REPORT
    || path.resolve(root, '..', 'brik64-prod', 'reports', 'beta15_4-cli-l6-materializer-gap', 'gap_report.json');
}

function beta15_4L6MaterializerGapGate() {
  if (isPullRequestDryRun()) {
    return run('beta15_4_l6_materializer_gap_deferred_for_pr', ['node', '-e', `
      console.log('decision=DEFERRED_BETA15_4_L6_MATERIALIZER_GAP_GATE_FOR_PULL_REQUEST');
      console.log('reason=publication workflows and local release dry-runs enforce this gate');
    `]);
  }
  const reportPath = beta15_4L6MaterializerGapReportPath();
  return run('beta15_4_l6_materializer_gap', ['node', 'scripts/beta15_4-l6-materializer-gap-report-validate.js', reportPath], {
    stdoutLimit: 12000,
    stderrLimit: 12000
  });
}

function blockedSurfaceGate(name, reason) {
  return run(name, ['node', '-e', `
    console.error(${JSON.stringify(reason)});
    process.exit(1);
  `], {
    stdoutLimit: 12000,
    stderrLimit: 12000
  });
}

function beta15_7SourceCandidateContract() {
  return run('beta15_7_source_candidate_contract', ['node', '-e', `
    const fs = require('fs');
    const path = require('path');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const version = pkg.version;
    const familyPattern = /^0\\.1\\.0-beta\\.15\\.7(?:\\.\\d+)?$/;
    const outDir = path.join('evidence', 'beta15_7-source-candidate-contract');
    const outPath = path.join(outDir, 'report.json');
    fs.mkdirSync(outDir, { recursive: true });
    const readme = fs.readFileSync('README.md', 'utf8');
    const source = fs.readFileSync(path.join('src', 'brik.js'), 'utf8');
    const blockers = [];
    if (!familyPattern.test(version)) blockers.push('package_version_not_beta15_7_family:' + version);
    if (pkg.version !== version) blockers.push('package_version_mismatch:' + pkg.version);
    if (!String(pkg.description || '').includes('beta15.7')) blockers.push('package_description_not_beta15_7');
    if (!readme.includes(version) || /0\\.1\\.0-beta\\.15\\.6|Beta15\\.6|beta15\\.6|0\\.1\\.0b15\\.post6/.test(readme)) blockers.push('readme_beta15_7_metadata_invalid');
    if (!source.includes("const version = '" + version + "'")) blockers.push('source_version_missing');
    if (!fs.existsSync(path.join('engines', 'l4plus-n5', 'runtime-bundle.manifest.json'))) blockers.push('l4plus_n5_bundle_missing');
    const report = {
      schemaVersion: 'brik64.beta15_7_source_candidate_contract.v1',
      generatedAt: new Date().toISOString(),
      version,
      decision: blockers.length === 0 ? 'PASS_BETA15_7_SOURCE_CANDIDATE_CONTRACT' : 'BLOCKED_BETA15_7_SOURCE_CANDIDATE_CONTRACT',
      releaseEligible: false,
      publicationAllowed: false,
      claimBoundary: {
        publicReleaseAllowed: false,
        l6MaterializationClaimAllowed: false,
        formalN5ClaimAllowed: false,
        fixpointClaimAllowed: false,
        selfHostingClaimAllowed: false,
        rustIndependenceClaimAllowed: false
      },
      checks: {
        packageVersion: pkg.version,
        packageDescription: pkg.description || null,
        readmeHasTargetVersion: readme.includes(version),
        sourceVersionPresent: source.includes("const version = '" + version + "'"),
        l4plusN5BundlePresent: fs.existsSync(path.join('engines', 'l4plus-n5', 'runtime-bundle.manifest.json'))
      },
      blockers
    };
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + String.fromCharCode(10));
    console.log('decision=' + report.decision);
    console.log('publicationAllowed=false');
    if (blockers.length) {
      console.error(blockers.join('\\\\n'));
      process.exit(1);
    }
  `], {
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
  if (version === '0.1.0-beta.14') {
    return [
      run('beta14_functional', ['npm', 'run', 'gate:beta14:functional'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_source_lift', ['npm', 'run', 'gate:beta14:source-lift'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_local_package', ['npm', 'run', 'package:beta14:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta14_package_smoke', ['npm', 'run', 'smoke:beta14:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.14.1') {
    return [
      run('beta14_functional', ['npm', 'run', 'gate:beta14:functional'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_source_lift', ['npm', 'run', 'gate:beta14:source-lift'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_1_audit_closure', ['npm', 'run', 'gate:beta14.1:audit-closure'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_1_local_package', ['npm', 'run', 'package:beta14:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta14_1_package_smoke', ['npm', 'run', 'smoke:beta14:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.14.2') {
    return [
      run('beta14_functional', ['npm', 'run', 'gate:beta14:functional'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_source_lift', ['npm', 'run', 'gate:beta14:source-lift'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_2_audit_closure', ['npm', 'run', 'gate:beta14.2:audit-closure'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_2_local_package', ['npm', 'run', 'package:beta14:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta14_2_package_smoke', ['npm', 'run', 'smoke:beta14:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.14.3') {
    return [
      run('beta14_3_monomer_128', ['npm', 'run', 'gate:beta14.3:monomer-128'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_3_local_package', ['npm', 'run', 'package:beta14.3:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta14_3_package_smoke', ['npm', 'run', 'smoke:beta14.3:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.14.4') {
    return [
      run('beta14_4_monomer_128', ['npm', 'run', 'gate:beta14.4:monomer-128'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_4_128_executable', ['npm', 'run', 'gate:beta14.4:128-executable'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_4_local_package', ['npm', 'run', 'package:beta14.4:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta14_4_package_smoke', ['npm', 'run', 'smoke:beta14.4:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.14.5') {
    return [
      run('beta14_5_monomer_128', ['npm', 'run', 'gate:beta14.5:monomer-128'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_5_128_executable', ['npm', 'run', 'gate:beta14.5:128-executable'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_5_functional_closure', ['npm', 'run', 'gate:beta14.5:functional-closure'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_5_local_package', ['npm', 'run', 'package:beta14.5:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta14_5_package_smoke', ['npm', 'run', 'smoke:beta14.5:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.14.6') {
    return [
      run('beta14_6_domain_contracts', ['npm', 'run', 'gate:beta14.6:domain-parser'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta14_6_local_package', ['npm', 'run', 'package:beta14.6:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta14_6_package_smoke', ['npm', 'run', 'smoke:beta14.6:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.15.1') {
    return [
      run('beta15_1_ledger_dtl', ['npm', 'run', 'gate:beta15.1:ledger-dtl'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_1_local_package', ['npm', 'run', 'package:beta15.1:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta15_1_package_smoke', ['npm', 'run', 'smoke:beta15.1:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.15.2') {
    return [
      run('beta15_2_pre_public_rc', ['npm', 'run', 'gate:beta15.2:pre-public-rc'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_2_local_package', ['npm', 'run', 'package:beta15.2:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta15_2_package_smoke', ['npm', 'run', 'smoke:beta15.2:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.15.3') {
    return [
      cliL6GenerationRequiredGate(),
      run('beta15_3_pre_public_rc', ['npm', 'run', 'gate:beta15.3:pre-public-rc'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_3_local_package', ['npm', 'run', 'package:beta15.3:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta15_3_package_smoke', ['npm', 'run', 'smoke:beta15.3:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.15.4') {
    return [
      cliL6GenerationRequiredGate(),
      beta15_4L6MaterializerGapGate(),
      run('beta15_4_pre_public_rc', ['npm', 'run', 'gate:beta15.4:pre-public-rc'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_4_local_package', ['npm', 'run', 'package:beta15.4:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta15_4_package_smoke', ['npm', 'run', 'smoke:beta15.4:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (isBeta15_7Family(version)) {
    return [
      run('smoke_tests', ['bash', '-lc', 'bash -x tests/smoke.sh'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      beta15_7SourceCandidateContract(),
      run('beta15_7_full_release_audit', ['npm', 'run', 'gate:beta15.7:full-release-audit'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.16.1') {
    return [
      cliL6GenerationRequiredGate(),
      run('beta16_1_full_release_audit', ['npm', 'run', 'gate:beta16.1:full-release-audit'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta16_1_local_package', ['npm', 'run', 'package:beta16.1:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta16_1_package_smoke', ['npm', 'run', 'smoke:beta16.1:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.17') {
    return [
      run('beta17_fixpoint_required_inputs', ['npm', 'run', 'gate:beta17:fixpoint:required-inputs'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta17_fixpoint_readiness', ['npm', 'run', 'gate:beta17:fixpoint-readiness'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.15.5') {
    return [
      cliL6GenerationRequiredGate(),
      run('beta15_5_rust_f64_command_lift', ['npm', 'run', 'gate:beta15.5:rust-f64-command-lift'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_5_pre_public_rc', ['npm', 'run', 'gate:beta15.5:pre-public-rc'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_5_local_package', ['npm', 'run', 'package:beta15.5:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta15_5_package_smoke', ['npm', 'run', 'smoke:beta15.5:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (version === '0.1.0-beta.15.6') {
    return [
      cliL6GenerationRequiredGate(),
      run('beta15_6_rust_f64_command_lift', ['npm', 'run', 'gate:beta15.6:rust-f64-command-lift'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_6_pre_public_rc', ['npm', 'run', 'gate:beta15.6:pre-public-rc'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_6_local_package', ['npm', 'run', 'package:beta15.6:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(version),
      run('beta15_6_package_smoke', ['npm', 'run', 'smoke:beta15.6:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  const label = betaLabel(version);
  return label
    ? [
        ...(betaNumber(version) >= 15 ? [cliL6GenerationRequiredGate()] : []),
        run(`${label}_candidate_missing_dry_run_contract`, ['bash', '-lc', `echo "missing candidate dry-run contract for ${label}" >&2; exit 2`])
      ]
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

  if (betaNumber(manifest.version) === 11 || betaNumber(manifest.version) === 12 || betaNumber(manifest.version) === 13 || betaNumber(manifest.version) === 14) {
    return candidateBranchCommands(manifest.version);
  }

  if (manifest.version === '0.1.0-beta.15.4') {
    if (manifest.state === 'draft') return candidateBranchCommands(manifest.version);
    return [
      cliL6GenerationRequiredGate(),
      beta15_4L6MaterializerGapGate(),
      run('beta15_4_pre_public_rc', ['npm', 'run', 'gate:beta15.4:pre-public-rc'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(manifest.version),
      run('beta15_4_package_smoke', ['npm', 'run', 'smoke:beta15.4:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }

  if (manifest.version === '0.1.0-beta.15.5') {
    return [
      cliL6GenerationRequiredGate(),
      run('beta15_5_rust_f64_command_lift', ['npm', 'run', 'gate:beta15.5:rust-f64-command-lift'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_5_pre_public_rc', ['npm', 'run', 'gate:beta15.5:pre-public-rc'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_5_local_package', ['npm', 'run', 'package:beta15.5:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(manifest.version),
      run('beta15_5_package_smoke', ['npm', 'run', 'smoke:beta15.5:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      ...(manifest.state === 'draft'
        ? []
        : [
            run('beta15_5_marketplace_packages', ['node', 'scripts/beta15_5-marketplace-package-gate.js'], {
              stdoutLimit: 12000,
              stderrLimit: 12000
            }),
            run('beta15_5_public_source_sync', ['node', 'scripts/beta15_5-public-source-sync-gate.js'], {
              stdoutLimit: 12000,
              stderrLimit: 12000
            })
          ])
    ];
  }

  if (manifest.version === '0.1.0-beta.15.6') {
    return [
      cliL6GenerationRequiredGate(),
      run('beta15_6_rust_f64_command_lift', ['npm', 'run', 'gate:beta15.6:rust-f64-command-lift'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_6_pre_public_rc', ['npm', 'run', 'gate:beta15.6:pre-public-rc'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_6_local_package', ['npm', 'run', 'package:beta15.6:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(manifest.version),
      run('beta15_6_package_smoke', ['npm', 'run', 'smoke:beta15.6:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      ...(manifest.state === 'draft'
        ? []
        : [
            run('beta15_6_marketplace_packages', ['node', 'scripts/beta15_6-marketplace-package-gate.js'], {
              stdoutLimit: 12000,
              stderrLimit: 12000
            }),
            run('beta15_6_public_source_sync', ['node', 'scripts/beta15_6-public-source-sync-gate.js'], {
              stdoutLimit: 12000,
              stderrLimit: 12000
            })
          ])
    ];
  }

  if (isBeta15_7Family(manifest.version)) {
    return [
      cliL6GenerationRequiredGate(),
      beta15_7SourceCandidateContract(),
      run('beta15_7_full_release_audit', ['npm', 'run', 'gate:beta15.7:full-release-audit'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta15_7_local_package', ['npm', 'run', 'package:beta15.7:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(manifest.version),
      run('beta15_7_package_smoke', ['npm', 'run', 'smoke:beta15.7:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (manifest.version === '0.1.0-beta.17') {
    return [
      run('beta17_fixpoint_required_inputs', ['npm', 'run', 'gate:beta17:fixpoint:required-inputs'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta17_fixpoint_readiness', ['npm', 'run', 'gate:beta17:fixpoint-readiness'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }
  if (manifest.version === '0.1.0-beta.16.1') {
    return [
      cliL6GenerationRequiredGate(),
      run('beta16_1_full_release_audit', ['npm', 'run', 'gate:beta16.1:full-release-audit'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      run('beta16_1_local_package', ['npm', 'run', 'package:beta16.1:local'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      }),
      committedPackageShaGate(manifest.version),
      run('beta16_1_package_smoke', ['npm', 'run', 'smoke:beta16.1:package'], {
        stdoutLimit: 12000,
        stderrLimit: 12000
      })
    ];
  }

  return [
    ...(betaNumber(manifest.version) >= 15 ? [cliL6GenerationRequiredGate()] : []),
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
  const minimalReleaseManifestMode = !manifest.publicSurfaces && !Array.isArray(manifest.verification?.requiredEvidence);
  const runLiveL6Gate = process.env.GITHUB_ACTIONS !== 'true' || process.env.BRIK64_L6_LIVE_GATES === '1';
  const canAccessSiblingRepos = process.env.GITHUB_ACTIONS !== 'true';
  const commands = candidateBranchMode
    ? candidateBranchCommands(currentPackageVersion)
    : minimalReleaseManifestMode
      ? [
          run('minimal_manifest_version_contract', ['node', '-e', `
            const fs = require('fs');
            const manifest = JSON.parse(fs.readFileSync('release/manifest.json', 'utf8'));
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            if (manifest.version !== pkg.version) {
              console.error('minimal_manifest_version_drift:' + manifest.version + ':' + pkg.version);
              process.exit(1);
            }
            const artifactSha = manifest.cli?.package?.sha256 || manifest.cli?.artifact?.sha256;
            if (!artifactSha) {
              console.error('minimal_manifest_cli_artifact_sha_missing');
              process.exit(1);
            }
            console.log('decision=PASS_MINIMAL_RELEASE_MANIFEST_VERSION_CONTRACT');
          `])
        ]
      : [
        ...(beta === 10
          ? candidateBranchCommands(manifest.version)
          : []),
        run('manifest_validate', ['node', 'scripts/release-manifest-validate.js', '--allow-dirty']),
        run('release_flow_audit', ['npm', 'run', 'release:flow:audit'], {
          stdoutLimit: 12000,
          stderrLimit: 12000
        }),
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
  if (!candidateBranchMode && !minimalReleaseManifestMode && (!validationReport || validationReport.manifestDigest !== manifestDigest)) {
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
    } else if (currentPackageVersion === '0.1.0-beta.14.3') {
      const monomerPath = path.join(root, 'evidence', 'beta14_3-monomer-128', 'report.json');
      const l6Path = path.join(root, 'evidence', 'beta14_3-l6-generation', 'gate-report.json');
      const packagePath = path.join(root, 'evidence', 'beta14_3-package', 'package.manifest.json');
      const packageSmokePath = path.join(root, 'evidence', 'beta14_3-package-smoke', 'report.json');
      const monomer = fs.existsSync(monomerPath) ? readJson(monomerPath) : null;
      const l6 = fs.existsSync(l6Path) ? readJson(l6Path) : null;
      const candidatePackage = fs.existsSync(packagePath) ? readJson(packagePath) : null;
      const candidatePackageSmoke = fs.existsSync(packageSmokePath) ? readJson(packageSmokePath) : null;
      requiredEvidence.push({
        id: 'beta14_3_monomer_128',
        path: 'evidence/beta14_3-monomer-128/report.json',
        expectedDecision: 'PASS_BETA14_3_MONOMER_128_GATE',
        actualDecision: monomer?.decision || null,
        pass: monomer?.decision === 'PASS_BETA14_3_MONOMER_128_GATE'
      });
      requiredEvidence.push({
        id: 'beta14_3_l6_generation_blocker',
        path: 'evidence/beta14_3-l6-generation/gate-report.json',
        expectedDecision: 'PASS_BETA14_3_L6_GENERATION_GATE',
        actualDecision: l6?.decision || null,
        pass: l6?.decision === 'PASS_BETA14_3_L6_GENERATION_GATE'
      });
      requiredEvidence.push({
        id: 'beta14_3_local_package',
        path: 'evidence/beta14_3-package/package.manifest.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA14_3_PACKAGE_BUILT',
        actualDecision: candidatePackage?.decision || null,
        pass: candidatePackage?.decision === 'PASS_BRIK64_CLI_BETA14_3_PACKAGE_BUILT'
          && candidatePackage?.releaseEligible === false
          && candidatePackage?.claimBoundary?.publicReleaseAllowed === false
      });
      requiredEvidence.push({
        id: 'beta14_3_package_smoke',
        path: 'evidence/beta14_3-package-smoke/report.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA14_3_LOCAL_PACKAGE_SMOKE',
        actualDecision: candidatePackageSmoke?.decision || null,
        pass: candidatePackageSmoke?.decision === 'PASS_BRIK64_CLI_BETA14_3_LOCAL_PACKAGE_SMOKE'
          && candidatePackageSmoke?.releaseEligible === false
          && candidatePackageSmoke?.claim_boundary?.public_release_allowed === false
      });
      if (!monomer) failures.push('candidate_readiness_missing:beta14_3_monomer_128');
      else if (monomer.decision !== 'PASS_BETA14_3_MONOMER_128_GATE') failures.push(`candidate_beta14_3_monomer_128_invalid:${monomer.decision}`);
      if (!l6) failures.push('candidate_readiness_missing:beta14_3_l6_generation_gate');
      else if (l6.decision !== 'PASS_BETA14_3_L6_GENERATION_GATE') failures.push(`candidate_beta14_3_l6_generation_decision_invalid:${l6.decision}`);
      if (!candidatePackage) failures.push('candidate_readiness_missing:beta14_3_local_package');
      else if (candidatePackage.decision !== 'PASS_BRIK64_CLI_BETA14_3_PACKAGE_BUILT') failures.push(`candidate_beta14_3_package_invalid:${candidatePackage.decision}`);
      else if (candidatePackage.releaseEligible !== false || candidatePackage.claimBoundary?.publicReleaseAllowed !== false) failures.push('candidate_beta14_3_package_public_boundary_invalid');
      if (!candidatePackageSmoke) failures.push('candidate_readiness_missing:beta14_3_package_smoke');
      else if (candidatePackageSmoke.decision !== 'PASS_BRIK64_CLI_BETA14_3_LOCAL_PACKAGE_SMOKE') failures.push(`candidate_beta14_3_package_smoke_invalid:${candidatePackageSmoke.decision}`);
      else if (candidatePackageSmoke.releaseEligible !== false || candidatePackageSmoke.claim_boundary?.public_release_allowed !== false) failures.push('candidate_beta14_3_smoke_public_boundary_invalid');
    } else if (currentPackageVersion === '0.1.0-beta.15.3') {
      const prePublicPath = path.join(root, 'evidence', 'beta15_3-pre-public-rc', 'report.json');
      const packagePath = path.join(root, 'evidence', 'beta15_3-package', 'package.manifest.json');
      const packageSmokePath = path.join(root, 'evidence', 'beta15_3-package-smoke', 'report.json');
      const l6PreflightPath = path.join(root, 'evidence', 'beta15_3-l6-preflight', 'report.json');
      const prePublic = fs.existsSync(prePublicPath) ? readJson(prePublicPath) : null;
      const candidatePackage = fs.existsSync(packagePath) ? readJson(packagePath) : null;
      const candidatePackageSmoke = fs.existsSync(packageSmokePath) ? readJson(packageSmokePath) : null;
      const l6Preflight = fs.existsSync(l6PreflightPath) ? readJson(l6PreflightPath) : null;
      requiredEvidence.push({
        id: 'beta15_3_pre_public_rc',
        path: 'evidence/beta15_3-pre-public-rc/report.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA15_3_PRE_PUBLIC_RC_GATE',
        actualDecision: prePublic?.decision || null,
        pass: prePublic?.decision === 'PASS_BRIK64_CLI_BETA15_3_PRE_PUBLIC_RC_GATE'
          && prePublic?.releaseEligible === false
      });
      requiredEvidence.push({
        id: 'beta15_3_local_package',
        path: 'evidence/beta15_3-package/package.manifest.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA15_3_PACKAGE_BUILT',
        actualDecision: candidatePackage?.decision || null,
        pass: candidatePackage?.decision === 'PASS_BRIK64_CLI_BETA15_3_PACKAGE_BUILT'
          && candidatePackage?.releaseEligible === false
          && candidatePackage?.claimBoundary?.publicReleaseAllowed === false
      });
      requiredEvidence.push({
        id: 'beta15_3_package_smoke',
        path: 'evidence/beta15_3-package-smoke/report.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA15_3_PACKAGE_SMOKE',
        actualDecision: candidatePackageSmoke?.decision || null,
        pass: candidatePackageSmoke?.decision === 'PASS_BRIK64_CLI_BETA15_3_PACKAGE_SMOKE'
          && candidatePackageSmoke?.releaseEligible === false
      });
      requiredEvidence.push({
        id: 'beta15_3_l6_preflight_non_claim',
        path: 'evidence/beta15_3-l6-preflight/report.json',
        expectedDecision: 'PASS_BETA15_3_L6_PREFLIGHT_NON_CLAIM',
        actualDecision: l6Preflight?.decision || null,
        pass: l6Preflight?.decision === 'PASS_BETA15_3_L6_PREFLIGHT_NON_CLAIM'
          && l6Preflight?.publicClaimAllowed === false
      });
      if (!prePublic) failures.push('candidate_readiness_missing:beta15_3_pre_public_rc');
      else if (prePublic.decision !== 'PASS_BRIK64_CLI_BETA15_3_PRE_PUBLIC_RC_GATE') failures.push(`candidate_beta15_3_pre_public_invalid:${prePublic.decision}`);
      else if (prePublic.releaseEligible !== false) failures.push('candidate_beta15_3_pre_public_boundary_invalid');
      if (!candidatePackage) failures.push('candidate_readiness_missing:beta15_3_local_package');
      else if (candidatePackage.decision !== 'PASS_BRIK64_CLI_BETA15_3_PACKAGE_BUILT') failures.push(`candidate_beta15_3_package_invalid:${candidatePackage.decision}`);
      else if (candidatePackage.releaseEligible !== false || candidatePackage.claimBoundary?.publicReleaseAllowed !== false) failures.push('candidate_beta15_3_package_public_boundary_invalid');
      if (!candidatePackageSmoke) failures.push('candidate_readiness_missing:beta15_3_package_smoke');
      else if (candidatePackageSmoke.decision !== 'PASS_BRIK64_CLI_BETA15_3_PACKAGE_SMOKE') failures.push(`candidate_beta15_3_package_smoke_invalid:${candidatePackageSmoke.decision}`);
      else if (candidatePackageSmoke.releaseEligible !== false) failures.push('candidate_beta15_3_smoke_public_boundary_invalid');
      if (!l6Preflight) failures.push('candidate_readiness_missing:beta15_3_l6_preflight');
      else if (l6Preflight.decision !== 'PASS_BETA15_3_L6_PREFLIGHT_NON_CLAIM') failures.push(`candidate_beta15_3_l6_preflight_invalid:${l6Preflight.decision}`);
      else if (l6Preflight.publicClaimAllowed !== false) failures.push('candidate_beta15_3_l6_preflight_claim_boundary_invalid');
    } else if (currentPackageVersion === '0.1.0-beta.15.4') {
      const prePublicPath = path.join(root, 'evidence', 'beta15_4-pre-public-rc', 'report.json');
      const rustPolymerPath = path.join(root, 'evidence', 'beta15_4-rust-polymer-domain', 'report.json');
      const packagePath = path.join(root, 'evidence', 'beta15_4-package', 'package.manifest.json');
      const packageSmokePath = path.join(root, 'evidence', 'beta15_4-package-smoke', 'report.json');
      const l6RequiredPath = path.join(root, 'evidence', 'cli-l6-generation-required', 'report.json');
      const l6GapPath = beta15_4L6MaterializerGapReportPath();
      const prePublic = fs.existsSync(prePublicPath) ? readJson(prePublicPath) : null;
      const rustPolymer = fs.existsSync(rustPolymerPath) ? readJson(rustPolymerPath) : null;
      const candidatePackage = fs.existsSync(packagePath) ? readJson(packagePath) : null;
      const candidatePackageSmoke = fs.existsSync(packageSmokePath) ? readJson(packageSmokePath) : null;
      const l6Required = fs.existsSync(l6RequiredPath) ? readJson(l6RequiredPath) : null;
      const l6Gap = fs.existsSync(l6GapPath) ? readJson(l6GapPath) : null;
      requiredEvidence.push({
        id: 'beta15_4_rust_polymer_domain',
        path: 'evidence/beta15_4-rust-polymer-domain/report.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA15_4_RUST_POLYMER_DOMAIN_GATE',
        actualDecision: rustPolymer?.decision || null,
        pass: rustPolymer?.decision === 'PASS_BRIK64_CLI_BETA15_4_RUST_POLYMER_DOMAIN_GATE'
          && rustPolymer?.releaseEligible === false
      });
      requiredEvidence.push({
        id: 'beta15_4_pre_public_rc',
        path: 'evidence/beta15_4-pre-public-rc/report.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA15_4_PRE_PUBLIC_RC_GATE',
        actualDecision: prePublic?.decision || null,
        pass: prePublic?.decision === 'PASS_BRIK64_CLI_BETA15_4_PRE_PUBLIC_RC_GATE'
          && prePublic?.releaseEligible === false
      });
      requiredEvidence.push({
        id: 'beta15_4_local_package',
        path: 'evidence/beta15_4-package/package.manifest.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA15_4_PACKAGE_BUILT',
        actualDecision: candidatePackage?.decision || null,
        pass: candidatePackage?.decision === 'PASS_BRIK64_CLI_BETA15_4_PACKAGE_BUILT'
          && candidatePackage?.releaseEligible === false
          && candidatePackage?.claimBoundary?.publicReleaseAllowed === false
      });
      requiredEvidence.push({
        id: 'beta15_4_package_smoke',
        path: 'evidence/beta15_4-package-smoke/report.json',
        expectedDecision: 'PASS_BRIK64_CLI_BETA15_4_PACKAGE_SMOKE',
        actualDecision: candidatePackageSmoke?.decision || null,
        pass: candidatePackageSmoke?.decision === 'PASS_BRIK64_CLI_BETA15_4_PACKAGE_SMOKE'
          && candidatePackageSmoke?.releaseEligible === false
      });
      requiredEvidence.push({
        id: 'beta15_4_l6_generation_required',
        path: 'evidence/cli-l6-generation-required/report.json',
        expectedDecision: 'PASS_CLI_L6_GENERATION_REQUIRED_GATE',
        actualDecision: l6Required?.decision || null,
        pass: l6Required?.decision === 'PASS_CLI_L6_GENERATION_REQUIRED_GATE'
          || (isPullRequestDryRun() && l6Required?.decision === 'BLOCKED_CLI_L6_GENERATION_REQUIRED_GATE')
          || (isPullRequestDryRun() && l6Required?.decision === 'DEFERRED_CLI_L6_GENERATION_REQUIRED_GATE_FOR_PULL_REQUEST')
      });
      requiredEvidence.push({
        id: 'beta15_4_l6_materializer_gap',
        path: path.relative(root, l6GapPath),
        expectedDecision: 'BETA15_4_CLI_L6_MATERIALIZER_GAP_PASS',
        actualDecision: l6Gap?.decision || null,
        pass: l6Gap?.decision === 'BETA15_4_CLI_L6_MATERIALIZER_GAP_PASS'
          || (isPullRequestDryRun() && l6Gap?.decision === 'BETA15_4_CLI_L6_MATERIALIZER_GAP_BLOCKED')
          || (isPullRequestDryRun() && !l6Gap)
      });
      if (!rustPolymer) failures.push('candidate_readiness_missing:beta15_4_rust_polymer_domain');
      else if (rustPolymer.decision !== 'PASS_BRIK64_CLI_BETA15_4_RUST_POLYMER_DOMAIN_GATE') failures.push(`candidate_beta15_4_rust_polymer_invalid:${rustPolymer.decision}`);
      else if (rustPolymer.releaseEligible !== false) failures.push('candidate_beta15_4_rust_polymer_boundary_invalid');
      if (!prePublic) failures.push('candidate_readiness_missing:beta15_4_pre_public_rc');
      else if (prePublic.decision !== 'PASS_BRIK64_CLI_BETA15_4_PRE_PUBLIC_RC_GATE') failures.push(`candidate_beta15_4_pre_public_invalid:${prePublic.decision}`);
      else if (prePublic.releaseEligible !== false) failures.push('candidate_beta15_4_pre_public_boundary_invalid');
      if (!candidatePackage) failures.push('candidate_readiness_missing:beta15_4_local_package');
      else if (candidatePackage.decision !== 'PASS_BRIK64_CLI_BETA15_4_PACKAGE_BUILT') failures.push(`candidate_beta15_4_package_invalid:${candidatePackage.decision}`);
      else if (candidatePackage.releaseEligible !== false || candidatePackage.claimBoundary?.publicReleaseAllowed !== false) failures.push('candidate_beta15_4_package_public_boundary_invalid');
      if (!candidatePackageSmoke) failures.push('candidate_readiness_missing:beta15_4_package_smoke');
      else if (candidatePackageSmoke.decision !== 'PASS_BRIK64_CLI_BETA15_4_PACKAGE_SMOKE') failures.push(`candidate_beta15_4_package_smoke_invalid:${candidatePackageSmoke.decision}`);
      else if (candidatePackageSmoke.releaseEligible !== false) failures.push('candidate_beta15_4_smoke_public_boundary_invalid');
      if (!l6Required) failures.push('candidate_readiness_missing:beta15_4_l6_generation_required');
      else if (
        l6Required.decision !== 'PASS_CLI_L6_GENERATION_REQUIRED_GATE'
        && !(isPullRequestDryRun() && l6Required.decision === 'BLOCKED_CLI_L6_GENERATION_REQUIRED_GATE')
        && !(isPullRequestDryRun() && l6Required.decision === 'DEFERRED_CLI_L6_GENERATION_REQUIRED_GATE_FOR_PULL_REQUEST')
      ) {
        failures.push(`candidate_beta15_4_l6_generation_required_invalid:${l6Required.decision}`);
      }
      if (!l6Gap && !isPullRequestDryRun()) failures.push('candidate_readiness_missing:beta15_4_l6_materializer_gap');
      else if (
        l6Gap
        && l6Gap.decision !== 'BETA15_4_CLI_L6_MATERIALIZER_GAP_PASS'
        && !(isPullRequestDryRun() && l6Gap.decision === 'BETA15_4_CLI_L6_MATERIALIZER_GAP_BLOCKED')
      ) {
        failures.push(`candidate_beta15_4_l6_materializer_gap_invalid:${l6Gap.decision}`);
      }
    } else if (isBeta15_7Family(currentPackageVersion)) {
      const sourceCandidatePath = path.join(root, 'evidence', 'beta15_7-source-candidate-contract', 'report.json');
      const sourceCandidate = fs.existsSync(sourceCandidatePath) ? readJson(sourceCandidatePath) : null;
      requiredEvidence.push({
        id: 'beta15_7_source_candidate_contract',
        path: 'evidence/beta15_7-source-candidate-contract/report.json',
        expectedDecision: 'PASS_BETA15_7_SOURCE_CANDIDATE_CONTRACT',
        actualDecision: sourceCandidate?.decision || null,
        pass: sourceCandidate?.decision === 'PASS_BETA15_7_SOURCE_CANDIDATE_CONTRACT'
          && sourceCandidate?.releaseEligible === false
          && sourceCandidate?.publicationAllowed === false
          && sourceCandidate?.claimBoundary?.publicReleaseAllowed === false
      });
      if (!sourceCandidate) failures.push('candidate_readiness_missing:beta15_7_source_candidate_contract');
      else if (sourceCandidate.decision !== 'PASS_BETA15_7_SOURCE_CANDIDATE_CONTRACT') failures.push(`candidate_beta15_7_source_candidate_contract_invalid:${sourceCandidate.decision}`);
      else if (sourceCandidate.releaseEligible !== false || sourceCandidate.publicationAllowed !== false || sourceCandidate.claimBoundary?.publicReleaseAllowed !== false) {
        failures.push('candidate_beta15_7_source_candidate_boundary_invalid');
      }
    } else if (currentPackageVersion === '0.1.0-beta.17') {
      const requiredInputsPath = path.join(root, 'evidence', 'beta17-fixpoint-required-inputs', 'report.json');
      const requiredInputs = fs.existsSync(requiredInputsPath) ? readJson(requiredInputsPath) : null;
      const requiredInputsRef = fileEvidenceRef(requiredInputsPath);
      requiredEvidence.push({
        id: 'beta17_fixpoint_required_inputs',
        path: requiredInputsRef.path,
        sha256: requiredInputsRef.sha256,
        bytes: requiredInputsRef.bytes,
        expectedDecision: 'PASS_BETA17_FIXPOINT_REQUIRED_INPUTS',
        actualDecision: requiredInputs?.decision || null,
        pass: requiredInputs?.decision === 'PASS_BETA17_FIXPOINT_REQUIRED_INPUTS'
          && requiredInputs?.claimBoundary?.definitiveFixpointAllowed === false
          && requiredInputs?.claimBoundary?.publicReleaseAllowed === false
          && Array.isArray(requiredInputs?.blockers)
          && requiredInputs.blockers.length === 0
      });
      if (!requiredInputs) failures.push('candidate_readiness_missing:beta17_fixpoint_required_inputs');
      else if (requiredInputs.decision !== 'PASS_BETA17_FIXPOINT_REQUIRED_INPUTS') failures.push(`candidate_beta17_fixpoint_required_inputs_invalid:${requiredInputs.decision}`);
      else if (
        requiredInputs.claimBoundary?.definitiveFixpointAllowed !== false
        || requiredInputs.claimBoundary?.publicReleaseAllowed !== false
        || !Array.isArray(requiredInputs.blockers)
        || requiredInputs.blockers.length !== 0
      ) {
        failures.push('candidate_beta17_fixpoint_required_inputs_boundary_invalid');
      }

      const readinessPath = path.join(root, 'evidence', 'beta17-fixpoint-readiness', 'report.json');
      const readiness = fs.existsSync(readinessPath) ? readJson(readinessPath) : null;
      const readinessRef = fileEvidenceRef(readinessPath);
      requiredEvidence.push({
        id: 'beta17_fixpoint_readiness',
        path: readinessRef.path,
        sha256: readinessRef.sha256,
        bytes: readinessRef.bytes,
        expectedDecision: 'PASS_BETA17_FIXPOINT_READINESS_GATE',
        actualDecision: readiness?.decision || null,
        pass: readiness?.decision === 'PASS_BETA17_FIXPOINT_READINESS_GATE'
          && readiness?.claimBoundary?.definitiveFixpointAllowed === true
          && readiness?.claimBoundary?.publicReleaseAllowed === true
          && readiness?.claimBoundary?.formalN5ClaimAllowed === false
          && readiness?.claimBoundary?.universalCorrectnessClaimAllowed === false
      });
      if (!readiness) failures.push('candidate_readiness_missing:beta17_fixpoint_readiness');
      else if (readiness.decision !== 'PASS_BETA17_FIXPOINT_READINESS_GATE') failures.push(`candidate_beta17_fixpoint_readiness_invalid:${readiness.decision}`);
      else if (
        readiness.claimBoundary?.definitiveFixpointAllowed !== true
        || readiness.claimBoundary?.publicReleaseAllowed !== true
        || readiness.claimBoundary?.formalN5ClaimAllowed !== false
        || readiness.claimBoundary?.universalCorrectnessClaimAllowed !== false
      ) {
        failures.push('candidate_beta17_fixpoint_readiness_claim_boundary_invalid');
      }
    }
  } else {
    const manifestRequiredEvidence = Array.isArray(manifest.verification?.requiredEvidence)
      ? manifest.verification.requiredEvidence
      : [];

    for (const item of manifestRequiredEvidence) {
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

    if (!manifestRequiredEvidence.length) {
      requiredEvidence.push({
        id: 'manifest_required_evidence_not_declared',
        path: 'release/manifest.json',
        expectedDecision: 'NO_REQUIRED_EVIDENCE_DECLARED',
        actualDecision: 'NO_REQUIRED_EVIDENCE_DECLARED',
        pass: true
      });
    }
  }

  const report = {
    schemaVersion: 'brik64.release_train_dry_run_report.v1',
    releaseId: manifest.releaseId,
    version: manifest.version,
    packageVersion: currentPackageVersion,
    candidateBranchMode,
    minimalReleaseManifestMode,
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
