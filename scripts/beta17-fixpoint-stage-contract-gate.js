#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta17-fixpoint-stage-contract');
const outPath = path.join(outDir, 'report.json');

const contracts = [
  {
    id: 'stage1',
    path: 'pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd',
    requiredNeedles: [
      'canonical_motor_pcd_hash_bound',
      'canonical_harness_pcd_hash_bound',
      'input_set_hash_bound',
      'l6plus_engine_serial_bound',
      'l6plus_materializer_accepts_contract',
      'stage1_artifact_hash_bound',
      'stage1_harness_pass',
      'stage1_seal_pass',
    ],
  },
  {
    id: 'stage2',
    path: 'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd',
    requiredNeedles: [
      'stage1_artifact_hash_bound',
      'stage1_can_execute_regenerator',
      'stage2_regeneration_started_from_stage1',
      'stage2_artifact_hash_bound',
      'byte_identical_hash_match',
      'byte_identical_size_match',
      'harness_replay_pass',
      'adversarial_triad_pass',
      'public_claim_boundary_closed',
    ],
  },
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function rel(file) {
  return path.relative(root, file);
}

function inspectContract(contract, blockers) {
  const absolute = path.join(root, contract.path);
  if (!fs.existsSync(absolute)) {
    blockers.push(`missing_contract:${contract.path}`);
    return {
      id: contract.id,
      path: contract.path,
      exists: false,
    };
  }
  const text = fs.readFileSync(absolute, 'utf8');
  const contractBlockers = [];
  if (!text.startsWith('// brik64.pcd_file.v1')) {
    contractBlockers.push('missing_pcd_header');
  }
  if (!text.includes('claim_boundary: beta17_fixpoint_candidate_source_contract')) {
    contractBlockers.push('missing_beta17_claim_boundary');
  }
  if (!text.includes(`beta17_source_contract: fixpoint_${contract.id}`)) {
    contractBlockers.push(`missing_beta17_source_contract_marker:${contract.id}`);
  }
  for (const needle of contract.requiredNeedles) {
    if (!text.includes(needle)) contractBlockers.push(`missing_required_condition:${needle}`);
    if (!text.includes(`if (${needle} == 0) { return 0; }`)) {
      contractBlockers.push(`missing_fail_closed_guard:${needle}`);
    }
  }
  if (!/return\s+1\s*;/.test(text)) contractBlockers.push('missing_success_return');
  for (const blocker of contractBlockers) blockers.push(`${contract.id}:${blocker}`);
  return {
    id: contract.id,
    path: contract.path,
    exists: true,
    sha256: sha256(text),
    bytes: Buffer.byteLength(text),
    blockers: contractBlockers,
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const blockers = [];
  const inspected = contracts.map((contract) => inspectContract(contract, blockers));
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint_stage_contract_gate.v1',
    generatedAt: new Date().toISOString(),
    version: '0.1.0-beta.17',
    decision: blockers.length === 0
      ? 'PASS_BETA17_FIXPOINT_STAGE_CONTRACT_GATE'
      : 'BLOCKED_BETA17_FIXPOINT_STAGE_CONTRACT_GATE',
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    contracts: inspected,
    blockers,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.decision} ${rel(outPath)}`);
  if (blockers.length > 0) {
    for (const blocker of blockers) console.error(blocker);
    process.exit(1);
  }
}

main();
