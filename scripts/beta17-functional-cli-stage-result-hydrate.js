#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  parseFunctionalCliStageResult,
  validateFunctionalCliStageResult,
  decodeStage1Artifact,
} = require('./beta17-functional-cli-stage-result');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const resultLinePath = argValue('--result-line', path.join(root, 'evidence', 'beta17-functional-cli-stage-result', 'result.line'));
const requestManifestPath = argValue('--request-manifest', path.join(root, 'evidence', 'beta17-functional-cli-stage-request', 'request.manifest.json'));
const outDir = path.join(root, 'evidence', 'beta17-functional-cli-stage-result');
const reportPath = path.join(outDir, 'hydrate-report.json');

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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function rel(file) {
  return path.relative(root, file);
}

function safeResolve(ref) {
  if (typeof ref !== 'string' || ref.length === 0 || path.isAbsolute(ref)) return null;
  if (ref.includes('\0') || /^https?:\/\//i.test(ref)) return null;
  const normalized = path.normalize(ref);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) return null;
  const resolved = path.resolve(root, ref);
  if (!(resolved === root || resolved.startsWith(`${root}${path.sep}`))) return null;
  return resolved;
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

function blocked(blockers, context = {}) {
  const report = {
    schemaVersion: 'brik64.beta17_functional_cli_stage_result_hydration.v1',
    generatedAt: new Date().toISOString(),
    version: '0.1.0-beta.17',
    decision: 'BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_RESULT_HYDRATION',
    hydrated: false,
    blockers,
    context,
    claimBoundary: closedClaimBoundary(),
  };
  writeJson(reportPath, report);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`blockers=${blockers.join(',')}\n`);
  process.exit(1);
}

function loadExpected() {
  if (!fs.existsSync(requestManifestPath)) return {};
  const manifest = readJson(requestManifestPath);
  return {
    pcdInputSetSha256: manifest.pcdInputSetSha256,
    functionalCliStageRequestSha256: manifest.requestLineSha256 || manifest.requestLine?.sha256,
    requiredInputPcdPaths: (manifest.inputPcds || []).map((item) => item.path),
  };
}

function ensureResultLine() {
  if (!fs.existsSync(resultLinePath)) {
    blocked([`missing_functional_cli_stage_result_line:${rel(resultLinePath)}`]);
  }
  const text = fs.readFileSync(resultLinePath, 'utf8');
  const result = parseFunctionalCliStageResult(text);
  if (!result) blocked(['functional_cli_stage_result_parse_failed'], { resultLine: rel(resultLinePath) });
  return result;
}

function writeBoundJsonRef(ref, value) {
  const target = safeResolve(ref.path);
  if (!target) throw new Error(`unsafe_output_ref:${ref.path || 'missing'}`);
  writeJson(target, value);
  const actualSha = sha256File(target);
  const actualBytes = fs.statSync(target).size;
  if (actualSha !== ref.sha256) throw new Error(`hydrated_ref_sha256_mismatch:${ref.path}`);
  if (actualBytes !== ref.bytes) throw new Error(`hydrated_ref_bytes_mismatch:${ref.path}`);
  return { path: ref.path, sha256: actualSha, bytes: actualBytes };
}

