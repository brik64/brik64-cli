#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.9';
const pyVersion = '0.1.0b9';
const outDir = path.join(root, 'evidence', 'beta9-public-surfaces');
const reportPath = path.join(outDir, 'sdk-marketplace-publish.json');

const jsRoot = process.env.BRIK64_JS_SDK_ROOT || '/Users/carlosjperez/Documents/GitHub/brik64-lib-js';
const pythonRoot = process.env.BRIK64_PYTHON_SDK_ROOT || '/Users/carlosjperez/Documents/GitHub/brik64-lib-python';
const rustRoot = process.env.BRIK64_RUST_SDK_ROOT || '/Users/carlosjperez/Documents/GitHub/brik64-lib-rust';
const opHelper = process.env.BRIK64_OP_HELPER || '/Users/carlosjperez/Documents/GitHub/brik64-prod/scripts/ops/brik64_op_keychain_token.sh';
const pythonDist = process.env.BRIK64_PYTHON_DIST || '/tmp/brik64-python-beta9-marketplace-dist';
const publishRequested = process.argv.includes('--publish');
const useOnePassword = process.env.BRIK64_USE_1PASSWORD === '1';
const expectedConfirm = `PUBLISH SDK ${version}`;
const confirm = process.env.BRIK64_RELEASE_CONFIRM || '';

function ensureOutDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function run(command, args, options = {}) {
  const startedAt = Date.now();
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    env: options.env || process.env,
    maxBuffer: 4 * 1024 * 1024
  });
  return {
    command: [command, ...args].join(' '),
    cwd: options.cwd || root,
    rc: result.status === null ? 1 : result.status,
    elapsedMs: Date.now() - startedAt,
    stdout: redact(result.stdout || ''),
    stderr: redact(result.stderr || '')
  };
}

function redact(value) {
  return String(value)
    .replace(/npm_[A-Za-z0-9_-]+/g, 'npm_[REDACTED]')
    .replace(/pypi-[A-Za-z0-9_-]+/g, 'pypi-[REDACTED]')
    .replace(/cio[a-zA-Z0-9_-]+/g, 'cio[REDACTED]')
    .slice(0, 4000);
}

function commandOk(command, args, options = {}) {
  const result = run(command, args, options);
  return { ok: result.rc === 0, result };
}

