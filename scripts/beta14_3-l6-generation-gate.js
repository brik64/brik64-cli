#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.14.3';
const evidenceDir = path.join(root, 'evidence', 'beta14_3-l6-generation');
const outputPath = path.join(evidenceDir, 'gate-report.json');
const blockers = [];
const checks = {};

function readJson(name) {
  const file = path.join(evidenceDir, name);
  if (!fs.existsSync(file)) {
    blockers.push(`missing:${name}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    blockers.push(`parse_error:${name}`);
    return null;
  }
}

const engine = readJson('l6plus_engine_manifest.json');
const artifact = readJson('generated_artifact_manifest.json');
const seal = readJson('seal_report.json');
const hashesExists = fs.existsSync(path.join(evidenceDir, 'input_pcd_hashes.tsv'));

if (engine) {
  checks.version = engine.version === version;
  checks.remotePreflight = engine.status === 'PASS_REMOTE_L6_PREFLIGHT_NON_CLAIM';
  checks.auditDecision = engine.auditDecision === 'PASS';
  checks.claimClosed = engine.publicClaimAllowed === false && engine.claimAuthority === 'non_claim';
  for (const [key, ok] of Object.entries(checks)) {
    if (!ok) blockers.push(`engine_${key}_invalid`);
  }
}
if (!hashesExists) blockers.push('input_pcd_hashes_missing');
if (!artifact || artifact.artifactStatus !== 'GENERATED_BY_L6') {
  blockers.push('beta14_3_l6_generated_artifact_missing');
}
if (!seal || seal.decision !== 'PASS_BETA14_3_L6_SEAL') {
  blockers.push('beta14_3_l6_seal_missing');
}

const decision = blockers.length === 0
  ? 'PASS_BETA14_3_L6_GENERATION_GATE'
  : 'BLOCKED_BETA14_3_L6_GENERATION_GATE';
const report = {
  schemaVersion: 'brik64.beta14_3_l6_generation_gate.v1',
  version,
  decision,
  blockers,
  checks,
  publicationAllowed: blockers.length === 0,
  claimBoundary: {
    publicClaimsAllowed: false,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false
  },
  nextAction: blockers.length === 0
    ? 'Continue package and release-train gates.'
    : 'Materialize the Beta14.3 CLI artifact from pcd/beta14_3 through L6+N5, then write generated_artifact_manifest.json and seal_report.json with PASS decisions.'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`decision=${decision}\n`);
if (blockers.length) {
  process.stdout.write(`blockers=${blockers.join(',')}\n`);
  process.exit(2);
}
