#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const skillsRoot = '/Users/carlosjperez/Documents/GitHub/brik64-tools-skills';
const outDir = path.join(root, 'evidence', 'beta5-skills-sync');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const files = [
  'README.md',
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
    if (/0\.1\.0-beta\.4|0\.1\.0b4|beta4|beta\.4/.test(text)) failures.push(`skill_beta4_residue:${rel}`);
    if (/\bL4\b|\bL5\b|\bL6\b|L4\+|L5\+|L6\+|\bN5\b|Hetzner|1Password|BRIK64 INC/.test(text)) {
      failures.push(`skill_private_nomenclature:${rel}`);
    }
  }
  const brik64 = fs.readFileSync(path.join(skillsRoot, 'skills/brik64/SKILL.md'), 'utf8');
  if (!brik64.includes('version: 0.1.0-beta.5')) failures.push('brik64_skill_beta5_version_missing');
  if (!brik64.includes('current candidate surface')) failures.push('brik64_skill_candidate_boundary_missing');

  const report = {
    schemaVersion: 'brik64.cli_beta5_skills_sync_gate.v1',
    version: '0.1.0-beta.5',
    decision: failures.length === 0 ? 'PASS_SKILLS_BETA5_SYNC' : 'FAIL_SKILLS_BETA5_SYNC',
    releaseEligible: false,
    publicSkillPublicationAllowed: failures.length === 0,
    skillsRoot,
    artifacts,
    failures,
    boundary: 'Public skills are beta5-candidate aligned and must still follow final release surface status.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicSkillPublicationAllowed=${report.publicSkillPublicationAllowed}\n`);
  if (failures.length > 0) {
    process.stdout.write(`failures=${failures.join(',')}\n`);
    process.exit(1);
  }
}

main();
