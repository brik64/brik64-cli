#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.15.7';
const label = 'beta15_7';
const outDir = path.join(root, 'evidence', `${label}-package`);
const stageRoot = path.join(outDir, 'stage');
const stageName = `brik64-cli-${version}`;
const stageDir = path.join(stageRoot, stageName);
const packageName = `${stageName}.tgz`;
const packagePath = path.join(outDir, packageName);
const packageRel = path.posix.join('evidence', `${label}-package`, packageName);
const manifestPath = path.join(outDir, 'package.manifest.json');
const sumsPath = path.join(outDir, 'SHA256SUMS');
const releaseManifestPath = path.join(root, 'release', 'manifest.json');

const inputs = [
  '.brik/manifest.json',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'NOTICE',
  'SECURITY.md',
  'package.json',
  'src/brik.js',
  'pcd/README.md',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
  'pcd/cli_beta14_release_contract.pcd',
  'pcd/beta15',
  'pcd/beta15_1',
  'pcd/beta15_2',
  'pcd/beta15_3',
  'pcd/beta15_6',
  'engines/l4plus-n5/serial.txt',
  'engines/l4plus-n5/checksums.tsv',
  'engines/l4plus-n5/runtime-bundle.manifest.json',
  'engines/l4plus-n5/manifest/claim_boundary.json',
  'engines/l4plus-n5/evidence/l4plus_n5_critical_artifact_lock.json',
  'engines/l4plus-n5/evidence/l4plus_n5_critical_freeze_certificate.json',
  'engines/l4plus-n5/evidence/l4plus_n5_critical_freeze_report.json',
  'engines/l4plus-n5/evidence/l4plus_n5_burn_in_report.json',
  'engines/l4plus-n5/pcd/engine.manifest.json',
  'engines/l4plus-n5/pcd/engine.pcd',
  'engines/l4plus-n5/pcd/l4plus_engine_runtime.bir',
  'engines/l4plus-n5/pcd/l4plus_engine_runtime.bir.asm',
  'engines/l4plus-n5/pcd/l4plus_engine_runtime.cert.json',
  'engines/l4plus-n5/pcd/harness.manifest.json',
  'engines/l4plus-n5/pcd/harness.pcd',
  'engines/l4plus-n5/pcd/l4plus_n5_harness.bir',
  'engines/l4plus-n5/pcd/l4plus_n5_harness.bir.asm',
  'engines/l4plus-n5/pcd/l4plus_n5_harness.cert.json',
  'engines/l4plus-n5/pcd/runtime_adapter.manifest.json',
  'engines/l4plus-n5/pcd/runtime_adapter.pcd',
  'engines/l4plus-n5/pcd/l4plus_n5_runtime_adapter.bir',
  'engines/l4plus-n5/pcd/l4plus_n5_runtime_adapter.bir.asm',
  'engines/l4plus-n5/pcd/l4plus_n5_runtime_adapter.cert.json',
];

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fileSize(file) {
  return fs.statSync(file).size;
}

function gitHead() {
  const result = childProcess.spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function fail(failures) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  writeJson(manifestPath, {
    schemaVersion: 'brik64.cli_beta15_7_package_manifest.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA15_7_PACKAGE_BUILT',
    releaseEligible: false,
    publicationAllowed: false,
    failures,
  });
  console.error(`beta15_7_package_input_gate_failed:${failures.join('|')}`);
  process.exit(1);
}

