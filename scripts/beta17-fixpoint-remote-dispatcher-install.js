#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const {
  REQUIRED_CAPABILITY,
  REQUIRED_RESULT_MARKER,
  validateDeployPlan,
} = require('./beta17-fixpoint-remote-dispatcher-preflight');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const defaultPlanPath = path.join(root, 'evidence', 'beta17-fixpoint-remote-dispatcher', 'deploy-plan.json');
const defaultOutDir = path.join(root, 'evidence', 'beta17-fixpoint-remote-dispatcher');
const version = '0.1.0-beta.17';
const executeConfirmation = 'INSTALL_BETA17_FIXPOINT_DISPATCHER_NON_CLAIM';

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

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
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

function readPlan(planPath) {
  if (!fs.existsSync(planPath)) throw new Error(`install_plan_missing:${path.relative(root, planPath)}`);
  return JSON.parse(fs.readFileSync(planPath, 'utf8'));
}

function materializerLocalPath(plan) {
  const relativePath = plan?.localMaterializerRef?.path;
  if (!safeWorkspacePath(relativePath)) throw new Error('install_plan_local_materializer_ref_path_invalid');
  const resolved = path.resolve(root, relativePath);
  const workspace = path.resolve(root);
  if (!(resolved === workspace || resolved.startsWith(`${workspace}${path.sep}`))) {
    throw new Error('install_plan_local_materializer_ref_path_outside_workspace');
  }
  return resolved;
}

function buildRemoteInstallScript(plan, options = {}) {
  const remoteTempPath = `/tmp/brik64-beta17-dispatcher-${plan.materializerSha256}.js`;
  const commands = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'umask 077',
    `expected_sha=${shellQuote(plan.materializerSha256)}`,
    `wrapper=${shellQuote(plan.wrapperPath)}`,
    `materializer_remote=${shellQuote(plan.materializerRemotePath)}`,
    `materializer_tmp=${shellQuote(remoteTempPath)}`,
    'actual_sha="$(sha256sum "$materializer_tmp" | awk \'{print $1}\')"',
    'if [ "$actual_sha" != "$expected_sha" ]; then',
    '  echo "beta17_dispatcher_materializer_sha_mismatch" >&2',
    '  exit 2',
    'fi',
    'install -d -m 0755 "$(dirname "$materializer_remote")"',
    'install -m 0755 "$materializer_tmp" "$materializer_remote"',
    'backup="${wrapper}.bak.$(date -u +%Y%m%dT%H%M%SZ)"',
    'cp "$wrapper" "$backup"',
    'python3 - "$wrapper" "$materializer_remote" <<\'PY\'',
    'import pathlib, sys',
    'wrapper = pathlib.Path(sys.argv[1])',
    'materializer = sys.argv[2]',
    'text = wrapper.read_text()',
    'marker = "BRIK64_BETA17_FIXPOINT_STAGE_ENDPOINT"',
    'if marker not in text:',
    '    lines = text.splitlines()',
    '    insert_at = None',
    '    for i, line in enumerate(lines):',
    '        if line.strip().startswith("case "):',
    '            insert_at = i + 1',
    '            break',
    '    if insert_at is None:',
    '        raise SystemExit("beta17_dispatcher_wrapper_case_block_missing")',
    '    block = [',
    '        "    # BRIK64_BETA17_FIXPOINT_STAGE_ENDPOINT",',
    '        "    beta17-fixpoint-stage-status)",',
    '        "      printf \\"BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\\\\tinstalled\\\\tbeta17_fixpoint_stage_dispatcher\\\\n\\"",',
    '        "      exit 0",',
    '        "      ;;",',
    '        "    beta17-fixpoint-stage-materialize|fixpoint-stage-materialize|materialize)",',
    '        "      shift",',
    `        "      exec /usr/bin/node ${plan.materializerRemotePath} \\"$@\\""`,
    '        "      ;;",',
    '    ]',
    '    lines[insert_at:insert_at] = block',
    '    wrapper.write_text("\\n".join(lines) + "\\n")',
    'PY',
    `if ! grep -q ${shellQuote(REQUIRED_CAPABILITY)} "$wrapper"; then`,
    '  echo "beta17_dispatcher_wrapper_patch_missing_capability" >&2',
    '  exit 2',
    'fi',
    'chmod 0755 "$wrapper"',
    'rm -f "$materializer_tmp"',
    `printf 'BRIK64_BETA17_DISPATCHER_INSTALL_RESULT\\tinstalled\\t%s\\t%s\\n' "$expected_sha" ${shellQuote(options.host || 'unknown')}`,
  ];
  return `${commands.join('\n')}\n`;
}

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
    ...options,
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function executeInstall(plan, installScript, host) {
  const localMaterializer = materializerLocalPath(plan);
  const remoteTempPath = `/tmp/brik64-beta17-dispatcher-${plan.materializerSha256}.js`;
  const scpResult = run('scp', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    localMaterializer,
    `${host}:${remoteTempPath}`,
  ]);
  if (scpResult.status !== 0) return { scpResult, sshResult: null };
  const sshResult = run('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    host,
    'bash -s',
  ], { input: installScript });
  return { scpResult, sshResult };
}

