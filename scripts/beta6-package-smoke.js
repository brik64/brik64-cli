#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.6';
const outDir = path.join(root, 'evidence', 'beta6-package-smoke');
const pkgDir = path.join(root, 'evidence', 'beta6-package');
const manifestPath = path.join(pkgDir, 'package.manifest.json');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(args, cwd) {
  return spawnSync(args[0], args.slice(1), { cwd, encoding: 'utf8' });
}

function requirePass(name, args, cwd, contains) {
  const result = run(args, cwd);
  if (result.status !== 0) throw new Error(`${name}:rc=${result.status}:stderr=${result.stderr}`);
  if (contains && !`${result.stdout}\n${result.stderr}`.includes(contains)) {
    throw new Error(`${name}:missing:${contains}`);
  }
  return result;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const packagePath = path.join(root, manifest.package.path);
  if (manifest.version !== version) throw new Error(`manifest_version_drift:${manifest.version}`);
  if (manifest.releaseEligible !== false) throw new Error('local_package_release_boundary_open');
  if (sha256File(packagePath) !== manifest.package.sha256) throw new Error('package_hash_mismatch');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta6-package-smoke-'));
  requirePass('extract', ['tar', '-xzf', packagePath, '-C', tmp], root);
  const extracted = path.join(tmp, `brik64-cli-${version}`);
  const brik = path.join(extracted, 'src/brik.js');
  requirePass('version', ['node', brik, '--version'], extracted, `BRIK64 CLI ${version}`);
  requirePass('engine-status', ['node', brik, 'engine', 'status'], extracted, '"runtimeMode": "portable_bir_bundle"');
  requirePass('doctor', ['node', brik, 'doctor'], extracted, '"status": "PASS"');

  const work = path.join(tmp, 'work');
  fs.mkdirSync(work);
  requirePass('init', ['node', brik, 'init'], work, 'created=.brik/manifest.json');
  fs.mkdirSync(path.join(work, 'pcd'));
  fs.writeFileSync(path.join(work, 'pcd/inventory.pcd'), 'PC inventory { fn inventory(input) { return 1; } }\n');
  fs.writeFileSync(path.join(work, 'program.pcd'), 'PC sample { fn sample(input) { if (input == 0) { return 1; } return 2; } }\n');
  requirePass('certify', ['node', brik, 'certify', 'program.pcd'], work, 'certificate=program.pcd.cert.json');
  requirePass('emit', ['node', brik, 'emit', 'program.pcd', '--target', 'ts', '--out', 'out-ts', '--tests'], work, 'generated=out-ts/program.ts');
  const stale = path.join(work, 'program.pcd');
  fs.appendFileSync(stale, '\nreturn 9;\n');
  const staleResult = run(['node', brik, 'emit', 'program.pcd'], work);
  if (staleResult.status === 0 || !staleResult.stderr.includes('certificate_hash_mismatch')) {
    throw new Error('stale_certificate_did_not_fail_closed');
  }

  const report = {
    schemaVersion: 'brik64.cli_beta6_package_smoke.v1',
    version,
    decision: 'PASS_BETA6_LOCAL_PACKAGE_SMOKE',
    releaseEligible: false,
    lane: 'cli_0_1_beta',
    generationClaim: 'assisted_generation_non_claim',
    package: manifest.package,
    checks: ['extract', 'version', 'engine-status', 'doctor', 'init', 'certify', 'emit-ts', 'stale-cert-fail-closed'],
    boundary: 'Local beta6 package smoke only. Public release train and cross-platform smoke remain separate.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`checks=${report.checks.length}\n`);
}

main();
