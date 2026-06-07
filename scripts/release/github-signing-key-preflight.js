#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'evidence', 'github-signing-key-preflight');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function run(command, args, options = {}) {
  return childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    ...options
  });
}

function commandText(command, args) {
  return [command, ...args].join(' ');
}

function fingerprint(publicKeyPath) {
  const result = run('ssh-keygen', ['-lf', publicKeyPath, '-E', 'sha256']);
  if (result.status !== 0) {
    return { ok: false, value: '', error: (result.stderr || result.stdout || '').trim() };
  }
  const value = result.stdout.trim().split(/\s+/)[1] || '';
  return { ok: Boolean(value), value, error: value ? '' : 'fingerprint_parse_failed' };
}

function ghJson(args) {
  const result = run('gh', args);
  if (result.status !== 0) {
    return {
      ok: false,
      status: result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      json: null
    };
  }
  try {
    return {
      ok: true,
      status: 0,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      json: JSON.parse(result.stdout || 'null')
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      stdout: result.stdout || '',
      stderr: `json_parse_failed:${error.message}`,
      json: null
    };
  }
}

function redact(text) {
  return String(text || '')
    .replace(/gho_[A-Za-z0-9_]+/g, 'gho_***')
    .replace(/github_pat_[A-Za-z0-9_]+/g, 'github_pat_***');
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const publicKeyPath = path.resolve(root, argValue('--public-key', path.join(os.homedir(), '.ssh', 'brik64-admin-signing.pub')));
  const expectedFingerprint = argValue('--expected-fingerprint', process.env.BRIK64_EXPECTED_SIGNING_KEY_FINGERPRINT || '');
  const failures = [];
  const warnings = [];

  if (!fs.existsSync(publicKeyPath)) failures.push('public_key_missing');
  const fp = fs.existsSync(publicKeyPath) ? fingerprint(publicKeyPath) : { ok: false, value: '', error: 'public_key_missing' };
  if (!fp.ok) failures.push(`public_key_fingerprint_failed:${fp.error}`);
  if (expectedFingerprint && fp.value && fp.value !== expectedFingerprint) failures.push('public_key_fingerprint_drift');

  const signingKeys = ghJson(['api', 'user/ssh_signing_keys', '--jq', '.']);
  if (!signingKeys.ok) {
    const detail = `${signingKeys.stderr}\n${signingKeys.stdout}`;
    if (detail.includes('admin:ssh_signing_key')) {
      failures.push('github_token_missing_scope:admin:ssh_signing_key');
    } else {
      failures.push('github_signing_keys_api_unavailable');
    }
  }

  const keys = Array.isArray(signingKeys.json) ? signingKeys.json : [];
  const matchingSigningKey = fp.value
    ? keys.find((item) => {
        const key = item?.key || '';
        if (!key) return false;
        const tmp = path.join(outDir, `key-${item.id || 'candidate'}.pub`);
        fs.writeFileSync(tmp, `${key.trim()}\n`);
        const candidateFp = fingerprint(tmp);
        fs.rmSync(tmp, { force: true });
        return candidateFp.ok && candidateFp.value === fp.value;
      })
    : null;
  if (signingKeys.ok && !matchingSigningKey) failures.push('github_signing_key_not_registered');

  const authStatus = run('gh', ['auth', 'status', '-h', 'github.com']);
  if (authStatus.status !== 0) warnings.push('github_auth_status_nonzero');

  const report = {
    schemaVersion: 'brik64.github_signing_key_preflight.v1',
    generatedAt: new Date().toISOString(),
    decision: failures.length === 0
      ? 'PASS_GITHUB_SIGNING_KEY_PREFLIGHT'
      : 'BLOCKED_GITHUB_SIGNING_KEY_PREFLIGHT',
    publicKey: {
      path: publicKeyPath.replace(os.homedir(), '~'),
      fingerprint: fp.value || null,
      expectedFingerprint: expectedFingerprint || null,
      fingerprintMatchesExpected: Boolean(expectedFingerprint && fp.value === expectedFingerprint)
    },
    github: {
      signingKeysApiAvailable: signingKeys.ok,
      signingKeyRegistered: Boolean(matchingSigningKey),
      matchingSigningKeyTitle: matchingSigningKey?.title || null,
      authStatusRedacted: redact(`${authStatus.stdout || ''}${authStatus.stderr || ''}`).trim()
    },
    nextRequiredAction: failures.includes('github_token_missing_scope:admin:ssh_signing_key')
      ? 'Run: gh auth refresh -h github.com -s admin:ssh_signing_key -s admin:public_key'
      : failures.includes('github_signing_key_not_registered')
        ? 'Register the public key as a GitHub SSH signing key for the committing account, then rerun this preflight.'
        : null,
    commands: {
      refreshScopes: 'gh auth refresh -h github.com -s admin:ssh_signing_key -s admin:public_key',
      listSigningKeys: commandText('gh', ['api', 'user/ssh_signing_keys', '--jq', '.'])
    },
    failures,
    warnings,
    boundary: {
      privateKeyRead: false,
      secretsPrinted: false,
      releasePublicationAllowed: failures.length === 0
    }
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`fingerprint=${report.publicKey.fingerprint || 'missing'}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (report.nextRequiredAction) process.stdout.write(`next=${report.nextRequiredAction}\n`);
  if (failures.length > 0) process.exit(2);
}

main();