function main() {
  const planPath = path.resolve(argValue('--plan', defaultPlanPath));
  const outDir = path.resolve(argValue('--out-dir', defaultOutDir));
  const reportPath = path.join(outDir, 'install-report.json');
  const installScriptPath = path.join(outDir, 'install-script.sh');
  const host = argValue('--host', process.env.BRIK64_L6_HOST || 'root@89.167.104.236');
  const execute = hasArg('--execute');
  const confirm = argValue('--confirm', '');
  const blockers = [];
  let plan = null;
  let installScript = null;
  let execution = null;
  try {
    plan = readPlan(planPath);
    const validation = validateDeployPlan(plan, { workspaceRoot: root });
    blockers.push(...validation.blockers);
    if (execute && confirm !== executeConfirmation) {
      blockers.push('install_execute_confirmation_missing');
    }
    if (blockers.length === 0) {
      const localMaterializer = materializerLocalPath(plan);
      if (sha256File(localMaterializer) !== plan.materializerSha256) {
        blockers.push('install_local_materializer_sha256_mismatch');
      }
    }
    if (blockers.length === 0) {
      installScript = buildRemoteInstallScript(plan, { host });
      writeText(installScriptPath, installScript);
      fs.chmodSync(installScriptPath, 0o755);
      if (execute) execution = executeInstall(plan, installScript, host);
      if (execution?.scpResult?.status && execution.scpResult.status !== 0) blockers.push('install_scp_failed');
      if (execution?.sshResult?.status && execution.sshResult.status !== 0) blockers.push('install_ssh_failed');
    }
  } catch (error) {
    blockers.push(error.message);
  }
  const accepted = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.remote_dispatcher_install_report.v1',
    version: '0.1.0-beta.17',
    generatedAt: new Date().toISOString(),
    decision: accepted
      ? execute
        ? 'PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL'
        : 'PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL_DRY_RUN'
      : 'BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL',
    executed: execute && accepted,
    publicationAllowed: false,
    claimBoundary: {
      publicReleaseAllowed: false,
      definitiveFixpointAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    host,
    plan: plan
      ? {
          path: path.relative(root, planPath),
          sha256: sha256File(planPath),
          capability: plan.capability,
          materializerRemotePath: plan.materializerRemotePath,
          materializerSha256: plan.materializerSha256,
          materializerBytes: plan.materializerBytes,
        }
      : null,
    installScript: installScript && fs.existsSync(installScriptPath)
      ? {
          path: path.relative(root, installScriptPath),
          sha256: sha256File(installScriptPath),
          bytes: fs.statSync(installScriptPath).size,
          requiredResultMarker: REQUIRED_RESULT_MARKER,
        }
      : null,
    execution: execution
      ? {
          scpStatus: execution.scpResult?.status ?? null,
          sshStatus: execution.sshResult?.status ?? null,
          stdoutSha256: execution.sshResult ? sha256(execution.sshResult.stdout) : null,
          stderrSha256: execution.sshResult ? sha256(execution.sshResult.stderr) : null,
        }
      : null,
    blockers: [...new Set(blockers)],
    nextAction: accepted
      ? execute
        ? 'rerun attempt:beta17:fixpoint:remote-stage and promote only a non-fixture accepted result'
        : `review ${path.relative(root, installScriptPath)}, then rerun with --execute --confirm ${executeConfirmation} only after materializer provenance is accepted`
      : 'fix the deploy plan or materializer ref, then rerun installer dry-run',
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
    console.error(`beta17_remote_dispatcher_install_fail_closed:${error.message}`);
    process.exit(2);
  }
}

module.exports = {
  buildRemoteInstallScript,
  executeConfirmation,
};
