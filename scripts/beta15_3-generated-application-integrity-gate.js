#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.15.3';
const evidenceDir = path.join(root, 'evidence', 'beta15_3-generated-application-integrity');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta15-3-'));
const records = [];

function run(id, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || work,
    env: { ...process.env, BRIK64_NO_BANNER: '1', ...(options.env || {}) },
    encoding: 'utf8'
  });
  const record = {
    id,
    command: [command, ...args],
    cwd: options.cwd || work,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
  records.push(record);
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${id}:rc=${result.status}\n${result.stderr || result.stdout}`);
  }
  if (options.expect && !`${result.stdout}\n${result.stderr}`.includes(options.expect)) {
    throw new Error(`${id}:missing:${options.expect}\n${result.stderr || result.stdout}`);
  }
  return record;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
  fs.writeFileSync(path.join(work, file), content);
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    const error = new Error(message);
    error.detail = detail;
    throw error;
  }
}

function runGeneratedTests(target, outDir) {
  const dir = path.join(work, outDir);
  if (target === 'ts') {
    run(`test:${outDir}:ts`, 'node', ['program.test.mjs'], { cwd: dir });
    const program = fs.readFileSync(path.join(dir, 'program.mjs'), 'utf8');
    assert(!/\bif\s+(?:true|false)\s*\{/.test(program), 'ts_condition_missing_parentheses', { outDir });
    return;
  }
  if (target === 'python') {
    const testFile = fs.readdirSync(path.join(dir, 'tests')).find((name) => /^test_.*\.py$/.test(name));
    run(`test:${outDir}:python`, 'python3', [path.join('tests', testFile)], {
      cwd: dir,
      env: { PYTHONPATH: dir }
    });
    return;
  }
  if (target === 'rust') {
    const record = run(`test:${outDir}:rust`, 'cargo', ['test', '--quiet'], { cwd: dir });
    assert(!/\bwarning:/.test(record.stderr), 'rust_generated_warning', { outDir, stderr: record.stderr });
  }
}

fs.mkdirSync(evidenceDir, { recursive: true });
run('version', 'node', [cli, '--version'], { expect: `BRIK64 CLI ${version}` });
run('init', 'node', [cli, 'init'], { expect: 'created=.brik/manifest.json' });

write('pcd/ts_constant_condition.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC ts_constant_condition {
    domain input: i64 [0, 255];
    fn ts_constant_condition(input: i64) -> i64 {
        if (false) return 0;
        if (input > 10) {
            return MC_00.ADD8(input, 1);
        } else {
            return MC_01.SUB8(input, 1);
        }
    }
}
`);

write('pcd/div8_tuple.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC div8_tuple {
    domain numerator: i64 [0, 255];
    domain denominator: i64 [1, 255];
    fn div8_tuple(numerator: i64, denominator: i64) -> tuple_u8_u8 {
        return MC_03.DIV8(numerator, denominator);
    }
}
`);

write('pcd/f64_branch.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC f64_branch {
    boundary MC_64.FADD;
    domain x: f64 [0.0, 1000.0];
    fn f64_branch(x: f64) -> f64 {
        if (x > 10.0) return 0;
        return MC_64.FADD(x, 1.0);
    }
}
`);

write('pcd/math_log.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC math_log {
    boundary MC_76.LOG;
    domain x: f64 [1.0, 1000.0];
    fn math_log(x: f64) -> f64 {
        return MC_76.LOG(x);
    }
}
`);

write('pcd/core_a.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC core_a {
    domain input: i64 [0, 255];
    fn core_a(input: i64) -> i64 {
        if (input == 0) return 1;
        return MC_00.ADD8(input, 2);
    }
}
`);

write('pcd/core_b.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC core_b {
    domain input: i64 [0, 255];
    fn core_b(input: i64) -> i64 {
        if (input > 10) return MC_02.MUL8(input, 2);
        return MC_01.SUB8(input, 1);
    }
}
`);

for (const file of fs.readdirSync(path.join(work, 'pcd')).filter((name) => name.endsWith('.pcd')).sort()) {
  run(`certify:${file}`, 'node', [cli, 'certify', path.join('pcd', file)]);
  run(`verify:${file}`, 'node', [cli, 'verify', path.join('pcd', file)]);
}

const emitMatrix = [
  ['pcd/ts_constant_condition.pcd', 'ts', 'out/ts-condition'],
  ['pcd/div8_tuple.pcd', 'ts', 'out/div8-ts'],
  ['pcd/div8_tuple.pcd', 'python', 'out/div8-python'],
  ['pcd/div8_tuple.pcd', 'rust', 'out/div8-rust'],
  ['pcd/f64_branch.pcd', 'rust', 'out/f64-rust'],
  ['pcd/f64_branch.pcd', 'ts', 'out/f64-ts'],
  ['pcd/math_log.pcd', 'python', 'out/log-python']
];

for (const [file, target, outDir] of emitMatrix) {
  run(`emit:${target}:${file}`, 'node', [cli, 'emit', file, '--target', target, '--out', outDir, '--tests']);
  runGeneratedTests(target, outDir);
}

run('polymerize:core', 'node', [
  cli,
  'polymerize',
  'pcd/core_a.pcd',
  'pcd/core_b.pcd',
  '--inline',
  '--root',
  'core_b',
  '--out',
  'polymers/core_system.polymer.pcd'
], { expect: 'polymer=polymers/core_system.polymer.pcd' });
run('certify:core_polymer', 'node', [cli, 'certify', 'polymers/core_system.polymer.pcd']);
run('verify:core_polymer', 'node', [cli, 'verify', 'polymers/core_system.polymer.pcd']);

const polymerSource = fs.readFileSync(path.join(work, 'polymers/core_system.polymer.pcd'), 'utf8');
assert(!/\bif\s+(?:true|false)\s*\{/.test(polymerSource), 'polymer_condition_missing_parentheses');
assert(!/fn\s+core_a[\s\S]*\n\s+domain\s+/m.test(polymerSource), 'polymer_domain_after_function');

const report = {
  schemaVersion: 'brik64.beta15_3_generated_application_integrity_gate.v1',
  version,
  decision: 'PASS_BRIK64_CLI_BETA15_3_GENERATED_APPLICATION_INTEGRITY_GATE',
  evidenceLevel: 'NIVEL 3',
  checked: [
    'ts_condition_parentheses',
    'div8_tuple_emit_ts_python_rust',
    'rust_f64_branch_literals',
    'python_math_log_domain_fixtures',
    'polymer_pcd_certify_verify',
    'polymer_domains_before_functions'
  ],
  workdir: work,
  records: records.map((record) => ({
    id: record.id,
    status: record.status,
    stdout: record.stdout.slice(0, 1200),
    stderr: record.stderr.slice(0, 1200)
  }))
};

fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write('decision=PASS_BRIK64_CLI_BETA15_3_GENERATED_APPLICATION_INTEGRITY_GATE\n');
