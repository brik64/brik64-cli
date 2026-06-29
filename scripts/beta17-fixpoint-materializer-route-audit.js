#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildRequest, validateRequest, safeRelativePath } = require('./beta17-fixpoint-stage-request-bundle');
const { parseStageResult, validateStageResult } = require('./beta17-fixpoint-stage-result');
const { validateProvenanceWithWorkspaceFiles, REQUIRED_RESULT_MARKER } = require('./beta17-fixpoint-materializer-provenance');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = '0.1.0-beta.17';
const defaultOutPath = path.join(root, 'evidence', 'beta17-fixpoint-materializer-route-audit', 'report.json');
const defaultRemoteAttemptPath = path.join(root, 'evidence', 'beta17-fixpoint-remote-attempt', 'report.json');
const defaultProvenancePath = path.join(root, 'evidence', 'beta17-fixpoint-remote-dispatcher', 'materializer-provenance.json');
const requiredCapability = 'beta17_fixpoint_stage_dispatcher';
const legacyMaterializers = [
  'scripts/remote_l6_beta15_7_cli_materializer.js',
  'scripts/remote_l6_beta16_1_cli_materializer.js',
];
const fixtureMaterializer = 'scripts/beta17-fixpoint-stage-fixture-materializer.js';

function argValue(name, fallback = null) {
  const index = process.argv.lastIndexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function resolveRootPath(value) {
  if (path.isAbsolute(value)) return value;
  return path.resolve(root, value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function workspacePath(relativePath, label, blockers) {
  if (!safeRelativePath(relativePath)) {
    blockers.push(`${label}_path_invalid:${relativePath || 'missing'}`);
    return null;
  }
  const absolute = path.resolve(root, relativePath);
  const workspace = path.resolve(root);
  if (!(absolute === workspace || absolute.startsWith(`${workspace}${path.sep}`))) {
    blockers.push(`${label}_path_outside_workspace:${relativePath}`);
    return null;
  }
  return absolute;
}

function readJsonIfPresent(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function requestLineSha256(request) {
  return sha256(`BRIK64_BETA17_FIXPOINT_STAGE_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`);
}

function fileRef(relativePath, label) {
  const blockers = [];
  const absolute = workspacePath(relativePath, label, blockers);
  if (blockers.length || !absolute || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return { path: relativePath, exists: false, blockers };
  }
  return {
    path: relativePath,
    exists: true,
    sha256: sha256File(absolute),
    bytes: fs.statSync(absolute).size,
  };
}

function inspectMaterializer(relativePath, label = 'materializer') {
  const blockers = [];
  const absolute = workspacePath(relativePath, label, blockers);
  if (!absolute) return { id: label, path: relativePath, eligible: false, blockers };
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    blockers.push(`${label}_file_missing:${relativePath}`);
    return { id: label, path: relativePath, eligible: false, blockers };
  }
  const content = fs.readFileSync(absolute, 'utf8');
  if (!content.includes(REQUIRED_RESULT_MARKER)) blockers.push(`${label}_missing_beta17_result_marker`);
  if (content.includes('<base64-json>')) blockers.push(`${label}_placeholder_result_marker`);
  if (/fixtureMaterializer|FIXTURE_MATERIALIZER|TEMPLATE_NON_CLAIM/i.test(content)) {
    blockers.push(`${label}_fixture_or_template_content`);
  }
  if (content.includes('BRIK64_L6_CLI_MATERIALIZATION_RESULT') && !content.includes(REQUIRED_RESULT_MARKER)) {
    blockers.push(`${label}_legacy_cli_materialization_marker`);
  }
  return {
    id: label,
    path: relativePath,
    eligible: blockers.length === 0,
    ref: {
      path: relativePath,
      sha256: sha256File(absolute),
      bytes: fs.statSync(absolute).size,
    },
    blockers,
  };
}

function inspectProvenance(provenancePath) {
  const blockers = [];
  const absolute = workspacePath(provenancePath, 'provenance', blockers);
  if (!absolute) return { path: provenancePath, accepted: false, blockers };
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return { path: provenancePath, accepted: false, blockers: [`provenance_file_missing:${provenancePath}`] };
  }
  let provenance = null;
  try {
    provenance = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch {
    return { path: provenancePath, accepted: false, blockers: [`provenance_json_parse_failed:${provenancePath}`] };
  }
  const validation = validateProvenanceWithWorkspaceFiles(provenance);
  return {
    path: provenancePath,
    accepted: validation.accepted,
    materializerRef: provenance.materializerRef || null,
    pcdInputSetSha256: provenance.pcdInputSetSha256 || null,
    blockers: validation.blockers,
  };
}

function inspectRemoteAttempt(relativePath) {
  const blockers = [];
  const absolute = workspacePath(relativePath, 'remote_attempt', blockers);
  if (!absolute) return { path: relativePath, accepted: false, capabilities: [], blockers };
  const report = readJsonIfPresent(absolute);
  if (!report) {
    return { path: relativePath, accepted: false, capabilities: [], blockers: [`remote_attempt_report_missing:${relativePath}`] };
  }
  const capabilities = report.remote?.endpointCapabilities || [];
  const accepted = report.decision === 'PASS_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT';
  if (!capabilities.includes(requiredCapability)) {
    blockers.push(`remote_endpoint_capability_missing:${capabilities.join(',') || 'none'}`);
  }
  if (!accepted) blockers.push(`remote_attempt_not_pass:${report.decision || 'missing'}`);
  return {
    path: relativePath,
    accepted,
    capabilities,
    decision: report.decision || null,
    blockers: [...blockers, ...(report.blockers || []).map((item) => `remote_attempt_blocker:${item}`)],
  };
}

function inspectStageResult(stageOutputPath, request) {
  if (!stageOutputPath) {
    return { path: null, accepted: false, blockers: ['stage_result_output_missing'] };
  }
  const blockers = [];
  const absolute = workspacePath(stageOutputPath, 'stage_result_output', blockers);
  if (!absolute) return { path: stageOutputPath, accepted: false, blockers };
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return { path: stageOutputPath, accepted: false, blockers: [`stage_result_output_file_missing:${stageOutputPath}`] };
  }
  const content = fs.readFileSync(absolute, 'utf8');
  const result = parseStageResult(content);
  if (!result) return { path: stageOutputPath, accepted: false, blockers: ['stage_result_parse_failed'] };
  const validation = validateStageResult(result, {
    workspaceRoot: root,
    pcdInputSetSha256: request.pcdInputSetSha256,
    materializerRequestSha256: requestLineSha256(request),
    requiredInputPcdPaths: request.requiredInputPcdPaths,
  });
  const resultBlockers = [...validation.blockers];
  if (result.fixtureMaterializer === true) resultBlockers.push('stage_result_fixture_materializer');
  if (result.l6plusEngineSerial === 'BRIK64-L6PLUS-N5-FIXTURE-NONCLAIM') {
    resultBlockers.push('stage_result_fixture_l6_serial');
  }
  return {
    path: stageOutputPath,
    accepted: resultBlockers.length === 0,
    decision: result.decision || null,
    stage1ArtifactSha256: result.stage1ArtifactSha256 || null,
    stage2ArtifactSha256: result.stage2ArtifactSha256 || null,
    blockers: resultBlockers,
  };
}

function buildReport() {
  const outPath = resolveRootPath(argValue('--out', defaultOutPath));
  const materializerPath = argValue('--materializer');
  const provenancePath = argValue('--provenance', path.relative(root, defaultProvenancePath));
  const remoteAttemptPath = argValue('--remote-attempt', path.relative(root, defaultRemoteAttemptPath));
  const stageOutputPath = argValue('--stage-output');
  const blockers = [];

  let request = null;
  let requestValidation = null;
  try {
    request = buildRequest();
    requestValidation = validateRequest(request);
    if (!requestValidation.accepted) blockers.push(...requestValidation.blockers.map((item) => `stage_request_${item}`));
  } catch (error) {
    blockers.push(`stage_request_build_failed:${error.message}`);
  }

  const candidateRoutes = [];
  const fixture = fileRef(fixtureMaterializer, 'fixture_materializer');
  candidateRoutes.push({
    id: 'beta17_fixture_materializer',
    classification: 'rejected_fixture_non_claim',
    ref: fixture.exists ? fixture : null,
    blockers: fixture.exists ? inspectMaterializer(fixtureMaterializer, 'fixture_materializer').blockers : fixture.blockers,
  });

  for (const legacyPath of legacyMaterializers) {
    const legacy = fileRef(legacyPath, 'legacy_materializer');
    candidateRoutes.push({
      id: path.basename(legacyPath, '.js'),
      classification: 'rejected_legacy_cli_materializer',
      ref: legacy.exists ? legacy : null,
      blockers: legacy.exists
        ? [`legacy_materializer_not_beta17_fixpoint_stage:${legacyPath}`]
        : legacy.blockers,
    });
  }

  const materializer = materializerPath
    ? inspectMaterializer(materializerPath, 'generated_materializer')
    : { path: null, eligible: false, blockers: ['generated_materializer_argument_missing'] };
  candidateRoutes.push({
    id: 'generated_materializer',
    classification: materializer.eligible ? 'candidate_local_materializer' : 'blocked_local_materializer',
    ref: materializer.ref || null,
    blockers: materializer.blockers,
  });

  const provenance = inspectProvenance(provenancePath);
  candidateRoutes.push({
    id: 'materializer_provenance',
    classification: provenance.accepted ? 'candidate_provenance' : 'blocked_provenance',
    ref: provenance.accepted
      ? { path: provenance.path, sha256: sha256File(path.resolve(root, provenance.path)), bytes: fs.statSync(path.resolve(root, provenance.path)).size }
      : null,
    blockers: provenance.blockers,
  });

  const remoteAttempt = inspectRemoteAttempt(remoteAttemptPath);
  candidateRoutes.push({
    id: 'remote_l6_endpoint',
    classification: remoteAttempt.accepted ? 'candidate_remote_stage_endpoint' : 'blocked_remote_stage_endpoint',
    capabilities: remoteAttempt.capabilities,
    blockers: remoteAttempt.blockers,
  });

  const stageResult = request
    ? inspectStageResult(stageOutputPath, request)
    : { path: stageOutputPath || null, accepted: false, blockers: ['stage_request_unavailable'] };
  candidateRoutes.push({
    id: 'stage_result',
    classification: stageResult.accepted ? 'accepted_stage_result' : 'blocked_stage_result',
    ref: stageResult.path ? fileRef(stageResult.path, 'stage_result_output') : null,
    blockers: stageResult.blockers,
  });

  const routeReady = stageResult.accepted || (materializer.eligible && provenance.accepted && remoteAttempt.accepted);
  blockers.push(...materializer.blockers.map((item) => `generated_materializer:${item}`));
  blockers.push(...stageResult.blockers.map((item) => `stage_result:${item}`));
  if (!stageResult.accepted) {
    blockers.push(...provenance.blockers.map((item) => `provenance:${item}`));
    blockers.push(...remoteAttempt.blockers.map((item) => `remote:${item}`));
  }
  if (!routeReady) blockers.push('no_beta17_fixpoint_materializer_route_ready');

  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.materializer_route_audit.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: routeReady && blockers.length === 0
      ? 'PASS_BETA17_FIXPOINT_MATERIALIZER_ROUTE_AUDIT'
      : 'BLOCKED_BETA17_FIXPOINT_MATERIALIZER_ROUTE_AUDIT',
    publicationAllowed: false,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    requiredCapability,
    stageRequest: request && requestValidation
      ? {
          accepted: requestValidation.accepted,
          pcdInputSetSha256: request.pcdInputSetSha256,
          materializerRequestSha256: requestLineSha256(request),
          inputPcdCount: request.inputPcds.length,
        }
      : null,
    candidateRoutes,
    blockers: [...new Set(blockers)],
    nextAction: routeReady && blockers.length === 0
      ? 'run remote stage attempt and fixpoint readiness gates with this route evidence'
      : 'generate a non-fixture Beta17 materializer from PCD/polymer via L6+N5, install the dispatcher, then rerun this audit',
  };
  writeJson(outPath, report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${path.relative(root, outPath)}`);
  for (const blocker of report.blockers) console.error(blocker);
  return report;
}

if (require.main === module) {
  try {
    const report = buildReport();
    process.exit(report.decision === 'PASS_BETA17_FIXPOINT_MATERIALIZER_ROUTE_AUDIT' ? 0 : 2);
  } catch (error) {
    console.error(`beta17_materializer_route_audit_fail_closed:${error.message}`);
    process.exit(2);
  }
}

module.exports = {
  buildReport,
  inspectMaterializer,
  inspectStageResult,
};
