#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  parseFunctionalCliStageResult,
  validateFunctionalCliStageResult,
  RESULT_PREFIX,
} = require('./beta17-functional-cli-stage-result');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const transcriptPath = argValue(
  '--factory-transcript',
  path.join(root, 'evidence', 'beta17-functional-cli-stage-attempt', 'transcripts', 'factory-attempt.stdout.txt'),
);
const requestManifestPath = argValue(
  '--request-manifest',
  path.join(root, 'evidence', 'beta17-functional-cli-stage-request', 'request.manifest.json'),
);
const outDir = path.join(root, 'evidence', 'beta17-target-aware-factory-result-gate');
const reportPath = path.join(outDir, 'report.json');
const factoryResultPrefix = 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT\t';

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

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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

function parseFactoryResult(text) {
  const line = String(text || '').split(/\r?\n/).find((entry) => entry.startsWith(factoryResultPrefix));
  if (!line) return null;
  try {
    return JSON.parse(Buffer.from(line.slice(factoryResultPrefix.length), 'base64').toString('utf8'));
  } catch {
    return { parseError: true };
  }
}

function functionalLineFromTranscript(text, factoryResult) {
  const direct = String(text || '').split(/\r?\n/).find((entry) => entry.startsWith(RESULT_PREFIX));
  if (direct) return `${direct}\n`;
  if (typeof factoryResult?.targetResultLineBase64 === 'string') {
    try {
      return Buffer.from(factoryResult.targetResultLineBase64, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
  if (typeof factoryResult?.targetResultLine === 'string') return factoryResult.targetResultLine;
  return null;
}

function summarizeFactoryResult(factoryResult) {
  if (!factoryResult || factoryResult.parseError) return null;
  let artifactText = '';
  if (typeof factoryResult.artifactContentBase64 === 'string') {
    try {
      artifactText = Buffer.from(factoryResult.artifactContentBase64, 'base64').toString('utf8');
    } catch {
      artifactText = '';
    }
  }
  return {
    schemaVersion: factoryResult.schemaVersion || null,
    version: factoryResult.version || null,
    artifactKind: factoryResult.artifactKind || null,
    capability: factoryResult.capability || null,
    generatedArtifactBytes: factoryResult.generatedArtifactBytes || null,
    generatedArtifactSha256: factoryResult.generatedArtifactSha256 || null,
    hasTargetResultLine: Boolean(factoryResult.targetResultLine || factoryResult.targetResultLineBase64),
    artifactLooksLikeNodeCli: artifactText.includes('#!/usr/bin/env node') && artifactText.includes('process.argv'),
    artifactContainsFunctionalMarker: artifactText.includes(RESULT_PREFIX.trim()),
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const blockers = [];
  if (!fs.existsSync(transcriptPath)) blockers.push(`missing_factory_transcript:${rel(transcriptPath)}`);
  if (!fs.existsSync(requestManifestPath)) blockers.push(`missing_request_manifest:${rel(requestManifestPath)}`);
  const transcript = fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '';
  const factoryResult = parseFactoryResult(transcript);
  if (!factoryResult) blockers.push('factory_result_marker_missing');
  if (factoryResult?.parseError) blockers.push('factory_result_parse_failed');

  let validation = { accepted: false, blockers: ['functional_cli_stage_result_missing'] };
  const targetLine = functionalLineFromTranscript(transcript, factoryResult);
  const targetResult = targetLine ? parseFunctionalCliStageResult(targetLine) : null;
  if (!targetLine) {
    blockers.push('factory_result_missing_target_functional_cli_stage_result_line');
  } else if (!targetResult) {
    blockers.push('factory_target_functional_cli_stage_result_parse_failed');
  } else {
    validation = validateFunctionalCliStageResult(targetResult, loadExpected());
    if (!validation.accepted) blockers.push(...validation.blockers);
  }

  const summary = summarizeFactoryResult(factoryResult);
  if (summary && summary.artifactKind !== 'cli') blockers.push(`factory_artifact_kind_not_cli:${summary.artifactKind || 'missing'}`);
  if (summary && summary.hasTargetResultLine !== true) blockers.push('factory_result_not_target_aware');
  if (summary && summary.artifactLooksLikeNodeCli !== true) blockers.push('factory_artifact_not_functional_node_cli');

  const accepted = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_target_aware_factory_result_gate.v1',
    generatedAt: new Date().toISOString(),
    version: '0.1.0-beta.17',
    decision: accepted
      ? 'PASS_BETA17_TARGET_AWARE_FACTORY_RESULT_GATE'
      : 'BLOCKED_BETA17_TARGET_AWARE_FACTORY_RESULT_GATE',
    publicationAllowed: false,
    transcript: fs.existsSync(transcriptPath)
      ? { path: rel(transcriptPath), sha256: sha256File(transcriptPath), bytes: fs.statSync(transcriptPath).size }
      : { path: rel(transcriptPath), missing: true },
    requestManifest: fs.existsSync(requestManifestPath)
      ? { path: rel(requestManifestPath), sha256: sha256File(requestManifestPath), bytes: fs.statSync(requestManifestPath).size }
      : { path: rel(requestManifestPath), missing: true },
    factoryResult: summary,
    targetFunctionalCliStageResultObserved: Boolean(targetResult),
    validation,
    blockers,
    claimBoundary: closedClaimBoundary(),
    nextAction: accepted
      ? 'hydrate functional CLI stage result and rerun Beta17 package/readiness gates'
      : 'upgrade L6+N5 factory materializer to emit a target-aware BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT',
  };
  writeJson(reportPath, report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${rel(reportPath)}`);
  if (!accepted) for (const blocker of blockers) console.error(blocker);
  process.exit(accepted ? 0 : 2);
}

if (require.main === module) main();

module.exports = {
  parseFactoryResult,
  summarizeFactoryResult,
};