function writeArtifact(ref, artifact) {
  const target = safeResolve(ref.path);
  if (!target) throw new Error(`unsafe_artifact_ref:${ref.path || 'missing'}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, artifact);
  const actualSha = sha256File(target);
  const actualBytes = fs.statSync(target).size;
  if (actualSha !== ref.sha256) throw new Error(`hydrated_artifact_sha256_mismatch:${ref.path}`);
  if (actualBytes !== ref.bytes) throw new Error(`hydrated_artifact_bytes_mismatch:${ref.path}`);
  return { path: ref.path, sha256: actualSha, bytes: actualBytes };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const result = ensureResultLine();
  const expected = loadExpected();
  const validation = validateFunctionalCliStageResult(result, expected);
  if (!validation.accepted) blocked(validation.blockers, { resultLine: rel(resultLinePath) });
  const artifact = decodeStage1Artifact(result);
  if (!artifact) blocked(['functional_cli_stage_artifact_decode_failed'], { resultLine: rel(resultLinePath) });

  try {
    const hydratedGeneratedAt = result.generatedAt || '1970-01-01T00:00:00.000Z';
    const artifactRef = writeArtifact(result.stage1Artifact, artifact);
    const stage1Manifest = {
      schemaVersion: 'brik64.beta17_fixpoint.stage1_artifact_manifest.v1',
      version: result.version,
      generatedByL6PlusN5: true,
      generatedFromPcdPolymer: true,
      artifact: artifactRef,
      stage1ArtifactSha256: artifactRef.sha256,
      functionalCliStageRequestSha256: result.functionalCliStageRequestSha256,
      pcdInputSetSha256: result.pcdInputSetSha256,
      claimBoundary: closedClaimBoundary(),
    };
    const stage1ManifestRef = writeBoundJsonRef(result.stage1Manifest, stage1Manifest);
    const functionalReport = {
      schemaVersion: 'brik64.beta17_fixpoint.functional_stage_artifact_gate.v1',
      generatedAt: hydratedGeneratedAt,
      version: result.version,
      decision: 'PASS_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE',
      releaseEligibleStageArtifact: true,
      artifact: artifactRef,
      checks: {
        hydratedFromFunctionalCliStageResult: true,
        generatedByL6PlusN5: true,
        nodeEntrypoint: true,
        argvHandling: true,
        commandDispatcher: true,
      },
      blockers: [],
      claimBoundary: closedClaimBoundary(),
    };
    const functionalReportRef = writeBoundJsonRef(result.functionalStageReport, functionalReport);
    const packageManifest = {
      schemaVersion: 'brik64.cli_beta17_package_manifest.v1',
      version: result.version,
      decision: 'PASS_BRIK64_CLI_BETA17_FUNCTIONAL_ARTIFACT_READY',
      releaseEligible: true,
      publicationAllowed: false,
      package: null,
      stageArtifact: {
        ...artifactRef,
        functionalCliArtifact: true,
      },
      functionalStageArtifactReport: functionalReportRef,
      blockers: ['publication_requires_public_surface_sync_and_external_audit'],
      claimBoundary: {
        publicReleaseAllowed: false,
        publicClaimsAllowed: false,
        l6MaterializationClaimAllowed: true,
        formalN5ClaimAllowed: false,
        fixpointClaimAllowed: false,
        selfHostingClaimAllowed: false,
        rustIndependenceClaimAllowed: false,
      },
    };
    const packageManifestRef = writeBoundJsonRef(result.packageManifest, packageManifest);
    const report = {
      schemaVersion: 'brik64.beta17_functional_cli_stage_result_hydration.v1',
      generatedAt: new Date().toISOString(),
      version: result.version,
      decision: 'PASS_BETA17_FUNCTIONAL_CLI_STAGE_RESULT_HYDRATION',
      hydrated: true,
      resultLine: {
        path: rel(resultLinePath),
        sha256: sha256File(resultLinePath),
        bytes: fs.statSync(resultLinePath).size,
      },
      hydratedRefs: {
        stage1Artifact: artifactRef,
        stage1Manifest: stage1ManifestRef,
        functionalStageReport: functionalReportRef,
        packageManifest: packageManifestRef,
      },
      claimBoundary: closedClaimBoundary(),
    };
    writeJson(reportPath, report);
    process.stdout.write(`decision=${report.decision}\n`);
    process.stdout.write(`hydrated=${report.hydrated}\n`);
  } catch (error) {
    blocked([`functional_cli_stage_hydration_write_failed:${error.message}`], { resultLine: rel(resultLinePath) });
  }
}

main();
