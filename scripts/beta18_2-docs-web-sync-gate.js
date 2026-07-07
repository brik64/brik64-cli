#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta18_2-docs-web-sync');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const packageManifest = JSON.parse(fs.readFileSync(path.join(root, 'evidence', 'beta18_2-package', 'package.manifest.json'), 'utf8'));
const packageSha = packageManifest.package.sha256;
const repoRoot = path.dirname(root);
const webRoot = process.env.BRIK64_WEB_ROOT || path.join(repoRoot, 'brik64.com');
const docsRoot = process.env.BRIK64_DOCS_ROOT || path.join(repoRoot, 'brik64-docs-site-beta18-1');
const failures = [];

function requireContains(file, needles) {
  if (!fs.existsSync(file)) {
    failures.push(`missing_file:${path.relative(repoRoot, file)}`);
    return;
  }
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) failures.push(`missing_text:${path.relative(repoRoot, file)}:${needle}`);
  }
}

requireContains(path.join(webRoot, 'public', 'cli', 'beta.json'), [version]);
requireContains(path.join(webRoot, 'public', 'cli', 'install.sh'), [version]);
requireContains(path.join(webRoot, 'public', 'cli', 'releases', `${version}.json`), [version, packageSha]);
requireContains(path.join(webRoot, 'src', 'app', 'download', 'page.tsx'), [version]);
requireContains(path.join(webRoot, 'src', 'app', 'sdks', 'page.tsx'), [version, '0.1.0b18.post2']);
requireContains(path.join(docsRoot, 'quickstart.mdx'), [version, 'brik64 audit']);
requireContains(path.join(docsRoot, 'cli', 'commands.mdx'), ['brik64 audit', 'lint-policy', '--fix-plan']);
requireContains(path.join(docsRoot, 'releases', 'changelog.mdx'), [version, 'Developer Assurance Loop']);

const report = {
  schemaVersion: 'brik64.cli_beta18_2_docs_web_sync_gate.v1',
  version,
  packageSha256: packageSha,
  webRoot,
  docsRoot,
  decision: failures.length === 0 ? 'PASS_BETA18_2_DOCS_WEB_SYNC_GATE' : 'FAIL_BETA18_2_DOCS_WEB_SYNC_GATE',
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
