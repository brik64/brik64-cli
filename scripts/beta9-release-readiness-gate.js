#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const reportPath = process.env.BRIK64_BETA9_RELEASE_READINESS_REPORT
  ? path.resolve(process.env.BRIK64_BETA9_RELEASE_READINESS_REPORT)
  : path.join(root, 'evidence', 'beta9-release-readiness', 'report.json');

const gates = [
  { id: 'typed_interface', command: ['npm', 'run', 'gate:beta9:typed-interface'], requiredRc: 0 },
  { id: 'collections', command: ['npm', 'run', 'gate:beta9:collections'], requiredRc: 0 },
  { id: 'maps', command: ['npm', 'run', 'gate:beta9:maps'], requiredRc: 0 },
  { id: 'bounded_loops', command: ['npm', 'run', 'gate:beta9:bounded-loops'], requiredRc: 0 },
  { id: 'scaffolds', command: ['npm', 'run', 'gate:beta9:scaffolds'], requiredRc: 0 },
  { id: 'local_imports', command: ['npm', 'run', 'gate:beta9:local-imports'], requiredRc: 0 },
  { id: 'doctor_ux', command: ['npm', 'run', 'gate:beta9:doctor-ux'], requiredRc: 0 },
  { id: 'pcd_l6_materialization', command: ['npm', 'run', 'gate:beta9:pcd-l6-materialization'], requiredRc: 0 },
  { id: 'package_smoke', command: ['npm', 'run', 'smoke:beta9:package'], requiredRc: 0 }
];

const publicSurfaceEvidence = [
  { id: 'github_release', path: 'evidence/beta9-public-surfaces/github-release.json', decision: 'PASS_BETA9_GITHUB_RELEASE' },
  { id: 'curl_gcp_installer', path: 'evidence/beta9-public-surfaces/curl-gcp-installer.json', decision: 'PASS_BETA9_CURL_GCP_INSTALLER' },
  { id: 'docs_web_changelog', path: 'evidence/beta9-public-surfaces/docs-web-changelog.json', decision: 'PASS_BETA9_DOCS_WEB_CHANGELOG' },
  { id: 'sdk_marketplaces', path: 'evidence/beta9-public-surfaces/sdk-marketplaces.json', decision: 'PASS_BETA9_SDK_MARKETPLACES' },
  { id: 'skills_sync', path: 'evidence/beta9-public-surfaces/skills-sync.json', decision: 'PASS_BETA9_SKILLS_SYNC' },
  { id: 'live_verify', path: 'evidence/beta9-public-surfaces/live-verify.json', decision: 'PASS_BETA9_LIVE_VERIFY' }
];

function runGate(gate) {
  const started = Date.now();
  const result = spawnSync(gate.command[0], gate.command.slice(1), {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_TOKEN: '',
      GH_TOKEN: ''
    }
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  return {
    id: gate.id,
    command: gate.command.join(' '),
    rc: result.status === null ? 124 : result.status,
    signal: result.signal,
    elapsedMs: Date.now() - started,
    passed: result.status === gate.requiredRc,
    stdoutTail: stdout.slice(-1200),
    stderrTail: stderr.slice(-1200)
  };
}

function main() {
  const results = gates.map(runGate);
  const blockers = [];
  for (const result of results) {
    if (!result.passed) {
      if (result.id === 'pcd_l6_materialization' && result.rc === 2) {
        blockers.push('beta9_l6_materialization_not_ready');
      } else {
        blockers.push(`${result.id}_gate_failed_rc_${result.rc}`);
      }
    }
  }
  const publicSurfaces = publicSurfaceEvidence.map((item) => {
    const file = path.join(root, item.path);
    if (!fs.existsSync(file)) {
      blockers.push(`${item.id}_evidence_missing`);
      return { ...item, exists: false, passed: false };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      const passed = parsed.decision === item.decision;
      if (!passed) blockers.push(`${item.id}_decision_invalid:${parsed.decision || 'missing'}`);
      return { ...item, exists: true, actualDecision: parsed.decision || null, passed };
    } catch (_) {
      blockers.push(`${item.id}_evidence_parse_error`);
      return { ...item, exists: true, passed: false };
    }
  });
  const functionalGateIds = gates
    .filter((gate) => gate.id !== 'pcd_l6_materialization')
    .map((gate) => gate.id);
  const functionalGatesPassed = functionalGateIds.every((id) => {
    const result = results.find((item) => item.id === id);
    return result && result.passed;
  });
  const packageCandidateReady = results.every((result) => result.passed);
  const publicSurfacesPassed = publicSurfaces.every((surface) => surface.passed);
  const decision = blockers.length === 0
    ? 'PASS_BRIK64_CLI_BETA9_RELEASE_READINESS'
    : 'BLOCKED_BRIK64_CLI_BETA9_RELEASE_READINESS';
  const report = {
    schemaVersion: 'brik64.cli_beta9_release_readiness_gate.v1',
    generatedAt: new Date().toISOString(),
    lane: 'cli_0_1_beta9',
    decision,
    rc: blockers.length === 0 ? 0 : 2,
    functionalGatesPassed,
    packageCandidateReady,
    publicSurfacesPassed,
    blockers,
    gates: results,
    publicSurfaces,
    releaseTrainAllowed: blockers.length === 0 && publicSurfacesPassed,
    claimBoundary: {
      publicClaimsAllowed: false,
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
      pureBrik64ChainClaimAllowed: false
    },
    nextAction: blockers.length === 0
      ? 'Proceed to beta9 package, surface sync, live verifier and atomic publication gates.'
      : 'Resolve blockers before beta9 public release. Package readiness is separate from public surface publication readiness.'
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.rc);
}

main();
