#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'brik.js');
const evidenceDir = process.env.BRIK64_BETA12_ADVERSARIAL_EVIDENCE
  ? path.resolve(process.env.BRIK64_BETA12_ADVERSARIAL_EVIDENCE)
  : path.join(root, 'evidence', 'beta12-adversarial');
const reportPath = path.join(evidenceDir, 'report.json');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta12-adversarial-'));

const checks = [];
const blockers = [];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function run(command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });
  return {
    command: [command, ...args].join(' '),
    cwd: options.cwd || root,
    rc: result.status === null ? 124 : result.status,
    signal: result.signal,
    elapsedMs: Date.now() - started,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function record(id, fn) {
  const started = Date.now();
  try {
    const detail = fn() || {};
    checks.push({ id, status: 'PASS', elapsedMs: Date.now() - started, ...detail });
  } catch (error) {
    blockers.push(`${id}:${error.message}`);
    checks.push({ id, status: 'FAIL', elapsedMs: Date.now() - started, error: error.message });
  }
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    const suffix = Object.keys(detail).length > 0 ? `:${JSON.stringify(detail).slice(0, 500)}` : '';
    throw new Error(`${message}${suffix}`);
  }
}

function expectPass(id, command, args, options = {}) {
  const result = run(command, args, options);
  assert(result.rc === 0, `${id}:expected_pass_rc_0`, tail(result));
  assert(!stackTraceLeaked(result), `${id}:stack_trace_leaked`, tail(result));
  return result;
}

function expectFail(id, command, args, expected, options = {}) {
  const result = run(command, args, options);
  assert(result.rc !== 0, `${id}:expected_fail`, tail(result));
  const output = `${result.stdout}\n${result.stderr}`;
  assert(output.includes(expected), `${id}:missing_expected:${expected}`, tail(result));
  assert(!stackTraceLeaked(result), `${id}:stack_trace_leaked`, tail(result));
  return result;
}

function tail(result) {
  return {
    rc: result.rc,
    stdoutTail: result.stdout.slice(-1000),
    stderrTail: result.stderr.slice(-1000)
  };
}

