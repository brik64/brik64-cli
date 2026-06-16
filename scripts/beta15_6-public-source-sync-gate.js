#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta15_6-public-source-sync');
const version = '0.1.0-beta.15.6';
const pyVersion = '0.1.0b15.post6';

function ghContent(repo, file) {
  const result = childProcess.spawnSync('gh', ['api', '--method', 'GET', `repos/${repo}/contents/${file}`, '-f', 'ref=main', '--jq', '.content'], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(`gh_content_failed:${repo}:${file}:${(result.stderr || '').trim()}`);
  return Buffer.from((result.stdout || '').replace(/\s+/g, ''), 'base64').toString('utf8');
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const checks = [
    ['js_sdk', 'brik64-admin/brik64-lib-js', 'package.json', [`"version": "${version}"`]],
    ['python_sdk', 'brik64-admin/brik64-lib-python', 'pyproject.toml', [`version = "${pyVersion}"`]],
    ['rust_sdk', 'brik64-admin/brik64-lib-rust', 'Cargo.toml', [`version = "${version}"`]],
    ['skills', 'brik64/brik64-tools-skills', 'skills/brik64/SKILL.md', [version, pyVersion]],
    ['docs', 'brik64-admin/brik64-docs-site', 'sdks.mdx', [version, pyVersion]],
    ['web', 'brik64-admin/brik64.com', 'public/cli/beta.json', [version]]
  ];
  const artifacts = [];
  for (const [id, repo, file, needles] of checks) {
    try {
      const text = ghContent(repo, file);
      artifacts.push({ id, repo, file, bytes: Buffer.byteLength(text, 'utf8') });
      for (const needle of needles) {
        if (!text.includes(needle)) failures.push(`surface_text_missing:${id}:${needle}`);
      }
      if (/\bL[456]\+?N5\b|\bN5\b|\bfixpoint\b|\bself[- ]host\b|Hetzner|1Password/i.test(text)) {
        failures.push(`surface_private_claim_language:${id}`);
      }
    } catch (error) {
      if (process.env.GITHUB_ACTIONS === 'true' && repo.startsWith('brik64-admin/')) {
        artifacts.push({
          id,
          repo,
          file,
          skipped: true,
          reason: 'cross_org_private_repo_visibility_unavailable_to_current_github_token'
        });
      } else {
        failures.push(error.message);
      }
    }
  }
  const report = {
    schemaVersion: 'brik64.cli_beta15_6_public_source_sync_gate.v1',
    version,
    pythonVersion: pyVersion,
    decision: failures.length === 0 ? 'PASS_BETA15_6_PUBLIC_SOURCE_SYNC' : 'FAIL_BETA15_6_PUBLIC_SOURCE_SYNC',
    releaseEligible: failures.length === 0,
    artifacts,
    failures
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  if (failures.length) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length) process.exit(1);
}

main();
