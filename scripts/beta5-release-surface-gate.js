#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const releaseMode = process.argv.includes('--release');
const outDir = path.join(root, 'evidence', 'beta5-release-surface-gate');
const changelogPath = path.join(root, 'CHANGELOG.md');
const matrixPath = path.join(root, 'docs', 'BETA5_RELEASE_SURFACE_SYNC.md');
const adversarialMethodologyPath = path.join(root, 'docs', 'BETA5_ADVERSARIAL_RELEASE_AUDIT.md');
const buildChainPath = path.join(root, 'evidence', 'beta5-local-candidate', 'build-chain.manifest.json');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function must(condition, code, failures) {
  if (!condition) failures.push(code);
}

function parseMatrix(markdown) {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('---'))
    .slice(1)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 4)
    .map(([surface, status, evidence, notes]) => ({ surface, status, evidence, notes }));
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const warnings = [];

  must(fs.existsSync(changelogPath), 'release_changelog_missing', failures);
  must(fs.existsSync(matrixPath), 'release_surface_sync_gap', failures);
  must(fs.existsSync(adversarialMethodologyPath), 'release_adversarial_audit_methodology_missing', failures);
  must(fs.existsSync(buildChainPath), 'release_build_chain_missing', failures);

  const changelog = fs.existsSync(changelogPath) ? read(changelogPath) : '';
  const matrix = fs.existsSync(matrixPath) ? read(matrixPath) : '';
  const adversarialMethodology = fs.existsSync(adversarialMethodologyPath) ? read(adversarialMethodologyPath) : '';
  const buildChain = fs.existsSync(buildChainPath) ? JSON.parse(read(buildChainPath)) : {};
  const surfaces = parseMatrix(matrix);

  const changelogHash = changelog ? sha256(changelog) : null;
  const matrixHash = matrix ? sha256(matrix) : null;
  const adversarialMethodologyHash = adversarialMethodology ? sha256(adversarialMethodology) : null;
  const boundChangelog = buildChain.releaseSurfaceSync?.changelog;
  const boundMatrix = buildChain.releaseSurfaceSync?.matrix;
  const boundAdversarialMethodology = buildChain.releaseSurfaceSync?.adversarialMethodology;

  must(changelog.includes('0.1.0-beta.5'), 'release_changelog_version_missing', failures);
  must(changelog.includes('SDK') || changelog.includes('SDKs'), 'release_changelog_sdk_surface_missing', failures);
  must(changelog.includes('skills'), 'release_changelog_skills_surface_missing', failures);
  must(changelog.includes('docs') || changelog.includes('documentation'), 'release_changelog_docs_surface_missing', failures);
  must(changelog.includes('curl') || changelog.includes('GitHub Release'), 'release_changelog_publication_surface_missing', failures);
  must(adversarialMethodology.includes('mandatory_before_publication'), 'release_adversarial_audit_methodology_contract_missing', failures);
  must(adversarialMethodology.includes('PASS_BETA5_LOCAL_COMPLETION'), 'release_adversarial_audit_completion_gate_missing', failures);

  must(boundChangelog?.sha256 === changelogHash, 'release_changelog_artifact_drift', failures);
  must(boundMatrix?.sha256 === matrixHash, 'release_surface_matrix_unbound', failures);
  must(boundAdversarialMethodology?.sha256 === adversarialMethodologyHash, 'release_adversarial_audit_methodology_unbound', failures);

  const requiredSurfaces = [
    'CLI repo',
    'CLI changelog',
    'Adversarial release audit methodology',
    'L4 offline runtime',
    'JavaScript/TypeScript SDK',
    'Python SDK',
    'Rust SDK',
    'Public skills',
    'Docs site',
    'Web/curl surface',
    'GitHub Release',
    'Marketplace publishing'
  ];
  const bySurface = new Map(surfaces.map((row) => [row.surface, row]));
  for (const surface of requiredSurfaces) {
    must(bySurface.has(surface), `release_surface_missing:${surface}`, failures);
  }

  const allowedStatuses = new Set(['updated', 'no_change_required', 'blocked', 'not_applicable']);
  for (const row of surfaces) {
    must(allowedStatuses.has(row.status), `release_surface_bad_status:${row.surface}`, failures);
    if (row.status === 'no_change_required' && /no evidence|n\/a|none/i.test(row.evidence)) {
      failures.push(`release_surface_no_change_unproven:${row.surface}`);
    }
  }

  const blocked = surfaces.filter((row) => row.status === 'blocked').map((row) => row.surface);
  const decision = failures.length > 0
    ? 'FAIL_RELEASE_SURFACE_GATE'
    : blocked.length > 0
      ? 'BLOCKED_PUBLIC_RELEASE_NOT_READY'
      : 'PASS_RELEASE_SURFACE_GATE';

  const report = {
    schemaVersion: 'brik64.cli_beta5_release_surface_gate.v1',
    version: '0.1.0-beta.5',
    releaseMode,
    decision,
    releaseEligible: decision === 'PASS_RELEASE_SURFACE_GATE',
    changelog: {
      path: 'CHANGELOG.md',
      sha256: changelogHash
    },
    adversarialMethodology: {
      path: 'docs/BETA5_ADVERSARIAL_RELEASE_AUDIT.md',
      sha256: adversarialMethodologyHash
    },
    matrix: {
      path: 'docs/BETA5_RELEASE_SURFACE_SYNC.md',
      sha256: matrixHash,
      surfaces
    },
    buildChain: {
      path: 'evidence/beta5-local-candidate/build-chain.manifest.json',
      changelogBound: boundChangelog?.sha256 === changelogHash,
      matrixBound: boundMatrix?.sha256 === matrixHash,
      adversarialMethodologyBound: boundAdversarialMethodology?.sha256 === adversarialMethodologyHash
    },
    blockers: blocked,
    failures,
    warnings
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${decision}\n`);
  process.stdout.write(`releaseEligible=${report.releaseEligible}\n`);
  if (blocked.length > 0) process.stdout.write(`blocked=${blocked.join(',')}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);

  if (failures.length > 0 || (releaseMode && blocked.length > 0)) {
    process.exit(1);
  }
}

main();
