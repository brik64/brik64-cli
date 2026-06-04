#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta5-cross-platform-smoke');
const packageManifestPath = path.join(root, 'evidence', 'beta5-package', 'package.manifest.json');
const remote = process.env.BRIK64_BETA5_LINUX_SMOKE_HOST || 'root@89.167.104.236';

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(args, options = {}) {
  return spawnSync(args[0], args.slice(1), {
    cwd: options.cwd || root,
    encoding: 'utf8',
    timeout: options.timeout || 120000
  });
}

function requirePass(name, args, options = {}) {
  const result = run(args, options);
  if (result.status !== 0) {
    throw new Error(`${name}:rc=${result.status}:stdout=${result.stdout}:stderr=${result.stderr}`);
  }
  return result;
}

function localSmoke(packagePath) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta5-local-platform-'));
  requirePass('local_extract', ['tar', '-xzf', packagePath, '-C', tmp]);
  const extracted = path.join(tmp, 'brik64-cli-0.1.0-beta.5');
  const brik = path.join(extracted, 'src', 'brik.js');
  const checks = [];
  const check = (name, args, cwd = extracted, contains) => {
    const result = requirePass(`local_${name}`, args, { cwd });
    const combined = `${result.stdout}\n${result.stderr}`;
    if (contains && !combined.includes(contains)) throw new Error(`local_${name}:missing:${contains}`);
    checks.push(name);
  };
  check('version', ['node', brik, '--version'], extracted, 'BRIK64 CLI 0.1.0-beta.5');
  check('engine_status', ['node', brik, 'engine', 'status'], extracted, '"runtimeMode": "portable_bir_bundle"');
  check('doctor', ['node', brik, 'doctor'], extracted, '"status": "PASS"');
  return {
    platform: `${process.platform}-${process.arch}`,
    runner: 'local',
    decision: 'PASS',
    checks
  };
}

function remoteSmoke(packagePath, packageSha) {
  const remoteBase = `/tmp/brik64-beta5-smoke-${Date.now()}`;
  const remotePackage = `${remoteBase}/brik64-cli-0.1.0-beta.5-local-candidate.tgz`;
  requirePass('remote_mkdir', ['ssh', '-o', 'BatchMode=yes', remote, `mkdir -p ${remoteBase}`], { timeout: 30000 });
  requirePass('remote_copy_package', ['scp', '-q', packagePath, `${remote}:${remotePackage}`], { timeout: 60000 });

  const script = `
set -euo pipefail
cd ${remoteBase}
test "$(sha256sum brik64-cli-0.1.0-beta.5-local-candidate.tgz | awk '{print $1}')" = "${packageSha}"
tar -xzf brik64-cli-0.1.0-beta.5-local-candidate.tgz
cd brik64-cli-0.1.0-beta.5
node src/brik.js --version | grep -q "BRIK64 CLI 0.1.0-beta.5"
node src/brik.js engine status | grep -q '"runtimeMode": "portable_bir_bundle"'
node src/brik.js doctor | grep -q '"status": "PASS"'
work="${remoteBase}/work"
mkdir -p "$work/pcd"
cd "$work"
node ${remoteBase}/brik64-cli-0.1.0-beta.5/src/brik.js init | grep -q "created=.brik/manifest.json"
printf 'PC inventory { fn inventory(input) { return 1; } }\\n' > pcd/inventory.pcd
printf 'PC sample { fn sample(input) { if (input == 0) { return 1; } return 2; } }\\n' > program.pcd
node ${remoteBase}/brik64-cli-0.1.0-beta.5/src/brik.js certify program.pcd | grep -q "certificate=program.pcd.cert.json"
node ${remoteBase}/brik64-cli-0.1.0-beta.5/src/brik.js emit program.pcd --target ts --out out-ts --tests | grep -q "generated=out-ts/program.ts"
printf '\\nreturn 9;\\n' >> program.pcd
if node ${remoteBase}/brik64-cli-0.1.0-beta.5/src/brik.js emit program.pcd >/tmp/brik64-stale.out 2>/tmp/brik64-stale.err; then
  echo stale_certificate_expected_failure >&2
  exit 1
fi
grep -q "certificate_hash_mismatch" /tmp/brik64-stale.err
uname -m
node --version
rm -rf ${remoteBase}
`;
  const result = requirePass('remote_linux_smoke', ['ssh', '-o', 'BatchMode=yes', remote, script], { timeout: 120000 });
  return {
    platform: 'linux-x64',
    runner: remote,
    decision: 'PASS',
    checks: ['sha256', 'extract', 'version', 'engine-status', 'doctor', 'init', 'certify', 'emit-ts', 'stale-cert-fail-closed'],
    stdout: result.stdout.trim().split('\n').slice(-4)
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(packageManifestPath, 'utf8'));
  const packagePath = path.join(root, manifest.package.path);
  const packageSha = manifest.package.sha256;
  if (sha256File(packagePath) !== packageSha) throw new Error('package_hash_mismatch');

  const platforms = [
    localSmoke(packagePath),
    remoteSmoke(packagePath, packageSha)
  ];
  const report = {
    schemaVersion: 'brik64.cli_beta5_cross_platform_smoke.v1',
    version: '0.1.0-beta.5',
    decision: 'PASS_CROSS_PLATFORM_SMOKE',
    releaseEligible: false,
    package: manifest.package,
    platforms,
    boundary: 'Cross-platform package smoke covers local macOS and one Linux x86_64 Hetzner host. It does not cover Windows or Linux ARM.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`platforms=${platforms.map((platform) => platform.platform).join(',')}\n`);
}

main();
