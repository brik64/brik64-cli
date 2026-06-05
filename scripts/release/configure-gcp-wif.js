#!/usr/bin/env node
const childProcess = require('child_process');

const project = 'brik64-platform-mvp';
const projectNumber = '897764825865';
const pool = 'brik64-github-actions';
const provider = 'brik64-cli-main';
const repo = 'brik64/brik64-cli';
const ref = 'refs/heads/main';
const requiredAccount = 'admin@brik64.com';
const serviceAccount = `brik64-cli-release-publisher@${project}.iam.gserviceaccount.com`;
const providerResource = `projects/${projectNumber}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`;

const apply = process.argv.includes('--apply');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function run(binary, args, options = {}) {
  const result = childProcess.spawnSync(binary, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit'
  });
  return {
    rc: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function output(binary, args) {
  const result = run(binary, args, { capture: true });
  if (result.rc !== 0) {
    throw new Error(`${binary} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function exists(binary, args) {
  const result = run(binary, args, { capture: true });
  return result.rc === 0;
}

function step(label, binary, args) {
  process.stdout.write(`step=${label}\n`);
  if (!apply) {
    process.stdout.write(`dryRunCommand=${binary} ${args.join(' ')}\n`);
    return;
  }
  const result = run(binary, args);
  if (result.rc !== 0) {
    throw new Error(`${label} failed`);
  }
}

function setSecret(name, value) {
  process.stdout.write(`secret=${name}\n`);
  if (!apply) return;
  const result = childProcess.spawnSync('gh', ['secret', 'set', name, '--repo', repo, '--body', value], {
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'inherit']
  });
  if (result.status !== 0) throw new Error(`secret_set_failed:${name}`);
}

function main() {
  const activeAccount = output('gcloud', ['config', 'get-value', 'account']);
  const failures = [];

  if (activeAccount !== requiredAccount) {
    failures.push(`active_account_not_admin:${activeAccount}`);
  }

  if (!exists('gcloud', ['projects', 'describe', project, '--format=value(projectId)'])) {
    failures.push('admin_gcloud_session_not_refreshed');
  }

  if (failures.length > 0) {
    process.stdout.write('decision=BLOCKED_GCP_ADMIN_REAUTH_REQUIRED\n');
    process.stdout.write(`requiredCommand=gcloud auth login ${requiredAccount}\n`);
    process.stdout.write(`failures=${failures.join(',')}\n`);
    process.exit(1);
  }

  const poolExists = exists('gcloud', [
    'iam',
    'workload-identity-pools',
    'describe',
    pool,
    '--project',
    project,
    '--location',
    'global',
    '--impersonate-service-account',
    serviceAccount
  ]);

  if (!poolExists) {
    step('create_pool', 'gcloud', [
      'iam',
      'workload-identity-pools',
      'create',
      pool,
      '--project',
      project,
      '--location',
      'global',
      '--display-name=BRIK64 GitHub Actions',
      '--impersonate-service-account',
      serviceAccount
    ]);
  } else {
    process.stdout.write('step=create_pool skipped=exists\n');
  }

  const providerExists = exists('gcloud', [
    'iam',
    'workload-identity-pools',
    'providers',
    'describe',
    provider,
    '--project',
    project,
    '--location',
    'global',
    '--workload-identity-pool',
    pool,
    '--impersonate-service-account',
    serviceAccount
  ]);

  if (!providerExists) {
    step('create_provider', 'gcloud', [
      'iam',
      'workload-identity-pools',
      'providers',
      'create-oidc',
      provider,
      '--project',
      project,
      '--location',
      'global',
      '--workload-identity-pool',
      pool,
      '--display-name=BRIK64 CLI main',
      '--issuer-uri=https://token.actions.githubusercontent.com',
      '--attribute-mapping=google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref',
      `--attribute-condition=assertion.repository=='${repo}' && assertion.ref=='${ref}'`,
      '--impersonate-service-account',
      serviceAccount
    ]);
  } else {
    process.stdout.write('step=create_provider skipped=exists\n');
  }

  const member = `principalSet://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${pool}/attribute.repository/${repo}`;
  step('bind_workload_identity_user', 'gcloud', [
    'iam',
    'service-accounts',
    'add-iam-policy-binding',
    serviceAccount,
    '--project',
    project,
    '--role=roles/iam.workloadIdentityUser',
    `--member=${member}`
  ]);

  setSecret('BRIK64_GCP_WORKLOAD_IDENTITY_PROVIDER', providerResource);
  setSecret('BRIK64_GCP_SERVICE_ACCOUNT', serviceAccount);

  process.stdout.write(`provider=${providerResource}\n`);
  process.stdout.write(`serviceAccount=${serviceAccount}\n`);
  process.stdout.write(`decision=${apply ? 'PASS_GCP_WIF_CONFIGURED' : 'PASS_GCP_WIF_DRY_RUN'}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
