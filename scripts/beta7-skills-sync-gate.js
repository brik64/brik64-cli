#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const skillsRoot = '/Users/carlosjperez/Documents/GitHub/brik64-tools-skills';
const outDir = path.join(root, 'evidence', 'beta7-skills-sync');
const version = '0.1.0-beta.7';

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const files = [
  'README.md',
  'BETA7_SYNC.md',
  'skills/brik64/SKILL.md',
  'skills/brik64-javascript/SKILL.md',
  'skills/brik64-python/SKILL.md',
  'skills/brik64-rust/SKILL.md',
  'skills/pcd-system/SKILL.md',
  'skills/digital-circuitality/SKILL.md'
];

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const artifacts = [];
  for (const rel of files) {
    const file = path.join(skillsRoot, rel);
    if (!fs.existsSync(file)) {
      failures.push(`missing_skill_file:${rel}`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    artifacts.push({ path: file, sha256: sha256File(file), bytes: Buffer.byteLength(text, 'utf8') });
    if (/0\.1\.0-beta\.[456](?:\.1)?|0\.1\.0b[456](?:\.post1)?|beta[456]|beta\.[456]/.test(text)) failures.push(`skill_stale_beta_residue:${rel}`);
    if (/\bL[456]\+?N5\b|\bfixpoint\b|\bself-host\b|Hetzner|1Password/.test(text)) {
      failures.push(`skill_private_or_claim_language:${rel}`);
    }
  }
  const brik64 = fs.readFileSync(path.join(skillsRoot, 'skills/brik64/SKILL.md'), 'utf8');
  if (!brik64.includes(`version: ${version}`)) failures.push('brik64_skill_beta7_version_missing');
  if (!brik64.includes(`Public CLI version: \`${version}\``)) failures.push('brik64_skill_public_version_boundary_missing');
  if (!brik64.includes('@brik64/core@0.1.0-beta.7')) failures.push('brik64_skill_js_sdk_missing');
  if (!brik64.includes('brik64==0.1.0b7')) failures.push('brik64_skill_python_sdk_missing');
  if (!brik64.includes('brik64-core@0.1.0-beta.7')) failures.push('brik64_skill_rust_sdk_missing');

  const report = {
    schemaVersion: 'brik64.cli_beta7_skills_sync_gate.v1',
    version,
    decision: failures.length === 0 ? 'PASS_SKILLS_BETA7_SYNC' : 'FAIL_SKILLS_BETA7_SYNC',
    releaseEligible: failures.length === 0,
    publicSkillPublicationAllowed: failures.length === 0,
    skillsRoot,
    artifacts,
    failures,
    boundary: 'Public skills are beta7 aligned and must not expose private release or engine nomenclature.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicSkillPublicationAllowed=${report.publicSkillPublicationAllowed}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
