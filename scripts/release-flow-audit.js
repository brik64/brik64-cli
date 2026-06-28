#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'release', 'manifest.json');
const packageJsonPath = path.join(root, 'package.json');
const workflowPath = path.join(root, '.github', 'workflows', 'release-train-publish.yml');
const outDir = path.join(root, 'evidence', 'release-flow-audit');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function gitStatus(args) {
  return childProcess.spawnSync('git', args, { cwd: root, encoding: 'utf8' }).status;
}

function section(text, marker) {
  const start = text.indexOf(marker);
  if (start === -1) return '';
  const rest = text.slice(start);
  const next = rest.indexOf('\n## ', marker.length);
  return next === -1 ? rest : rest.slice(0, next);
}

function betaNumber(version) {
  const match = String(version).match(/^0\.1\.0-beta\.(\d+)(?:\.\d+)*$/);
  return match ? match[1] : null;
}

function betaLabel(version) {
  const match = String(version).match(/^0\.1\.0-beta\.(\d+)(?:\.(\d+))?(?:\.\d+)*$/);
  if (!match) return null;
  return match[2] ? `beta${match[1]}_${match[2]}` : `beta${match[1]}`;
}

function add(condition, failures, code) {
  if (!condition) failures.push(code);
}

function pypiVersion(version) {
  const match = String(version).match(/^(\d+\.\d+\.\d+)-beta\.(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) return version;
  const [, base, beta, post, patch] = match;
  if (!post) return `${base}b${beta}`;
  if (!patch) return `${base}b${beta}.post${post}`;
  return `${base}b${beta}.post${post}${String(patch).padStart(2, '0')}`;
}

function textContainsAll(text, needles, failures, prefix) {
  for (const needle of needles) {
    if (!text.includes(needle)) failures.push(`${prefix}_missing:${needle}`);
  }
}

function forbiddenPublicPatterns() {
  return [
    /\bL[456]\+?N5\b/i,
    /\bN5\b/i,
    /\bfixpoint\b/i,
    /\bself[- ]hosting\b/i,
    /\bHetzner\b/i,
    /\b1Password\b/i,
    /\bmethodology\b/i,
    /\brelease train\b/i,
    /\bCI\/CD\b/i,
    /\bpreflight\b/i,
    /\bapproval\b/i,
    /\bauthorization\b/i,
    /\bclaim boundary scan\b/i,
    /\brunner[- ]pending\b/i
  ];
}

function forbiddenHits(text) {
  return forbiddenPublicPatterns()
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.toString());
}

