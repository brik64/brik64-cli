#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'evidence', 'github-signing-key-registration');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function run(command, args, input = '') {
  return childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    input,
    env: process.env
  });
}

function fingerprint(publicKeyPath) {
  const result = run('ssh-keygen', ['-lf', publicKeyPath, '-E', 'sha256']);
  if (result.status !== 0) return { ok: false, value: '', error: (result.stderr || result.stdout || '').trim() };
  const value = result.stdout.trim().split(/\s+/)[1] || '';
  return { ok: Boolean(value), value, error: value ? '' : 'fingerprint_parse_failed' };
}

function ghJson(args, input = '') {
  const result = run('gh', args, input);
  if (result.status !== 0) {
    return { ok: false, status: result.status, stdout: result.stdout || '', stderr: result.stderr || '', json: null };
  }
  try {
    return { ok: true, status: 0, stdout: result.stdout || '', stderr: result.stderr || '', json: JSON.parse(result.stdout || 'null') };
  } catch (error) {
    return { ok: false, status: 0, stdout: result.stdout || '', stderr: `json_parse_failed:${error.message}`, json: null };
  }
}

function fingerprintForKeyText(keyText, id) {
  const tmp = path.join(outDir, `candidate-${id || 'key'}.pub`);
  fs.writeFileSync(tmp, `${String(keyText).trim()}\n`);
  const fp = fingerprint(tmp);
  fs.rmSync(tmp, { force: true });
  return fp;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const publicKeyPath = path.resolve(root, argValue('--public-key', path.join(os.homedir(), '.ssh', 'brik64-admin-signing.pub')));
  const title = argValue('--title', 'BRIK64 beta8 release signing key');
  const execute = hasFlag('--execute');
  const failures = [];
  const warnings = [];

  if (!fs.existsSync(publicKeyPath)) failures.push('public_key_missing');
  const keyText = fs.existsSync(publicKeyPath) ? fs.readFileSync(publicKeyPath, 'utf8').trim() : '';
  const fp = keyText ? fingerprint(publicKeyPath) : { ok: false, value: '', error: 'public_key_missing' };
  if (!fp.ok) failures.push(`public_key_fingerprint_failed:${fp.error}`);

  const list = ghJson(['api', 'user/ssh_signing_keys', '--jq', '.']);
  if (!list.ok) {
    const detail = `${list.stderr}\n${list.stdout}`;
    if (detail.includes('admin:ssh_signing_key')) failures.push('github_token_missing_scope:admin:ssh_signing_key');
    else failures.push('github_signing_keys_api_unavailable');
  }

  const keys = Array.isArray(list.json) ? list.json : [];
  const existing = fp.value
    ? keys.find((item) => {
        const candidate = fingerprintForKeyText(item?.key || '', item?.id || 'existing');
        return candidate.ok && candidate.value === fp.value;
      })
    : null;

  let created = null;
  if (execute && failures.length === 0 && !existing) {
    const payload = JSON.stringify({ title, key: keyText });
    const create = ghJson(['api', 'user/ssh_signing_keys', '--method', 'POST', '--input', '-'], payload);
    if (!create.ok) {
      const detail = `${create.stderr}\n${create.stdout}`;
      if (detail.includes('already')) warnings.push('github_signing_key_already_exists');
      else failures.push('github_signing_key_create_failed');
    } else {
      created = create.json;
    }
  }

  const registered = Boolean(existing || created);
  if (!registered && !execute && failures.length === 0) warnings.push('dry_run_registration_not_executed');
  if (!registered && execute && failures.length === 0) failures.push('github_signing_key_not_registered_after_create');

  const report = {
    schemaVersion: 'brik64.github_signing_key_registration.v1',
    generatedAt: new Date().toISOString(),
    decision: failures.length === 0
      ? execute
        ? 'PASS_GITHUB_SIGNING_KEY_REGISTRATION'
        : 'PASS_GITHUB_SIGNING_KEY_REGISTRATION_DRY_RUN'
      : 'BLOCKED_GITHUB_SIGNING_KEY_REGISTRATION',
    execute,
    publicKey: {
      path: publicKeyPath.replace(os.homedir(), '~'),
      fingerprint: fp.value || null
    },
    github: {
      signingKeysApiAvailable: list.ok,
      signingKeyAlreadyRegistered: Boolean(existing),
      signingKeyCreated: Boolean(created),
      matchingSigningKeyTitle: existing?.title || created?.title || null
    },
    nextRequiredAction: failures.includes('github_token_missing_scope:admin:ssh_signing_key')
      ? 'Run: gh auth refresh -h github.com -s admin:ssh_signing_key -s admin:public_key'
      : !execute && !registered
        ? 'Re-run with --execute after confirming the public key fingerprint.'
        : null,
    failures,
    warnings,
    boundary: {
      privateKeyRead: false,
      secretsPrinted: false,
      mutatesGitHub: execute && failures.length === 0 && !existing
    }
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`fingerprint=${report.publicKey.fingerprint || 'missing'}\n`);
  process.stdout.write(`execute=${execute}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (warnings.length > 0) process.stdout.write(`warnings=${warnings.join(',')}\n`);
  if (report.nextRequiredAction) process.stdout.write(`next=${report.nextRequiredAction}\n`);
  if (failures.length > 0) process.exit(2);
}

main();
