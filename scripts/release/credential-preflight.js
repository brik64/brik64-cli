#!/usr/bin/env node
const fs = require('fs');
const https = require('https');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, 'evidence', 'release-credential-preflight');
const reportPath = path.join(outDir, 'report.json');

function requestJson(options) {
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: body.slice(0, 800) });
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.on('error', (error) => resolve({ statusCode: 0, body: error.message }));
    req.end();
  });
}

function run(command, env = {}) {
  const result = childProcess.spawnSync('bash', ['-lc', command], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
  return {
    rc: result.status,
    stdout: (result.stdout || '').slice(0, 800),
    stderr: (result.stderr || '').slice(0, 800)
  };
}

function present(name) {
  return Boolean(process.env[name]);
}

function redactStatus(status) {
  if (status === 401 || status === 403) return 'auth_rejected';
  if (status >= 200 && status < 300) return 'auth_accepted';
  if (status === 0) return 'network_or_client_error';
  return `http_${status}`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const warnings = [];
  const checks = [];

  const publishRequested = process.argv.includes('--publish');
  const ghToken = process.env.BRIK64_GITHUB_RELEASE_TOKEN || process.env.GH_TOKEN || '';
  const npmToken = process.env.BRIK64_NPM_TOKEN || process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN || '';
  const pypiToken = process.env.BRIK64_PYPI_TOKEN || process.env.TWINE_PASSWORD || '';
  const cratesToken = process.env.BRIK64_CRATES_TOKEN || process.env.CARGO_REGISTRY_TOKEN || '';

  if (ghToken) {
    const result = run('gh api user >/dev/null', { GH_TOKEN: ghToken });
    checks.push({ name: 'github_release_token', present: true, valid: result.rc === 0, status: result.rc === 0 ? 'auth_accepted' : 'auth_rejected' });
    if (result.rc !== 0) failures.push('github_release_token_invalid');
  } else {
    checks.push({ name: 'github_release_token', present: false, valid: false, status: 'missing' });
    failures.push('github_release_token_missing');
  }

  if (npmToken) {
    const npm = await requestJson({
      hostname: 'registry.npmjs.org',
      path: '/-/whoami',
      method: 'GET',
      headers: {
        authorization: `Bearer ${npmToken}`,
        'user-agent': 'brik64-release-credential-preflight'
      }
    });
    const valid = npm.statusCode >= 200 && npm.statusCode < 300;
    checks.push({ name: 'npm_token', present: true, valid, status: redactStatus(npm.statusCode) });
    if (!valid) failures.push('npm_token_invalid');
  } else {
    checks.push({ name: 'npm_token', present: false, valid: false, status: 'missing' });
    failures.push('npm_token_missing');
  }

  if (pypiToken) {
    checks.push({
      name: 'pypi_token',
      present: true,
      valid: null,
      status: 'present_unverified',
      note: 'PyPI API tokens are verified by twine upload; preflight avoids printing or probing upload-only credentials.'
    });
  } else {
    checks.push({ name: 'pypi_token', present: false, valid: false, status: 'missing' });
    failures.push('pypi_token_missing');
  }

  if (cratesToken) {
    const crates = await requestJson({
      hostname: 'crates.io',
      path: '/api/v1/me',
      method: 'GET',
      headers: {
        authorization: cratesToken,
        'user-agent': 'brik64-release-credential-preflight'
      }
    });
    const valid = crates.statusCode >= 200 && crates.statusCode < 300;
    checks.push({
      name: 'crates_token',
      present: true,
      valid: valid || null,
      status: valid ? 'auth_accepted' : 'present_scoped_or_oidc_publish_token_unverified',
      note: valid
        ? 'crates.io accepted the token on /api/v1/me.'
        : 'Scoped crates.io publish tokens may not authorize /api/v1/me. Final validation happens at cargo publish.'
    });
    if (!valid) warnings.push(`crates_token_account_probe_${redactStatus(crates.statusCode)}`);
  } else {
    checks.push({ name: 'crates_token', present: false, valid: false, status: 'missing' });
    failures.push('crates_token_missing_or_trusted_publishing_missing');
  }

  const gcpWifReady = present('BRIK64_GCP_WORKLOAD_IDENTITY_PROVIDER') && present('BRIK64_GCP_SERVICE_ACCOUNT');
  const gcpJsonReady = present('BRIK64_GCP_RELEASE_CREDENTIALS');
  checks.push({
    name: 'gcp_auth',
    present: gcpWifReady || gcpJsonReady,
    valid: null,
    status: gcpWifReady ? 'workload_identity_config_present' : gcpJsonReady ? 'service_account_json_present' : 'missing'
  });
  if (!gcpWifReady && !gcpJsonReady) failures.push('gcp_auth_missing');

  for (const name of ['BRIK64_DOCS_DISPATCH_TOKEN', 'BRIK64_WEB_DEPLOY_TOKEN', 'BRIK64_SKILLS_REPO_TOKEN']) {
    checks.push({ name, present: present(name), valid: null, status: present(name) ? 'present_unverified_dispatch_token' : 'missing' });
    if (!present(name)) failures.push(`${name.toLowerCase()}_missing`);
  }

  if (!publishRequested) warnings.push('dry_run_preflight_no_public_mutation');

  const report = {
    schemaVersion: 'brik64.release_credential_preflight.v1',
    publishRequested,
    decision: failures.length === 0 ? 'PASS_RELEASE_CREDENTIAL_PREFLIGHT' : 'FAIL_RELEASE_CREDENTIAL_PREFLIGHT',
    boundary: 'Validates release credentials without printing secrets. Some provider tokens can only be fully verified during provider-specific publish or dispatch.',
    checks,
    failures,
    warnings
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (warnings.length > 0) process.stdout.write(`warnings=${warnings.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({
    schemaVersion: 'brik64.release_credential_preflight.v1',
    decision: 'FAIL_RELEASE_CREDENTIAL_PREFLIGHT',
    failures: ['credential_preflight_exception'],
    error: error.message
  }, null, 2)}\n`);
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
