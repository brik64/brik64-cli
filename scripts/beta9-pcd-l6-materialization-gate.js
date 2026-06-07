#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.9';
const reportPath = process.env.BRIK64_BETA9_L6_MATERIALIZATION_REPORT
  ? path.resolve(process.env.BRIK64_BETA9_L6_MATERIALIZATION_REPORT)
  : path.join(root, 'evidence', 'beta9-l6-materialization', 'report.json');
const outputPath = process.env.BRIK64_BETA9_PCD_L6_GATE_REPORT
  ? path.resolve(process.env.BRIK64_BETA9_PCD_L6_GATE_REPORT)
  : path.join(root, 'evidence', 'beta9-l6-materialization', 'gate-report.json');

function sha256(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rel(file) {
  return path.relative(root, file);
}

function pcdInventory() {
  const dir = path.join(root, 'pcd');
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.pcd'))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      return { path: rel(file), sha256: sha256(file) };
    });
}

function hashJson(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function hasSha(value) {
  return /^sha256:[0-9a-f]{64}$/.test(String(value || ''));
}

function main() {
  const blockers = [];
  const checks = {};
  const inventory = pcdInventory();
  const expected = {
    version,
    lane: 'cli_0_1_beta',
    generationClaim: 'assisted_generation_non_claim',
    pcdInventoryHash: hashJson(inventory),
    cliPolymerHash: sha256(path.join(root, 'pcd', 'cli_polymer.pcd')),
    beta9ContractHash: sha256(path.join(root, 'pcd', 'cli_beta9_transpiler_contract.pcd'))
  };

  let materialization = null;
  if (!fs.existsSync(reportPath)) {
    blockers.push('manual_surface_pending_pcd_generation');
    blockers.push('beta9_l6_materialization_report_missing');
  } else {
    try {
      materialization = readJson(reportPath);
    } catch (error) {
      blockers.push('beta9_l6_materialization_report_parse_error');
    }
  }

  if (materialization) {
    checks.decision = materialization.decision === 'PASS_BETA9_PCD_L6_MATERIALIZATION';
    checks.version = materialization.version === expected.version;
    checks.lane = materialization.lane === expected.lane;
    checks.generationClaim = materialization.generationClaim === expected.generationClaim;
    checks.pcdInventoryHash = materialization.hashes?.pcdInventoryHash === expected.pcdInventoryHash;
    checks.cliPolymerHash = materialization.hashes?.cliPolymerHash === expected.cliPolymerHash;
    checks.beta9ContractHash = materialization.hashes?.beta9ContractHash === expected.beta9ContractHash;
    checks.factorySerial = typeof materialization.factory?.serial === 'string' && materialization.factory.serial.length > 0;
    checks.factoryStage1Hash = hasSha(materialization.factory?.stage1Hash);
    checks.generatedArtifactHash = hasSha(materialization.hashes?.generatedArtifactHash);
    checks.packageHash = hasSha(materialization.hashes?.packageHash);
    checks.releaseManifestHash = hasSha(materialization.hashes?.releaseManifestHash);
    checks.claimBoundaryClosed =
      materialization.claimBoundary?.publicClaimsAllowed === false
      && materialization.claimBoundary?.formalN5ClaimAllowed === false
      && materialization.claimBoundary?.fixpointClaimAllowed === false
      && materialization.claimBoundary?.selfHostingClaimAllowed === false
      && materialization.claimBoundary?.rustIndependenceClaimAllowed === false
      && materialization.claimBoundary?.pureBrik64ChainClaimAllowed === false;

    for (const [key, ok] of Object.entries(checks)) {
      if (!ok) blockers.push(`beta9_l6_materialization_${key}_invalid`);
    }
  }

  const decision = blockers.length === 0
    ? 'PASS_BETA9_PCD_L6_MATERIALIZATION_GATE'
    : 'BLOCKED_BETA9_PCD_L6_MATERIALIZATION_GATE';
  const gate = {
    schemaVersion: 'brik64.beta9_pcd_l6_materialization_gate.v1',
    generatedAt: new Date().toISOString(),
    decision,
    blockers,
    expected,
    checks,
    inputs: {
      report: rel(reportPath),
      pcdInventory: inventory
    },
    claimBoundary: {
      publicClaimsAllowed: false,
      formalN5ClaimAllowed: false,
      fixpointClaimAllowed: false,
      selfHostingClaimAllowed: false,
      rustIndependenceClaimAllowed: false,
      pureBrik64ChainClaimAllowed: false
    },
    nextAction: blockers.length === 0
      ? 'Continue beta9 package and release-train gates.'
      : 'Materialize beta9 from PCD/polymer through L6+N5 and write evidence/beta9-l6-materialization/report.json before publication.'
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(gate, null, 2)}\n`);
  if (blockers.length) {
    console.error(`BLOCKED ${blockers.join(',')}`);
    process.exit(2);
  }
  console.log(decision);
}

main();
