#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  REQUIRED_CAPABILITY,
  REQUIRED_COMMANDS,
  REQUIRED_MATERIALIZER_MODE,
  REQUIRED_RESULT_MARKER,
  validateDeployPlan,
} = require('./beta17-fixpoint-remote-dispatcher-preflight');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const defaultPlanPath = path.join(root, 'evidence', 'beta17-fixpoint-remote-dispatcher', 'deploy-plan.json');
const defaultReportPath = path.join(root, 'evidence', 'beta17-fixpoint-remote-dispatcher', 'deploy-plan-report.json');
const defaultWrapperPath = '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5';
const defaultRemotePath = '/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta17_fixpoint_stage_materializer.js';
const version = '0.1.0-beta.17';

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
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

function relativeMaterializerRef(materializerPath) {
  const absolute = path.resolve(root, materializerPath);
  const relativePath = path.relative(root, absolute);
  if (!safeWorkspacePath(relativePath)) {
    throw new Error(`materializer_path_outside_workspace:${materializerPath}`);
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`materializer_file_missing:${relativePath}`);
  }
  const stat = fs.statSync(absolute);
  return {
    path: relativePath,
    sha256: sha256File(absolute),
    bytes: stat.size,
  };
}

function relativeFileRef(filePath, label) {
  const absolute = path.resolve(root, filePath);
  const relativePath = path.relative(root, absolute);
  if (!safeWorkspacePath(relativePath)) {
    throw new Error(`${label}_path_outside_workspace:${filePath}`);
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`${label}_file_missing:${relativePath}`);
  }
  const stat = fs.statSync(absolute);
  return {
    path: relativePath,
    sha256: sha256File(absolute),
    bytes: stat.size,
  };
}

function buildPlan(options) {
  const localMaterializerRef = relativeMaterializerRef(options.materializer);
  const materializerProvenanceRef = relativeFileRef(options.provenance, 'materializer_provenance');
  return {
    schemaVersion: 'brik64.beta17_fixpoint.remote_dispatcher_deploy_plan.v1',
    version,
    status: 'DEPLOY_PLAN_NON_CLAIM',
    capability: REQUIRED_CAPABILITY,
    wrapperMode: REQUIRED_CAPABILITY,
    wrapperPath: options.wrapperPath,
    materializerRemotePath: options.remotePath,
    materializerSha256: localMaterializerRef.sha256,
    materializerBytes: localMaterializerRef.bytes,
    localMaterializerRef,
    materializerProvenanceRef,
    resultMarker: REQUIRED_RESULT_MARKER,
    materializerMode: REQUIRED_MATERIALIZER_MODE,
    generatedFromPcdPolymer: true,
    fixtureOrTemplate: false,
    supportedCommands: [...REQUIRED_COMMANDS],
    nonAcceptableSubstitutes: [
      'beta15.7 or beta16 materializer endpoint',
      'fixture or TEMPLATE_NON_CLAIM stage result',
      'manual artifact patch not regenerated from PCD/polymer through L6+N5',
    ],
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
  };
}

function main() {
  const materializer = argValue('--materializer', null);
  const provenance = argValue('--provenance', null);
  const planPath = path.resolve(argValue('--out', defaultPlanPath));
  const reportPath = path.resolve(argValue('--report', defaultReportPath));
  const options = {
    materializer,
    provenance,
    wrapperPath: argValue('--wrapper', defaultWrapperPath),
    remotePath: argValue('--remote-path', defaultRemotePath),
  };
  const blockers = [];
  let plan = null;
  if (!materializer) {
    blockers.push('materializer_argument_missing');
  }
  if (!provenance) {
    blockers.push('materializer_provenance_argument_missing');
  }
  if (blockers.length === 0) {
    try {
      plan = buildPlan(options);
      const validation = validateDeployPlan(plan, { workspaceRoot: root });
      blockers.push(...validation.blockers);
      if (validation.accepted && !hasArg('--check-only')) writeJson(planPath, plan);
    } catch (error) {
      blockers.push(error.message);
    }
  }
  const accepted = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.remote_dispatcher_deploy_plan_report.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: accepted
      ? 'PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_DEPLOY_PLAN'
      : 'BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_DEPLOY_PLAN',
    publicationAllowed: false,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    plan: plan
      ? {
          outputPath: hasArg('--check-only') ? null : path.relative(root, planPath),
          materializerRef: plan.localMaterializerRef,
          materializerProvenanceRef: plan.materializerProvenanceRef,
          materializerRemotePath: plan.materializerRemotePath,
          capability: plan.capability,
        }
      : null,
    blockers: [...new Set(blockers)],
    nextAction: accepted
      ? 'run preflight:beta17:fixpoint:remote-dispatcher against the generated deploy-plan.json'
      : 'provide a real Beta17 materializer file generated from PCD/polymer through L6+N5, then regenerate the deploy plan',
  };
  writeJson(reportPath, report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${path.relative(root, reportPath)}`);
  for (const blocker of report.blockers) console.error(blocker);
  process.exit(accepted ? 0 : 2);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`beta17_remote_dispatcher_deploy_plan_fail_closed:${error.message}`);
    process.exit(2);
  }
}

module.exports = {
  buildPlan,
};
