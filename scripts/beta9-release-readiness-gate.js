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
  { id: 'pcd_l6_materialization', command: ['npm', 'run', 'gate:beta9:pcd-l6-materialization'], requiredRc: 0 }
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
  const functionalGateIds = gates
    .filter((gate) => gate.id !== 'pcd_l6_materialization')
    .map((gate) => gate.id);
  const functionalGatesPassed = functionalGateIds.every((id) => {
    const result = results.find((item) => item.id === id);
    return result && result.passed;
  });
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
    blockers,
    gates: results,
    releaseTrainAllowed: blockers.length === 0,
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
      : 'Resolve blockers before beta9 public release. If only beta9_l6_materialization_not_ready remains, materialize beta9 from PCD/polymer through L6+N5 and rerun this gate.'
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.rc);
}

main();
