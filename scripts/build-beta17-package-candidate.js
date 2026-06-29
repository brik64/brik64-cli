#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = process.env.BRIK64_BETA17_VERSION || '0.1.0-beta.17';
const label = 'beta17';
const outDir = path.join(root, 'evidence', `${label}-package`);
const stageRoot = path.join(outDir, 'stage');
const stageName = `brik64-cli-${version}`;
const stageDir = path.join(stageRoot, stageName);
const packageName = `${stageName}.tgz`;
const packagePath = path.join(outDir, packageName);
const packageRel = path.posix.join('evidence', `${label}-package`, packageName);
const packageManifestPath = path.join(outDir, 'package.manifest.json');
const candidateManifestPath = path.join(outDir, 'release.manifest.candidate.json');
const releaseManifestPath = path.join(root, 'release', 'manifest.json');
const sumsPath = path.join(outDir, 'SHA256SUMS');

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

function rel(file) {
  return path.relative(root, file);
}

function gitHead() {
  const result = childProcess.spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function pypiVersion(value) {
  const match = String(value).match(/^(\d+\.\d+\.\d+)-beta\.(\d+)$/);
  if (!match) return value;
  return `${match[1]}b${match[2]}`;
}

function fail(failures) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(stageRoot, { recursive: true, force: true });
  writeJson(packageManifestPath, {
    schemaVersion: 'brik64.cli_beta17_package_manifest.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA17_PACKAGE_CANDIDATE_BUILT',
    releaseEligible: false,
    publicationAllowed: false,
    failures,
  });
  console.error(`beta17_package_candidate_input_gate_failed:${failures.join('|')}`);
  process.exit(1);
}

function ensureFile(ref) {
  const file = path.join(root, ref);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return file;
}

function copyFileRef(ref, targetRef = ref) {
  const source = ensureFile(ref);
  if (!source) fail([`missing_package_input:${ref}`]);
  const target = path.join(stageDir, targetRef);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
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
  const parts = [Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0xff])];
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
    const ref = path.relative(stageRoot, file).replace(/\\/g, '/');
    const body = fs.readFileSync(file);
    const mode = ref.endsWith('/src/brik.js') ? 0o755 : 0o644;
    blocks.push(tarHeader(ref, body.length, mode), body);
    const padding = (512 - (body.length % 512)) % 512;
    if (padding) blocks.push(Buffer.alloc(padding, 0));
  }
  blocks.push(Buffer.alloc(1024, 0));
  fs.writeFileSync(packagePath, gzipStored(Buffer.concat(blocks)));
}

const failures = [];
if (version !== '0.1.0-beta.17') failures.push(`unsupported_beta17_version:${version}`);

const stage1ManifestPath = ensureFile('evidence/beta17-fixpoint/stage1_artifact_manifest.json');
const stage2ManifestPath = ensureFile('evidence/beta17-fixpoint/stage2_regeneration_manifest.json');
const byteIdenticalPath = ensureFile('evidence/beta17-fixpoint/byte_identical_report.json');
const sealReportPath = ensureFile('evidence/beta17-fixpoint/seal_report.json');
const evidencePackPath = ensureFile('evidence/beta17-fixpoint/evidence_pack_manifest.json');
const readinessPath = ensureFile('evidence/beta17-fixpoint-readiness/report.json');
const functionalStageReportPath = ensureFile('evidence/beta17-fixpoint-functional-stage-artifact/report.json');
if (!stage1ManifestPath) failures.push('missing_stage1_artifact_manifest');
if (!stage2ManifestPath) failures.push('missing_stage2_regeneration_manifest');
if (!byteIdenticalPath) failures.push('missing_byte_identical_report');
if (!sealReportPath) failures.push('missing_seal_report');
if (!evidencePackPath) failures.push('missing_evidence_pack_manifest');
if (!readinessPath) failures.push('missing_readiness_report');
if (!functionalStageReportPath) failures.push('missing_functional_stage_artifact_report');
if (failures.length > 0) fail(failures);

