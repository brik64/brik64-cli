#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(root, 'release', 'manifest.json');
const outDir = path.join(root, 'evidence', 'release-web-pages-deploy');
const workflow = process.env.BRIK64_WEB_PAGES_WORKFLOW || 'cloudflare-pages-deploy.yml';
const repo = process.env.BRIK64_WEB_REPO || 'brik64-admin/brik64.com';
const projectName = process.env.BRIK64_WEB_PAGES_PROJECT || 'brik64-web-brik64com';
const waitSeconds = Number(process.env.BRIK64_WEB_DEPLOY_WAIT_SECONDS || '900');
const intervalSeconds = Number(process.env.BRIK64_WEB_DEPLOY_INTERVAL_SECONDS || '15');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args, options = {}) {
  const startedAt = Date.now();
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 8 * 1024 * 1024
  });
  return {
    command: [command, ...args].join(' '),
    rc: result.status,
    elapsedMs: Date.now() - startedAt,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
}

function ghJson(args) {
  const result = run('gh', args);
  if (result.rc !== 0) return { result, value: null };
  try {
    return { result, value: JSON.parse(result.stdout) };
  } catch (error) {
    result.stderr = `${result.stderr}\njson_parse_failed:${error.message}`.trim();
    result.rc = 1;
    return { result, value: null };
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function latestRun(version, notBeforeIso) {
  const { result, value } = ghJson([
    'run',
    'list',
    '--repo',
    repo,
    '--workflow',
    'Deploy Cloudflare Pages',
    '--limit',
    '10',
    '--json',
    'databaseId,status,conclusion,createdAt,url,headSha'
  ]);
  if (result.rc !== 0) return { result, run: null };
  const notBefore = Date.parse(notBeforeIso);
  const run = (value || []).find((item) => {
    const createdAt = Date.parse(item.createdAt || '');
    return Number.isFinite(createdAt) && createdAt >= notBefore;
  });
  return { result, run: run || null };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = readJson(manifestPath);
  const failures = [];
  const observations = [];
  const startedAt = new Date().toISOString();

  const dispatch = run('gh', [
    'workflow',
    'run',
    workflow,
    '--repo',
    repo,
    '-f',
    `version=${manifest.version}`,
    '-f',
    `project_name=${projectName}`
  ]);
  observations.push({ id: 'workflow_dispatch', ...dispatch });
  if (dispatch.rc !== 0) failures.push(`web_pages_dispatch_failed:${dispatch.rc}`);

  let runRecord = null;
  if (failures.length === 0) {
    const deadline = Date.now() + waitSeconds * 1000;
    while (Date.now() < deadline) {
      const listed = latestRun(manifest.version, startedAt);
      observations.push({ id: 'workflow_run_list', ...listed.result });
      if (listed.result.rc !== 0) {
        failures.push(`web_pages_run_list_failed:${listed.result.rc}`);
        break;
      }
      if (listed.run) {
        runRecord = listed.run;
        break;
      }
      sleep(intervalSeconds * 1000);
    }
    if (!runRecord && failures.length === 0) failures.push('web_pages_run_not_found');
  }

  let watch = null;
  if (runRecord && failures.length === 0) {
    watch = run('gh', [
      'run',
      'watch',
      String(runRecord.databaseId),
      '--repo',
      repo,
      '--interval',
      String(Math.min(intervalSeconds, 10)),
      '--exit-status'
    ]);
    observations.push({ id: 'workflow_run_watch', ...watch });
    if (watch.rc !== 0) failures.push(`web_pages_deploy_failed:${watch.rc}`);
  }

  const report = {
    schemaVersion: 'brik64.release_web_pages_deploy_report.v1',
    releaseId: manifest.releaseId,
    version: manifest.version,
    repo,
    workflow,
    projectName,
    waitSeconds,
    decision: failures.length === 0 ? 'PASS_RELEASE_WEB_PAGES_DEPLOY' : 'FAIL_RELEASE_WEB_PAGES_DEPLOY',
    run: runRecord,
    observations,
    failures,
    boundary: 'Dispatches and waits for the brik64.com Cloudflare Pages deployment workflow. It does not assert compiler correctness.'
  };
  writeJson(path.join(outDir, 'report.json'), report);
  process.stdout.write(`decision=${report.decision}\n`);
  if (runRecord?.url) process.stdout.write(`run=${runRecord.url}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
