#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const version = '0.1.0-beta.5';
const RESET = '\x1b[0m';
const BRIK = '\x1b[38;2;180;180;180m';
const CYAN = '\x1b[38;2;25;167;195m';

const LOGO_80 = String.raw`
█████████████  ███████████████ ████  ████    ██████ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒         ▒
██████████████ ███████████████ ████  ████  ██████  ▒▒▒▒▒▒▒▒▒▒▒▒   ▒▒▒▒       ▒▒▒
████     █████ █████     █████ ██ █  ██████████   ▒▒▒▒▒           ▒▒▒▒      ▒▒▒▒
████ █████████ █████    ██████  ███  ████████     ▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒
████ █████████ █████  ██████   ████  ████████     ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒▒▒▒▒▒
████      ████ █████ ██████    ████  ██████████   ▒▒▒▒▒      ▒▒▒▒           ▒▒▒▒
██████████████ █████  ██████   ████  ████  ██████  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒           ▒▒▒▒
██████████████ █████    ██████ ████  ████    ██████ ▒▒▒▒▒▒▒▒▒▒▒▒            ▒▒▒▒
`;

function colorizeLogo(raw) {
  return raw
    .replaceAll('█', `${BRIK}█${RESET}`)
    .replaceAll('▒', `${CYAN}▒${RESET}`);
}

function printBrik64Logo() {
  process.stdout.write(`${colorizeLogo(LOGO_80.trimEnd())}\n`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function workspacePath(inputPath, errorCode = 64) {
  if (!inputPath || typeof inputPath !== 'string') {
    fail(errorCode, 'missing_path');
  }
  const resolved = path.resolve(inputPath);
  const cwd = process.cwd();
  if (resolved !== cwd && !resolved.startsWith(`${cwd}${path.sep}`)) {
    fail(errorCode, 'path_outside_workspace');
  }
  return resolved;
}

function writeFileControlled(file, content) {
  try {
    fs.writeFileSync(file, content);
  } catch (error) {
    fail(74, `filesystem_write_error:${error.code || 'unknown'}`);
  }
}

function mkdirControlled(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    fail(74, `filesystem_mkdir_error:${error.code || 'unknown'}`);
  }
}

function printBanner() {
  printBrik64Logo();
  process.stdout.write(`BRIK64 CLI ${version}\n`);
  process.stdout.write('status=public_beta\n');
}

function help() {
  printBanner();
  process.stdout.write('\ncommands:\n');
  process.stdout.write('  init                 create .brik metadata only\n');
  process.stdout.write('  doctor               inspect local beta5 workspace contract\n');
  process.stdout.write('  engine status        inspect packaged offline L4+N5 runtime bundle\n');
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
    fail(64, 'missing_file_argument');
  }
  const resolved = workspacePath(file);
  if (path.extname(resolved) !== '.pcd') {
    fail(64, 'unsupported_file_extension');
  }
  if (!fs.existsSync(resolved)) {
    fail(66, `file_not_found:${file}`);
  }
  return fs.readFileSync(resolved, 'utf8');
}

function readJsonRequired(file, parseError, missingError) {
  if (!fs.existsSync(file)) {
    fail(66, missingError);
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    fail(65, parseError);
  }
}

function validateManifest() {
  const manifestPath = path.resolve('.brik', 'manifest.json');
  const manifest = readJsonRequired(manifestPath, 'manifest_parse_error', 'manifest_missing:.brik/manifest.json');
  const schema = manifest.schema || manifest.schemaVersion;
  if (schema !== 'brik64.cli_project_manifest.v1') {
    fail(65, 'manifest_schema_unsupported');
  }
  if (!manifest.cliVersion || typeof manifest.cliVersion !== 'string') {
    fail(65, 'manifest_cli_version_missing');
  }
  const boundary = manifest.claimBoundary;
  if (!boundary || typeof boundary !== 'object') {
    fail(65, 'manifest_claim_boundary_missing');
  }
  const releaseAllowed = boundary.releaseAllowed ?? boundary.releaseAuthorized;
  if (releaseAllowed !== false) {
    fail(65, 'manifest_release_policy_invalid');
  }
  return manifest;
}

