#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const defaultSource = '/Users/carlosjperez/Documents/GitHub/brik64-engine-l4plus-n5';
const sourceRoot = path.resolve(process.env.BRIK64_L4PLUS_N5_REPO || defaultSource);
const outDir = path.join(root, 'engines', 'l4plus-n5');

const files = [
  'serial.txt',
  'checksums.tsv',
  'manifest/claim_boundary.json',
  'evidence/l4plus_n5_critical_artifact_lock.json',
  'evidence/l4plus_n5_critical_freeze_certificate.json',
  'evidence/l4plus_n5_critical_freeze_report.json',
  'evidence/l4plus_n5_burn_in_report.json',
  'pcd/engine.manifest.json',
  'pcd/engine.pcd',
  'pcd/l4plus_engine_runtime.bir',
  'pcd/l4plus_engine_runtime.bir.asm',
  'pcd/l4plus_engine_runtime.cert.json',
  'pcd/harness.manifest.json',
  'pcd/harness.pcd',
  'pcd/l4plus_n5_harness.bir',
  'pcd/l4plus_n5_harness.cert.json',
  'pcd/runtime_adapter.manifest.json',
  'pcd/runtime_adapter.pcd',
  'pcd/l4plus_n5_runtime_adapter.bir',
  'pcd/l4plus_n5_runtime_adapter.cert.json'
];

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function copyFile(relativePath) {
  const src = path.join(sourceRoot, relativePath);
  if (!fs.existsSync(src)) throw new Error(`missing_l4_source_artifact:${relativePath}`);
  const dest = path.join(outDir, relativePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return {
    path: path.relative(root, dest),
    sourcePath: src,
    sha256: sha256File(dest),
    bytes: fs.statSync(dest).size
  };
}

function main() {
  if (!fs.existsSync(sourceRoot)) throw new Error(`missing_l4_source_repo:${sourceRoot}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const artifacts = files.map(copyFile);
  const serial = fs.readFileSync(path.join(outDir, 'serial.txt'), 'utf8').trim();
  const claimBoundary = readJson(path.join(outDir, 'manifest', 'claim_boundary.json'));
  const freeze = readJson(path.join(outDir, 'evidence', 'l4plus_n5_critical_freeze_certificate.json'));
  const burnIn = readJson(path.join(outDir, 'evidence', 'l4plus_n5_burn_in_report.json'));

  const blockers = [];
  if (serial !== 'BRIK64-L4PLUS-N5-20260525-12d8e4662dec74a4') blockers.push('l4_serial_unexpected');
  if (claimBoundary.engine !== 'l4plus_n5') blockers.push('l4_claim_boundary_engine_mismatch');
  if (claimBoundary.public_claims_allowed !== true) blockers.push('l4_public_claim_boundary_closed');
  if (claimBoundary.r99_999999_claim_allowed !== false) blockers.push('l4_overclaim_boundary_open');
  if (freeze.decision !== 'PASS') blockers.push('l4_freeze_not_pass');
  if (burnIn.decision !== 'PASS') blockers.push('l4_burn_in_not_pass');

  const manifest = {
    schemaVersion: 'brik64.cli_l4plus_n5_portable_runtime_bundle.v1',
    decision: blockers.length === 0 ? 'PASS_PORTABLE_L4_BUNDLE_PACKAGED' : 'FAIL_PORTABLE_L4_BUNDLE',
    releaseEligible: false,
    runtimeMode: 'portable_bir_bundle',
    nativeExecutableIncluded: false,
    cliVersion: '0.1.0-beta.5',
    engine: 'L4+N5',
    serial,
    sourceRepo: sourceRoot,
    claimBoundary: {
      publicClaimsAllowed: claimBoundary.public_claims_allowed,
      n5Authorized: claimBoundary.n5_authorized,
      r99_9ClaimAllowed: claimBoundary.r99_9_claim_allowed,
      r99_999999ClaimAllowed: claimBoundary.r99_999999_claim_allowed,
      universalCorrectnessClaimAllowed: claimBoundary.universal_correctness_claim_allowed,
      platformCanIssueCertification: claimBoundary.platform_can_issue_certification
    },
    artifacts,
    blockers,
    limitations: [
      'This bundle packages portable PCD/BIR/certificate evidence for offline CLI binding.',
      'It does not include a native executable runtime.',
      'It does not authorize universal correctness claims.'
    ]
  };
  fs.writeFileSync(path.join(outDir, 'runtime-bundle.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`decision=${manifest.decision}\n`);
  process.stdout.write(`serial=${serial}\n`);
  process.stdout.write(`nativeExecutableIncluded=false\n`);
  if (blockers.length > 0) {
    process.stdout.write(`blockers=${blockers.join(',')}\n`);
    process.exit(1);
  }
}

main();
