#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const skillsRoot = '/Users/carlosjperez/Documents/GitHub/brik64-tools-skills';
const outDir = path.join(root, 'evidence', 'beta13-skills-sync');
const version = '0.1.0-beta.13';

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
  let joined = '';
  for (const rel of files) {
    const file = path.join(skillsRoot, rel);
    if (!fs.existsSync(file)) {
      failures.push(`missing_skill_file:${rel}`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    joined += `\n${text}`;
    artifacts.push({ path: file, sha256: sha256File(file), bytes: Buffer.byteLength(text, 'utf8') });
    if (/\bL[456]\+?N5\b|\bN5\b|\bfixpoint\b|\bself[- ]host\b|Hetzner|1Password|methodology/i.test(text)) {
      failures.push(`skill_private_or_claim_language:${rel}`);
    }
  }
  for (const needle of [version, '@brik64/core@0.1.0-beta.13', 'brik64==0.1.0b13', 'brik64-core@0.1.0-beta.13']) {
    if (!joined.includes(needle)) failures.push(`skill_required_text_missing:${needle}`);
  }
  if (/0\.1\.0-beta\.(?:[4-9]|10|11|12)\b|0\.1\.0b(?:[4-9]|10|11|12)\b/.test(joined)) {
    failures.push('skill_stale_beta_residue');
  }
  const report = {
    schemaVersion: 'brik64.cli_beta13_skills_sync_gate.v1',
    version,
    decision: failures.length === 0 ? 'PASS_SKILLS_BETA13_SYNC' : 'FAIL_SKILLS_BETA13_SYNC',
    releaseEligible: failures.length === 0,
    publicSkillPublicationAllowed: failures.length === 0,
    skillsRoot,
    artifacts,
    failures,
    boundary: 'Public skills must be Beta13 aware and must not expose private engine nomenclature.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicSkillPublicationAllowed=${report.publicSkillPublicationAllowed}\n`);
  if (failures.length) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length) process.exit(1);
}

main();
