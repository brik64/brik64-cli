#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const brik = path.join(repoRoot, 'src/brik.js');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta11-polymer-'));

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
  if (options.allowFailure) return result;
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

write('mid.pcd', `// brik64.pcd_file.v1
use leaf;

PC mid {
    const LIMIT: i64 = 2;
    fn mid(y: i64) -> i64 {
        repeat LIMIT {
            if (leaf(y) > 20) {
                return leaf(y) - 2;
            }
        }
        return leaf(y) + 3;
    }
}
`);

write('root.pcd', `// brik64.pcd_file.v1
use mid;

PC root {
    fn level1(input: i64) -> i64 {
        if (mid(input) >= 20) {
            return mid(input) * 2;
        } else {
            return mid(input) + 5;
        }
    }
}
`);

run(['node', brik, 'init']);
run(['node', brik, 'certify', 'root.pcd']);
run(['node', brik, 'emit', 'root.pcd', '--target', 'ts', '--out', 'out-root-ts', '--tests']);
run(['node', brik, 'polymerize', 'leaf.pcd', 'mid.pcd', 'root.pcd', '--local', '--out', 'polymer.pcd', '--json']);
run(['node', brik, 'certify', 'polymer.pcd']);
run(['node', brik, 'emit', 'polymer.pcd', '--target', 'ts', '--out', 'out-polymer-ts', '--tests']);
run(['node', 'program.test.mjs'], { cwd: path.join(work, 'out-root-ts') });
run(['node', 'program.test.mjs'], { cwd: path.join(work, 'out-polymer-ts') });

const comparisonScript = `
import { run as rootRun } from "./out-root-ts/program.mjs";
import { run as polymerRun } from "./out-polymer-ts/program.mjs";
const inputs = [0, 1, 10, 11, 20, 21, -1];
for (const input of inputs) {
  const root = rootRun(input);
  const polymer = polymerRun(input);
  if (root !== polymer) {
    throw new Error(\`semantic mismatch input=\${input} root=\${root} polymer=\${polymer}\`);
  }
}
console.log("PASS_BETA11_SEMANTIC_POLYMERIZE");
`;
write('compare.mjs', comparisonScript);
run(['node', 'compare.mjs']);

const manifest = JSON.parse(fs.readFileSync(path.join(work, 'polymer.pcd.manifest.json'), 'utf8'));
if (manifest.semanticMode !== 'root_dag_reference') {
  throw new Error(`unexpected semanticMode ${manifest.semanticMode}`);
}
if (manifest.root?.file !== 'root.pcd') {
  throw new Error('polymer root metadata missing root.pcd');
}

process.stdout.write(JSON.stringify({
  schemaVersion: 'brik64.beta11_semantic_polymerize_gate.v1',
  decision: 'PASS_BETA11_SEMANTIC_POLYMERIZE',
  workdir: work,
  root: manifest.root,
  semanticMode: manifest.semanticMode,
}, null, 2) + '\n');
