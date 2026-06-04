#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta5-l6-factory-bridge');
const version = '0.1.0-beta.5';
const expected = {
  host: process.env.BRIK64_L6_HOST || 'root@89.167.104.236',
  serial: 'BRIK64-L6PLUS-N5-20260601-ee53196434bd17cf',
  binarySha256: '1ee21aec87146322cc0136fab19b90cc0a62171ef4ad4058417fbac661bb4885',
  binaryPath: '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus',
  claimBoundaryPath: '/opt/brik64/engines/l6plus-n5/current/claim_boundary.json',
  serialPath: '/opt/brik64/engines/l6plus-n5/current/serial.txt'
};

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function rel(file) {
  return path.relative(root, file);
}

function ssh(command) {
  return execFileSync('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=8',
    expected.host,
    command
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function listPcds() {
  const pcdDir = path.join(root, 'pcd');
  return fs.readdirSync(pcdDir)
    .filter((name) => name.endsWith('.pcd'))
    .sort()
    .map((name) => {
      const file = path.join(pcdDir, name);
      const source = read(file);
      return {
        path: rel(file),
        semantic_pcd_sha256: sha256Bytes(source),
        bytes: Buffer.byteLength(source, 'utf8')
      };
    });
}

function buildRequest() {
  const manifestFile = path.join(root, '.brik', 'manifest.json');
  const manifest = JSON.parse(read(manifestFile));
  const pcds = listPcds();
  const request = {
    schemaVersion: 'brik64.cli_beta5_l6_factory_request.v1',
    version,
    generatedAt: new Date().toISOString(),
    lane: 'internal_non_claim_l6_factory_bridge',
    releaseEligible: false,
    sourceRepository: 'brik64/brik64-cli',
    sourceHead: process.env.BRIK64_CLI_HEAD || null,
    manifest: {
      path: rel(manifestFile),
      sha256: sha256Bytes(read(manifestFile)),
      cliVersion: manifest.cliVersion,
      engineTierPolicy: manifest.engineTierPolicy
    },
    pcdInventory: {
      pcdCount: pcds.length,
      inventorySha256: sha256Bytes(JSON.stringify(pcds)),
      pcds
    },
    requiredL6: {
      serial: expected.serial,
      binarySha256: expected.binarySha256,
      publicClaimsAllowed: false,
      l6plusClaimAllowed: false,
      n5Authorized: false,
      route: 'bounded_route2_non_claim_emitter'
    },
    requiredOutput: {
      artifactKind: 'brik64_cli_beta5_generated_candidate',
      mustBind: [
        'request_sha256',
        'manifest_sha256',
        'pcd_inventory_sha256',
        'l6_serial',
        'l6_binary_sha256',
        'generated_artifact_sha256',
        'hardening_output_sha256'
      ],
      releaseAllowed: false
    }
  };
  request.requestSha256 = sha256Bytes(JSON.stringify(request));
  return request;
}

function offlinePreflight(request) {
  const errors = [];
  if (request.manifest.cliVersion !== version) errors.push('manifest_cli_version_mismatch');
  if (request.manifest.engineTierPolicy?.publicOfflineRuntime !== 'L4+N5') errors.push('missing_l4_offline_policy');
  if (request.manifest.engineTierPolicy?.registeredManagedRuntime !== 'L5+N5') errors.push('missing_l5_managed_policy');
  if (request.manifest.engineTierPolicy?.internalArtifactFactory !== 'L6+N5') errors.push('missing_l6_factory_policy');
  if (request.manifest.engineTierPolicy?.l6DistributionAllowed !== false) errors.push('l6_distribution_allowed');
  if (request.manifest.engineTierPolicy?.l5EmbeddedFreeRuntimeAllowed !== false) errors.push('l5_free_embedding_allowed');
  if (request.pcdInventory.pcdCount < 1) errors.push('pcd_inventory_empty');
  return errors;
}

function livePreflight() {
  const serial = ssh(`cat ${expected.serialPath}`).trim();
  const binarySha256 = ssh(`sha256sum ${expected.binaryPath} | awk '{print $1}'`).trim();
  const claimBoundaryRaw = ssh(`cat ${expected.claimBoundaryPath}`);
  const claimBoundary = JSON.parse(claimBoundaryRaw);
  const toolProbe = ssh(`${expected.binaryPath} --help 2>&1 || true`).trim();
  const errors = [];
  if (serial !== expected.serial) errors.push('l6_serial_mismatch');
  if (binarySha256 !== expected.binarySha256) errors.push('l6_binary_sha256_mismatch');
  if (claimBoundary.public_claims_allowed !== false) errors.push('l6_public_claim_boundary_open');
  if (claimBoundary.l6plus_claim_allowed !== false) errors.push('l6plus_claim_boundary_open');
  if (claimBoundary.n5_authorized !== false) errors.push('l6_n5_boundary_open');
  const route2Ready = /bounded route-2 non-claim emitter/.test(toolProbe) && /fail-closed/.test(toolProbe);
  return {
    serial,
    binarySha256,
    claimBoundary,
    toolProbe,
    route2Ready,
    errors
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const live = process.argv.includes('--live');
  const request = buildRequest();
  const offlineErrors = offlinePreflight(request);
  const requestPath = path.join(outDir, 'factory-request.json');
  writeJson(requestPath, request);

  let l6 = null;
  const errors = [...offlineErrors];
  if (!live) {
    errors.push('l6_live_probe_not_requested');
  }
  if (live) {
    try {
      l6 = livePreflight();
      errors.push(...l6.errors);
      if (!l6.route2Ready) errors.push('l6_route2_probe_missing');
    } catch (error) {
      errors.push(`l6_live_probe_failed:${error.message.split('\n')[0]}`);
    }
  }

  const decision = errors.length === 0 && live
    ? 'READY_FOR_BOUNDED_L6_ROUTE2_GENERATION'
    : 'BLOCKED_L6_FACTORY_BRIDGE';
  const report = {
    schemaVersion: 'brik64.cli_beta5_l6_factory_bridge_preflight.v1',
    version,
    generatedAt: new Date().toISOString(),
    lane: 'internal_non_claim_l6_factory_bridge',
    decision,
    releaseEligible: false,
    request: {
      path: rel(requestPath),
      sha256: sha256Bytes(JSON.stringify(request, null, 2))
    },
    checks: {
      offlineContract: offlineErrors.length === 0,
      liveProbeRequested: live,
      l6Host: live ? 'checked' : 'not_checked',
      route2Ready: l6?.route2Ready ?? false
    },
    l6,
    blockers: errors,
    nextAction: decision === 'READY_FOR_BOUNDED_L6_ROUTE2_GENERATION'
      ? 'Implement the bounded route2 generation call and bind returned artifact hashes to factory-request.json.'
      : 'Fix blockers before claiming beta5 was generated by L6.'
  };
  writeJson(path.join(outDir, 'preflight-report.json'), report);
  process.stdout.write(`decision=${decision}\n`);
  process.stdout.write(`request=${rel(requestPath)}\n`);
  process.stdout.write(`report=${rel(path.join(outDir, 'preflight-report.json'))}\n`);
  if (errors.length > 0) {
    process.stdout.write(`blockers=${errors.join(',')}\n`);
    process.exitCode = 2;
  }
}

main();