const stage1Manifest = readJson(stage1ManifestPath);
const stage2Manifest = readJson(stage2ManifestPath);
const byteIdentical = readJson(byteIdenticalPath);
const sealReport = readJson(sealReportPath);
const readiness = readJson(readinessPath);
const functionalStageReport = readJson(functionalStageReportPath);
const stageArtifactRef = stage1Manifest.artifact?.path;
const stageArtifactFile = stageArtifactRef ? ensureFile(stageArtifactRef) : null;
if (stage1Manifest.version !== version) failures.push(`stage1_version_mismatch:${stage1Manifest.version || 'missing'}`);
if (stage1Manifest.generatedByL6PlusN5 !== true) failures.push('stage1_not_generated_by_l6plus_n5');
if (!stageArtifactFile) failures.push(`missing_stage1_artifact:${stageArtifactRef || 'missing'}`);
if (stageArtifactFile && sha256File(stageArtifactFile) !== stage1Manifest.artifact.sha256) failures.push('stage1_artifact_sha256_mismatch');
if (stageArtifactFile && fileSize(stageArtifactFile) !== stage1Manifest.artifact.bytes) failures.push('stage1_artifact_bytes_mismatch');
if (stage2Manifest.version !== version) failures.push(`stage2_version_mismatch:${stage2Manifest.version || 'missing'}`);
if (!['PASS_BETA17_FIXPOINT_BYTE_IDENTICAL', 'PASS_BYTE_IDENTICAL_REGENERATION'].includes(byteIdentical.decision)) {
  failures.push(`byte_identical_not_pass:${byteIdentical.decision || 'missing'}`);
}
if (byteIdentical.byteIdentical === false) failures.push('byte_identical_false');
if (sealReport.decision !== 'PASS_BETA17_FIXPOINT_SEAL') failures.push(`seal_report_not_pass:${sealReport.decision || 'missing'}`);
if (readiness.decision !== 'BLOCKED_BETA17_FIXPOINT_READINESS_GATE' && readiness.decision !== 'PASS_BETA17_FIXPOINT_READINESS_GATE') {
  failures.push(`readiness_decision_unrecognized:${readiness.decision || 'missing'}`);
}
if (failures.length > 0) fail(failures);

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(stageRoot, { recursive: true, force: true });
fs.rmSync(packagePath, { force: true });
fs.mkdirSync(path.join(stageDir, 'src'), { recursive: true });

const packageJson = {
  name: '@brik64/cli',
  version,
  private: true,
  type: 'commonjs',
  bin: { brik64: 'src/brik.js', brik: 'src/brik.js' },
  description: 'BRIK64 Beta17 candidate package generated from L6+N5 stage evidence. Not public-release eligible.',
  engines: { node: '>=20' },
};
writeJson(path.join(stageDir, 'package.json'), packageJson);
fs.writeFileSync(path.join(stageDir, 'README.md'), [
  '# BRIK64 CLI 0.1.0-beta.17 Candidate',
  '',
  'This package is candidate evidence only. It is not publicly released until public-surface sync and external audit gates pass.',
  '',
].join('\n'));
fs.copyFileSync(stageArtifactFile, path.join(stageDir, 'src', 'brik.js'));
fs.chmodSync(path.join(stageDir, 'src', 'brik.js'), 0o755);

for (const ref of [
  'evidence/beta17-fixpoint/stage1_artifact_manifest.json',
  'evidence/beta17-fixpoint/stage2_regeneration_manifest.json',
  'evidence/beta17-fixpoint/byte_identical_report.json',
  'evidence/beta17-fixpoint/seal_report.json',
  'evidence/beta17-fixpoint/evidence_pack_manifest.json',
  'evidence/beta17-fixpoint-readiness/report.json',
]) {
  copyFileRef(ref);
}
copyFileRef(stageArtifactRef);

writePackage();

const stageChecksums = listFiles(stageDir)
  .map((file) => `${sha256File(file)}  ${path.relative(stageDir, file).replace(/\\/g, '/')}`)
  .join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'stage-checksums.tsv'), stageChecksums);
const packageSha = sha256File(packagePath);
const packageBytes = fileSize(packagePath);
const stageArtifactBytes = fileSize(stageArtifactFile);
const functionalCliArtifact = functionalStageReport.decision === 'PASS_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE'
  && functionalStageReport.releaseEligibleStageArtifact === true;
const releaseEligible = functionalCliArtifact;

