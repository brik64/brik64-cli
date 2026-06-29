#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const {
  parseFunctionalCliStageResult,
  validateFunctionalCliStageResult,
} = require('./beta17-functional-cli-stage-result');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const evidenceDir = path.join(root, 'evidence', 'beta17-functional-cli-stage-attempt');
const resultEvidenceDir = path.join(root, 'evidence', 'beta17-functional-cli-stage-result');
const defaultRequestLinePath = path.join(root, 'evidence', 'beta17-functional-cli-stage-request', 'request.line');
const defaultRequestManifestPath = path.join(root, 'evidence', 'beta17-functional-cli-stage-request', 'request.manifest.json');
const defaultResultLinePath = path.join(resultEvidenceDir, 'result.line');
const requestLinePath = argValue('--request-line', defaultRequestLinePath);
const requestManifestPath = argValue('--request-manifest', defaultRequestManifestPath);
const suppliedResultLinePath = argValue('--result-line', process.env.BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT_LINE || '');
const resultLineText = argValue('--result-text', process.env.BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT || '');
const hydrateScript = path.join(root, 'scripts', 'beta17-functional-cli-stage-result-hydrate.js');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function rel(file) {
  return path.relative(root, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fileRef(file) {
  return {
    path: rel(file),
    sha256: sha256File(file),
    bytes: fs.statSync(file).size,
  };
}

function closedClaimBoundary() {
  return {
    publicReleaseAllowed: false,
    definitiveFixpointAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
    publicClaimsAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  };
}

function loadExpected() {
  const manifest = readJsonIfExists(requestManifestPath);
  if (!manifest) return {};
  return {
    pcdInputSetSha256: manifest.pcdInputSetSha256,
    functionalCliStageRequestSha256: manifest.requestLineSha256 || manifest.requestLine?.sha256,
    requiredInputPcdPaths: (manifest.inputPcds || []).map((item) => item.path),
  };
}

function readSuppliedResultLine() {
  if (resultLineText) return `${resultLineText.trim()}\n`;
  if (suppliedResultLinePath && fs.existsSync(suppliedResultLinePath)) {
    return fs.readFileSync(suppliedResultLinePath, 'utf8');
  }
  if (fs.existsSync(defaultResultLinePath)) return fs.readFileSync(defaultResultLinePath, 'utf8');
  return null;
}

function runHydration() {
  return childProcess.spawnSync(process.execPath, [
    hydrateScript,
    '--result-line',
    defaultResultLinePath,
    '--request-manifest',
    requestManifestPath,
  ], {
    cwd: root,
    env: { ...process.env, BRIK64_CLI_ROOT: root },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });
}

function main() {
  fs.rmSync(evidenceDir, { recursive: true, force: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  const blockers = [];
  const requestLineExists = fs.existsSync(requestLinePath);
  const requestManifestExists = fs.existsSync(requestManifestPath);
  if (!requestLineExists) blockers.push(`missing_functional_cli_stage_request_line:${rel(requestLinePath)}`);
  if (!requestManifestExists) blockers.push(`missing_functional_cli_stage_request_manifest:${rel(requestManifestPath)}`);

  const resultLine = readSuppliedResultLine();
  let result = null;
  let validation = { accepted: false, blockers: [] };
  let hydration = null;
  if (!resultLine) {
    blockers.push('functional_cli_stage_result_unavailable');
  } else {
    result = parseFunctionalCliStageResult(resultLine);
    if (!result) {
      blockers.push('functional_cli_stage_result_parse_failed');
    } else {
      validation = validateFunctionalCliStageResult(result, loadExpected());
      if (!validation.accepted) blockers.push(...validation.blockers);
    }
  }

  if (requestLineExists && requestManifestExists && validation.accepted && resultLine) {
    writeText(defaultResultLinePath, resultLine.endsWith('\n') ? resultLine : `${resultLine}\n`);
    const hydrate = runHydration();
    hydration = {
      status: hydrate.status === null ? 1 : hydrate.status,
      stdout_sha256: sha256(hydrate.stdout || ''),
      stderr_sha256: sha256(hydrate.stderr || ''),
      stdout: (hydrate.stdout || '').slice(0, 1000),
      stderr: (hydrate.stderr || '').slice(0, 1000),
    };
    if (hydration.status !== 0) blockers.push(`functional_cli_stage_hydration_failed:${hydration.status}`);
  }

  const accepted = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_functional_cli_stage_attempt.v1',
    generatedAt: new Date().toISOString(),
    version: '0.1.0-beta.17',
    decision: accepted
      ? 'PASS_BETA17_FUNCTIONAL_CLI_STAGE_ATTEMPT'
      : 'BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_ATTEMPT',
    hydrated: accepted,
    publicationAllowed: false,
    claimBoundary: closedClaimBoundary(),
    request: requestLineExists
      ? {
          requestLine: fileRef(requestLinePath),
          requestManifest: requestManifestExists ? fileRef(requestManifestPath) : null,
        }
      : null,
    result: resultLine
      ? {
          source: suppliedResultLinePath || (fs.existsSync(defaultResultLinePath) ? rel(defaultResultLinePath) : 'inline'),
          sha256: sha256(resultLine),
          parsed: Boolean(result),
          validation,
        }
      : null,
    hydration,
    blockers: [...new Set(blockers)],
    nextAction: accepted
      ? 'run package:beta17:fixpoint:candidate, gate:beta17:fixpoint:functional-stage-artifact and preflight:beta17:fixpoint:publication'
      : 'obtain a valid BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT from L6+N5 and rerun attempt:beta17:functional-cli-stage',
  };
  writeJson(path.join(evidenceDir, 'report.json'), report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${rel(path.join(evidenceDir, 'report.json'))}`);
  if (!accepted) for (const blocker of report.blockers) console.error(blocker);
  process.exit(accepted ? 0 : 2);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`beta17_functional_cli_stage_attempt_fail_closed:${error.message}`);
    process.exit(2);
  }
}

module.exports = {
  loadExpected,
  closedClaimBoundary,
};
