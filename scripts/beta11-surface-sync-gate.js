#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.11';
const pyVersion = '0.1.0b11';
const outDir = path.join(root, 'evidence', 'beta11-surface-sync');
const reportPath = path.join(outDir, 'report.json');
const webRoot = process.env.BRIK64_WEB_ROOT || '/Users/carlosjperez/Documents/GitHub/brik64.com';
const docsRoot = process.env.BRIK64_DOCS_ROOT || '/Users/carlosjperez/Documents/GitHub/brik64-docs-site';
const skillsRoot = process.env.BRIK64_SKILLS_ROOT || '/Users/carlosjperez/Documents/GitHub/brik64-tools-skills';

const surfaces = [
  {
    id: 'cli_readme',
    root,
    file: 'README.md',
    required: [
      `Current public beta: \`${version}\``,
      `npm install @brik64/core@${version}`,
      `pip install brik64==${pyVersion}`,
      `cargo add brik64-core@${version}`
    ]
  },
  {
    id: 'cli_changelog',
    root,
    file: 'CHANGELOG.md',
    required: [`## ${version}`, 'polymerize'],
    allowHistoricalVersions: true
  },
  {
    id: 'web_sdk_download_api',
    root: webRoot,
    file: 'functions/api/download/sdk/[target].ts',
    required: [version, pyVersion, `@brik64/core/v/${version}`, `brik64/${pyVersion}`, `brik64-core/${version}`]
  },
  {
    id: 'web_cli_download_api',
    root: webRoot,
    file: 'functions/api/download/cli.ts',
    required: [version]
  },
  {
    id: 'web_cli_page',
    root: webRoot,
    file: 'src/app/cli/page.tsx',
    required: [version]
  },
  {
    id: 'web_download_page',
    root: webRoot,
    file: 'src/app/download/page.tsx',
    required: [version, `gh release view v${version}`]
  },
  {
    id: 'web_changelog_page',
    root: webRoot,
    file: 'src/app/changelog/page.tsx',
    required: [version],
    allowHistoricalVersions: true
  },
  {
    id: 'web_sdks_page',
    root: webRoot,
    file: 'src/app/sdks/page.tsx',
    required: [`@brik64/core@${version}`, `brik64==${pyVersion}`, `brik64-core --version ${version}`]
  },
  {
    id: 'web_beta_channel',
    root: webRoot,
    file: 'public/cli/beta.json',
    required: [version, `/cli/releases/${version}.json`]
  },
  {
    id: 'web_installer',
    root: webRoot,
    file: 'public/cli/install.sh',
    required: [version, 'CHECKSUMS_URL=', 'missing checksum for $ASSET_NAME in SHA256SUMS']
  },
  {
    id: 'web_deploy_runbook',
    root: webRoot,
    file: 'docs/operations/CLOUDFLARE_PAGES_DEPLOY_AUTH_RUNBOOK.md',
    required: [version, `cli/releases/${version}.json`]
  },
  {
    id: 'web_language_data',
    root: webRoot,
    file: 'src/lib/language-data.ts',
    required: [
      `npm install @brik64/core@${version}`,
      `pip install brik64==${pyVersion}`,
      `cargo add brik64-core --version ${version}`
    ]
  },
  {
    id: 'docs_sdks',
    root: docsRoot,
    file: 'sdks.mdx',
    required: [`@brik64/core@${version}`, `brik64==${pyVersion}`, `brik64-core@${version}`]
  },
  {
    id: 'docs_quickstart',
    root: docsRoot,
    file: 'quickstart.mdx',
    required: [version]
  },
  {
    id: 'docs_releases',
    root: docsRoot,
    file: 'releases.mdx',
    required: [version, `cli/releases/${version}.json`]
  },
  {
    id: 'docs_current_availability',
    root: docsRoot,
    file: 'current-availability.mdx',
    required: [version]
  },
  {
    id: 'docs_cli',
    root: docsRoot,
    file: 'cli.mdx',
    required: [version]
  },
  {
    id: 'docs_cli_install',
    root: docsRoot,
    file: 'cli/install.mdx',
    required: [version, `v${version}`]
  },
  {
    id: 'docs_changelog',
    root: docsRoot,
    file: 'releases/changelog.mdx',
    required: [version, `v${version}`]
  },
  {
    id: 'docs_js_sdk',
    root: docsRoot,
    file: 'sdks/javascript.mdx',
    required: [`npm install @brik64/core@${version}`]
  },
  {
    id: 'docs_python_sdk',
    root: docsRoot,
    file: 'sdks/python.mdx',
    required: [`pip install brik64==${pyVersion}`]
  },
  {
    id: 'docs_rust_sdk',
    root: docsRoot,
    file: 'sdks/rust.mdx',
    required: [`cargo add brik64-core --version ${version}`]
  },
  {
    id: 'skills_readme',
    root: skillsRoot,
    file: 'README.md',
    required: [`@brik64/core@${version}`]
  },
  {
    id: 'skill_brik64',
    root: skillsRoot,
    file: 'skills/brik64/SKILL.md',
    required: [
      `beta surface is \`${version}\``,
      `Public CLI version: \`${version}\``,
      `@brik64/core@${version}`,
      `brik64==${pyVersion}`,
      `brik64-core@${version}`
    ]
  },
  {
    id: 'skill_javascript',
    root: skillsRoot,
    file: 'skills/brik64-javascript/SKILL.md',
    required: [`npm install @brik64/core@${version}`]
  },
  {
    id: 'skill_python',
    root: skillsRoot,
    file: 'skills/brik64-python/SKILL.md',
    required: [`pip install brik64==${pyVersion}`]
  },
  {
    id: 'skill_rust',
    root: skillsRoot,
    file: 'skills/brik64-rust/SKILL.md',
    required: [`brik64-core = "${version}"`]
  },
  {
    id: 'skill_pcd_system',
    root: skillsRoot,
    file: 'skills/pcd-system/SKILL.md',
    required: [`version: ${version}-public-reference`, `Current public CLI version: \`${version}\``]
  }
];

