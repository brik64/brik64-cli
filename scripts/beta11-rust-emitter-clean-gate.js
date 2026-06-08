#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const brik = path.join(repoRoot, 'src/brik.js');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta11-rust-'));

function write(relativePath, content) {
  const target = path.join(work, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function run(args, options = {}) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: options.cwd || work,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    process.stderr.write(`command failed: ${args.join(' ')}\n`);
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
  return result;
}

write('leaf.pcd', `// brik64.pcd_file.v1
PC leaf {
    const BONUS: i64 = 7;
    fn leaf(x: i64) -> i64 {
        if (x > 10) {
            return x + BONUS;
        } else {
            return x + 1;
        }
    }
}
`);

write('root.pcd', `// brik64.pcd_file.v1
use leaf;

PC root {
    fn level1(input: i64) -> i64 {
        if (leaf(input) >= 20) {
            return leaf(input) * 2;
        } else {
            return leaf(input) + 5;
        }
    }
}
`);

run(['node', brik, 'init']);
run(['node', brik, 'certify', 'root.pcd']);
run(['node', brik, 'emit', 'root.pcd', '--target', 'rust', '--out', 'out-rust', '--tests']);

const cargo = run(['cargo', 'test', '--quiet'], { cwd: path.join(work, 'out-rust') });
const combined = `${cargo.stdout}\n${cargo.stderr}`;
const forbidden = [
  'unnecessary parentheses',
  'unreachable statement',
  'warning:',
];
const matched = forbidden.filter((needle) => combined.includes(needle));
if (matched.length > 0) {
  process.stderr.write(combined);
  throw new Error(`rust warning gate failed: ${matched.join(', ')}`);
}

process.stdout.write(JSON.stringify({
  schemaVersion: 'brik64.beta11_rust_emitter_clean_gate.v1',
  decision: 'PASS_BETA11_RUST_EMITTER_CLEAN',
  workdir: work,
  checks: ['cargo_test_quiet', 'no_unnecessary_parentheses', 'no_unreachable_statement'],
}, null, 2) + '\n');
