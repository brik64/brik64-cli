#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta6-l6-full-generation-contract');
const contractPath = path.join(root, 'pcd', 'l6_full_cli_generation_factory.pcd');
const manifestPath = path.join(root, '.brik', 'manifest.json');
const hetznerReportPath = path.join(root, 'evidence', 'beta6-l6-hetzner-generation', 'report.json');

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
    'required_serial = "BRIK64-L6PLUS-N5-20260601-ee53196434bd17cf"',
    'requires pcd_inventory_hash_bound == true',
    'requires cli_polymer_hash_bound == true',
    'requires technical_sheet_present == true',
    'requires full_cli_compile_supported == true',
    'requires route2_bounded_only == false',
    'requires generated_artifact_hash_bound == true',
    'requires package_manifest_hash_bound == true',
    'requires release_manifest_hash_bound == true',
    'invariant source_to_artifact_chain_hash_bound == true',
    'failure l6_full_cli_generation_endpoint_missing',
    'failure l6_general_compile_route2_bounded_only',
    'failure brik64_pcd_generation_gate_missing'
  ];

  if (!fs.existsSync(contractPath)) blockers.push('contract_pcd_missing');
  if (!fs.existsSync(manifestPath)) blockers.push('manifest_missing');
  if (!fs.existsSync(hetznerReportPath)) blockers.push('hetzner_generation_report_missing');

  let contract = '';
  let manifest = {};
  let hetznerReport = {};
  if (fs.existsSync(contractPath)) contract = fs.readFileSync(contractPath, 'utf8');
  if (fs.existsSync(manifestPath)) manifest = readJson(manifestPath);
  if (fs.existsSync(hetznerReportPath)) hetznerReport = readJson(hetznerReportPath);

  const patternChecks = includesAll(contract, requiredPatterns);
  const missingPatterns = patternChecks.filter((item) => !item.present).map((item) => item.pattern);
  checks.contractPatternsPresent = missingPatterns.length === 0;
  checks.manifestL6Factory = manifest.engineTierPolicy?.internalArtifactFactory === 'L6+N5';
  checks.manifestL6DistributionClosed = manifest.engineTierPolicy?.l6DistributionAllowed === false;
  checks.hetznerIdentityVerified = hetznerReport.checks?.hetznerInstanceMatches === true
    && hetznerReport.checks?.publicIpv4Matches === true
    && hetznerReport.checks?.availabilityZoneMatches === true;
  checks.hetznerFullCompileBlocked = hetznerReport.checks?.fullCliCompileSupported === false
    && hetznerReport.checks?.route2Only === true;
  checks.contractReleaseEligible = false;

  if (!checks.contractPatternsPresent) blockers.push('contract_required_pattern_missing');
  if (!checks.manifestL6Factory) blockers.push('manifest_internal_factory_not_l6n5');
  if (!checks.manifestL6DistributionClosed) blockers.push('manifest_l6_distribution_not_closed');
  if (!checks.hetznerIdentityVerified) blockers.push('hetzner_identity_not_verified');
  if (!checks.hetznerFullCompileBlocked) blockers.push('hetzner_route2_blocker_not_recorded');

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
    checks,
    blockers,
    requiredNextAction: 'Implement or deploy an L6+N5 harness that satisfies pcd/l6_full_cli_generation_factory.pcd and turns the beta6 Hetzner generation gate into PASS_L6_FULL_CLI_GENERATION_READY.'
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