function requiredBetaScripts(label) {
  if (label === 'beta14_1') {
    return [
      'gate:beta14:functional',
      'gate:beta14:source-lift',
      'gate:beta14.1:audit-closure',
      'package:beta14:local',
      'smoke:beta14:package'
    ];
  }
  if (label === 'beta11') {
    return [
      'gate:beta11:semantic-polymerize',
      'gate:beta11:rust-emitter-clean',
      'gate:beta11:doctor-empty-workspace',
      'gate:beta11:adversarial',
      'attempt:beta11:l6-materialization',
      'gate:beta11:l6-materialization'
    ];
  }
  if (label === 'beta15_7') {
    return [
      'gate:cli:l6-generation-required',
      'gate:beta15.7:full-release-audit',
      'package:beta15.7:local',
      'smoke:beta15.7:package'
    ];
  }
  if (label === 'beta16_1') {
    return [
      'gate:cli:l6-generation-required',
      'gate:beta16.1:full-release-audit',
      'package:beta16.1:local',
      'smoke:beta16.1:package'
    ];
  }
  return [
    `gate:${label}:feature-parity`,
    `package:${label}:local`,
    `smoke:${label}:package`,
    `gate:${label}:sdk-sync`,
    `gate:${label}:marketplace-packages`,
    `gate:${label}:docs-web-sync`,
    `gate:${label}:skills-sync`
  ];
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const failures = [];
  const warnings = [];
  const observations = [];

  const manifestText = readText(manifestPath);
  const manifest = JSON.parse(manifestText);
  const manifestDigest = sha256(manifestText);
  const packageJson = readJson(packageJsonPath);
  const workflow = readText(workflowPath);
  const publishPlan = readText(path.join(root, 'scripts', 'release-train-publish-plan.js'));
  const publishExecute = readText(path.join(root, 'scripts', 'release-train-publish-execute.js'));
  const dryRun = readText(path.join(root, 'scripts', 'release-train-dry-run.js'));
  const liveVerify = readText(path.join(root, 'scripts', 'release-train-live-verify.js'));
  const syncSurfaces = readText(path.join(root, 'scripts', 'release-train-sync-surfaces.js'));
  const readme = readText(path.join(root, 'README.md'));
  const changelog = readText(path.join(root, 'CHANGELOG.md'));

  const currentBeta = betaNumber(manifest.version);
  const label = betaLabel(manifest.version);
  const changelogSection = section(changelog, `## ${manifest.version}`);

  add(manifest.schemaVersion === 'brik64.release_manifest.v1', failures, 'manifest_schema_invalid');
  add(packageJson.version === manifest.version, failures, `package_version_drift:${packageJson.version}`);
  add(manifest.releaseId === `brik64-${manifest.version}`, failures, 'release_id_version_drift');
  add(manifest.channel === 'beta', failures, `channel_not_beta:${manifest.channel}`);
  add(['draft', 'dry_run_passed', 'publishing', 'public', 'failed', 'superseded'].includes(manifest.state), failures, `manifest_state_invalid:${manifest.state}`);
  add(Boolean(label), failures, `unsupported_release_version:${manifest.version}`);

  if (manifest.source?.commit) {
    const isAncestor = gitStatus(['merge-base', '--is-ancestor', manifest.source.commit, 'HEAD']) === 0;
    add(isAncestor, failures, `manifest_source_commit_not_ancestor:${manifest.source.commit}`);
  } else {
    failures.push('manifest_source_commit_missing');
  }

  if (label) {
    const scripts = packageJson.scripts || {};
    const packageScriptLabel = label === 'beta14_1' ? 'beta14' : label;
    for (const scriptName of requiredBetaScripts(label)) {
      add(Boolean(scripts[scriptName]), failures, `current_beta_script_missing:${scriptName}`);
    }
    add(
      fs.existsSync(path.join(root, 'scripts', `build-${packageScriptLabel}-package.js`))
        || fs.existsSync(path.join(root, 'scripts', `build-${packageScriptLabel}-package.sh`)),
      failures,
      `current_beta_package_builder_missing:${packageScriptLabel}`
    );
    add(
      fs.existsSync(path.join(root, 'scripts', `${packageScriptLabel}-package-smoke.js`))
        || fs.existsSync(path.join(root, 'scripts', `${packageScriptLabel}-package-smoke.sh`)),
      failures,
      `current_beta_package_smoke_missing:${packageScriptLabel}`
    );
    add(fs.existsSync(path.join(root, 'evidence', `${label}-package`, 'package.manifest.json')), failures, `current_beta_package_manifest_missing:${label}`);
  }

  const requiredSurfaces = [
    'githubRelease',
    'curlInstaller',
    'channelManifest',
    'web',
    'docs',
    'skills'
  ];
  for (const surface of requiredSurfaces) {
    add(manifest.publicSurfaces?.[surface]?.required === true, failures, `required_public_surface_missing:${surface}`);
  }

  const requiredMarketplaces = new Map([
    ['npm', manifest.version],
    ['pypi', pypiVersion(manifest.version)],
    ['crates.io', manifest.version]
  ]);
  for (const [marketplace, expectedVersion] of requiredMarketplaces.entries()) {
    const sdk = (manifest.sdks || []).find((item) => item.marketplace === marketplace);
    add(Boolean(sdk), failures, `sdk_surface_missing:${marketplace}`);
    if (sdk) {
      add(sdk.required === true, failures, `sdk_surface_not_required:${marketplace}`);
      add(sdk.version === expectedVersion, failures, `sdk_version_drift:${marketplace}:${sdk.version}`);
    }
  }

  const releaseNoteText = (manifest.releaseNotes || []).map((note) => note.text || '').join('\n');
  const releaseNoteForbidden = forbiddenHits(releaseNoteText);
  if (releaseNoteForbidden.length > 0) failures.push(`manifest_release_notes_internal_language:${releaseNoteForbidden.join('|')}`);
  add((manifest.releaseNotes || []).length > 0, failures, 'manifest_release_notes_missing');

  add(changelogSection.length > 0, failures, 'changelog_section_missing');
  const changelogForbidden = forbiddenHits(changelogSection);
  if (changelogForbidden.length > 0) failures.push(`changelog_internal_language:${changelogForbidden.join('|')}`);
  if (manifest.state === 'public') {
    add(readme.includes(`Current public beta: \`${manifest.version}\``), failures, 'readme_public_version_drift');
  } else {
    add(readme.includes(`Current beta candidate: \`${manifest.version}\``), failures, 'readme_candidate_version_drift');
  }

  textContainsAll(publishPlan, [
    'github_release',
    'sdk_npm',
    'sdk_pypi',
    'sdk_crates',
    'gcp_curl',
    'web_static_surface',
    'web_pages_deploy',
    'docs_dispatch',
    'skills_dispatch',
    'post_publish_live_verify'
  ], failures, 'publish_plan_command');

  textContainsAll(publishExecute, [
    'manifest_digest_input_drift',
    'plan_manifest_digest_drift',
    'worktree_dirty',
    'post_publish_command_failed',
    'PASS_RELEASE_TRAIN_PUBLISH_EXECUTE'
  ], failures, 'publish_execute_guard');

  textContainsAll(dryRun, [
    'release-manifest-validate',
    'release-train-sync-surfaces',
    'release-train-publish-plan',
    'release-train-publish-execute'
  ], failures, 'dry_run_guard');

  textContainsAll(liveVerify, [
    'curl_installer',
    'channel_manifest',
    'github_release',
    'docs_install',
    'web_home',
    'web_changelog',
    'npm_sdk',
    'pypi_sdk',
    'crates_sdk',
    'public_skill'
  ], failures, 'live_verify_surface');

  textContainsAll(syncSurfaces, [
    'changelogMarkdown',
    'releaseNotes',
    'manifestDigest',
    'PASS_RELEASE_TRAIN_SYNC_SURFACES'
  ], failures, 'sync_surface_payload');

  textContainsAll(workflow, [
    'manifest_digest',
    'execute_publication',
    'Validate release train pre-publication',
    'Generate sync payload',
    'Prepare SDK publication workspaces',
    'Authenticate to Google Cloud',
    'Generate publication plan',
    'Execute publication train',
    'Upload publication planning evidence'
  ], failures, 'workflow_step');

  add(!workflow.includes('npm publish') || workflow.includes('release:train:publish-execute'), failures, 'workflow_direct_npm_publish_outside_executor');
  add(!workflow.includes('twine upload') || workflow.includes('release:train:publish-execute'), failures, 'workflow_direct_pypi_publish_outside_executor');
  add(!workflow.includes('cargo publish') || workflow.includes('release:train:publish-execute'), failures, 'workflow_direct_crates_publish_outside_executor');

  observations.push({
    releaseId: manifest.releaseId,
    version: manifest.version,
    state: manifest.state,
    manifestDigest,
    currentBetaLabel: label,
    requiredSurfaces,
    requiredMarketplaces: Object.fromEntries(requiredMarketplaces),
    boundary: 'Carril A release-flow audit only. Does not mutate public surfaces and does not assert L6+N5 fixpoint.'
  });

  const report = {
    schemaVersion: 'brik64.release_flow_audit_report.v1',
    releaseId: manifest.releaseId,
    version: manifest.version,
    manifestDigest,
    decision: failures.length === 0 ? 'PASS_RELEASE_FLOW_AUDIT' : 'FAIL_RELEASE_FLOW_AUDIT',
    publicationAllowed: false,
    boundary: 'Static and local release-flow hardening audit. It verifies publication gates, public-surface coverage, and changelog hygiene without publishing.',
    observations,
    failures,
    warnings
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write('publicationAllowed=false\n');
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (warnings.length > 0) process.stdout.write(`warnings=${warnings.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
