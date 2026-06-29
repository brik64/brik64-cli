#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateRequest } = require('./beta17-fixpoint-stage-request-bundle');
const { validateStageResult } = require('./beta17-fixpoint-stage-result');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');

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

function safeRelativePath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.includes('\0') &&
    !/^https?:\/\//i.test(value) &&
    !value.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function resolveOutput(ref) {
  if (!safeRelativePath(ref)) throw new Error(`unsafe_output_ref:${ref || 'missing'}`);
  const target = path.resolve(root, ref);
  const resolvedRoot = path.resolve(root);
  if (!(target === resolvedRoot || target.startsWith(`${resolvedRoot}${path.sep}`))) {
    throw new Error(`output_ref_outside_workspace:${ref}`);
  }
  return target;
}

function requestLineSha256(request) {
  return sha256(`BRIK64_BETA17_FIXPOINT_STAGE_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`);
}

function readRequest(file) {
  const request = JSON.parse(fs.readFileSync(file, 'utf8'));
  const validation = validateRequest(request);
  if (!validation.accepted) throw new Error(`invalid_stage_request:${validation.blockers.join(',')}`);
  return request;
}

function writeArtifact(ref, body) {
  const target = resolveOutput(ref);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
  return {
    path: ref,
    sha256: sha256(body),
    bytes: Buffer.byteLength(body),
  };
}

