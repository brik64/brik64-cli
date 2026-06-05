#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta6-l6-hetzner-generation');
const host = process.env.BRIK64_L6_HOST || 'root@89.167.104.236';
const expected = {
  instanceId: '125157982',
  publicIpv4: '89.167.104.236',
  availabilityZone: 'hel1-dc2',
  documentedServerName: 'ECO-BRIK-HETZNER',
  serial: 'BRIK64-L6PLUS-N5-20260605-BETA6MP-660de957',
  binarySha256: '660de957ccd0ace57ce2a34eb4c0b60baf1912993f2f814eb91ce28978a72ea4',
  binaryPath: '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus',
  serialPath: '/opt/brik64/engines/l6plus-n5/current/serial.txt',
  healthcheckPath: '/opt/brik64/engines/l6plus-n5/bin/healthcheck',
  auditPath: '/opt/brik64/engines/l6plus-n5/bin/audit'
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(file) {
  return fs.readFileSync(file);
}

function rel(file) {
  return path.relative(root, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function ssh(script) {
  return run('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=8',
    host,
    script
  ]);
}

function pcdInventory() {
  const pcdDir = path.join(root, 'pcd');
  return fs.readdirSync(pcdDir)
    .filter((name) => name.endsWith('.pcd'))
    .sort()
    .map((name) => {
      const file = path.join(pcdDir, name);
      const bytes = read(file);
      return {
        path: rel(file),
        sha256: sha256(bytes),
        bytes: bytes.length
      };
    });
}

function parseKeyValueLines(output) {
  const values = {};
  for (const line of output.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function loadCompatibleEvidence() {
  const reportFile = path.join(root, 'evidence', 'beta6-l6-compatible-polymer', 'report.json');
  if (!fs.existsSync(reportFile)) {
    return {
      present: false,
      releaseEligible: false
    };
  }

  try {
    const report = JSON.parse(read(reportFile));
    return {
      present: true,
      path: rel(reportFile),
      sha256: sha256(read(reportFile)),
      decision: report.decision,
      releaseEligible: report.releaseEligible === true,
      parityCases: report.fixtures?.parityCases ?? 0,
      compatibleSource: report.compatibleSource,
      claimBoundary: report.claimBoundary
    };
  } catch (error) {
    return {
      present: true,
      parseError: String(error.message),
      releaseEligible: false
    };
  }
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const blockers = [];
  const checks = {};
  let remote = {};

  const manifestFile = path.join(root, '.brik', 'manifest.json');
  const polymerFile = path.join(root, 'pcd', 'cli_polymer.pcd');
  const inventory = pcdInventory();
  const request = {
    schemaVersion: 'brik64.beta6_l6_hetzner_generation_request.v1',
    version: '0.1.0-beta.6',
    generatedAt: new Date().toISOString(),
    host,
    requiredEngine: 'L6+N5',
    semanticSource: {
      manifest: {
        path: rel(manifestFile),
        sha256: sha256(read(manifestFile))
      },
      polymer: {
        path: rel(polymerFile),
        sha256: sha256(read(polymerFile))
      },
      pcdInventory: {
        count: inventory.length,
        sha256: sha256(JSON.stringify(inventory)),
        files: inventory
      }
    },
    expected
  };
  request.requestSha256 = sha256(JSON.stringify(request));
  writeJson(path.join(outDir, 'generation-request.json'), request);

  try {
    const probe = ssh([
      'set -e',
      'echo HOSTNAME=$(hostname)',
      'echo INSTANCE_ID=$(curl -s --max-time 2 http://169.254.169.254/hetzner/v1/metadata/instance-id || true)',
      'echo PUBLIC_IPV4=$(curl -s --max-time 2 http://169.254.169.254/hetzner/v1/metadata/public-ipv4 || true)',
      'echo AVAILABILITY_ZONE=$(curl -s --max-time 2 http://169.254.169.254/hetzner/v1/metadata/availability-zone || true)',
      `cat ${expected.serialPath}`,
      `sha256sum ${expected.binaryPath}`,
      `${expected.healthcheckPath}`,
      `${expected.auditPath}`,
      `${expected.binaryPath} --version`
    ].join('\n'));
    remote.rawProbe = probe;
    const lines = probe.split('\n').map((line) => line.trim()).filter(Boolean);
    remote.identity = parseKeyValueLines(probe);
    remote.serial = lines.find((line) => line.startsWith('BRIK64-L6PLUS-N5-')) || '';
    remote.binarySha256 = (lines.find((line) => line.includes(expected.binaryPath)) || '').split(/\s+/)[0] || '';
    remote.versionOutput = lines.filter((line) => /^(brikc_cli_l6plus|engine=|lane=|claim_authority=|public_claim_allowed=|general_compile_|route2_|quality_)/.test(line));
    const auditStart = probe.indexOf('{');
    if (auditStart >= 0) {
      const auditEnd = probe.lastIndexOf('}');
      remote.audit = JSON.parse(probe.slice(auditStart, auditEnd + 1));
    }
  } catch (error) {
    blockers.push(`ssh_or_remote_probe_failed:${String(error.message).split('\n')[0]}`);
  }

  checks.sshReachable = blockers.length === 0;
  checks.hetznerInstanceMatches = remote.identity?.INSTANCE_ID === expected.instanceId;
  checks.publicIpv4Matches = remote.identity?.PUBLIC_IPV4 === expected.publicIpv4;
  checks.availabilityZoneMatches = remote.identity?.AVAILABILITY_ZONE === expected.availabilityZone;
  checks.serialMatches = remote.serial === expected.serial;
  checks.binarySha256Matches = remote.binarySha256 === expected.binarySha256;
  checks.healthcheckChecksumsOk = /checksums_ok=[1-9][0-9]*/.test(remote.rawProbe || '');
  checks.auditPass = remote.audit?.decision === 'PASS';
  checks.claimBoundaryClosed = /public_claim_allowed=false/.test(remote.rawProbe || '');
  checks.fullCliCompileSupported = /general_compile_supported=multi_parameter_cli_dispatch/.test(remote.rawProbe || '');
  checks.route2Only = /general_compile_supported=route2_bounded_only/.test(remote.rawProbe || '');

  if (!checks.serialMatches) blockers.push('l6_serial_mismatch');
  if (!checks.hetznerInstanceMatches) blockers.push('hetzner_instance_id_mismatch');
  if (!checks.publicIpv4Matches) blockers.push('hetzner_public_ipv4_mismatch');
  if (!checks.availabilityZoneMatches) blockers.push('hetzner_availability_zone_mismatch');
  if (!checks.binarySha256Matches) blockers.push('l6_binary_sha256_mismatch');
  if (!checks.healthcheckChecksumsOk) blockers.push('l6_healthcheck_missing_checksums_ok');
  if (!checks.auditPass) blockers.push('l6_audit_not_pass');
  if (!checks.claimBoundaryClosed) blockers.push('l6_claim_boundary_not_closed');
  if (!checks.fullCliCompileSupported) blockers.push('l6_full_cli_generation_endpoint_missing');
  if (checks.route2Only) blockers.push('l6_general_compile_route2_bounded_only');

  const decision = blockers.length === 0
    ? 'PASS_L6_FULL_CLI_GENERATION_READY'
    : 'BLOCKED_L6_FULL_CLI_GENERATION_UNAVAILABLE';
  const report = {
    schemaVersion: 'brik64.beta6_l6_hetzner_generation_gate.v1',
    version: '0.1.0-beta.6',
    generatedAt: new Date().toISOString(),
    lane: 'beta6_l6_hetzner_generation_gate',
    decision,
    releaseEligible: decision === 'PASS_L6_FULL_CLI_GENERATION_READY',
    request: {
      path: rel(path.join(outDir, 'generation-request.json')),
      sha256: sha256(JSON.stringify(request, null, 2))
    },
    checks,
    remote,
    compatibleRoute2Evidence: loadCompatibleEvidence(),
    blockers,
    requiredNextAction: decision === 'PASS_L6_FULL_CLI_GENERATION_READY'
      ? 'Run L6 generation and bind generated artifact/package/release hashes.'
      : 'Expose or install the full CLI PCD/polymer generation harness on Hetzner before beta6 publication.'
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
