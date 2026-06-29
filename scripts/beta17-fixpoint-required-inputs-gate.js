#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = '0.1.0-beta.17';
const defaultOut = path.join(root, 'evidence', 'beta17-fixpoint-required-inputs', 'report.json');

const requiredCanonicalPcds = [
  'pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd',
  'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
];

const requiredEvidence = [
  {
    id: 'generated_materializer',
    kind: 'l6plus_generated_file',
    defaultPath: null,
    description: 'Non-fixture Beta17 stage materializer generated from canonical PCD/polymer through L6+N5.',
  },
  {
    id: 'materializer_provenance',
    kind: 'json_report',
    defaultPath: 'evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance.json',
    description: 'Hash-bound provenance for the generated materializer and canonical PCD input set.',
  },
  {
    id: 'dispatcher_deploy_plan',
    kind: 'json_report',
    defaultPath: 'evidence/beta17-fixpoint-remote-dispatcher/deploy-plan.json',
    description: 'Validated non-claim plan for installing the Beta17 stage dispatcher on the L6+N5 host.',
  },
  {
    id: 'dispatcher_install_report',
    kind: 'json_report',
    defaultPath: 'evidence/beta17-fixpoint-remote-dispatcher/install-report.json',
    description: 'Executed dispatcher install report with remote hash-bound install marker.',
  },
  {
    id: 'remote_stage_attempt',
    kind: 'json_report',
    defaultPath: 'evidence/beta17-fixpoint-remote-attempt/report.json',
    description: 'Remote Stage1/Stage2 attempt report that must pass only after dispatcher installation.',
  },
  {
    id: 'remote_promotion_report',
    kind: 'json_report',
    defaultPath: 'evidence/beta17-fixpoint-remote-promotion/report.json',
    description: 'Promotion gate report for the accepted remote Stage1/Stage2 result.',
  },
  {
    id: 'remote_promotion_manifest',
    kind: 'json_report',
    defaultPath: 'evidence/beta17-fixpoint/remote_promotion_manifest.json',
    description: 'Canonical promotion manifest binding source and target Stage1/Stage2 evidence.',
  },
];

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
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
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.includes('\0') &&
    !/^https?:\/\//i.test(value) &&
    !value.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function fileStatus(relativePath, label, blockers) {
  if (!safeWorkspacePath(relativePath)) {
    blockers.push(`${label}_path_invalid:${relativePath || 'missing'}`);
    return { path: relativePath || null, exists: false };
  }
  const absolute = path.resolve(root, relativePath);
  const workspace = path.resolve(root);
  if (!(absolute === workspace || absolute.startsWith(`${workspace}${path.sep}`))) {
    blockers.push(`${label}_path_outside_workspace:${relativePath}`);
    return { path: relativePath, exists: false };
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    blockers.push(`${label}_missing:${relativePath}`);
    return { path: relativePath, exists: false };
  }
  const stat = fs.statSync(absolute);
  return {
    path: relativePath,
    exists: true,
    sha256: sha256File(absolute),
    bytes: stat.size,
  };
}

function readJsonIfPresent(ref, label, blockers) {
  if (!ref.exists) return null;
  try {
    return JSON.parse(fs.readFileSync(path.resolve(root, ref.path), 'utf8'));
  } catch (error) {
    blockers.push(`${label}_json_parse_failed:${error.message}`);
    return null;
  }
}

