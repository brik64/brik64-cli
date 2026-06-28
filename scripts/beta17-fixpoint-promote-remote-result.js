#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const crypto = require('crypto');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const promotionReportPath = path.join(root, 'evidence', 'beta17-fixpoint-remote-promotion', 'report.json');
const fixpointDir = path.join(root, 'evidence', 'beta17-fixpoint');
const outReportPath = path.join(fixpointDir, 'remote_promotion_manifest.json');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function rel(file) {
  return path.relative(root, file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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

function resolveWorkspaceFile(refPath, blockers, key) {
  if (!safeRelativePath(refPath)) {
    blockers.push(`${key}_path_unsafe`);
    return null;
  }
  const file = path.resolve(root, refPath);
  const resolvedRoot = path.resolve(root);
  if (!(file === resolvedRoot || file.startsWith(`${resolvedRoot}${path.sep}`))) {
    blockers.push(`${key}_path_outside_workspace`);
    return null;
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    blockers.push(`${key}_file_missing:${refPath}`);
    return null;
  }
  return file;
}

function validateCopyRef(sourceRef, targetRelativePath, blockers, key) {
  if (!sourceRef || typeof sourceRef !== 'object') {
    blockers.push(`${key}_source_ref_missing`);
    return null;
  }
  const source = resolveWorkspaceFile(sourceRef.path, blockers, `${key}_source`);
  if (!source) return null;
  const sourceSha256 = sha256File(source);
  if (sourceSha256 !== String(sourceRef.sha256 || '').toLowerCase()) {
    blockers.push(`${key}_source_sha256_mismatch:${sourceRef.path}`);
    return null;
  }
  if (!safeRelativePath(targetRelativePath)) {
    blockers.push(`${key}_target_path_unsafe`);
    return null;
  }
  const target = path.resolve(root, targetRelativePath);
  const resolvedRoot = path.resolve(root);
  if (!(target === resolvedRoot || target.startsWith(`${resolvedRoot}${path.sep}`))) {
    blockers.push(`${key}_target_path_outside_workspace`);
    return null;
  }
  return {
    sourceFile: source,
    targetFile: target,
    path: targetRelativePath,
    sha256: sourceSha256,
    bytes: fs.statSync(source).size,
    source: {
      path: sourceRef.path,
      sha256: sourceSha256,
    },
  };
}

function runGate() {
  const result = childProcess.spawnSync('node', ['scripts/beta17-fixpoint-remote-promotion-gate.js'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function main() {
  const blockers = [];
  const copyPlan = [];
  const gate = runGate();
  if (gate.status !== 0) blockers.push(`remote_promotion_gate_not_pass:${gate.status}`);
  if (!fs.existsSync(promotionReportPath)) {
    blockers.push(`missing_remote_promotion_report:${rel(promotionReportPath)}`);
  }

  let promotionReport = null;
  if (fs.existsSync(promotionReportPath)) {
    promotionReport = readJson(promotionReportPath);
    if (promotionReport.decision !== 'PASS_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE') {
      blockers.push(`remote_promotion_report_not_pass:${promotionReport.decision || 'missing'}`);
    }
  }

  let stageResult = null;
  if (promotionReport?.evidence?.acceptedAttemptStageResult?.path) {
    const stageResultFile = resolveWorkspaceFile(
      promotionReport.evidence.acceptedAttemptStageResult.path,
      blockers,
      'accepted_stage_result'
    );
    if (stageResultFile) stageResult = readJson(stageResultFile);
  } else {
    blockers.push('accepted_stage_result_ref_missing');
  }

  const promoted = {};
  if (stageResult) {
    promoted.stage1ArtifactManifest = validateCopyRef(
      stageResult.stage1Manifest,
      'evidence/beta17-fixpoint/stage1_artifact_manifest.json',
      blockers,
      'stage1_manifest'
    );
    promoted.stage2RegenerationManifest = validateCopyRef(
      stageResult.stage2Manifest,
      'evidence/beta17-fixpoint/stage2_regeneration_manifest.json',
      blockers,
      'stage2_manifest'
    );
    promoted.byteIdenticalReport = validateCopyRef(
      stageResult.byteIdenticalReport,
      'evidence/beta17-fixpoint/byte_identical_report.json',
      blockers,
      'byte_identical_report'
    );
    promoted.harnessReport = validateCopyRef(
      stageResult.harnessReport,
      'evidence/beta17-fixpoint/harness_report.json',
      blockers,
      'harness_report'
    );
    promoted.sealReport = validateCopyRef(
      stageResult.sealReport,
      'evidence/beta17-fixpoint/seal_report.json',
      blockers,
      'seal_report'
    );
    promoted.stage1Artifact = validateCopyRef(
      stageResult.stage1Artifact,
      'evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs',
      blockers,
      'stage1_artifact'
    );
    promoted.stage2Artifact = validateCopyRef(
      stageResult.stage2Artifact,
      'evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs',
      blockers,
      'stage2_artifact'
    );
    for (const item of Object.values(promoted)) {
      if (item) copyPlan.push(item);
    }
  }

  if (blockers.length === 0) {
    for (const item of copyPlan) {
      fs.mkdirSync(path.dirname(item.targetFile), { recursive: true });
      fs.copyFileSync(item.sourceFile, item.targetFile);
      delete item.sourceFile;
      delete item.targetFile;
    }
  }

  fs.mkdirSync(fixpointDir, { recursive: true });
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.remote_promotion_manifest.v1',
    generatedAt: new Date().toISOString(),
    version: '0.1.0-beta.17',
    decision: blockers.length === 0
      ? 'PASS_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION'
      : 'BLOCKED_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION',
    publicationAllowed: false,
    claimBoundary: {
      definitiveFixpointAllowed: false,
      publicReleaseAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    gate: {
      status: gate.status,
      stdoutSha256: crypto.createHash('sha256').update(gate.stdout).digest('hex'),
      stderrSha256: crypto.createHash('sha256').update(gate.stderr).digest('hex'),
    },
    sourcePromotionReport: fs.existsSync(promotionReportPath)
      ? {
          path: rel(promotionReportPath),
          sha256: sha256File(promotionReportPath),
          bytes: fs.statSync(promotionReportPath).size,
        }
      : null,
    promoted,
    blockers,
    nextAction: blockers.length === 0
      ? 'add canonical motor/harness manifests, input_pcd_hashes, public sync and external audit before readiness'
      : 'produce a passing non-fixture remote promotion gate before promotion',
  };
  fs.writeFileSync(outReportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.decision} ${rel(outReportPath)}`);
  if (blockers.length > 0) {
    for (const blocker of blockers) console.error(blocker);
    process.exit(1);
  }
}

main();
