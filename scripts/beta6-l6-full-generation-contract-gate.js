#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta6-l6-full-generation-contract');
const contractPath = path.join(root, 'pcd', 'l6_full_cli_generation_factory.pcd');
const manifestPath = path.join(root, '.brik', 'manifest.json');
const hetznerReportPath = path.join(root, 'evidence', 'beta6-l6-hetzner-generation', 'report.json');
const materializationReportPath = path.join(root, 'evidence', 'beta6-l6-full-materialization-attempt', 'report.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(file) {
  return fs.readFileSync(file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rel(file) {
  return path.relative(root, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function includesAll(text, patterns) {
  return patterns.map((pattern) => ({
    pattern,
    present: text.includes(pattern)
  }));
}

function main() {
  const blockers = [];
  const checks = {};
  const requiredPatterns = [
    'status: beta6_generation_contract',
    'engine = "L6+N5"',
    'cli_version = "0.1.0-beta.6"',
    'hetzner_instance_id = "125157982"',
    'required_serial = "BRIK64-L6PLUS-N5-20260605-BETA6MP-660de957"',
    'requires pcd_inventory_hash_bound == true',
    'requires cli_polymer_hash_bound == true',
    'requires beta6_package_harness_pcd_hash_bound == true',
    'requires full_materialization_report_hash_bound == true',
    'requires technical_sheet_present == true',
    'requires full_cli_compile_supported == true',
    'requires route2_bounded_only == false',
    'requires generated_artifact_hash_bound == true',
    'requires emitted_harness_artifact_hash_bound == true',
    'requires package_manifest_hash_bound == true',
    'requires release_manifest_hash_bound == true',
    'invariant source_to_artifact_chain_hash_bound == true',
    'invariant harness_code_must_be_generated_from_pcd == true',
    'failure l6_full_cli_generation_endpoint_missing',
    'failure l6_general_compile_route2_bounded_only',
    'failure brik64_pcd_generation_gate_missing',
    'failure harness_pcd_generation_gate_missing'
  ];

  if (!fs.existsSync(contractPath)) blockers.push('contract_pcd_missing');
  if (!fs.existsSync(manifestPath)) blockers.push('manifest_missing');
  if (!fs.existsSync(hetznerReportPath)) blockers.push('hetzner_generation_report_missing');
  if (!fs.existsSync(materializationReportPath)) blockers.push('materialization_report_missing');

  let contract = '';
  let manifest = {};
  let hetznerReport = {};
  let materializationReport = {};
  if (fs.existsSync(contractPath)) contract = fs.readFileSync(contractPath, 'utf8');
  if (fs.existsSync(manifestPath)) manifest = readJson(manifestPath);
  if (fs.existsSync(hetznerReportPath)) hetznerReport = readJson(hetznerReportPath);
  if (fs.existsSync(materializationReportPath)) materializationReport = readJson(materializationReportPath);

  const patternChecks = includesAll(contract, requiredPatterns);
  const missingPatterns = patternChecks.filter((item) => !item.present).map((item) => item.pattern);
  checks.contractPatternsPresent = missingPatterns.length === 0;
  checks.manifestL6Factory = manifest.engineTierPolicy?.internalArtifactFactory === 'L6+N5';
  checks.manifestL6DistributionClosed = manifest.engineTierPolicy?.l6DistributionAllowed === false;
  checks.hetznerIdentityVerified = hetznerReport.checks?.hetznerInstanceMatches === true
    && hetznerReport.checks?.publicIpv4Matches === true
    && hetznerReport.checks?.availabilityZoneMatches === true;
  checks.hetznerFullCompileReady = hetznerReport.decision === 'PASS_L6_FULL_CLI_GENERATION_READY'
    && hetznerReport.checks?.fullCliCompileSupported === true
    && hetznerReport.checks?.route2Only === false;
  checks.materializationPass = materializationReport.decision === 'PASS_BETA6_L6_FULL_HARNESS_MATERIALIZED'
    && materializationReport.remote?.rc === 0
    && Array.isArray(materializationReport.remote?.outFiles)
    && materializationReport.remote.outFiles.length > 0;
  checks.materializationNonRelease = materializationReport.releaseEligible === false;
  checks.contractReleaseEligible = false;

  if (!checks.contractPatternsPresent) blockers.push('contract_required_pattern_missing');
  if (!checks.manifestL6Factory) blockers.push('manifest_internal_factory_not_l6n5');
  if (!checks.manifestL6DistributionClosed) blockers.push('manifest_l6_distribution_not_closed');
  if (!checks.hetznerIdentityVerified) blockers.push('hetzner_identity_not_verified');
  if (!checks.hetznerFullCompileReady) blockers.push('hetzner_full_compile_not_ready');
  if (!checks.materializationPass) blockers.push('beta6_l6_materialization_not_pass');
  if (!checks.materializationNonRelease) blockers.push('beta6_l6_materialization_release_boundary_open');

  const decision = blockers.length === 0
    ? 'PASS_BETA6_L6_FULL_GENERATION_CONTRACT_RECORDED'
    : 'BLOCKED_BETA6_L6_FULL_GENERATION_CONTRACT';

  const report = {
    schemaVersion: 'brik64.beta6_l6_full_generation_contract_gate.v1',
    version: '0.1.0-beta.6',
    generatedAt: new Date().toISOString(),
    lane: 'beta6_l6_full_generation_contract',
    decision,
    releaseEligible: false,
    contract: fs.existsSync(contractPath) ? {
      path: rel(contractPath),
      sha256: sha256(read(contractPath)),
      missingPatterns
    } : null,
    manifest: fs.existsSync(manifestPath) ? {
      path: rel(manifestPath),
      sha256: sha256(read(manifestPath))
    } : null,
    hetznerGenerationReport: fs.existsSync(hetznerReportPath) ? {
      path: rel(hetznerReportPath),
      sha256: sha256(read(hetznerReportPath)),
      decision: hetznerReport.decision,
      blockers: hetznerReport.blockers || []
    } : null,
    materializationReport: fs.existsSync(materializationReportPath) ? {
      path: rel(materializationReportPath),
      sha256: sha256(read(materializationReportPath)),
      decision: materializationReport.decision,
      outFiles: materializationReport.remote?.outFiles || []
    } : null,
    checks,
    blockers,
    requiredNextAction: decision === 'PASS_BETA6_L6_FULL_GENERATION_CONTRACT_RECORDED'
      ? 'Bind emitted harness artifact into package/release manifest and continue beta6 artifact generation.'
      : 'Repair beta6 L6 contract/materialization evidence before package/release manifest binding.'
  };

  writeJson(path.join(outDir, 'report.json'), report);
  process.stdout.write(`decision=${decision}\n`);
  process.stdout.write(`report=${rel(path.join(outDir, 'report.json'))}\n`);
  if (blockers.length > 0) {
    process.stdout.write(`blockers=${blockers.join(',')}\n`);
    process.exitCode = 2;
  }
}

main();
