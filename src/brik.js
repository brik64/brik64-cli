#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const version = '0.1.0-beta.3';
const ascii = [
  ' ____  ____  ___ _  __ __   _  _ ',
  '| __ )|  _ \\|_ _| |/ // /_ | || |',
  "|  _ \\| |_) || || ' /| '_ \\| || |_",
  '| |_) |  _ < | || . \\| (_) |__   _|',
  '|____/|_| \\_\\___|_|\\_\\\\___/   |_|  ',
].join('\n');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function printBanner() {
  process.stdout.write(`${ascii}\n`);
  process.stdout.write(`BRIK64 CLI ${version}\n`);
  process.stdout.write('status=public_beta\n');
}

function help() {
  printBanner();
  process.stdout.write('\ncommands:\n');
  process.stdout.write('  init                 create .brik metadata only\n');
  process.stdout.write('  certify <file.pcd>   write local candidate certificate\n');
  process.stdout.write('  emit <file.pcd>      emit only when local certificate exists\n');
  process.stdout.write('       --target <ts|rust|python> --out <dir> --tests\n');
  process.stdout.write('  --version            print version\n');
  process.stdout.write('\nreferences:\n');
  process.stdout.write('  docs                 https://docs.brik64.com/cli/install\n');
  process.stdout.write('  skill                https://github.com/brik64/brik64-tools-skills\n');
  process.stdout.write('  pcd standard         https://github.com/brik64/pcd-standard\n');
}

function readFileRequired(file) {
  if (!file) {
    process.stderr.write('missing_file_argument\n');
    process.exit(64);
  }
  if (!fs.existsSync(file)) {
    process.stderr.write(`file_not_found:${file}\n`);
    process.exit(66);
  }
  return fs.readFileSync(file, 'utf8');
}

function init() {
  const brikDir = path.resolve('.brik');
  fs.mkdirSync(brikDir, { recursive: true });
  const manifestPath = path.join(brikDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 'brik64.cli_project_manifest.v1',
      cliVersion: version,
      createdBy: 'brik64-cli-bootstrap',
      claimBoundary: {
        publicBetaAllowed: false,
        releaseAllowed: false,
        generatedAgentsFile: false
      }
    }, null, 2) + '\n');
  }
  process.stdout.write(`created=${path.relative(process.cwd(), manifestPath)}\n`);
}

function certPathFor(file) {
  return `${file}.cert.json`;
}

function parseEmitOptions(args) {
  const options = { target: null, outDir: null, tests: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--target') {
      options.target = args[index + 1];
      index += 1;
    } else if (arg === '--out') {
      options.outDir = args[index + 1];
      index += 1;
    } else if (arg === '--tests') {
      options.tests = true;
    } else {
      process.stderr.write(`unknown_emit_option:${arg}\n`);
      process.exit(64);
    }
  }
  return options;
}