function main() {
  const requestPath = process.argv[2] || path.join(root, 'evidence', 'beta17-fixpoint-stage-request', 'request.json');
  const request = readRequest(requestPath);
  const materializerRequestSha256 = requestLineSha256(request);
  const pcdSummary = request.inputPcds.map(({ path: itemPath, sha256: itemSha256, bytes }) => ({
    path: itemPath,
    sha256: itemSha256,
    bytes,
  }));

  const artifactObject = {
    schemaVersion: 'brik64.beta17_fixture_stage_artifact.v1',
    version: request.version,
    lane: request.lane,
    materializerMode: request.materializerMode,
    source: {
      pcdInputSetSha256: request.pcdInputSetSha256,
      materializerRequestSha256,
      inputPcds: pcdSummary,
    },
    claimBoundary: request.claimBoundary,
  };
  const artifactBody = `// brik64 beta17 fixture stage artifact\nexport const brik64Beta17FixtureStageArtifact = ${JSON.stringify(artifactObject, null, 2)};\n`;
  const stage1Artifact = writeArtifact(request.outputRefs.stage1Artifact, artifactBody);
  const stage2Artifact = writeArtifact(request.outputRefs.stage2Artifact, artifactBody);

  const stage1Manifest = {
    schemaVersion: 'brik64.beta17_fixpoint.stage1_artifact_manifest.v1',
    version: request.version,
    generatedByL6PlusN5: true,
    fixtureMaterializer: true,
    artifact: stage1Artifact,
    pcdInputSetSha256: request.pcdInputSetSha256,
    materializerRequestSha256,
    claimBoundary: request.claimBoundary,
  };
  const stage2Manifest = {
    schemaVersion: 'brik64.beta17_fixpoint.stage2_regeneration_manifest.v1',
    version: request.version,
    generatedByStage1: true,
    fixtureMaterializer: true,
    stage1ArtifactSha256: stage1Artifact.sha256,
    stage2ArtifactSha256: stage2Artifact.sha256,
    artifact: stage2Artifact,
    claimBoundary: request.claimBoundary,
  };
  const byteIdenticalReport = {
    schemaVersion: 'brik64.beta17_fixpoint.byte_identical_report.v1',
    decision: 'PASS_BYTE_IDENTICAL_REGENERATION',
    byteIdentical: true,
    comparison: {
      byteIdentical: true,
      sha256Match: stage1Artifact.sha256 === stage2Artifact.sha256,
      sizeMatch: stage1Artifact.bytes === stage2Artifact.bytes,
    },
    stage1Artifact,
    stage2Artifact,
    fixtureMaterializer: true,
    claimBoundary: request.claimBoundary,
  };
  const harnessReport = {
    schemaVersion: 'brik64.beta17_fixpoint.harness_report.v1',
    decision: 'PASS_BETA17_FIXPOINT_HARNESS',
    pass: true,
    adversarialCases: 3,
    fixtureMaterializer: true,
    claimBoundary: request.claimBoundary,
  };
  const sealReport = {
    schemaVersion: 'brik64.beta17_fixpoint.seal_report.v1',
    decision: 'PASS_BETA17_FIXPOINT_SEAL',
    sealed: true,
    fixtureMaterializer: true,
    claimBoundary: request.claimBoundary,
  };

  writeJson(resolveOutput(request.outputRefs.stage1Manifest), stage1Manifest);
  writeJson(resolveOutput(request.outputRefs.stage2Manifest), stage2Manifest);
  writeJson(resolveOutput(request.outputRefs.byteIdenticalReport), byteIdenticalReport);
  writeJson(resolveOutput(request.outputRefs.harnessReport), harnessReport);
  writeJson(resolveOutput(request.outputRefs.sealReport), sealReport);

  const refs = {
    stage1Manifest: {
      path: request.outputRefs.stage1Manifest,
      sha256: sha256File(resolveOutput(request.outputRefs.stage1Manifest)),
      bytes: fs.statSync(resolveOutput(request.outputRefs.stage1Manifest)).size,
    },
    stage2Manifest: {
      path: request.outputRefs.stage2Manifest,
      sha256: sha256File(resolveOutput(request.outputRefs.stage2Manifest)),
      bytes: fs.statSync(resolveOutput(request.outputRefs.stage2Manifest)).size,
    },
    byteIdenticalReport: {
      path: request.outputRefs.byteIdenticalReport,
      sha256: sha256File(resolveOutput(request.outputRefs.byteIdenticalReport)),
      bytes: fs.statSync(resolveOutput(request.outputRefs.byteIdenticalReport)).size,
    },
    harnessReport: {
      path: request.outputRefs.harnessReport,
      sha256: sha256File(resolveOutput(request.outputRefs.harnessReport)),
      bytes: fs.statSync(resolveOutput(request.outputRefs.harnessReport)).size,
    },
    sealReport: {
      path: request.outputRefs.sealReport,
      sha256: sha256File(resolveOutput(request.outputRefs.sealReport)),
      bytes: fs.statSync(resolveOutput(request.outputRefs.sealReport)).size,
    },
  };
  const remoteWrapperSha256 = '7'.repeat(64);
  const wrapperExecTargetSha256 = '8'.repeat(64);
  const generationTraceSha256 = sha256([
    request.pcdInputSetSha256,
    materializerRequestSha256,
    stage1Artifact.sha256,
    stage2Artifact.sha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
  ].join('\n'));
  const compositeSha256 = sha256([
    generationTraceSha256,
    refs.stage1Manifest.sha256,
    refs.stage2Manifest.sha256,
    refs.byteIdenticalReport.sha256,
    refs.harnessReport.sha256,
    refs.sealReport.sha256,
  ].join('\n'));
  const result = {
    schemaVersion: 'brik64.beta17_fixpoint_stage_result.v1',
    version: request.version,
    l6plusEngineSerial: 'BRIK64-L6PLUS-N5-FIXTURE-NONCLAIM',
    materializerMode: request.materializerMode,
    generatedByL6PlusN5: true,
    fixtureMaterializer: true,
    stage2GeneratedByStage1: true,
    byteIdentical: true,
    byteIdenticalSha256Match: true,
    byteIdenticalSizeMatch: true,
    harnessPass: true,
    adversarialCases: 3,
    sealReportPass: true,
    pcdInputSetSha256: request.pcdInputSetSha256,
    materializerRequestSha256,
    stage1ArtifactSha256: stage1Artifact.sha256,
    stage2ArtifactSha256: stage2Artifact.sha256,
    stage1ArtifactBytes: stage1Artifact.bytes,
    stage2ArtifactBytes: stage2Artifact.bytes,
    compositeSha256,
    generationTraceSha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
    stage1Artifact,
    stage2Artifact,
    ...refs,
    inputPcds: pcdSummary,
    claimBoundary: request.claimBoundary,
  };
  const validation = validateStageResult(result, {
    workspaceRoot: root,
    pcdInputSetSha256: request.pcdInputSetSha256,
    materializerRequestSha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
    requiredInputPcdPaths: request.requiredInputPcdPaths,
  });
  if (!validation.accepted) throw new Error(`invalid_fixture_stage_result:${validation.blockers.join(',')}`);
  process.stdout.write(`BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t${Buffer.from(JSON.stringify(result)).toString('base64')}\n`);
}

try {
  main();
} catch (error) {
  console.error(`beta17_fixture_materializer_fail_closed:${error.message}`);
  process.exit(2);
}