function copyInput(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(stageDir, relativePath);
  if (!fs.existsSync(source)) fail([`missing_package_input:${relativePath}`]);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function writeString(buffer, offset, length, value) {
  Buffer.from(value).copy(buffer, offset, 0, length);
}

function writeOctal(buffer, offset, length, value) {
  const text = value.toString(8).padStart(length - 1, '0').slice(-(length - 1));
  writeString(buffer, offset, length - 1, text);
  buffer[offset + length - 1] = 0;
}

function splitTarName(name) {
  if (Buffer.byteLength(name) <= 100) return { name, prefix: '' };
  const parts = name.split('/');
  for (let i = parts.length - 1; i > 0; i -= 1) {
    const base = parts.slice(i).join('/');
    const prefix = parts.slice(0, i).join('/');
    if (Buffer.byteLength(base) <= 100 && Buffer.byteLength(prefix) <= 155) return { name: base, prefix };
  }
  throw new Error(`tar_path_too_long:${name}`);
}

function tarHeader(rawName, size, mode) {
  const buffer = Buffer.alloc(512, 0);
  const split = splitTarName(rawName.replace(/\\/g, '/'));
  writeString(buffer, 0, 100, split.name);
  writeOctal(buffer, 100, 8, mode);
  writeOctal(buffer, 108, 8, 0);
  writeOctal(buffer, 116, 8, 0);
  writeOctal(buffer, 124, 12, size);
  writeOctal(buffer, 136, 12, 1781308800);
  buffer.fill(0x20, 148, 156);
  buffer[156] = '0'.charCodeAt(0);
  writeString(buffer, 257, 6, 'ustar');
  writeString(buffer, 263, 2, '00');
  writeString(buffer, 265, 32, 'brik64');
  writeString(buffer, 297, 32, 'brik64');
  if (split.prefix) writeString(buffer, 345, 155, split.prefix);
  let checksum = 0;
  for (const byte of buffer) checksum += byte;
  writeString(buffer, 148, 6, checksum.toString(8).padStart(6, '0').slice(-6));
  buffer[154] = 0;
  buffer[155] = 0x20;
  return buffer;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function gzipStored(buffer) {
  const parts = [Buffer.from([0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0, 0, 0xff])];
  for (let offset = 0; offset < buffer.length; offset += 65535) {
    const chunk = buffer.subarray(offset, Math.min(offset + 65535, buffer.length));
    const block = Buffer.alloc(5);
    block[0] = offset + chunk.length >= buffer.length ? 0x01 : 0x00;
    block.writeUInt16LE(chunk.length, 1);
    block.writeUInt16LE((~chunk.length) & 0xffff, 3);
    parts.push(block, chunk);
  }
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc32(buffer), 0);
  trailer.writeUInt32LE(buffer.length >>> 0, 4);
  parts.push(trailer);
  return Buffer.concat(parts);
}

function writePackage() {
  const blocks = [];
  for (const file of listFiles(stageDir)) {
    const rel = path.relative(stageRoot, file).replace(/\\/g, '/');
    const body = fs.readFileSync(file);
    const mode = rel.endsWith('/src/brik.js') ? 0o755 : 0o644;
    blocks.push(tarHeader(rel, body.length, mode), body);
    const padding = (512 - (body.length % 512)) % 512;
    if (padding) blocks.push(Buffer.alloc(padding, 0));
  }
  blocks.push(Buffer.alloc(1024, 0));
  fs.writeFileSync(packagePath, gzipStored(Buffer.concat(blocks)));
}

const packageJson = readJson(path.join(root, 'package.json'));
const brikManifest = readJson(path.join(root, '.brik', 'manifest.json'));
const source = fs.readFileSync(path.join(root, 'src', 'brik.js'), 'utf8');
const failures = [];
if (packageJson.version !== version) failures.push(`package_version_drift:${packageJson.version}`);
if (brikManifest.cliVersion !== version) failures.push(`brik_manifest_version_drift:${brikManifest.cliVersion || 'missing'}`);
if (!source.includes("const version = '0.1.0-beta.15.7'")) failures.push('source_version_missing');
if (!fs.existsSync(path.join(root, 'engines', 'l4plus-n5', 'runtime-bundle.manifest.json'))) failures.push('l4plus_n5_bundle_missing');
if (failures.length > 0) fail(failures);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });
for (const input of inputs) copyInput(input);
writePackage();

const stageChecksums = listFiles(stageDir)
  .map((file) => `${sha256File(file)}  ${path.relative(stageDir, file).replace(/\\/g, '/')}`)
  .join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'stage-checksums.tsv'), stageChecksums);

const packageSha = sha256File(packagePath);
const packageManifest = {
  schemaVersion: 'brik64.cli_beta15_7_package_manifest.v1',
  version,
  decision: 'PASS_BRIK64_CLI_BETA15_7_PACKAGE_BUILT',
  releaseEligible: false,
  publicationAllowed: false,
  lane: 'cli_0_1_beta',
  generationClaim: 'source_candidate_pending_l6_materialization',
  package: {
    path: packageRel,
    sha256: packageSha,
    bytes: fileSize(packagePath),
  },
  claimBoundary: {
    publicReleaseAllowed: false,
    publicClaimsAllowed: false,
    l6MaterializationClaimAllowed: false,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  },
  inputs,
};
writeJson(manifestPath, packageManifest);
fs.writeFileSync(sumsPath, `${packageSha}  ${packageName}\n${sha256(stageChecksums)}  stage-checksums.tsv\n`);

const sourceCommit = gitHead();
writeJson(releaseManifestPath, {
  schemaVersion: 'brik64.release_manifest.v1',
  releaseId: `brik64-${version}`,
  version,
  state: 'draft',
  source: {
    commit: sourceCommit,
    commitBinding: 'candidate_base_commit',
  },
  cli: {
    package: {
      path: packageRel,
      sha256: packageSha,
      bytes: fileSize(packagePath),
    },
  },
  releaseNotes: [
    {
      type: 'added',
      surface: 'CLI package',
      text: 'Adds a local package candidate for the Beta15.7 offline command-line workflow and embedded engine files.',
    },
    {
      type: 'fixed',
      surface: 'CLI package',
      text: 'Aligns candidate package metadata with the Beta15.7 command behavior before public release work continues.',
    },
  ],
  sdks: [
    { marketplace: 'npm', name: '@brik64/core', version, publication: 'pending_release_train_publish' },
    { marketplace: 'pypi', name: 'brik64', version: '0.1.0b15.post7', publication: 'pending_release_train_publish' },
    { marketplace: 'crates.io', name: 'brik64-core', version, publication: 'pending_release_train_publish' },
  ],
  publicSurfaces: {
    githubRelease: { required: true, status: 'pending_release_train_publish', tag: `v${version}` },
    curlInstaller: { required: true, status: 'pending_release_train_publish', url: 'https://brik64.com/cli/install.sh' },
    channelManifest: { required: true, status: 'pending_release_train_publish', url: 'https://brik64.com/cli/beta.json' },
    web: { required: true, status: 'pending_release_train_publish', url: 'https://brik64.com/download' },
    docs: { required: true, status: 'pending_release_train_publish', url: 'https://docs.brik64.com' },
    skills: { required: true, status: 'pending_release_train_publish', repo: 'brik64/brik64-tools-skills' },
  },
  verification: {
    requiredEvidence: [],
  },
  claimBoundary: {
    publicClaimsAllowed: false,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  },
});

fs.rmSync(stageRoot, { recursive: true, force: true });

console.log(`decision=${packageManifest.decision}`);
console.log(`releaseEligible=${packageManifest.releaseEligible}`);
console.log(`package=${packageRel}`);
