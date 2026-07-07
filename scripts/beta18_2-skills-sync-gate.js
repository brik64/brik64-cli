#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const repoRoot = path.dirname(root);
const skillsRoot = process.env.BRIK64_SKILLS_ROOT || path.join(repoRoot, 'brik64-tools-skills-blueprint-flow');
const skillPath = path.join(skillsRoot, 'skills', 'brik64', 'SKILL.md');
const readmePath = path.join(skillsRoot, 'README.md');
const outDir = path.join(root, 'evidence', 'beta18_2-skills-sync');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const failures = [];

function check(file, needles) {
  if (!fs.existsSync(file)) {
    failures.push(`missing_file:${path.relative(repoRoot, file)}`);
    return;
  }
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) failures.push(`missing_text:${path.relative(repoRoot, file)}:${needle}`);
  }
  if (/0\.1\.0-beta\.18\.1|Beta18\.1|0\.1\.0b18\.post1/.test(text)) {
    failures.push(`stale_beta18_1_reference:${path.relative(repoRoot, file)}`);
  }
}

check(skillPath, [version, 'brik64 audit', '--fix-plan', 'brik64 test', 'brik64 diff', 'brik64 doc', 'lint-policy']);
check(readmePath, ['brik64 audit', 'Developer Assurance Loop']);

const report = {
  schemaVersion: 'brik64.cli_beta18_2_skills_sync_gate.v1',
  version,
  skillsRoot,
  decision: failures.length === 0 ? 'PASS_BETA18_2_SKILLS_SYNC_GATE' : 'FAIL_BETA18_2_SKILLS_SYNC_GATE',
  publicationAllowed: failures.length === 0,
  failures,
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`decision=${report.decision}`);
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
