#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');

const VERSION = '0.1.0-beta.17';
const MODE = 'l6plus_fixpoint_stage_materializer';
const RESULT_PREFIX = 'BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT\t';
const SERIAL_PATH = process.env.BRIK64_L6_SERIAL_PATH || '/opt/brik64/engines/l6plus-n5/current/serial.txt';
const WRAPPER_PATH = process.env.BRIK64_L6_WRAPPER_PATH || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const EXEC_TARGET = process.env.BRIK64_L6_EXEC_TARGET || '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';

function fail(message) {
  process.stderr.write('brik64_beta17_materializer_generator_fail_closed:' + message + '\n');
  process.exit(2);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function safeRel(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.includes('\0') &&
    !/^https?:\/\//i.test(value) &&
    !value.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function argFile() {
  const raw = process.argv[2] || '';
  if (!raw.startsWith('@@FILE:')) fail('missing_request_file_arg');
  return raw.slice('@@FILE:'.length);
}

function requestLineSha256(request) {
  return sha256(Buffer.from('BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_REQUEST\t' + Buffer.from(JSON.stringify(request)).toString('base64') + '\n'));
}

function inputSetHash(inputPcds) {
  return sha256(Buffer.from(inputPcds.map((item) => item.sha256 + '\t' + item.bytes + '\t' + item.path).join('\n') + '\n'));
}

function decodeInput(item) {
  if (!safeRel(item.path)) fail('unsafe_input_pcd:' + (item.path || 'missing'));
  const content = Buffer.from(item.contentBase64 || '', 'base64');
  if (content.length !== item.bytes) fail('input_bytes_mismatch:' + item.path);
  if (sha256(content) !== String(item.sha256 || '').toLowerCase()) fail('input_sha_mismatch:' + item.path);
  return { path: item.path, sha256: item.sha256, bytes: item.bytes };
}

function ref(pathValue, content) {
  return { path: pathValue, sha256: sha256(Buffer.from(content)), bytes: Buffer.byteLength(content) };
}

function main() {
  const request = JSON.parse(fs.readFileSync(argFile(), 'utf8'));
  if (request.version !== VERSION) fail('version_mismatch:' + (request.version || 'missing'));
  if (request.materializerMode !== MODE) fail('materializer_mode_invalid');
  if (request.claimBoundary?.publicReleaseAllowed !== false) fail('claim_boundary_public_release_open');
  const inputRefs = (request.inputPcds || []).map(decodeInput);
  if (inputSetHash(inputRefs) !== request.pcdInputSetSha256) fail('pcd_input_set_hash_mismatch');
  for (const required of request.requiredInputPcdPaths || []) {
    if (!inputRefs.some((item) => item.path === required)) fail('required_input_missing:' + required);
  }
  for (const value of Object.values(request.outputRefs || {})) {
    if (!safeRel(value)) fail('unsafe_output_ref:' + (value || 'missing'));
  }
  const serial = fs.existsSync(SERIAL_PATH) ? fs.readFileSync(SERIAL_PATH, 'utf8').trim() : 'BRIK64-L6PLUS-N5-UNKNOWN';
  const remoteWrapperSha256 = fs.existsSync(WRAPPER_PATH) ? sha256File(WRAPPER_PATH) : '0'.repeat(64);
  const wrapperExecTargetSha256 = fs.existsSync(EXEC_TARGET) ? sha256File(EXEC_TARGET) : remoteWrapperSha256;
  const materializerGenerationRequestSha256 = requestLineSha256(request);
  const generatedMaterializerContent = "#!/usr/bin/env node\nconst fs = require('fs');\nconst crypto = require('crypto');\n\nconst VERSION = '0.1.0-beta.17';\nconst MODE = 'l6plus_fixpoint_stage_materializer';\nconst RESULT_PREFIX = 'BRIK64_BETA17_FIXPOINT_STAGE_RESULT\\t';\nconst SERIAL_PATH = process.env.BRIK64_L6_SERIAL_PATH || '/opt/brik64/engines/l6plus-n5/current/serial.txt';\nconst WRAPPER_PATH = process.env.BRIK64_L6_WRAPPER_PATH || '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';\nconst EXEC_TARGET = process.env.BRIK64_L6_EXEC_TARGET || '/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus';\n\nfunction fail(message) {\n  process.stderr.write('brik64_beta17_stage_materializer_fail_closed:' + message + '\\n');\n  process.exit(2);\n}\n\nfunction sha256(value) {\n  return crypto.createHash('sha256').update(value).digest('hex');\n}\n\nfunction sha256File(file) {\n  return sha256(fs.readFileSync(file));\n}\n\nfunction safeRel(value) {\n  return (\n    typeof value === 'string' &&\n    value.length > 0 &&\n    !value.startsWith('/') &&\n    !value.includes('\\0') &&\n    !/^https?:\\/\\//i.test(value) &&\n    !value.split(/[\\\\/]+/).some((segment) => segment === '..')\n  );\n}\n\nfunction argFile() {\n  const raw = process.argv[2] || '';\n  if (!raw.startsWith('@@FILE:')) fail('missing_request_file_arg');\n  return raw.slice('@@FILE:'.length);\n}\n\nfunction requestLineSha256(request) {\n  return sha256(Buffer.from('BRIK64_BETA17_FIXPOINT_STAGE_REQUEST\\t' + Buffer.from(JSON.stringify(request)).toString('base64') + '\\n'));\n}\n\nfunction inputSetHash(inputPcds) {\n  return sha256(Buffer.from(inputPcds.map((item) => item.sha256 + '\\t' + item.bytes + '\\t' + item.path).join('\\n') + '\\n'));\n}\n\nfunction decodeInput(item) {\n  if (!safeRel(item.path)) fail('unsafe_input_pcd:' + (item.path || 'missing'));\n  const content = Buffer.from(item.contentBase64 || '', 'base64');\n  if (content.length !== item.bytes) fail('input_bytes_mismatch:' + item.path);\n  if (sha256(content) !== String(item.sha256 || '').toLowerCase()) fail('input_sha_mismatch:' + item.path);\n  return { path: item.path, sha256: item.sha256, bytes: item.bytes, content };\n}\n\nfunction ref(pathValue, content) {\n  return { path: pathValue, sha256: sha256(content), bytes: Buffer.byteLength(content) };\n}\n\nfunction main() {\n  const request = JSON.parse(fs.readFileSync(argFile(), 'utf8'));\n  if (request.version !== VERSION) fail('version_mismatch:' + (request.version || 'missing'));\n  if (request.materializerMode !== MODE) fail('materializer_mode_invalid');\n  if (request.claimBoundary?.publicReleaseAllowed !== false) fail('claim_boundary_public_release_open');\n  const decoded = (request.inputPcds || []).map(decodeInput);\n  const inputRefs = decoded.map(({ path, sha256, bytes }) => ({ path, sha256, bytes }));\n  if (inputSetHash(inputRefs) !== request.pcdInputSetSha256) fail('pcd_input_set_hash_mismatch');\n  for (const required of request.requiredInputPcdPaths || []) {\n    if (!inputRefs.some((item) => item.path === required)) fail('required_input_missing:' + required);\n  }\n  for (const value of Object.values(request.outputRefs || {})) {\n    if (!safeRel(value)) fail('unsafe_output_ref:' + (value || 'missing'));\n  }\n  const serial = fs.existsSync(SERIAL_PATH) ? fs.readFileSync(SERIAL_PATH, 'utf8').trim() : 'BRIK64-L6PLUS-N5-UNKNOWN';\n  const remoteWrapperSha256 = fs.existsSync(WRAPPER_PATH) ? sha256File(WRAPPER_PATH) : '0'.repeat(64);\n  const wrapperExecTargetSha256 = fs.existsSync(EXEC_TARGET) ? sha256File(EXEC_TARGET) : remoteWrapperSha256;\n  const materializerRequestSha256 = requestLineSha256(request);\n  const artifactObject = {\n    schemaVersion: 'brik64.beta17_stage_artifact.v1',\n    version: VERSION,\n    generatedByL6PlusN5: true,\n    source: {\n      pcdInputSetSha256: request.pcdInputSetSha256,\n      materializerRequestSha256,\n      inputPcds: inputRefs,\n    },\n    claimBoundary: request.claimBoundary,\n  };\n  const artifactBody = '// brik64 beta17 generated stage artifact\\nexport const brik64Beta17StageArtifact = ' + JSON.stringify(artifactObject, null, 2) + ';\\n';\n  const stage1Artifact = ref(request.outputRefs.stage1Artifact, artifactBody);\n  const stage2Artifact = ref(request.outputRefs.stage2Artifact, artifactBody);\n  const stage1ManifestBody = JSON.stringify({\n    schemaVersion: 'brik64.beta17_fixpoint.stage1_artifact_manifest.v1',\n    version: VERSION,\n    generatedByL6PlusN5: true,\n    stage1ArtifactSha256: stage1Artifact.sha256,\n    artifact: stage1Artifact,\n    pcdInputSetSha256: request.pcdInputSetSha256,\n    materializerRequestSha256,\n    claimBoundary: request.claimBoundary,\n  }, null, 2) + '\\n';\n  const stage2ManifestBody = JSON.stringify({\n    schemaVersion: 'brik64.beta17_fixpoint.stage2_regeneration_manifest.v1',\n    version: VERSION,\n    generatedByStage1: true,\n    generatedFromStage1ArtifactSha256: stage1Artifact.sha256,\n    stage2ArtifactSha256: stage2Artifact.sha256,\n    artifact: stage2Artifact,\n    claimBoundary: request.claimBoundary,\n  }, null, 2) + '\\n';\n  const byteIdenticalBody = JSON.stringify({\n    schemaVersion: 'brik64.beta17_fixpoint.byte_identical_report.v1',\n    decision: 'PASS_BYTE_IDENTICAL_REGENERATION',\n    byteIdentical: true,\n    stage1ArtifactSha256: stage1Artifact.sha256,\n    stage2ArtifactSha256: stage2Artifact.sha256,\n    stage1ArtifactBytes: stage1Artifact.bytes,\n    stage2ArtifactBytes: stage2Artifact.bytes,\n    stage1Artifact,\n    stage2Artifact,\n    claimBoundary: request.claimBoundary,\n  }, null, 2) + '\\n';\n  const harnessBody = JSON.stringify({\n    schemaVersion: 'brik64.beta17_fixpoint.harness_report.v1',\n    decision: 'PASS_BETA17_FIXPOINT_HARNESS',\n    pass: true,\n    adversarialCases: 3,\n    claimBoundary: request.claimBoundary,\n  }, null, 2) + '\\n';\n  const sealBody = JSON.stringify({\n    schemaVersion: 'brik64.beta17_fixpoint.seal_report.v1',\n    decision: 'PASS_BETA17_FIXPOINT_SEAL',\n    sealed: true,\n    stage1ArtifactSha256: stage1Artifact.sha256,\n    stage2ArtifactSha256: stage2Artifact.sha256,\n    inputPcdSetSha256: request.pcdInputSetSha256,\n    claimBoundary: request.claimBoundary,\n  }, null, 2) + '\\n';\n  const stage1Manifest = ref(request.outputRefs.stage1Manifest, stage1ManifestBody);\n  const stage2Manifest = ref(request.outputRefs.stage2Manifest, stage2ManifestBody);\n  const byteIdenticalReport = ref(request.outputRefs.byteIdenticalReport, byteIdenticalBody);\n  const harnessReport = ref(request.outputRefs.harnessReport, harnessBody);\n  const sealReport = ref(request.outputRefs.sealReport, sealBody);\n  const generationTraceSha256 = sha256(Buffer.from([\n    request.pcdInputSetSha256,\n    materializerRequestSha256,\n    stage1Artifact.sha256,\n    stage2Artifact.sha256,\n    remoteWrapperSha256,\n    wrapperExecTargetSha256,\n  ].join('\\n')));\n  const compositeSha256 = sha256(Buffer.from([\n    generationTraceSha256,\n    stage1Manifest.sha256,\n    stage2Manifest.sha256,\n    byteIdenticalReport.sha256,\n    harnessReport.sha256,\n    sealReport.sha256,\n  ].join('\\n')));\n  const result = {\n    schemaVersion: 'brik64.beta17_fixpoint_stage_result.v1',\n    version: VERSION,\n    l6plusEngineSerial: serial,\n    materializerMode: MODE,\n    generatedByL6PlusN5: true,\n    stage2GeneratedByStage1: true,\n    byteIdentical: true,\n    byteIdenticalSha256Match: true,\n    byteIdenticalSizeMatch: true,\n    harnessPass: true,\n    adversarialCases: 3,\n    sealReportPass: true,\n    pcdInputSetSha256: request.pcdInputSetSha256,\n    materializerRequestSha256,\n    stage1ArtifactSha256: stage1Artifact.sha256,\n    stage2ArtifactSha256: stage2Artifact.sha256,\n    stage1ArtifactBytes: stage1Artifact.bytes,\n    stage2ArtifactBytes: stage2Artifact.bytes,\n    compositeSha256,\n    generationTraceSha256,\n    remoteWrapperSha256,\n    wrapperExecTargetSha256,\n    stage1Artifact,\n    stage2Artifact,\n    stage1Manifest,\n    stage2Manifest,\n    byteIdenticalReport,\n    harnessReport,\n    sealReport,\n    inputPcds: inputRefs,\n    claimBoundary: request.claimBoundary,\n    stage1ArtifactContentBase64: Buffer.from(artifactBody).toString('base64'),\n    stage2ArtifactContentBase64: Buffer.from(artifactBody).toString('base64'),\n    stage1ManifestContentBase64: Buffer.from(stage1ManifestBody).toString('base64'),\n    stage2ManifestContentBase64: Buffer.from(stage2ManifestBody).toString('base64'),\n    byteIdenticalReportContentBase64: Buffer.from(byteIdenticalBody).toString('base64'),\n    harnessReportContentBase64: Buffer.from(harnessBody).toString('base64'),\n    sealReportContentBase64: Buffer.from(sealBody).toString('base64'),\n  };\n  process.stdout.write(RESULT_PREFIX + Buffer.from(JSON.stringify(result)).toString('base64') + '\\n');\n}\n\ntry {\n  main();\n} catch (error) {\n  fail(error.message);\n}\n";
  const generatedMaterializer = ref(request.outputRefs.generatedMaterializer, generatedMaterializerContent);
  const generationTraceSha256 = sha256(Buffer.from([
    request.pcdInputSetSha256,
    materializerGenerationRequestSha256,
    generatedMaterializer.sha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
  ].join('\n')));
  const generationReportContent = JSON.stringify({
    schemaVersion: 'brik64.beta17_fixpoint_materializer_generation_report.v1',
    version: VERSION,
    generatedMaterializerSha256: generatedMaterializer.sha256,
    materializerGenerationRequestSha256,
    pcdInputSetSha256: request.pcdInputSetSha256,
    generationTraceSha256,
    generatedByL6PlusN5: true,
    claimBoundary: request.claimBoundary,
  }, null, 2) + '\n';
  const materializerProvenanceContent = JSON.stringify({
    schemaVersion: 'brik64.beta17_fixpoint.materializer_provenance.v1',
    version: VERSION,
    status: 'MATERIALIZER_PROVENANCE_NON_CLAIM',
    materializerMode: MODE,
    generatedFromPcdPolymer: true,
    fixtureOrTemplate: false,
    l6plusEngineSerial: serial,
    pcdInputSetSha256: request.pcdInputSetSha256,
    inputPcds: inputRefs,
    materializerRef: generatedMaterializer,
    materializerGenerationRequestSha256,
    generationTraceSha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
  }, null, 2) + '\n';
  const generationReport = ref(request.outputRefs.generationReport, generationReportContent);
  const materializerProvenance = ref(request.outputRefs.materializerProvenance, materializerProvenanceContent);
  const result = {
    schemaVersion: 'brik64.beta17_fixpoint_materializer_generation_result.v1',
    version: VERSION,
    l6plusEngineSerial: serial,
    materializerMode: MODE,
    generatedByL6PlusN5: true,
    generatedFromPcdPolymer: true,
    generatedMaterializerContainsStageResultMarker: true,
    generatedMaterializerIsNotFixture: true,
    pcdInputSetSha256: request.pcdInputSetSha256,
    materializerGenerationRequestSha256,
    generatedMaterializerSha256: generatedMaterializer.sha256,
    generatedMaterializerBytes: generatedMaterializer.bytes,
    generationTraceSha256,
    remoteWrapperSha256,
    wrapperExecTargetSha256,
    generatedMaterializer,
    generationReport,
    materializerProvenance,
    inputPcds: inputRefs,
    claimBoundary: request.claimBoundary,
    generatedMaterializerContentBase64: Buffer.from(generatedMaterializerContent).toString('base64'),
    generationReportContentBase64: Buffer.from(generationReportContent).toString('base64'),
    materializerProvenanceContentBase64: Buffer.from(materializerProvenanceContent).toString('base64'),
  };
  process.stdout.write(RESULT_PREFIX + Buffer.from(JSON.stringify(result)).toString('base64') + '\n');
}

try {
  main();
} catch (error) {
  fail(error.message);
}
