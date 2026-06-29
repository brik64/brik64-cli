#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const fixpointDir = path.join(root, 'evidence', 'beta17-fixpoint');
const outPath = path.join(fixpointDir, 'evidence_pack_manifest.json');

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function rel(file) {
  return path.relative(root, file);
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(file);
    if (!entry.isFile()) return [];
    return [file];
  });
}

function buildEvidencePackManifest(options = {}) {
  const status = options.status || 'CANDIDATE_NON_CLAIM';
  const files = walkFiles(fixpointDir)
    .filter((file) => path.resolve(file) !== path.resolve(outPath))
    .sort()
    .map((file) => ({
      path: rel(file),
      sha256: sha256Bytes(fs.readFileSync(file)),
      bytes: fs.statSync(file).size,
    }));
  return {
    schemaVersion: 'brik64.beta17_fixpoint.evidence_pack_manifest.v1',
    version: '0.1.0-beta.17',
    status,
    generatedAt: new Date().toISOString(),
    files,
    packSha256: sha256Bytes(`${JSON.stringify({ files }, null, 2)}\n`),
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
  };
}

function writeEvidencePackManifest(options = {}) {
  fs.mkdirSync(fixpointDir, { recursive: true });
  const manifest = buildEvidencePackManifest(options);
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    path: rel(outPath),
    sha256: sha256Bytes(fs.readFileSync(outPath)),
    manifest,
  };
}

function comparableManifest(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    version: manifest.version,
    status: manifest.status,
    files: manifest.files,
    packSha256: manifest.packSha256,
    claimBoundary: manifest.claimBoundary,
  };
}

function checkEvidencePackManifest() {
  if (!fs.existsSync(outPath)) {
    return {
      ok: false,
      reason: 'evidence_pack_manifest_missing',
      path: rel(outPath),
    };
  }
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const expected = buildEvidencePackManifest({
    status: existing.status || 'CANDIDATE_NON_CLAIM',
  });
  const existingComparable = comparableManifest(existing);
  const expectedComparable = comparableManifest(expected);
  const ok = JSON.stringify(existingComparable) === JSON.stringify(expectedComparable);
  return {
    ok,
    reason: ok ? 'evidence_pack_manifest_current' : 'evidence_pack_manifest_stale',
    path: rel(outPath),
    expectedPackSha256: expected.packSha256,
    observedPackSha256: existing.packSha256 || null,
    expectedFileCount: expected.files.length,
    observedFileCount: Array.isArray(existing.files) ? existing.files.length : null,
  };
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function main() {
  if (process.argv.includes('--check')) {
    const result = checkEvidencePackManifest();
    if (!result.ok) {
      console.error(`BETA17_EVIDENCE_PACK_MANIFEST_CHECK_FAIL ${result.reason}`);
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
    console.log(`BETA17_EVIDENCE_PACK_MANIFEST_CHECK_PASS ${result.path}`);
    console.log(`packSha256=${result.observedPackSha256}`);
    console.log(`files=${result.observedFileCount}`);
    return;
  }
  const status = argValue('--status', 'CANDIDATE_NON_CLAIM');
  const result = writeEvidencePackManifest({ status });
  console.log(`BETA17_EVIDENCE_PACK_MANIFEST_READY ${result.path}`);
  console.log(`sha256=${result.sha256}`);
  console.log(`files=${result.manifest.files.length}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildEvidencePackManifest,
  checkEvidencePackManifest,
  writeEvidencePackManifest,
};
