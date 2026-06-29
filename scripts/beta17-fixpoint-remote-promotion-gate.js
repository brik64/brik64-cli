#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateRequest } = require('./beta17-fixpoint-stage-request-bundle');
const { parseStageResult, validateStageResult } = require('./beta17-fixpoint-stage-result');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const attemptReportPath = path.join(root, 'evidence', 'beta17-fixpoint-remote-attempt', 'report.json');
const outDir = path.join(root, 'evidence', 'beta17-fixpoint-remote-promotion');
const outPath = path.join(outDir, 'report.json');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function rel(file) {
  return path.relative(root, file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function canonicalJsonSha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requestLineSha256(request) {
  return crypto
    .createHash('sha256')
    .update(`BRIK64_BETA17_FIXPOINT_STAGE_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`)
    .digest('hex');
}

function boolAt(object, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, object) === true;
}

function safeRelativePath(value) {
  const text = String(value || '');
  return (
    text.length > 0 &&
    !text.startsWith('/') &&
    !text.includes('\0') &&
    !/^https?:\/\//i.test(text) &&
    !text.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function fileRefExists(ref, blockers, key) {
  if (!ref || typeof ref !== 'object') {
    blockers.push(`${key}_missing`);
    return null;
  }
  if (!safeRelativePath(ref.path)) {
    blockers.push(`${key}_path_unsafe`);
    return null;
  }
  const file = path.resolve(root, ref.path);
  const resolvedRoot = path.resolve(root);
  if (!(file === resolvedRoot || file.startsWith(`${resolvedRoot}${path.sep}`))) {
    blockers.push(`${key}_path_outside_workspace`);
    return null;
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    blockers.push(`${key}_file_missing:${ref.path}`);
    return null;
  }
  if (typeof ref.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(ref.sha256)) {
    blockers.push(`${key}_sha256_invalid`);
    return null;
  }
  if (!Number.isInteger(ref.bytes) || ref.bytes < 0) {
    blockers.push(`${key}_bytes_invalid`);
    return null;
  }
  const actualSha256 = sha256File(file);
  const actualBytes = fs.statSync(file).size;
  if (actualSha256 !== ref.sha256.toLowerCase()) {
    blockers.push(`${key}_sha256_mismatch:${ref.path}`);
  }
  if (actualBytes !== ref.bytes) {
    blockers.push(`${key}_bytes_mismatch:${ref.path}`);
  }
  return {
    path: ref.path,
    sha256: actualSha256,
    bytes: actualBytes,
  };
}

function rejectFixture(value, blockers, key) {
  if (!value || typeof value !== 'object') return;
  if (
    boolAt(value, 'fixtureMaterializer') ||
    boolAt(value, 'stageResult.fixtureMaterializer') ||
    boolAt(value, 'stageResult.result.fixtureMaterializer') ||
    boolAt(value, 'stageResultValidation.normalized.fixtureMaterializer')
  ) {
    blockers.push(`${key}_fixture_materializer_not_claim_bearing`);
  }
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const blockers = [];
  const evidence = {};
  let report = null;

  if (!fs.existsSync(attemptReportPath)) {
    blockers.push(`missing_remote_attempt_report:${rel(attemptReportPath)}`);
  } else {
    evidence.remoteAttemptReport = {
      path: rel(attemptReportPath),
      sha256: sha256File(attemptReportPath),
      bytes: fs.statSync(attemptReportPath).size,
    };
    report = readJson(attemptReportPath);
  }

  if (report) {
    if (report.schemaVersion !== 'brik64.beta17_fixpoint.remote_attempt.v1') {
      blockers.push(`remote_attempt_schema_invalid:${report.schemaVersion || 'missing'}`);
    }
    if (report.version !== '0.1.0-beta.17') {
      blockers.push(`remote_attempt_version_mismatch:${report.version || 'missing'}`);
    }
    if (report.decision !== 'PASS_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT') {
      blockers.push(`remote_attempt_not_pass:${report.decision || 'missing'}`);
    }
    if (report.publicationAllowed !== false) blockers.push('remote_attempt_publication_flag_open');
    if (report.claimBoundary?.definitiveFixpointAllowed !== false) {
      blockers.push('remote_attempt_definitive_fixpoint_claim_open');
    }
    if (report.claimBoundary?.formalN5ClaimAllowed !== false) blockers.push('remote_attempt_formal_n5_claim_open');
    if (report.claimBoundary?.universalCorrectnessClaimAllowed !== false) {
      blockers.push('remote_attempt_universal_correctness_claim_open');
    }
    if (report.skipped === true) blockers.push('remote_attempt_was_skipped');

    let validatedRequest = null;
    const requestRef = fileRefExists(report.request, blockers, 'remote_attempt_request_ref');
    if (requestRef) {
      evidence.remoteAttemptRequest = requestRef;
      validatedRequest = readJson(path.resolve(root, report.request.path));
      const requestValidation = validateRequest(validatedRequest);
      evidence.remoteAttemptRequestValidation = {
        accepted: requestValidation.accepted,
        blockers: requestValidation.blockers,
      };
      if (!requestValidation.accepted) {
        blockers.push(`remote_attempt_request_invalid:${requestValidation.blockers.join('|')}`);
      }
      if (report.request?.pcdInputSetSha256 !== validatedRequest.pcdInputSetSha256) {
        blockers.push('remote_attempt_request_pcd_input_set_sha256_mismatch');
      }
      if (report.expectedContext?.materializerRequestSha256 !== requestLineSha256(validatedRequest)) {
        blockers.push('remote_attempt_expected_context_request_sha256_mismatch');
      }
    }

    const probeTranscripts = report.remote?.transcripts || {};
    for (const key of [
      'hostProbeStdout',
      'hostProbeStderr',
      'remoteRefStdout',
      'remoteRefStderr',
      'endpointStatusStdout',
      'endpointStatusStderr',
    ]) {
      const ref = fileRefExists(probeTranscripts[key], blockers, `remote_transcript_${key}`);
      if (ref) evidence[`remote_transcript_${key}`] = ref;
    }

    const acceptedAttempts = (report.attempts || []).filter((attempt) => attempt.stageResultValidation?.accepted === true);
    if (acceptedAttempts.length !== 1) {
      blockers.push(`accepted_remote_attempt_count_invalid:${acceptedAttempts.length}`);
    }
    const accepted = acceptedAttempts[0] || null;
    if (accepted) {
      rejectFixture(accepted, blockers, 'accepted_remote_attempt');
      if (accepted.stageResultValidation.normalized?.fixtureMaterializer === true) {
        blockers.push('accepted_remote_stage_result_fixture_materializer_not_claim_bearing');
      }
      const stdoutRef = fileRefExists(accepted.stdoutTranscript, blockers, 'accepted_attempt_stdout_transcript');
      const stderrRef = fileRefExists(accepted.stderrTranscript, blockers, 'accepted_attempt_stderr_transcript');
      const resultRef = fileRefExists(accepted.stageResult?.resultRef, blockers, 'accepted_attempt_stage_result_ref');
      if (stdoutRef) evidence.acceptedAttemptStdoutTranscript = stdoutRef;
      if (stderrRef) evidence.acceptedAttemptStderrTranscript = stderrRef;
      if (resultRef) {
        evidence.acceptedAttemptStageResult = resultRef;
        const stageResult = readJson(path.resolve(root, accepted.stageResult.resultRef.path));
        rejectFixture(stageResult, blockers, 'accepted_stage_result_file');
        if (stageResult.schemaVersion !== 'brik64.beta17_fixpoint_stage_result.v1') {
          blockers.push(`accepted_stage_result_schema_invalid:${stageResult.schemaVersion || 'missing'}`);
        }
        if (stageResult.version !== '0.1.0-beta.17') {
          blockers.push(`accepted_stage_result_version_mismatch:${stageResult.version || 'missing'}`);
        }
        if (stdoutRef) {
          const stdoutStageResult = parseStageResult(fs.readFileSync(path.resolve(root, accepted.stdoutTranscript.path), 'utf8'));
          if (!stdoutStageResult) {
            blockers.push('accepted_attempt_stdout_stage_result_missing');
          } else if (canonicalJsonSha256(stdoutStageResult) !== canonicalJsonSha256(stageResult)) {
            blockers.push('accepted_attempt_stdout_stage_result_mismatch');
          }
        }
        const expectedContext = {
          ...(report.expectedContext || {}),
          workspaceRoot: root,
        };
        if (validatedRequest) {
          expectedContext.pcdInputSetSha256 = validatedRequest.pcdInputSetSha256;
          expectedContext.materializerRequestSha256 = requestLineSha256(validatedRequest);
          expectedContext.requiredInputPcdPaths = validatedRequest.requiredInputPcdPaths;
        }
        const revalidation = validateStageResult(stageResult, expectedContext);
        evidence.acceptedAttemptStageResultRevalidation = {
          accepted: revalidation.accepted,
          blockers: revalidation.blockers,
        };
        if (!revalidation.accepted) {
          blockers.push(`accepted_stage_result_revalidation_failed:${revalidation.blockers.join('|')}`);
        }
      }
    }
  }

  const promotionReport = {
    schemaVersion: 'brik64.beta17_fixpoint.remote_promotion_gate.v1',
    generatedAt: new Date().toISOString(),
    version: '0.1.0-beta.17',
    decision: blockers.length === 0
      ? 'PASS_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE'
      : 'BLOCKED_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE',
    publicationAllowed: false,
    claimBoundary: {
      definitiveFixpointAllowed: false,
      publicReleaseAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    evidence,
    blockers,
    nextAction: blockers.length === 0
      ? 'promote accepted remote stage files into evidence/beta17-fixpoint and run readiness gate'
      : 'rerun beta17 remote stage attempt with a real non-fixture L6+N5 result',
  };
  fs.writeFileSync(outPath, `${JSON.stringify(promotionReport, null, 2)}\n`);
  console.log(`${promotionReport.decision} ${rel(outPath)}`);
  if (blockers.length > 0) {
    for (const blocker of blockers) console.error(blocker);
    process.exit(1);
  }
}

main();