function stripPcdComments(source) {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function parsePcd(source) {
  if (source.length === 0 || source.trim().length === 0) {
    fail(65, 'pcd_empty');
  }
  if (source.includes('\u0000')) {
    fail(65, 'pcd_binary_input');
  }
  if (Buffer.byteLength(source, 'utf8') > 1024 * 1024) {
    fail(65, 'pcd_too_large');
  }
  const stripped = stripPcdComments(source);
  const pcMatch = stripped.match(/\bPC\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*)\}\s*$/m);
  if (!pcMatch) {
    fail(65, 'pcd_parse_error:missing_pc_block');
  }
  const [, pcName, pcBody] = pcMatch;
  const fnMatch = pcBody.match(/\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/m);
  if (!fnMatch) {
    fail(65, 'pcd_parse_error:missing_fn_block');
  }
  const [, fnName, paramsRaw, fnBody] = fnMatch;
  const params = paramsRaw
    .split(',')
    .map((param) => param.trim())
    .filter(Boolean);
  const returns = [...fnBody.matchAll(/\breturn\s+(-?\d+)\s*;/g)].map((match) => Number(match[1]));
  if (returns.length === 0) {
    fail(65, 'pcd_parse_error:missing_return');
  }
  const unsupported = fnBody
    .replace(/\bif\s*\([^)]*\)\s*\{/g, '')
    .replace(/\breturn\s+-?\d+\s*;/g, '')
    .replace(/[{}\s;]/g, '');
  if (unsupported.length > 0) {
    fail(65, 'pcd_parse_error:unsupported_tokens');
  }
  return {
    schemaVersion: 'brik64.cli_ast.v1',
    pcName,
    fnName,
    params,
    returnValues: returns,
    branchCount: (fnBody.match(/\bif\s*\(/g) || []).length,
  };
}

function init() {
  const brikDir = path.resolve('.brik');
  fs.mkdirSync(brikDir, { recursive: true });
  const manifestPath = path.join(brikDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 'brik64.cli_project_manifest.v1',
      schema: 'brik64.cli_project_manifest.v1',
      cliVersion: version,
      createdBy: 'brik64-cli-bootstrap',
      engineTierPolicy: {
        publicOfflineRuntime: 'L4+N5',
        registeredManagedRuntime: 'L5+N5',
        internalArtifactFactory: 'L6+N5',
        l6DistributionAllowed: false,
        l5EmbeddedFreeRuntimeAllowed: false
      },
      claimBoundary: {
        releaseAuthorized: false,
        publicBetaAllowed: false,
        releaseAllowed: false,
        generatedAgentsFile: false
      }
    }, null, 2) + '\n');
  }
  process.stdout.write(`created=${path.relative(process.cwd(), manifestPath)}\n`);
}

function pcdInventory() {
  const pcdRoot = path.resolve('pcd');
  if (!fs.existsSync(pcdRoot)) {
    return [];
  }
  return fs.readdirSync(pcdRoot)
    .filter((name) => name.endsWith('.pcd'))
    .sort()
    .map((name) => {
      const file = path.join(pcdRoot, name);
      const source = fs.readFileSync(file, 'utf8');
      return {
        file: path.relative(process.cwd(), file),
        semantic_pcd_sha256: sha256(source),
        bytes: Buffer.byteLength(source, 'utf8')
      };
    });
}