function withNpmTokenEnv(token, callback) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-npm-auth-'));
  const npmrc = path.join(tmpDir, 'npmrc');
  try {
    fs.writeFileSync(npmrc, [
      'registry=https://registry.npmjs.org/',
      '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}',
      ''
    ].join('\n'), { mode: 0o600 });
    return callback({
      ...process.env,
      NODE_AUTH_TOKEN: token,
      NPM_CONFIG_USERCONFIG: npmrc,
      NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/'
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function readJsonFromCommand(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.rc !== 0) return { ok: false, result };
  try {
    return { ok: true, value: JSON.parse(result.stdout), result };
  } catch (error) {
    return { ok: false, error: `json_parse_error:${error.message}`, result };
  }
}

function gitState(cwd) {
  const head = run('git', ['rev-parse', 'HEAD'], { cwd });
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
  const status = run('git', ['status', '--short'], { cwd });
  return {
    cwd,
    ok: head.rc === 0 && branch.rc === 0 && status.rc === 0,
    branch: branch.stdout.trim() || null,
    head: head.stdout.trim() || null,
    dirty: Boolean(status.stdout.trim()),
    status: status.stdout.trim() ? status.stdout.trim().split('\n') : []
  };
}

function readSecret({ envNames, opRef }) {
  for (const name of envNames) {
    if (process.env[name]) return { present: true, source: `env:${name}`, value: process.env[name] };
  }
  if (!useOnePassword) return { present: false, source: 'not_requested', value: '' };
  if (!fs.existsSync(opHelper)) return { present: false, source: 'onepassword_helper_missing', value: '' };
  const result = childProcess.spawnSync('bash', [opHelper, 'run', '--', 'op', 'read', opRef], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });
  if (result.status !== 0) return { present: false, source: 'onepassword_read_failed', value: '' };
  const value = (result.stdout || '').trim();
  return { present: Boolean(value), source: 'onepassword:BRIK64', value };
}

function packageVersion(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8')).version;
}

function pyProjectVersion(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

function cargoVersion(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

function npmVersionExists() {
  const check = run('npm', ['view', `@brik64/core@${version}`, 'version'], { cwd: jsRoot });
  return check.rc === 0 && check.stdout.trim() === version;
}

function pypiVersionExists() {
  const script = `import urllib.request\nurllib.request.urlopen('https://pypi.org/pypi/brik64/${pyVersion}/json', timeout=20).close()\n`;
  return run('python3', ['-c', script], { cwd: pythonRoot }).rc === 0;
}

function cratesVersionExists() {
  const query = readJsonFromCommand('python3', ['-c', "import json,urllib.request;print(json.dumps(json.load(urllib.request.urlopen('https://crates.io/api/v1/crates/brik64-core', timeout=20))))"]);
  if (!query.ok) return false;
  return (query.value.versions || []).some((item) => item.num === version);
}

function isAlreadyPublished(result) {
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  return /already exists/i.test(text) || /previously published/i.test(text);
}

function main() {
  ensureOutDir();
  const failures = [];
  const warnings = [];
  const preflight = [];
  const executed = [];

  const npmSecret = readSecret({
    envNames: ['NODE_AUTH_TOKEN', 'NPM_TOKEN', 'BRIK64_NPM_TOKEN'],
    opRef: 'op://BRIK64/npmjs.com BRIK64/API KEY'
  });
  const pypiSecret = readSecret({
    envNames: ['TWINE_PASSWORD', 'PYPI_TOKEN', 'BRIK64_PYPI_TOKEN'],
    opRef: 'op://BRIK64/PYPI.ORG BRIK64/API KEY'
  });
  const cratesSecret = readSecret({
    envNames: ['CARGO_REGISTRY_TOKEN', 'BRIK64_CRATES_TOKEN'],
    opRef: 'op://BRIK64/CRATES.IO/API'
  });

  const sourceRepos = [
    { id: 'js', expectedPackage: '@brik64/core', expectedVersion: version, packageVersion: packageVersion(path.join(jsRoot, 'package.json')), ...gitState(jsRoot) },
    { id: 'python', expectedPackage: 'brik64', expectedVersion: pyVersion, packageVersion: pyProjectVersion(path.join(pythonRoot, 'pyproject.toml')), ...gitState(pythonRoot) },
    { id: 'rust', expectedPackage: 'brik64-core', expectedVersion: version, packageVersion: cargoVersion(path.join(rustRoot, 'Cargo.toml')), ...gitState(rustRoot) }
  ];

  for (const repo of sourceRepos) {
    if (!repo.ok) failures.push(`sdk_repo_unreadable:${repo.id}`);
    if (repo.packageVersion !== repo.expectedVersion) failures.push(`sdk_repo_version_drift:${repo.id}:${repo.packageVersion}`);
    const nonAllowedDirty = (repo.status || []).filter((line) => repo.id !== 'js' || !/evidence-beta\d+-pack\//.test(line));
    if (nonAllowedDirty.length > 0) failures.push(`sdk_repo_dirty:${repo.id}`);
  }

  const jsChecks = [
    commandOk('npm', ['run', 'build'], { cwd: jsRoot }),
    commandOk('npm', ['test'], { cwd: jsRoot }),
    commandOk('npm', ['publish', '--dry-run', '--tag', 'beta', '--access', 'public'], { cwd: jsRoot })
  ];
  preflight.push({ id: 'npm_package_dry_run', passed: jsChecks.every((item) => item.ok), commands: jsChecks.map((item) => item.result) });
  if (!jsChecks.every((item) => item.ok)) failures.push('npm_package_dry_run_failed');

  const pyChecks = [
    commandOk('python3', ['-m', 'compileall', 'brik64', 'tests'], { cwd: pythonRoot }),
    commandOk('bash', ['-lc', `rm -rf ${quote(pythonDist)} && python3 -m build --outdir ${quote(pythonDist)} && python3 -m twine check ${quote(pythonDist)}/*`], { cwd: pythonRoot })
  ];
  preflight.push({ id: 'pypi_package_build_check', passed: pyChecks.every((item) => item.ok), commands: pyChecks.map((item) => item.result) });
  if (!pyChecks.every((item) => item.ok)) failures.push('pypi_package_build_check_failed');

  const rustChecks = [
    commandOk('cargo', ['test'], { cwd: rustRoot }),
    commandOk('cargo', ['publish', '--dry-run', '--allow-dirty'], { cwd: rustRoot })
  ];
  preflight.push({ id: 'crates_package_dry_run', passed: rustChecks.every((item) => item.ok), commands: rustChecks.map((item) => item.result) });
  if (!rustChecks.every((item) => item.ok)) failures.push('crates_package_dry_run_failed');

  const npmAuth = npmSecret.present
    ? withNpmTokenEnv(npmSecret.value, (npmAuthEnv) => commandOk('npm', ['whoami'], { cwd: jsRoot, env: npmAuthEnv }))
    : { ok: false, result: { rc: 1, stdout: '', stderr: 'npm_token_missing' } };
  preflight.push({
    id: 'npm_auth',
    passed: npmAuth.ok,
    secretSource: npmSecret.present ? npmSecret.source : npmSecret.source,
    command: npmAuth.result
  });
  if (!npmAuth.ok) failures.push('npm_auth_failed_or_missing');

  preflight.push({
    id: 'pypi_auth_material_present',
    passed: pypiSecret.present,
    secretSource: pypiSecret.source,
    boundary: 'PyPI upload tokens cannot be fully validated without an upload attempt; this preflight only proves token material is present and package artifacts pass twine check.'
  });
  if (!pypiSecret.present) failures.push('pypi_token_missing');

  const cratesAuthEnv = cratesSecret.present ? { ...process.env, CARGO_REGISTRY_TOKEN: cratesSecret.value } : process.env;
  const cratesAuth = commandOk('cargo', ['owner', '--list', 'brik64-core'], { cwd: rustRoot, env: cratesAuthEnv });
  preflight.push({
    id: 'crates_auth',
    passed: cratesAuth.ok,
    secretSource: cratesSecret.present ? cratesSecret.source : 'cargo_local_config_or_session',
    command: cratesAuth.result
  });
  if (!cratesAuth.ok) failures.push('crates_auth_failed');

  if (publishRequested && confirm !== expectedConfirm) failures.push('publish_confirmation_missing_or_invalid');

  if (publishRequested && failures.length === 0) {
    const pypiExists = pypiVersionExists();
    const npmExists = npmVersionExists();
    const cratesExists = cratesVersionExists();

    if (!pypiExists) {
      const result = run('python3', ['-m', 'twine', 'upload', `${pythonDist}/*`], {
        cwd: pythonRoot,
        env: { ...process.env, TWINE_USERNAME: '__token__', TWINE_PASSWORD: pypiSecret.value }
      });
      executed.push({ id: 'pypi_publish', skipped: false, result });
      if (result.rc !== 0) failures.push('pypi_publish_failed');
    } else {
      executed.push({ id: 'pypi_publish', skipped: true, reason: 'version_already_exists' });
    }

    if (failures.length === 0 && !npmExists) {
      const result = withNpmTokenEnv(npmSecret.value, (npmAuthEnv) => (
        run('npm', ['publish', '--tag', 'beta', '--access', 'public'], { cwd: jsRoot, env: npmAuthEnv })
      ));
      executed.push({ id: 'npm_publish', skipped: false, result });
      if (result.rc !== 0) failures.push('npm_publish_failed');
    } else if (failures.length === 0) {
      executed.push({ id: 'npm_publish', skipped: true, reason: 'version_already_exists' });
    }

    if (failures.length === 0 && !cratesExists) {
      const args = ['publish', '--manifest-path', path.join(rustRoot, 'Cargo.toml')];
      const result = run('cargo', args, { cwd: rustRoot, env: cratesAuthEnv });
      if (result.rc !== 0 && isAlreadyPublished(result)) {
        executed.push({ id: 'crates_publish', skipped: true, reason: 'version_already_exists_after_index_race', result });
      } else {
        executed.push({ id: 'crates_publish', skipped: false, result });
        if (result.rc !== 0) failures.push('crates_publish_failed');
      }
    } else if (failures.length === 0) {
      executed.push({ id: 'crates_publish', skipped: true, reason: 'version_already_exists' });
    }
  }

  const report = {
    schemaVersion: 'brik64.beta9_sdk_marketplace_publish.v1',
    generatedAt: new Date().toISOString(),
    version,
    pyVersion,
    publishRequested,
    publicationMutated: publishRequested && executed.some((item) => item.skipped === false && item.result?.rc === 0),
    decision: failures.length === 0
      ? publishRequested
        ? 'PASS_BETA9_SDK_MARKETPLACE_PUBLISH'
        : 'PASS_BETA9_SDK_MARKETPLACE_PUBLISH_DRY_RUN'
      : 'BLOCKED_BETA9_SDK_MARKETPLACE_PUBLISH',
    sourceRepos,
    preflight,
    executed,
    failures,
    warnings,
    expectedConfirm,
    boundary: publishRequested
      ? 'Mutation mode publishes SDK marketplaces only after package checks and auth preflight pass.'
      : 'Dry-run mode validates package and auth preflight without publishing.'
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicationMutated=${report.publicationMutated}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  process.exit(failures.length === 0 ? 0 : 2);
}

function quote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

main();