function validateCanonicalPcds(blockers) {
  const refs = requiredCanonicalPcds.map((pcdPath, index) =>
    fileStatus(pcdPath, `canonical_pcd_${index}`, blockers),
  );
  const present = refs.filter((ref) => ref.exists);
  const body = `${present.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
  return {
    requiredCount: requiredCanonicalPcds.length,
    presentCount: present.length,
    pcdInputSetSha256: present.length === requiredCanonicalPcds.length ? sha256(body) : null,
    refs,
  };
}

function validateMaterializer(ref, blockers) {
  if (!ref.exists) return;
  const content = fs.readFileSync(path.resolve(root, ref.path), 'utf8');
  if (!content.includes('BRIK64_BETA17_FIXPOINT_STAGE_RESULT')) {
    blockers.push('generated_materializer_missing_stage_result_marker');
  }
  if (content.includes('<base64-json>')) {
    blockers.push('generated_materializer_contains_placeholder_result');
  }
  if (/TEMPLATE_NON_CLAIM|fixtureMaterializer|FIXTURE_MATERIALIZER/i.test(content)) {
    blockers.push('generated_materializer_fixture_or_template_content');
  }
}

function validateKnownReport(id, json, blockers) {
  if (!json) return;
  const boundary = json.claimBoundary || json.plan?.claimBoundary || json.provenance?.claimBoundary;
  if (boundary) {
    if (boundary.publicReleaseAllowed !== false) blockers.push(`${id}_public_release_boundary_open`);
    if (boundary.definitiveFixpointAllowed !== false) blockers.push(`${id}_fixpoint_boundary_open`);
    if (boundary.formalN5ClaimAllowed !== false) blockers.push(`${id}_formal_n5_boundary_open`);
  }
  if (id === 'materializer_provenance') {
    if (json.schemaVersion !== 'brik64.beta17_fixpoint.materializer_provenance.v1') {
      blockers.push('materializer_provenance_schema_invalid');
    }
    if (json.version !== version) blockers.push(`materializer_provenance_version_mismatch:${json.version || 'missing'}`);
    if (json.generatedFromPcdPolymer !== true) blockers.push('materializer_provenance_not_generated_from_pcd_polymer');
    if (json.fixtureOrTemplate === true) blockers.push('materializer_provenance_fixture_or_template');
  }
  if (id === 'dispatcher_deploy_plan') {
    if (json.schemaVersion !== 'brik64.beta17_fixpoint.remote_dispatcher_deploy_plan.v1') {
      blockers.push('dispatcher_deploy_plan_schema_invalid');
    }
    if (json.version !== version) blockers.push(`dispatcher_deploy_plan_version_mismatch:${json.version || 'missing'}`);
    if ((json.requiredEndpointCapability || json.capability) !== 'beta17_fixpoint_stage_dispatcher') {
      blockers.push('dispatcher_deploy_plan_capability_invalid');
    }
  }
  if (id === 'dispatcher_install_report') {
    if (json.decision !== 'PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL') {
      blockers.push(`dispatcher_install_report_not_executed_pass:${json.decision || 'missing'}`);
    }
    if (json.executed !== true) blockers.push('dispatcher_install_report_not_executed');
    if (json.remoteInstallResult?.status !== 'installed') blockers.push('dispatcher_install_report_remote_marker_missing');
  }
  if (id === 'remote_stage_attempt') {
    if (json.decision !== 'PASS_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT') {
      blockers.push(`remote_stage_attempt_not_pass:${json.decision || 'missing'}`);
    }
    if (!Array.isArray(json.attempts) || json.attempts.filter((item) => item.accepted === true).length !== 1) {
      blockers.push('remote_stage_attempt_accepted_attempt_count_invalid');
    }
    if (!json.installEvidence?.reportRef) blockers.push('remote_stage_attempt_install_evidence_missing');
  }
  if (id === 'remote_promotion_report' && json.decision !== 'PASS_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE') {
    blockers.push(`remote_promotion_report_not_pass:${json.decision || 'missing'}`);
  }
  if (id === 'remote_promotion_manifest') {
    if (
      json.schemaVersion
      && json.schemaVersion !== 'brik64.beta17_fixpoint.remote_promotion_manifest.v1'
    ) {
      blockers.push('remote_promotion_manifest_schema_invalid');
    }
    if (json.version && json.version !== version) blockers.push(`remote_promotion_manifest_version_mismatch:${json.version}`);
    if (!json.promoted || typeof json.promoted !== 'object') blockers.push('remote_promotion_manifest_promoted_missing');
    if (!json.sourcePromotionReport || typeof json.sourcePromotionReport !== 'object') {
      blockers.push('remote_promotion_manifest_source_promotion_report_missing');
    }
  }
}

function inferMaterializerPathFromDefaultProvenance() {
  const provenancePath = path.join(root, 'evidence', 'beta17-fixpoint-remote-dispatcher', 'materializer-provenance.json');
  if (!fs.existsSync(provenancePath) || !fs.statSync(provenancePath).isFile()) return null;
  try {
    const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
    return typeof provenance?.materializerRef?.path === 'string' ? provenance.materializerRef.path : null;
  } catch (_error) {
    return null;
  }
}

function buildReport() {
  const blockers = [];
  const materializerPath = argValue('--materializer') || inferMaterializerPathFromDefaultProvenance();
  const canonicalPcds = validateCanonicalPcds(blockers);
  const evidence = requiredEvidence.map((item) => {
    const refPath = item.id === 'generated_materializer' ? materializerPath : item.defaultPath;
    if (!refPath) {
      blockers.push('generated_materializer_argument_missing');
      return { ...item, ref: { path: null, exists: false } };
    }
    const ref = fileStatus(refPath, item.id, blockers);
    const json = item.kind === 'json_report' ? readJsonIfPresent(ref, item.id, blockers) : null;
    if (item.id === 'generated_materializer') validateMaterializer(ref, blockers);
    validateKnownReport(item.id, json, blockers);
    return {
      ...item,
      ref,
      observedDecision: json?.decision || json?.status || null,
    };
  });

  const uniqueBlockers = [...new Set(blockers)];
  return {
    schemaVersion: 'brik64.beta17_fixpoint.required_inputs_report.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: uniqueBlockers.length === 0
      ? 'PASS_BETA17_FIXPOINT_REQUIRED_INPUTS'
      : 'BLOCKED_BETA17_FIXPOINT_REQUIRED_INPUTS',
    publicationAllowed: false,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    canonicalPcds,
    evidence,
    blockers: uniqueBlockers,
    nextAction: uniqueBlockers.length === 0
      ? 'run plan/preflight/install/attempt/promote/readiness sequence with the verified inputs'
      : 'provide a real L6+N5-generated Beta17 materializer, executed dispatcher install evidence and passing remote Stage1/Stage2 promotion evidence',
  };
}

function main() {
  const outPath = path.resolve(argValue('--out', defaultOut));
  const report = buildReport();
  writeJson(outPath, report);
  if (!hasArg('--quiet')) {
    const relativeOut = path.relative(root, outPath) || outPath;
    console.log(`${report.decision} ${relativeOut}`);
  }
  if (report.decision !== 'PASS_BETA17_FIXPOINT_REQUIRED_INPUTS') {
    console.error(`beta17_required_inputs_blocked:${report.blockers.join(',')}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
