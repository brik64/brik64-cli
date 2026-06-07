#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const https = require('https');

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

function githubApiPath(repo, commit) {
  return `/repos/${repo}/commits/${commit}`;
}

function githubApiUrl(repo, commit) {
  return `https://api.github.com${githubApiPath(repo, commit)}`;
}

function ghEnvironment() {
  const env = { ...process.env };
  if (process.env.BRIK64_GITHUB_VERIFICATION_ALLOW_HOST_TOKEN !== '1') {
    delete env.GITHUB_TOKEN;
  }
  return env;
}

function parseVerificationPayload(raw, method) {
  try {
    const payload = JSON.parse(raw);
    return {
      ok: true,
      method,
      apiError: '',
      payload: payload.commit && payload.commit.verification ? payload.commit.verification : payload
    };
  } catch (error) {
    return {
      ok: false,
      method,
      apiError: `github_verification_parse_error:${error.message}`,
      payload: null
    };
  }
}

function readFallbackFixture() {
  const fixture = process.env.BRIK64_GITHUB_VERIFICATION_FALLBACK_JSON || '';
  if (!fixture) return null;
  try {
    return parseVerificationPayload(fs.readFileSync(path.resolve(root, fixture), 'utf8'), 'fallback_fixture');
  } catch (error) {
    return {
      ok: false,
      method: 'fallback_fixture',
      apiError: `github_verification_fallback_fixture_error:${error.message}`,
      payload: null
    };
  }
}

function runHttpsVerification(repo, commit) {
  const fixture = readFallbackFixture();
  if (fixture) return Promise.resolve(fixture);

  return new Promise((resolve) => {
    const request = https.get(githubApiUrl(repo, commit), {
      headers: {
        'User-Agent': 'brik64-release-gate',
        'Accept': 'application/vnd.github+json'
      },
      timeout: 20000
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          resolve({
            ok: false,
            method: 'https',
            apiError: `github_verification_https_status:${response.statusCode}:${body.slice(0, 300)}`,
            payload: null
          });
          return;
        }
        resolve(parseVerificationPayload(body, 'https'));
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('github_verification_https_timeout'));
    });
    request.on('error', (error) => {
      resolve({
        ok: false,
        method: 'https',
        apiError: `github_verification_https_error:${error.message}`,
        payload: null
      });
    });
  });
}

async function runGhVerification(repo, commit) {
  const result = childProcess.spawnSync('gh', ['api', `repos/${repo}/commits/${commit}`, '--jq', '.commit.verification'], {
    cwd: root,
    encoding: 'utf8',
    env: ghEnvironment()
  });
  if (result.status !== 0) {
    const fallback = await runHttpsVerification(repo, commit);
    return fallback.ok ? {
      ...fallback,
      ghApiError: (result.stderr || result.stdout || '').trim()
    } : {
      ok: false,
      method: 'gh',
      apiError: (result.stderr || result.stdout || '').trim(),
      fallbackApiError: fallback.apiError,
      payload: null
    };
  }
  return parseVerificationPayload(result.stdout, 'gh');
}

function readFixture(file) {
  try {
    return {
      ok: true,
      method: 'fixture',
      apiError: '',
      payload: JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'))
    };
  } catch (error) {
    return {
      ok: false,
      method: 'fixture',
      apiError: `verification_fixture_error:${error.message}`,
      payload: null
    };
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const repo = argValue('--repo', process.env.BRIK64_GITHUB_REPO || 'brik64/brik64-cli');
  const commit = argValue('--commit', process.env.BRIK64_RELEASE_COMMIT || gitOutput(['rev-parse', 'HEAD']));
  const fixture = argValue('--verification-json', '');
  const failures = [];
  const warnings = [];

  if (!/^[0-9a-f]{40}$/.test(commit)) failures.push('commit_sha_invalid');

  const source = fixture ? readFixture(fixture) : failures.length === 0 ? await runGhVerification(repo, commit) : { ok: false, method: 'skipped', apiError: '', payload: null };
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
      source: source.method || 'unknown',
      verified: verification.verified === true,
      reason: verification.reason || '',
      verifiedAt: verification.verified_at || null,
      payloadPresent: Boolean(verification.payload)
    },
    apiError: source.apiError || null,
    ghApiError: source.ghApiError || null,
    fallbackApiError: source.fallbackApiError || null,
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

main().catch((error) => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify({
    schemaVersion: 'brik64.beta8_github_verified_signature_gate.v1',
    generatedAt: new Date().toISOString(),
    decision: 'BLOCKED_BETA8_GITHUB_VERIFIED_SIGNATURE',
    failures: ['github_verification_gate_exception'],
    apiError: error.message
  }, null, 2)}\n`);
  process.stdout.write('decision=BLOCKED_BETA8_GITHUB_VERIFIED_SIGNATURE\n');
  process.stdout.write('failures=github_verification_gate_exception\n');
  process.exit(2);
});