const stalePatterns = [
  /0\.1\.0-beta\.(?:[0-9]|10)(?!\d)/,
  /0\.1\.0b(?:[0-9]|10)(?!\d)/,
  /\bbeta(?:[0-9]|10)\b/i
];

const privatePatterns = [
  /\bL[456]\+?N5\b/i,
  /\bfixpoint\b/i,
  /\bself[- ]hosting\b/i,
  /\bHetzner\b/i,
  /\b1Password\b/i,
];

const wrongVersionChecksumPatterns = [
  /SHA256_0_1_0_BETA_(?:[0-9]|10)(?!\d)/,
  /b7794371859e0267923db7f4c0b5404cc29040376d23b5cd9d02dd344afa88ea/
];

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function gitState(repoRoot) {
  const status = childProcess.spawnSync('git', ['status', '--short', '--branch'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  const head = childProcess.spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  return {
    root: repoRoot,
    ok: status.status === 0 && head.status === 0,
    head: (head.stdout || '').trim(),
    status: (status.stdout || '').trim().split('\n').filter(Boolean)
  };
}

function checkSurface(surface) {
  const file = path.join(surface.root, surface.file);
  if (!fs.existsSync(file)) {
    return { ...surface, exists: false, passed: false, failures: [`missing:${surface.file}`] };
  }
  const text = fs.readFileSync(file, 'utf8');
  const failures = [];
  for (const needle of surface.required) {
    if (!text.includes(needle)) failures.push(`missing_required:${needle}`);
  }
  if (!surface.allowHistoricalVersions) {
    for (const pattern of stalePatterns) {
      if (pattern.test(text)) failures.push(`stale_version:${pattern}`);
    }
  }
  for (const pattern of privatePatterns) {
    if (pattern.test(text)) failures.push(`private_or_claim_language:${pattern}`);
  }
  for (const pattern of wrongVersionChecksumPatterns) {
    if (pattern.test(text)) failures.push(`wrong_version_checksum:${pattern}`);
  }
  return {
    id: surface.id,
    path: path.relative(surface.root, file),
    root: surface.root,
    exists: true,
    passed: failures.length === 0,
    failures,
    sha256: sha256Text(text),
    bytes: Buffer.byteLength(text, 'utf8')
  };
}

const reports = surfaces.map(checkSurface);
const repoStates = [root, webRoot, docsRoot, skillsRoot].map(gitState);
const blockers = reports.flatMap((surface) => surface.failures.map((failure) => `${surface.id}:${failure}`));
for (const state of repoStates) {
  if (!state.ok) blockers.push(`repo_state_unreadable:${state.root}`);
}

const report = {
  schemaVersion: 'brik64.beta11_surface_sync_gate.v1',
  generatedAt: new Date().toISOString(),
  version,
  pythonVersion: pyVersion,
  decision: blockers.length === 0 ? 'PASS_BETA11_SURFACE_SYNC' : 'BLOCKED_BETA11_SURFACE_SYNC',
  releaseEligible: blockers.length === 0,
  blockers,
  surfaces: reports,
  repos: repoStates,
  claimBoundary: {
    publicClaimsAllowed: false,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false
  }
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(blockers.length === 0 ? 0 : 2);