function stackTraceLeaked(result) {
  return /(^|\n)\s+at .*\(|Node\.js v\d+\./.test(result.stderr);
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function pcd(name, body) {
  return `PC ${name} {\n  fn ${name}(input) {\n${body}\n  }\n}\n`;
}

record('regression:beta12_semantic_polymerize_gate', () => {
  const result = expectPass('semantic-polymerize', 'npm', ['run', 'gate:beta12:semantic-polymerize']);
  return { stdoutSha256: sha256(result.stdout) };
});

record('regression:beta12_rust_emitter_clean_gate', () => {
  const result = expectPass('rust-emitter-clean', 'npm', ['run', 'gate:beta12:rust-emitter-clean']);
  return { stdoutSha256: sha256(result.stdout) };
});

record('regression:beta12_doctor_empty_workspace_gate', () => {
  const result = expectPass('doctor-empty-workspace', 'npm', ['run', 'gate:beta12:doctor-empty-workspace']);
  return { stdoutSha256: sha256(result.stdout) };
});

record('adversarial:path_traversal_and_certificate_fail_closed', () => {
  const workdir = path.join(scratch, 'path-traversal');
  fs.mkdirSync(workdir, { recursive: true });
  expectPass('init', process.execPath, [cli, 'init'], { cwd: workdir });
  write(path.join(workdir, 'pcd', 'root.pcd'), pcd('root', '    return input + 1;'));
  expectFail(
    'emit-before-cert',
    process.execPath,
    [cli, 'emit', 'pcd/root.pcd', '--target', 'ts', '--out', 'out-ts'],
    'certificate_required',
    { cwd: workdir }
  );
  expectPass('certify-root', process.execPath, [cli, 'certify', 'pcd/root.pcd'], { cwd: workdir });
  expectFail(
    'emit-outside-workspace',
    process.execPath,
    [cli, 'emit', 'pcd/root.pcd', '--target', 'ts', '--out', '../escaped-out', '--tests'],
    'path_outside_workspace',
    { cwd: workdir }
  );
  assert(!fs.existsSync(path.join(scratch, 'escaped-out', 'program.ts')), 'path_traversal_wrote_outside_workspace');
  fs.appendFileSync(path.join(workdir, 'pcd', 'root.pcd'), '\n// tamper\n');
  expectFail(
    'stale-cert-after-tamper',
    process.execPath,
    [cli, 'emit', 'pcd/root.pcd', '--target', 'ts', '--out', 'out-ts'],
    'certificate_hash_mismatch',
    { cwd: workdir }
  );
});

record('adversarial:symlink_input_escape_fail_closed', () => {
  const workdir = path.join(scratch, 'symlink-input');
  const outside = path.join(scratch, 'outside-sensitive.pcd');
  fs.mkdirSync(workdir, { recursive: true });
  expectPass('init', process.execPath, [cli, 'init'], { cwd: workdir });
  write(outside, pcd('outside', '    return 99;'));
  fs.symlinkSync(outside, path.join(workdir, 'symlink.pcd'));
  expectFail(
    'certify-symlink-outside',
    process.execPath,
    [cli, 'certify', 'symlink.pcd'],
    'path_outside_workspace',
    { cwd: workdir }
  );
  assert(!fs.existsSync(path.join(workdir, 'symlink.pcd.cert.json')), 'symlink_certificate_written');
});

record('adversarial:parser_rejects_malformed_inputs', () => {
  const workdir = path.join(scratch, 'parser');
  fs.mkdirSync(workdir, { recursive: true });
  expectPass('init', process.execPath, [cli, 'init'], { cwd: workdir });
  write(path.join(workdir, 'pcd', 'empty.pcd'), '');
  write(path.join(workdir, 'pcd', 'binary.pcd'), `PC binary {\n  fn binary(input) {\n    return input;\n  }\n}\0`);
  write(path.join(workdir, 'pcd', 'legacy.pcd'), 'pc legacy {\n  fn legacy(input) {\n    return input;\n  }\n}\n');
  write(path.join(workdir, 'pcd', 'missing_return.pcd'), 'PC missing_return {\n  fn missing_return(input) {\n    if (input > 0) {\n    }\n  }\n}\n');
  write(path.join(workdir, 'pcd', 'unsupported_statement.pcd'), pcd('unsupported_statement', '    let x = input;\n    return x;'));
  write(path.join(workdir, 'pcd', 'malformed_expression.pcd'), pcd('malformed_expression', '    return input + ;'));
  write(path.join(workdir, 'pcd', 'too_large.pcd'), `${pcd('too_large', '    return input;')}${'//x\n'.repeat(300000)}`);
  expectFail('empty', process.execPath, [cli, 'certify', 'pcd/empty.pcd'], 'pcd_empty', { cwd: workdir });
  expectFail('binary', process.execPath, [cli, 'certify', 'pcd/binary.pcd'], 'pcd_binary_input', { cwd: workdir });
  expectFail('legacy', process.execPath, [cli, 'certify', 'pcd/legacy.pcd'], 'legacy syntax detected', { cwd: workdir });
  expectFail(
    'missing-return',
    process.execPath,
    [cli, 'certify', 'pcd/missing_return.pcd'],
    'pcd_parse_error:missing_return',
    { cwd: workdir }
  );
  expectFail(
    'unsupported-statement',
    process.execPath,
    [cli, 'certify', 'pcd/unsupported_statement.pcd'],
    'pcd_parse_error:unsupported_statement',
    { cwd: workdir }
  );
  expectFail(
    'malformed-expression',
    process.execPath,
    [cli, 'certify', 'pcd/malformed_expression.pcd'],
    'pcd_parse_error:malformed_expression',
    { cwd: workdir }
  );
  expectFail('too-large', process.execPath, [cli, 'certify', 'pcd/too_large.pcd'], 'pcd_too_large', { cwd: workdir });
});

record('adversarial:polymerize_import_dag_fail_closed', () => {
  const workdir = path.join(scratch, 'polymer');
  fs.mkdirSync(workdir, { recursive: true });
  expectPass('init', process.execPath, [cli, 'init'], { cwd: workdir });
  write(path.join(workdir, 'pcd', 'root.pcd'), [
    'use missing;',
    '',
    'PC root {',
    '  fn root(input) {',
    '    return missing(input);',
    '  }',
    '}',
    ''
  ].join('\n'));
  expectFail(
    'missing-import-certify',
    process.execPath,
    [cli, 'certify', 'pcd/root.pcd'],
    'pcd_import_not_found:missing',
    { cwd: workdir }
  );
  write(path.join(workdir, 'pcd', 'leaf.pcd'), pcd('leaf', '    if (input > 3) {\n      return input * 2;\n    } else {\n      return input - 2;\n    }'));
  write(path.join(workdir, 'pcd', 'root.pcd'), [
    'use leaf;',
    '',
    'PC root {',
    '  fn root(input) {',
    '    return leaf(input) + 1;',
    '  }',
    '}',
    ''
  ].join('\n'));
  expectPass('certify-root', process.execPath, [cli, 'certify', 'pcd/root.pcd'], { cwd: workdir });
  expectPass('polymerize-root', process.execPath, [cli, 'polymerize', 'pcd/root.pcd', '--out', 'polymer.pcd'], { cwd: workdir });
  expectPass('certify-polymer', process.execPath, [cli, 'certify', 'polymer.pcd'], { cwd: workdir });
  expectPass(
    'emit-polymer-python',
    process.execPath,
    [cli, 'emit', 'polymer.pcd', '--target', 'python', '--out', 'out-python', '--tests'],
    { cwd: workdir }
  );
  expectPass('python-generated-test', 'python3', ['out-python/test_program.py'], { cwd: workdir, env: { PYTHONPATH: 'out-python' } });
});

const decision = blockers.length === 0
  ? 'PASS_BETA12_ADVERSARIAL_GATE'
  : 'BLOCKED_BETA12_ADVERSARIAL_GATE';
const report = {
  schemaVersion: 'brik64.cli_beta12_adversarial_gate.v1',
  generatedAt: new Date().toISOString(),
  lane: 'cli_0_1_beta12',
  decision,
  rc: blockers.length === 0 ? 0 : 2,
  checks,
  blockers,
  scratchWorkspace: path.basename(scratch),
  claimBoundary: {
    functionalCliEvidence: true,
    publicReleaseAllowed: false,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    l6PublicClaimAllowed: false
  }
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.rc);