const packageManifest = {
  schemaVersion: 'brik64.cli_beta17_package_manifest.v1',
  version,
  decision: 'PASS_BRIK64_CLI_BETA17_PACKAGE_CANDIDATE_BUILT',
  releaseEligible,
  publicationAllowed: false,
  lane: 'l6plus_n5_self_host_fixpoint',
  generationClaim: 'l6plus_n5_stage_artifact_candidate',
  package: {
    path: packageRel,
    sha256: packageSha,
    bytes: packageBytes,
  },
  stageArtifact: {
    path: stageArtifactRef,
    sha256: stage1Manifest.artifact.sha256,
    bytes: stageArtifactBytes,
    functionalCliArtifact,
  },
  functionalStageArtifactReport: {
    path: 'evidence/beta17-fixpoint-functional-stage-artifact/report.json',
    decision: functionalStageReport.decision,
    sha256: sha256File(functionalStageReportPath),
    bytes: fileSize(functionalStageReportPath),
  },
  blockers: releaseEligible ? [] : [
    ...(functionalCliArtifact ? [] : [
      `functional_stage_artifact_not_pass:${functionalStageReport.decision || 'missing'}`,
      ...(Array.isArray(functionalStageReport.blockers)
        ? functionalStageReport.blockers.map((blocker) => `functional_stage_artifact:${blocker}`)
        : []),
    ]),
    'publication_requires_public_surface_sync_and_external_audit',
  ],
  claimBoundary: {
    publicReleaseAllowed: false,
    publicClaimsAllowed: false,
    l6MaterializationClaimAllowed: true,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  },
};
writeJson(packageManifestPath, packageManifest);
fs.writeFileSync(sumsPath, `${packageSha}  ${packageName}\n${sha256(stageChecksums)}  stage-checksums.tsv\n`);

const releaseManifest = {
  schemaVersion: 'brik64.release_manifest.v1',
  releaseId: `brik64-${version}`,
  version,
  channel: 'beta',
  state: 'candidate',
  source: {
    commit: gitHead(),
    commitBinding: 'candidate_base_commit',
  },
  cli: {
    package: {
      path: packageRel,
      sha256: packageSha,
      bytes: packageBytes,
    },
  },
  releaseNotes: [
    {
      type: 'prepared',
      surface: 'CLI package candidate',
      text: 'Prepares a Beta17 package candidate from L6+N5 stage evidence while keeping public release disabled until functional package, public sync and external audit gates pass.',
    },
  ],
  sdks: [
    { marketplace: 'npm', name: '@brik64/core', version, required: true, publication: 'pending_release_train_publish' },
    { marketplace: 'pypi', name: 'brik64', version: pypiVersion(version), required: true, publication: 'pending_release_train_publish' },
    { marketplace: 'crates.io', name: 'brik64-core', version, required: true, publication: 'pending_release_train_publish' },
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
    requiredEvidence: [
      {
        id: 'beta17_fixpoint_readiness',
        path: 'evidence/beta17-fixpoint-readiness/report.json',
        decision: 'PASS_BETA17_FIXPOINT_READINESS_GATE',
      },
      {
        id: 'beta17_public_surface_sync',
        path: 'evidence/beta17-fixpoint/public_surface_sync_report.json',
        decision: 'PASS_BETA17_PUBLIC_SURFACE_SYNC',
      },
      {
        id: 'beta17_external_audit_status',
        path: 'evidence/beta17-fixpoint-external-audit-status/report.json',
        decision: 'PASS_BETA17_EXTERNAL_AUDIT_STATUS_GATE',
      },
      {
        id: 'beta17_cli_package',
        path: packageManifest.package.path,
        decision: 'FILE_EXISTS',
      },
    ],
  },
  claimBoundary: {
    publicClaimsAllowed: false,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  },
};
writeJson(candidateManifestPath, releaseManifest);
writeJson(releaseManifestPath, releaseManifest);

fs.rmSync(stageRoot, { recursive: true, force: true });
console.log(`decision=${packageManifest.decision}`);
console.log(`releaseEligible=${packageManifest.releaseEligible}`);
console.log(`publicationAllowed=${packageManifest.publicationAllowed}`);
console.log(`package=${packageRel}`);
console.log(`candidateManifest=${rel(candidateManifestPath)}`);
