#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const defaultPlanPath = path.join(root, 'evidence', 'beta17-fixpoint-remote-dispatcher', 'deploy-plan.json');
const defaultReportPath = path.join(root, 'evidence', 'beta17-fixpoint-remote-dispatcher', 'preflight-report.json');

const REQUIRED_VERSION = '0.1.0-beta.17';
const REQUIRED_SCHEMA = 'brik64.beta17_fixpoint.remote_dispatcher_deploy_plan.v1';
const REQUIRED_CAPABILITY = 'beta17_fixpoint_stage_dispatcher';
const REQUIRED_RESULT_MARKER = 'BRIK64_BETA17_FIXPOINT_STAGE_RESULT';
const REQUIRED_MATERIALIZER_MODE = 'l6plus_fixpoint_stage_materializer';
const REQUIRED_COMMANDS = [
  'beta17-fixpoint-stage-materialize',
  'fixpoint-stage-materialize',
  'materialize',
];
const LEGACY_FAMILY_PATTERN = /beta1[456][._-]|beta15|beta16/i;

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

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.replace(/^sha256:/, ''));
}

function normalizeSha256(value) {
  return String(value || '').replace(/^sha256:/, '').toLowerCase();
}

function safeRemotePath(value) {
  const text = String(value || '');
  return (
    text.startsWith('/opt/brik64/engines/l6plus-n5/') &&
    !text.includes('\0') &&
    !text.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function safeWorkspacePath(value) {
  const text = String(value || '');
  return (
    text.length > 0 &&
    !text.startsWith('/') &&
    !text.includes('\0') &&
    !/^https?:\/\//i.test(text) &&
    !text.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function validateLocalRef(ref, field, blockers, workspaceRoot = root) {
  if (!ref || typeof ref !== 'object') {
    blockers.push(`${field}_missing`);
    return;
  }
  if (!safeWorkspacePath(ref.path)) {
    blockers.push(`${field}_path_invalid`);
    return;
  }
  if (!isSha256(ref.sha256)) blockers.push(`${field}_sha256_invalid`);
  if (!Number.isInteger(ref.bytes) || ref.bytes < 1) blockers.push(`${field}_bytes_invalid`);
  const resolved = path.resolve(workspaceRoot, ref.path);
  const workspace = path.resolve(workspaceRoot);
  if (!(resolved === workspace || resolved.startsWith(`${workspace}${path.sep}`))) {
    blockers.push(`${field}_path_outside_workspace`);
    return;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    blockers.push(`${field}_file_missing:${ref.path}`);
    return;
  }
  if (isSha256(ref.sha256) && sha256File(resolved) !== normalizeSha256(ref.sha256)) {
    blockers.push(`${field}_file_sha256_mismatch:${ref.path}`);
  }
  if (Number.isInteger(ref.bytes) && fs.statSync(resolved).size !== ref.bytes) {
    blockers.push(`${field}_file_bytes_mismatch:${ref.path}`);
  }
}

function validateDeployPlan(plan, options = {}) {
  const blockers = [];
  if (!plan || typeof plan !== 'object') {
    return { accepted: false, blockers: ['deploy_plan_missing_or_invalid'] };
  }
  if (plan.schemaVersion !== REQUIRED_SCHEMA) blockers.push('deploy_plan_schema_invalid');
  if (plan.version !== REQUIRED_VERSION) blockers.push(`deploy_plan_version_mismatch:${plan.version || 'missing'}`);
  if (plan.status !== 'DEPLOY_PLAN_NON_CLAIM') blockers.push('deploy_plan_status_not_non_claim');
  if (plan.capability !== REQUIRED_CAPABILITY) blockers.push(`deploy_plan_capability_invalid:${plan.capability || 'missing'}`);
  if (plan.wrapperMode !== REQUIRED_CAPABILITY) blockers.push(`deploy_plan_wrapper_mode_invalid:${plan.wrapperMode || 'missing'}`);
  if (plan.resultMarker !== REQUIRED_RESULT_MARKER) blockers.push('deploy_plan_result_marker_invalid');
  if (plan.materializerMode !== REQUIRED_MATERIALIZER_MODE) blockers.push('deploy_plan_materializer_mode_invalid');
  if (plan.claimBoundary?.publicReleaseAllowed !== false) blockers.push('deploy_plan_claim_boundary_public_release_open');
  if (plan.claimBoundary?.definitiveFixpointAllowed !== false) blockers.push('deploy_plan_claim_boundary_fixpoint_open');
  if (plan.claimBoundary?.formalN5ClaimAllowed !== false) blockers.push('deploy_plan_claim_boundary_formal_n5_open');
  if (plan.claimBoundary?.universalCorrectnessClaimAllowed !== false) blockers.push('deploy_plan_claim_boundary_universal_correctness_open');
  if (!Array.isArray(plan.supportedCommands)) {
    blockers.push('deploy_plan_supported_commands_missing');
  } else {
    for (const command of REQUIRED_COMMANDS) {
      if (!plan.supportedCommands.includes(command)) blockers.push(`deploy_plan_supported_command_missing:${command}`);
    }
  }
  if (!safeRemotePath(plan.wrapperPath)) blockers.push('deploy_plan_wrapper_path_invalid');
  if (!safeRemotePath(plan.materializerRemotePath)) blockers.push('deploy_plan_materializer_remote_path_invalid');
  if (LEGACY_FAMILY_PATTERN.test(String(plan.materializerRemotePath || ''))) {
    blockers.push('deploy_plan_materializer_remote_path_legacy_family');
  }
  if (!isSha256(plan.materializerSha256)) blockers.push('deploy_plan_materializer_sha256_invalid');
  if (!Number.isInteger(plan.materializerBytes) || plan.materializerBytes < 1) {
    blockers.push('deploy_plan_materializer_bytes_invalid');
  }
  if (plan.generatedFromPcdPolymer !== true) blockers.push('deploy_plan_not_generated_from_pcd_polymer');
  if (plan.fixtureOrTemplate === true) blockers.push('deploy_plan_fixture_or_template_not_allowed');
  if (!Array.isArray(plan.nonAcceptableSubstitutes)) {
    blockers.push('deploy_plan_non_acceptable_substitutes_missing');
  } else {
    for (const phrase of [
      'beta15.7 or beta16 materializer endpoint',
      'fixture or TEMPLATE_NON_CLAIM stage result',
      'manual artifact patch not regenerated from PCD/polymer through L6+N5',
    ]) {
      if (!plan.nonAcceptableSubstitutes.includes(phrase)) {
        blockers.push(`deploy_plan_non_acceptable_substitute_missing:${phrase}`);
      }
    }
  }
  if (plan.localMaterializerRef) {
    validateLocalRef(plan.localMaterializerRef, 'deploy_plan_local_materializer_ref', blockers, options.workspaceRoot || root);
    if (
      isSha256(plan.localMaterializerRef.sha256) &&
      isSha256(plan.materializerSha256) &&
      normalizeSha256(plan.localMaterializerRef.sha256) !== normalizeSha256(plan.materializerSha256)
    ) {
      blockers.push('deploy_plan_local_materializer_ref_sha256_mismatch');
    }
    if (
      Number.isInteger(plan.localMaterializerRef.bytes) &&
      Number.isInteger(plan.materializerBytes) &&
      plan.localMaterializerRef.bytes !== plan.materializerBytes
    ) {
      blockers.push('deploy_plan_local_materializer_ref_bytes_mismatch');
    }
  } else {
    blockers.push('deploy_plan_local_materializer_ref_missing');
  }
  return { accepted: blockers.length === 0, blockers };
}

function readPlan(planPath) {
  if (!fs.existsSync(planPath)) {
    return { plan: null, readBlocker: `deploy_plan_missing:${path.relative(root, planPath)}` };
  }
  try {
    return { plan: JSON.parse(fs.readFileSync(planPath, 'utf8')), readBlocker: null };
  } catch (error) {
    return { plan: null, readBlocker: `deploy_plan_json_parse_failed:${error.message}` };
  }
}

function main() {
  const planPath = path.resolve(argValue('--plan', defaultPlanPath));
  const reportPath = path.resolve(argValue('--out', defaultReportPath));
  const { plan, readBlocker } = readPlan(planPath);
  const validation = validateDeployPlan(plan);
  const blockers = [...new Set([readBlocker, ...validation.blockers].filter(Boolean))];
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.remote_dispatcher_preflight_report.v1',
    version: REQUIRED_VERSION,
    generatedAt: new Date().toISOString(),
    decision: blockers.length === 0
      ? 'PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_PREFLIGHT'
      : 'BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_PREFLIGHT',
    publicationAllowed: false,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    required: {
      capability: REQUIRED_CAPABILITY,
      wrapperMode: REQUIRED_CAPABILITY,
      resultMarker: REQUIRED_RESULT_MARKER,
      materializerMode: REQUIRED_MATERIALIZER_MODE,
      supportedCommands: REQUIRED_COMMANDS,
    },
    plan: plan
      ? {
          path: path.relative(root, planPath),
          sha256: sha256File(planPath),
          capability: plan.capability || null,
          materializerRemotePath: plan.materializerRemotePath || null,
        }
      : null,
    blockers,
    nextAction: blockers.length === 0
      ? 'install the validated dispatcher plan on the L6+N5 host, then rerun attempt:beta17:fixpoint:remote-stage'
      : 'produce a non-claim deploy-plan.json for beta17_fixpoint_stage_dispatcher and rerun this preflight',
  };
  writeJson(reportPath, report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${path.relative(root, reportPath)}`);
  for (const blocker of blockers) console.error(blocker);
  process.exit(blockers.length === 0 ? 0 : 2);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`beta17_remote_dispatcher_preflight_fail_closed:${error.message}`);
    process.exit(2);
  }
}

module.exports = {
  REQUIRED_CAPABILITY,
  REQUIRED_COMMANDS,
  REQUIRED_MATERIALIZER_MODE,
  REQUIRED_RESULT_MARKER,
  validateDeployPlan,
};
