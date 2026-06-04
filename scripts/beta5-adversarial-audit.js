#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta5-adversarial-audit');
const brik = path.join(root, 'src', 'brik.js');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function run(args, options = {}) {
  return spawnSync(args[0], args.slice(1), {
    cwd: options.cwd || root,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) }
  });
}

function assertPass(name, args, options = {}) {
  const result = run(args, options);
  if (result.status !== 0) {
    throw new Error(`${name}:expected_pass:rc=${result.status}:stderr=${result.stderr}`);
  }
  return result;
}

function assertFail(name, args, expected, options = {}) {
  const result = run(args, options);
  if (result.status === 0) {
    throw new Error(`${name}:expected_fail_but_passed`);
  }
  const combined = `${result.stdout}\n${result.stderr}`;
  if (expected && !combined.includes(expected)) {
    throw new Error(`${name}:missing_expected_error:${expected}:output=${combined}`);
  }
  return result;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const checks = [];
  const record = (name, fn) => {
    const started = Date.now();
    fn();
    checks.push({ name, status: 'PASS', elapsedMs: Date.now() - started });
  };

  record('precondition:build_chain_fresh', () => {
    assertPass('build-chain-refresh', ['node', 'scripts/build-beta5-candidate.js']);
  });

  record('gate:release_surface_candidate_blocks_public_release', () => {
    assertPass('release-surface-candidate', ['node', 'scripts/beta5-release-surface-gate.js']);
    assertFail('release-surface-release', ['node', 'scripts/beta5-release-surface-gate.js', '--release'], 'BLOCKED_PUBLIC_RELEASE_NOT_READY');
  });

  record('gate:publication_preflight_blocks_release', () => {
    assertPass('publication-preflight', ['node', 'scripts/beta5-publication-preflight.js']);
    assertFail('publication-preflight-release', ['node', 'scripts/beta5-publication-preflight.js', '--release'], 'githubReleaseAllowed=false');
  });

  record('gate:surface_syncs_pass', () => {
    assertPass('sdk-sync', ['node', 'scripts/beta5-sdk-sync-gate.js']);
    assertPass('skills-sync', ['node', 'scripts/beta5-skills-sync-gate.js']);
    assertPass('docs-web-sync', ['node', 'scripts/beta5-docs-web-sync-gate.js']);
    assertPass('marketplace-package-gate', ['node', 'scripts/beta5-marketplace-package-gate.js']);
  });

  record('cli:edge_failclosed_variation', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta5-audit-'));
    assertPass('init', ['node', brik, 'init'], { cwd: tmp });
    fs.mkdirSync(path.join(tmp, 'pcd'), { recursive: true });
    write(path.join(tmp, 'pcd', 'inventory.pcd'), 'PC inventory { fn inventory(input) { return 1; } }\n');
    assertPass('doctor', ['node', brik, 'doctor'], { cwd: tmp });
    write(path.join(tmp, 'program.pcd'), 'PC sample { fn sample(input) { if (input == 0) { return 1; } return 2; } }\n');
    assertFail('emit-before-cert', ['node', brik, 'emit', 'program.pcd'], 'certificate_required', { cwd: tmp });
    assertPass('certify', ['node', brik, 'certify', 'program.pcd'], { cwd: tmp });
    assertPass('emit-ts', ['node', brik, 'emit', 'program.pcd', '--target', 'ts', '--out', 'out-ts', '--tests'], { cwd: tmp });
    assertFail('unsupported-target', ['node', brik, 'emit', 'program.pcd', '--target', 'go', '--out', 'out-go'], 'unsupported_target', { cwd: tmp });
    assertFail('output-path-traversal', ['node', brik, 'emit', 'program.pcd', '--target', 'ts', '--out', '../escaped-out', '--tests'], 'path_outside_workspace', { cwd: tmp });
    if (fs.existsSync(path.join(path.dirname(tmp), 'escaped-out', 'program.ts'))) {
      throw new Error('output_path_traversal_wrote_outside_workspace');
    }
    fs.mkdirSync(path.join(tmp, 'readonly'));
    fs.chmodSync(path.join(tmp, 'readonly'), 0o500);
    try {
      const readonly = assertFail('readonly-output', ['node', brik, 'emit', 'program.pcd', '--target', 'ts', '--out', 'readonly/child', '--tests'], 'filesystem_mkdir_error', { cwd: tmp });
      if (/at Object\.mkdirSync|Node\.js/.test(readonly.stderr)) {
        throw new Error('readonly_output_exposed_node_stack_trace');
      }
    } finally {
      fs.chmodSync(path.join(tmp, 'readonly'), 0o700);
    }
    fs.appendFileSync(path.join(tmp, 'program.pcd'), '\nreturn 9;\n');
    assertFail('stale-cert', ['node', brik, 'emit', 'program.pcd'], 'certificate_hash_mismatch', { cwd: tmp });
    write(path.join(tmp, 'empty.pcd'), '');
    assertFail('empty-pcd', ['node', brik, 'certify', 'empty.pcd'], 'pcd_empty', { cwd: tmp });
  });

  record('cli:engine_bundle_hash_tamper_fails_closed', () => {
    const bundle = path.join(root, 'engines/l4plus-n5/runtime-bundle.manifest.json');
    const original = fs.readFileSync(bundle, 'utf8');
    const tampered = JSON.parse(original);
    tampered.artifacts[0].sha256 = '0'.repeat(64);
    fs.writeFileSync(bundle, `${JSON.stringify(tampered, null, 2)}\n`);
    try {
      assertFail('engine-status-tamper', ['node', brik, 'engine', 'status'], 'engine_bundle_artifact_hash_mismatch');
    } finally {
      fs.writeFileSync(bundle, original);
    }
    assertPass('engine-status-restored', ['node', brik, 'engine', 'status']);
  });

  record('gate:docs_web_missing_boundary_fails_closed', () => {
    const file = '/Users/carlosjperez/Documents/GitHub/brik64-docs-site/BETA5_SYNC.md';
    const original = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, original.replace('Do not present beta5 as the current public release', 'Do not publish accidentally'));
    try {
      assertFail('docs-web-boundary-tamper', ['node', 'scripts/beta5-docs-web-sync-gate.js'], 'surface_candidate_boundary_missing');
    } finally {
      fs.writeFileSync(file, original);
    }
    assertPass('docs-web-restored', ['node', 'scripts/beta5-docs-web-sync-gate.js']);
  });

  const report = {
    schemaVersion: 'brik64.cli_beta5_adversarial_audit.v1',
    version: '0.1.0-beta.5',
    decision: 'PASS_BETA5_LOCAL_ADVERSARIAL_AUDIT',
    releaseEligible: false,
    checks,
    artifactHashes: {
      buildChain: sha256(fs.readFileSync(path.join(root, 'evidence/beta5-local-candidate/build-chain.manifest.json'))),
      releaseSurfaceGate: sha256(fs.readFileSync(path.join(root, 'evidence/beta5-release-surface-gate/report.json'))),
      publicationPreflight: sha256(fs.readFileSync(path.join(root, 'evidence/beta5-publication-preflight/manifest.json'))),
      marketplacePackageGate: sha256(fs.readFileSync(path.join(root, 'evidence/beta5-marketplace-packages/report.json')))
    },
    boundary: 'Local adversarial audit only. Public release remains blocked by GitHub Release and marketplace publication gates.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`checks=${checks.length}\n`);
}

main();