function targetSpec(target) {
  const specs = {
    ts: {
      program: 'program.ts',
      test: 'program.test.ts',
      code: (hash) => [
        '// BRIK64 bootstrap emission candidate',
        '// claim: local candidate only',
        `export const pcdSha256 = "${hash}";`,
        'export function run(): string {',
        '  return `brik:${pcdSha256}`;',
        '}',
        '',
      ].join('\n'),
      testCode: (hash) => [
        'import { pcdSha256, run } from "./program";',
        '',
        'if (pcdSha256 !== "' + hash + '") throw new Error("pcd hash mismatch");',
        'if (run() !== `brik:${pcdSha256}`) throw new Error("run mismatch");',
        'console.log("brik64 generated ts test: PASS");',
        '',
      ].join('\n'),
    },
    rust: {
      program: 'program.rs',
      test: 'program_test.rs',
      code: (hash) => [
        '// BRIK64 bootstrap emission candidate',
        '// claim: local candidate only',
        `pub const PCD_SHA256: &str = "${hash}";`,
        'pub fn run() -> String {',
        '    format!("brik:{}", PCD_SHA256)',
        '}',
        '',
      ].join('\n'),
      testCode: (hash) => [
        `const PCD_SHA256: &str = "${hash}";`,
        'fn run() -> String {',
        '    format!("brik:{}", PCD_SHA256)',
        '}',
        '',
        'fn main() {',
        `    assert_eq!(PCD_SHA256, "${hash}");`,
        '    assert_eq!(run(), format!("brik:{}", PCD_SHA256));',
        '    println!("brik64 generated rust test: PASS");',
        '}',
        '',
      ].join('\n'),
    },
    python: {
      program: 'program.py',
      test: 'test_program.py',
      code: (hash) => [
        '# BRIK64 bootstrap emission candidate',
        '# claim: local candidate only',
        `PCD_SHA256 = "${hash}"`,
        '',
        'def run():',
        '    return f"brik:{PCD_SHA256}"',
        '',
      ].join('\n'),
      testCode: (hash) => [
        'from program import PCD_SHA256, run',
        '',
        `assert PCD_SHA256 == "${hash}"`,
        'assert run() == f"brik:{PCD_SHA256}"',
        'print("brik64 generated python test: PASS")',
        '',
      ].join('\n'),
    },
  };
  return specs[target] || null;
}

function certify(file) {
  const source = readFileRequired(file);
  const cert = {
    schemaVersion: 'brik64.cli_local_candidate_certificate.v1',
    cliVersion: version,
    pcd: file,
    semantic_pcd_sha256: sha256(source),
    certifiesFormalCorrectness: false,
    certifiesTests: false,
    claimBoundary: {
      localCandidateOnly: true,
      publicBetaAllowed: false,
      releaseAllowed: false
    }
  };
  const certPath = certPathFor(file);
  fs.writeFileSync(certPath, JSON.stringify(cert, null, 2) + '\n');
  process.stdout.write(`certificate=${certPath}\n`);
}

function emit(file, args = []) {
  const source = readFileRequired(file);
  const certPath = certPathFor(file);
  if (!fs.existsSync(certPath)) {
    process.stderr.write(`certificate_required:${certPath}\n`);
    process.exit(67);
  }
  const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'));
  if (cert.semantic_pcd_sha256 !== sha256(source)) {
    process.stderr.write('certificate_hash_mismatch\n');
    process.exit(68);
  }
  const options = parseEmitOptions(args);
  if (options.target || options.outDir || options.tests) {
    const spec = targetSpec(options.target);
    if (!spec) {
      process.stderr.write('unsupported_target\n');
      process.exit(69);
    }
    if (!options.outDir) {
      process.stderr.write('missing_out_dir\n');
      process.exit(64);
    }
    fs.mkdirSync(options.outDir, { recursive: true });
    fs.writeFileSync(path.join(options.outDir, spec.program), spec.code(cert.semantic_pcd_sha256));
    if (options.tests) {
      fs.writeFileSync(path.join(options.outDir, spec.test), spec.testCode(cert.semantic_pcd_sha256));
    }
    process.stdout.write(`generated=${path.join(options.outDir, spec.program)}\n`);
    if (options.tests) process.stdout.write(`tests=${path.join(options.outDir, spec.test)}\n`);
    return;
  }
  process.stdout.write('// BRIK64 bootstrap emission candidate\n');
  process.stdout.write('// claim: local candidate only\n');
  process.stdout.write(`// pcd_sha256=${cert.semantic_pcd_sha256}\n`);
}

function main() {
  const [cmd, file, ...args] = process.argv.slice(2);
  if (!cmd || cmd === '--help' || cmd === 'help') return help();
  if (cmd === '--version' || cmd === 'version') {
    printBanner();
    return;
  }
  if (cmd === 'init') return init();
  if (cmd === 'certify') return certify(file);
  if (cmd === 'emit') return emit(file, args);
  process.stderr.write(`unknown_command:${cmd}\n`);
  process.exit(2);
}

main();
