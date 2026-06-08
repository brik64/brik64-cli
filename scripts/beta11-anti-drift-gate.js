#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const reportPath = process.env.BRIK64_BETA11_ANTI_DRIFT_REPORT
  ? path.resolve(process.env.BRIK64_BETA11_ANTI_DRIFT_REPORT)
  : path.join(root, 'evidence', 'beta11-anti-drift', 'report.json');

const requiredScripts = [
  'gate:beta11:semantic-polymerize',
  'gate:beta11:rust-emitter-clean',
  'gate:beta11:doctor-empty-workspace',
  'gate:beta11:adversarial',
  'attempt:beta11:l6-materialization',
  'gate:beta11:l6-materialization'
];

const requiredDryRunIds = [
  'beta11_semantic_polymerize',
  'beta11_rust_emitter_clean',
  'beta11_doctor_empty_workspace',
  'beta11_adversarial',
  'beta11_l6_materialization_attempt',
  'beta11_l6_materialization'
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const packageJson = JSON.parse(read('package.json'));
const dryRun = read('scripts/release-train-dry-run.js');
const flowAudit = read('scripts/release-flow-audit.js');
const blockers = [];

for (const script of requiredScripts) {
  if (!packageJson.scripts?.[script]) blockers.push(`package_script_missing:${script}`);
  if (!dryRun.includes(script)) blockers.push(`dry_run_beta11_script_missing:${script}`);
  if (!flowAudit.includes(script)) blockers.push(`flow_audit_beta11_script_missing:${script}`);
}

for (const id of requiredDryRunIds) {
  if (!dryRun.includes(id)) blockers.push(`dry_run_beta11_command_id_missing:${id}`);
}

if (!dryRun.includes("version === '0.1.0-beta.11'")) {
  blockers.push('dry_run_beta11_candidate_branch_missing');
}
if (!dryRun.includes('betaNumber(manifest.version) === 11')) {
  blockers.push('dry_run_beta11_manifest_branch_missing');
}
if (!flowAudit.includes("if (label === 'beta11')")) {
  blockers.push('flow_audit_beta11_required_script_branch_missing');
}

const report = {
  schemaVersion: 'brik64.beta11_anti_drift_gate.v1',
  generatedAt: new Date().toISOString(),
  decision: blockers.length === 0 ? 'PASS_BETA11_ANTI_DRIFT_GATE' : 'BLOCKED_BETA11_ANTI_DRIFT_GATE',
  blockers,
  checked: {
    requiredScripts,
    requiredDryRunIds,
    files: [
      'package.json',
      'scripts/release-train-dry-run.js',
      'scripts/release-flow-audit.js'
    ]
  },
  claimBoundary: {
    publicClaimsAllowed: false,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false
  }
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(blockers.length === 0 ? 0 : 2);