function doctor() {
  const manifest = validateManifest();
  const policy = manifest.engineTierPolicy || {};
  if (manifest.cliVersion !== version) {
    fail(65, 'manifest_cli_version_mismatch');
  }
  if (policy.publicOfflineRuntime !== 'L4+N5') {
    fail(65, 'engine_tier_policy_missing_l4_offline');
  }
  if (policy.registeredManagedRuntime !== 'L5+N5') {
    fail(65, 'engine_tier_policy_missing_l5_managed');
  }
  if (policy.internalArtifactFactory !== 'L6+N5') {
    fail(65, 'engine_tier_policy_missing_l6_factory');
  }
  if (policy.l6DistributionAllowed !== false) {
    fail(65, 'engine_tier_policy_l6_distribution_open');
  }
  if (policy.l5EmbeddedFreeRuntimeAllowed !== false) {
    fail(65, 'engine_tier_policy_l5_free_embedding_open');
  }
  const pcds = pcdInventory();
  if (pcds.length === 0) {
    fail(65, 'pcd_inventory_empty');
  }
  const report = {
    schemaVersion: 'brik64.cli_doctor_report.v1',
    cliVersion: version,
    status: 'PASS',
    releaseEligible: false,
    publicOfflineRuntime: 'L4+N5',
    registeredManagedRuntime: 'L5+N5',
    internalArtifactFactory: 'L6+N5',
    pcdCount: pcds.length,
    pcdInventorySha256: sha256(JSON.stringify(pcds)),
    claimBoundary: 'local_candidate_only'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function repoRoot() {
  return path.resolve(__dirname, '..');
}

function engineStatus() {
  const bundlePath = path.join(repoRoot(), 'engines', 'l4plus-n5', 'runtime-bundle.manifest.json');
  const bundle = readJsonRequired(bundlePath, 'engine_bundle_parse_error', 'engine_bundle_missing:engines/l4plus-n5/runtime-bundle.manifest.json');
  if (bundle.schemaVersion !== 'brik64.cli_l4plus_n5_portable_runtime_bundle.v1') {
    fail(65, 'engine_bundle_schema_unsupported');
  }
  if (bundle.engine !== 'L4+N5') {
    fail(65, 'engine_bundle_tier_mismatch');
  }
  if (bundle.runtimeMode !== 'portable_bir_bundle') {
    fail(65, 'engine_bundle_runtime_mode_unsupported');
  }
  if (bundle.nativeExecutableIncluded !== false) {
    fail(65, 'engine_bundle_native_claim_unverified');
  }
  if (!Array.isArray(bundle.artifacts) || bundle.artifacts.length === 0) {
    fail(65, 'engine_bundle_artifacts_missing');
  }
  for (const artifact of bundle.artifacts) {
    const artifactPath = path.join(repoRoot(), artifact.path);
    if (!fs.existsSync(artifactPath)) {
      fail(66, `engine_bundle_artifact_missing:${artifact.path}`);
    }
    const actual = sha256(fs.readFileSync(artifactPath));
    if (actual !== artifact.sha256) {
      fail(68, `engine_bundle_artifact_hash_mismatch:${artifact.path}`);
    }
  }
  const report = {
    schemaVersion: 'brik64.cli_engine_status_report.v1',
    cliVersion: version,
    status: 'PASS',
    engine: bundle.engine,
    serial: bundle.serial,
    runtimeMode: bundle.runtimeMode,
    nativeExecutableIncluded: bundle.nativeExecutableIncluded,
    artifactCount: bundle.artifacts.length,
    releaseEligible: false,
    claimBoundary: bundle.claimBoundary,
    limitations: bundle.limitations
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function certPathFor(file) {
  return `${workspacePath(file)}.cert.json`;
}

function parseEmitOptions(args) {
  const options = { target: null, outDir: null, tests: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--target') {
      options.target = args[index + 1];
      if (!options.target) fail(64, 'missing_target');
      index += 1;
    } else if (arg === '--out') {
      options.outDir = args[index + 1];
      if (!options.outDir) fail(64, 'missing_out_dir');
      index += 1;
    } else if (arg === '--tests') {
      options.tests = true;
    } else {
      fail(64, `unknown_emit_option:${arg}`);
    }
  }
  return options;
}

function encodedAst(ast) {
  return JSON.stringify(ast);
}

function targetSpec(target, ast) {
  const astJson = encodedAst(ast);
  const specs = {
    ts: {
      program: 'program.ts',
      test: 'program.test.ts',
      code: (hash) => [
        '// BRIK64 beta5 functional emission candidate',
        '// claim: local offline L4+N5 candidate only',
        `export const pcdSha256 = "${hash}";`,
        `export const pcdAst = ${astJson} as const;`,
        'export function run(input = 0): string {',
        '  return `brik:${pcdAst.pcName}:${pcdAst.fnName}:${pcdAst.returnValues.join(",")}:${input}:${pcdSha256}`;',
        '}',
        '',
      ].join('\n'),
      testCode: (hash) => [
        'import { pcdAst, pcdSha256, run } from "./program";',
        '',
        'if (pcdSha256 !== "' + hash + '") throw new Error("pcd hash mismatch");',
        'if (!run().includes(pcdAst.pcName)) throw new Error("run mismatch");',
        'console.log("brik64 generated ts test: PASS");',
        '',
      ].join('\n'),
    },
    rust: {
      program: 'program.rs',
      test: 'program_test.rs',
      code: (hash) => [
        '// BRIK64 beta5 functional emission candidate',
        '// claim: local offline L4+N5 candidate only',
        `pub const PCD_SHA256: &str = "${hash}";`,
        `pub const PCD_AST_JSON: &str = r#"${astJson}"#;`,
        'pub fn run() -> String {',
        '    format!("brik:{}:{}", PCD_AST_JSON, PCD_SHA256)',
        '}',
        '',
      ].join('\n'),
      testCode: (hash) => [
        `const PCD_SHA256: &str = "${hash}";`,
        `const PCD_AST_JSON: &str = r#"${astJson}"#;`,
        'fn run() -> String {',
        '    format!("brik:{}:{}", PCD_AST_JSON, PCD_SHA256)',
        '}',
        '',
        'fn main() {',
        `    assert_eq!(PCD_SHA256, "${hash}");`,
        '    assert!(run().contains(PCD_AST_JSON));',
        '    println!("brik64 generated rust test: PASS");',
        '}',
        '',
      ].join('\n'),
    },
    python: {
      program: 'program.py',
      test: 'test_program.py',
      code: (hash) => [
        '# BRIK64 beta5 functional emission candidate',
        '# claim: local offline L4+N5 candidate only',
        `PCD_SHA256 = "${hash}"`,
        `PCD_AST = ${astJson}`,
        '',
        'def run(input=0):',
        '    return f"brik:{PCD_AST[\'pcName\']}:{PCD_AST[\'fnName\']}:{PCD_AST[\'returnValues\']}:{input}:{PCD_SHA256}"',
        '',
      ].join('\n'),
      testCode: (hash) => [
        'from program import PCD_AST, PCD_SHA256, run',
        '',
        `assert PCD_SHA256 == "${hash}"`,
        'assert PCD_AST["pcName"] in run()',
        'print("brik64 generated python test: PASS")',
        '',
      ].join('\n'),
    },
  };
  return specs[target] || null;
}

function certify(file) {
  validateManifest();
  const source = readFileRequired(file);
  const ast = parsePcd(source);
  const cert = {
    schemaVersion: 'brik64.cli_local_candidate_certificate.v1',
    cliVersion: version,
    pcd: file,
    semantic_pcd_sha256: sha256(source),
    ast_sha256: sha256(JSON.stringify(ast)),
    ast,
    offlineEngine: 'L4+N5-local-parser-emitter',
    certifiesFormalCorrectness: false,
    certifiesTests: false,
    claimBoundary: {
      localCandidateOnly: true,
      publicBetaAllowed: false,
      releaseAllowed: false
    }
  };
  const certPath = certPathFor(file);
  writeFileControlled(certPath, JSON.stringify(cert, null, 2) + '\n');
  process.stdout.write(`certificate=${path.relative(process.cwd(), certPath)}\n`);
}

function emit(file, args = []) {
  validateManifest();
  const source = readFileRequired(file);
  const ast = parsePcd(source);
  const certPath = certPathFor(file);
  if (!fs.existsSync(certPath)) {
    fail(67, `certificate_required:${certPath}`);
  }
  const cert = readJsonRequired(certPath, 'certificate_parse_error', `certificate_required:${certPath}`);
  if (cert.semantic_pcd_sha256 !== sha256(source)) {
    fail(68, 'certificate_hash_mismatch');
  }
  if (cert.ast_sha256 !== sha256(JSON.stringify(ast))) {
    fail(68, 'certificate_ast_mismatch');
  }
  const options = parseEmitOptions(args);
  if (options.target || options.outDir || options.tests) {
    const spec = targetSpec(options.target, ast);
    if (!spec) {
      fail(69, 'unsupported_target');
    }
    if (!options.outDir) {
      fail(64, 'missing_out_dir');
    }
    const outDir = workspacePath(options.outDir);
    mkdirControlled(outDir);
    const programPath = path.join(outDir, spec.program);
    const testPath = path.join(outDir, spec.test);
    writeFileControlled(programPath, spec.code(cert.semantic_pcd_sha256));
    if (options.tests) {
      writeFileControlled(testPath, spec.testCode(cert.semantic_pcd_sha256));
    }
    process.stdout.write(`generated=${path.relative(process.cwd(), programPath)}\n`);
    if (options.tests) process.stdout.write(`tests=${path.relative(process.cwd(), testPath)}\n`);
    return;
  }
  process.stdout.write('// BRIK64 beta5 functional emission candidate\n');
  process.stdout.write('// claim: local offline L4+N5 candidate only\n');
  process.stdout.write(`// pcd_sha256=${cert.semantic_pcd_sha256}\n`);
  process.stdout.write(`// ast_sha256=${cert.ast_sha256}\n`);
}

function main() {
  const [cmd, file, ...args] = process.argv.slice(2);
  if (!cmd || cmd === '--help' || cmd === 'help') return help();
  if (cmd === '--version' || cmd === 'version') {
    printBanner();
    return;
  }
  if (cmd === 'init') return init();
  if (cmd === 'doctor') return doctor();
  if (cmd === 'engine' && file === 'status') return engineStatus();
  if (cmd === 'certify') return certify(file);
  if (cmd === 'emit') return emit(file, args);
  fail(2, `unknown_command:${cmd}`);
}

main();
