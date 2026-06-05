#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'release', 'manifest.json');
const outDir = path.join(root, 'evidence', 'release-train-live-verify');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const verifierHeaders = {
  'user-agent': 'Mozilla/5.0 (compatible; brik64-release-train-live-verify/1.0; +https://brik64.com)',
  'accept': 'text/html,application/json,text/plain,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  'pragma': 'no-cache'
};

function fetchTextWithCurl(url) {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'brik64-live-verify-'));
  const headerFile = path.join(tmpDir, 'headers.txt');
  const bodyFile = path.join(tmpDir, 'body.txt');
  const args = [
    '--fail-with-body',
    '--location',
    '--silent',
    '--show-error',
    '--max-time',
    '20',
    '--dump-header',
    headerFile,
    '--output',
    bodyFile
  ];
  for (const [name, value] of Object.entries(verifierHeaders)) {
    args.push('--header', `${name}: ${value}`);
  }
  args.push(url);

  const result = spawnSync('curl', args, {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  });
  try {
    const headerText = fs.existsSync(headerFile) ? fs.readFileSync(headerFile, 'utf8') : '';
    const body = fs.existsSync(bodyFile) ? fs.readFileSync(bodyFile, 'utf8') : '';
    const headerSections = headerText.trim().split(/\r?\n\r?\n/).filter(Boolean);
    const finalHeaderText = headerSections[headerSections.length - 1] || '';
    const statusMatches = [...headerText.matchAll(/^HTTP\/\S+\s+(\d+)/gmi)];
    const statusCode = statusMatches.length > 0 ? Number(statusMatches[statusMatches.length - 1][1]) : (result.status === 0 ? 200 : 0);
    const headers = {};
    for (const line of finalHeaderText.split(/\r?\n/)) {
      const separator = line.indexOf(':');
      if (separator > 0) headers[line.slice(0, separator).toLowerCase()] = line.slice(separator + 1).trim();
    }
    return {
      url,
      statusCode,
      headers,
      body,
      transport: 'curl',
      transportStatus: result.status,
      transportError: result.error?.message || null,
      stderr: result.stderr || ''
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function fetchTextWithNode(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: verifierHeaders,
      timeout: 15000
    }, (res) => {
      const location = res.headers.location;
      if (res.statusCode >= 300 && res.statusCode < 400 && location && redirects < 5) {
        res.resume();
        const next = new URL(location, url).toString();
        fetchTextWithNode(next, redirects + 1).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          url,
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          transport: 'node:https'
        });
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error(`timeout:${url}`));
    });
    req.on('error', reject);
  });
}

async function fetchText(url) {
  if (process.env.BRIK64_LIVE_VERIFY_TRANSPORT !== 'node') {
    try {
      const response = fetchTextWithCurl(url);
      if (response.transportError) throw new Error(response.transportError);
      return response;
    } catch (error) {
      if (process.env.BRIK64_LIVE_VERIFY_TRANSPORT === 'curl') throw error;
    }
  }
  return fetchTextWithNode(url);
}

function requireText(surface, body, needle, failures) {
  if (!body.includes(needle)) failures.push(`${surface}_missing:${needle}`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = readJson(manifestPath);
  const failures = [];
  const observations = [];
  const version = manifest.version;
  const pypiVersion = manifest.sdks.find((sdk) => sdk.marketplace === 'pypi')?.version;

  async function observe(id, url, checker) {
    try {
      const response = await fetchText(url);
      const record = {
        id,
        url,
        statusCode: response.statusCode,
        transport: response.transport,
        sha256: sha256(response.body),
        bytes: Buffer.byteLength(response.body, 'utf8')
      };
      if (response.statusCode < 200 || response.statusCode >= 300) {
        record.responseHeaders = {
          server: response.headers.server || null,
          'cf-ray': response.headers['cf-ray'] || null,
          'cf-cache-status': response.headers['cf-cache-status'] || null,
          'content-type': response.headers['content-type'] || null
        };
        record.bodyExcerpt = response.body.slice(0, 500);
      }
      observations.push(record);
      if (response.statusCode < 200 || response.statusCode >= 300) failures.push(`${id}_http_status:${response.statusCode}`);
      checker(response.body, response, record);
    } catch (error) {
      failures.push(`${id}_fetch_error:${error.message}`);
      observations.push({ id, url, error: error.message });
    }
  }

  await observe('curl_installer', manifest.publicSurfaces.curlInstaller.url, (body) => {
    requireText('curl_installer', body, version, failures);
    requireText('curl_installer', body, 'brik64', failures);
  });

  await observe('channel_manifest', manifest.publicSurfaces.channelManifest.url, (body) => {
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      failures.push('channel_manifest_invalid_json');
      return;
    }
    const channelVersion = parsed.currentVersion || parsed.version;
    if (channelVersion !== version) failures.push(`channel_manifest_version_drift:${channelVersion || 'missing'}`);
  });

  await observe('github_release', manifest.publicSurfaces.githubRelease.url, (body) => {
    requireText('github_release', body, `v${version}`, failures);
  });

  await observe('docs_install', manifest.publicSurfaces.docs.urls[0], (body) => {
    requireText('docs_install', body, version, failures);
    requireText('docs_install', body, manifest.cli.installCommand, failures);
  });

  await observe('web_home', manifest.publicSurfaces.web.urls[0], (body) => {
    requireText('web_home', body, 'Get the skill', failures);
    requireText('web_home', body, manifest.cli.installCommand, failures);
  });

  await observe('web_changelog', manifest.publicSurfaces.web.urls[1], (body) => {
    requireText('web_changelog', body, version, failures);
  });

  await observe('npm_sdk', 'https://registry.npmjs.org/@brik64%2Fcore', (body) => {
    const parsed = JSON.parse(body);
    if (!parsed.versions?.[version]) failures.push(`npm_sdk_version_missing:${version}`);
  });

  await observe('pypi_sdk', 'https://pypi.org/pypi/brik64/json', (body) => {
    const parsed = JSON.parse(body);
    if (!parsed.releases?.[pypiVersion]) failures.push(`pypi_sdk_version_missing:${pypiVersion}`);
  });

  await observe('crates_sdk', 'https://crates.io/api/v1/crates/brik64-core', (body) => {
    const parsed = JSON.parse(body);
    const versions = (parsed.versions || []).map((item) => item.num);
    if (!versions.includes(version)) failures.push(`crates_sdk_version_missing:${version}`);
  });

  await observe('public_skill', 'https://raw.githubusercontent.com/brik64/brik64-tools-skills/main/skills/brik64/SKILL.md', (body) => {
    requireText('public_skill', body, `version: ${version}`, failures);
    requireText('public_skill', body, 'Public CLI version', failures);
    if (/0\.1\.0-beta\.4|beta4|L4\+|L5\+|L6\+|N5|Hetzner|1Password/.test(body)) {
      failures.push('public_skill_private_or_stale_language');
    }
  });

  const report = {
    schemaVersion: 'brik64.release_train_live_verify_report.v1',
    releaseId: manifest.releaseId,
    version,
    manifestDigest: sha256(fs.readFileSync(manifestPath, 'utf8')),
    decision: failures.length === 0 ? 'PASS_RELEASE_TRAIN_LIVE_VERIFY' : 'FAIL_RELEASE_TRAIN_LIVE_VERIFY',
    publicationAllowed: false,
    boundary: 'Live verification only. This report observes public surfaces and does not mutate or publish.',
    observations,
    failures
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write('publicationAllowed=false\n');
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
