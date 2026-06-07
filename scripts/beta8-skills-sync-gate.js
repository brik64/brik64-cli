#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const skillsRoot = '/Users/carlosjperez/Documents/GitHub/brik64-tools-skills';
const outDir = path.join(root, 'evidence', 'beta8-skills-sync');
const version = '0.1.0-beta.8';

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
    if (/0\.1\.0-beta\.[4567](?:\.1)?|0\.1\.0b[4567](?:\.post1)?|beta[4567]|beta\.[4567]/.test(text)) failures.push(`skill_stale_beta_residue:${rel}`);
    if (/\bL[456]\+?N5\b|\bfixpoint\b|\bself-host\b|Hetzner|1Password/.test(text)) failures.push(`skill_private_or_claim_language:${rel}`);
  }
  const brik64Path = path.join(skillsRoot, 'skills/brik64/SKILL.md');
  const brik64 = fs.existsSync(brik64Path) ? fs.readFileSync(brik64Path, 'utf8') : '';
  if (!brik64.includes(`Public CLI version: \`${version}\``) && !brik64.includes('Public CLI version: dynamic')) failures.push('brik64_skill_beta8_version_boundary_missing');
  if (!brik64.includes('@brik64/core@0.1.0-beta.8')) failures.push('brik64_skill_js_sdk_missing');
  if (!brik64.includes('brik64==0.1.0b8')) failures.push('brik64_skill_python_sdk_missing');
  if (!brik64.includes('brik64-core@0.1.0-beta.8')) failures.push('brik64_skill_rust_sdk_missing');

  const report = {
    schemaVersion: 'brik64.cli_beta8_skills_sync_gate.v1',
    version,
    decision: failures.length === 0 ? 'PASS_SKILLS_BETA8_SYNC' : 'FAIL_SKILLS_BETA8_SYNC',
    releaseEligible: failures.length === 0,
    publicSkillPublicationAllowed: failures.length === 0,
    skillsRoot,
    artifacts,
    failures,
    boundary: 'Public skills must be beta8 aware and must not expose private release or engine nomenclature.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicSkillPublicationAllowed=${report.publicSkillPublicationAllowed}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
