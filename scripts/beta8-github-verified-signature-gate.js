#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta8-github-verified-signature');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function gitOutput(args) {
  return childProcess.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function runGhVerification(repo, commit) {
  const result = childProcess.spawnSync('gh', ['api', `repos/${repo}/commits/${commit}`, '--jq', '.commit.verification'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env
  });
  if (result.status !== 0) {
    return {
      ok: false,
      apiError: (result.stderr || result.stdout || '').trim(),
      payload: null
    };
  }
  try {
    return {
      ok: true,
      apiError: '',
      payload: JSON.parse(result.stdout)
    };
  } catch (error) {
    return {
      ok: false,
      apiError: `github_verification_parse_error:${error.message}`,
      payload: null
    };
  }
}

function readFixture(file) {
  try {
    return {
      ok: true,
      apiError: '',
      payload: JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'))
    };
  } catch (error) {
    return {
      ok: false,
      apiError: `verification_fixture_error:${error.message}`,
      payload: null
    };
  }
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const repo = argValue('--repo', process.env.BRIK64_GITHUB_REPO || 'brik64/brik64-cli');
  const commit = argValue('--commit', process.env.BRIK64_RELEASE_COMMIT || gitOutput(['rev-parse', 'HEAD']));
  const fixture = argValue('--verification-json', '');
  const failures = [];
  const warnings = [];

  if (!/^[0-9a-f]{40}$/.test(commit)) failures.push('commit_sha_invalid');

  const source = fixture ? readFixture(fixture) : failures.length === 0 ? runGhVerification(repo, commit) : { ok: false, apiError: '', payload: null };
  if (!source.ok) failures.push('github_verification_unavailable');
  const verification = source.payload || {};
  if (source.ok && verification.verified !== true) failures.push('commit_not_github_verified');
  if (source.ok && !verification.verified_at) warnings.push('verified_at_missing');

  const report = {
    schemaVersion: 'brik64.beta8_github_verified_signature_gate.v1',
    generatedAt: new Date().toISOString(),
    releaseId: 'brik64-0.1.0-beta.8',
    version: '0.1.0-beta.8',
    decision: failures.length === 0
      ? 'PASS_BETA8_GITHUB_VERIFIED_SIGNATURE'
      : 'BLOCKED_BETA8_GITHUB_VERIFIED_SIGNATURE',
    repo,
    commit,
    verification: {
      verified: verification.verified === true,
      reason: verification.reason || '',
      verifiedAt: verification.verified_at || null,
      payloadPresent: Boolean(verification.payload)
    },
    apiError: source.apiError || null,
    boundary: {
      gateKind: 'release_integrity_identity_gate',
      compilerFunctionalityEvidence: false,
      publicReleaseAllowed: failures.length === 0,
      adminOverrideAllowed: false
    },
    failures,
    warnings
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicReleaseAllowed=${report.boundary.publicReleaseAllowed}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (warnings.length > 0) process.stdout.write(`warnings=${warnings.join(',')}\n`);
  if (failures.length > 0) process.exit(2);
}

main();
