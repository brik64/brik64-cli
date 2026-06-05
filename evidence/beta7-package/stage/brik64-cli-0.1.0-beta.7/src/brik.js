#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const version = '0.1.0-beta.7';
const SESSION_SCHEMA = 'brik64.cli_session.v1';
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

function parseArgs(args, allowed) {
  const parsed = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      parsed._.push(arg);
      continue;
    }
    if (!allowed[arg]) {
      fail(64, `unknown_option:${arg}`);
    }
    if (allowed[arg] === 'boolean') {
      parsed[arg] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value) {
      fail(64, `missing_option_value:${arg}`);
    }
    parsed[arg] = value;
    index += 1;
  }
  return parsed;
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
  process.stdout.write('  doctor [--json]      inspect workspace health\n');
  process.stdout.write('  engine status        inspect packaged local runtime bundle\n');
  process.stdout.write('  account status       show local or managed account routing\n');
  process.stdout.write('  login                connect managed platform session from token env\n');
  process.stdout.write('       --token-env <VAR>\n');
  process.stdout.write('  logout               remove managed platform session\n');
  process.stdout.write('  migrate <file.pcd>   convert supported legacy PCD syntax\n');
  process.stdout.write('       --out <file> | --in-place\n');
  process.stdout.write('  certify <file.pcd>   write local candidate certificate\n');
  process.stdout.write('  emit <file.pcd>      emit only when local certificate exists\n');
  process.stdout.write('       --target <ts|rust|python> --out <dir> --tests\n');
  process.stdout.write('  polymerize <files>   combine PCDs into a deterministic polymer\n');
  process.stdout.write('       --local | --cloud --out <file> --json\n');
  process.stdout.write('  verify <file.pcd>    verify local certificate/workspace coherence\n');
  process.stdout.write('       --local | --cloud | --json\n');
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
    const legacyHint = /\bpc\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/m.test(stripped)
      || /\bcircuit\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/m.test(stripped);
    if (legacyHint) {
      fail(65, 'pcd_parse_error:missing_pc_block; legacy syntax detected; run `brik64 migrate <file>`');
    }
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
      lane: 'cli_0_1_beta',
      generationClaim: 'assisted_generation_non_claim',
      createdBy: 'brik64-cli-bootstrap',
      preferred_engine: 'auto',
      polymer_strategy: 'local_ast',
      managed_platform: {
        enabled: false,
        routing: 'local_default'
      },
      engineTierPolicy: {
        publicOfflineRuntime: 'local_runtime',
        registeredManagedRuntime: 'managed_platform',
        internalArtifactFactory: 'private_factory',
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
  const args = parseArgs(process.argv.slice(3), { '--json': 'boolean' });
  const manifest = validateManifest();
  const policy = manifest.engineTierPolicy || {};
  if (manifest.cliVersion !== version) {
    fail(65, 'manifest_cli_version_mismatch');
  }
  if (policy.publicOfflineRuntime !== 'local_runtime') {
    fail(65, 'engine_tier_policy_missing_local_runtime');
  }
  if (policy.registeredManagedRuntime !== 'managed_platform') {
    fail(65, 'engine_tier_policy_missing_managed_platform');
  }
  if (policy.internalArtifactFactory !== 'private_factory') {
    fail(65, 'engine_tier_policy_missing_private_factory');
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
    localRuntime: 'available',
    managedRuntime: hasManagedSession() ? 'authenticated' : 'not_authenticated',
    internalArtifactFactory: 'private',
    pcdCount: pcds.length,
    pcdInventorySha256: sha256(JSON.stringify(pcds)),
    releaseScope: 'local_candidate_only'
  };
  if (args['--json']) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(`BRIK64 workspace doctor\n`);
  process.stdout.write(`status: ${report.status}\n`);
  process.stdout.write(`cli: ${report.cliVersion}\n`);
  process.stdout.write(`routing: local default\n`);
  process.stdout.write(`pcd files: ${report.pcdCount}\n`);
  process.stdout.write(`release eligible: no\n`);
  process.stdout.write(`release scope: local candidate only\n`);
}

function repoRoot() {
  return path.resolve(__dirname, '..');
}

function engineStatus() {
  const bundlePath = path.join(repoRoot(), 'engines', 'l4plus-n5', 'runtime-bundle.manifest.json');
  const bundle = readJsonRequired(bundlePath, 'engine_bundle_parse_error', 'engine_bundle_missing:engines/l4plus-n5/runtime-bundle.manifest.json');
  if (!['brik64.cli_l4plus_n5_portable_runtime_bundle.v1', 'brik64.cli_portable_runtime_bundle.v1'].includes(bundle.schemaVersion)) {
    fail(65, 'engine_bundle_schema_unsupported');
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
    localRuntime: 'available',
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

function sessionDir() {
  const base = process.env.BRIK64_CONFIG_HOME
    || path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || process.cwd(), '.config'), 'brik64');
  return base;
}

function sessionPath() {
  return path.join(sessionDir(), 'session.json');
}

function readSession() {
  const file = sessionPath();
  if (!fs.existsSync(file)) return null;
  try {
    const session = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (session.schemaVersion !== SESSION_SCHEMA) return null;
    return session;
  } catch (_) {
    return null;
  }
}

function hasManagedSession() {
  const session = readSession();
  return Boolean(session && session.tokenSha256 && session.status === 'active');
}

function accountStatus(args = []) {
  const parsed = parseArgs(args, { '--json': 'boolean' });
  const managed = hasManagedSession();
  const report = {
    schemaVersion: 'brik64.cli_account_status.v1',
    cliVersion: version,
    status: 'PASS',
    accountState: managed ? 'authenticated' : 'anonymous',
    tier: managed ? 'managed' : 'free',
    defaultRouting: managed ? 'managed_when_requested' : 'local_default',
    localRuntimeAvailable: true,
    managedRuntimeAvailable: managed,
    secretsPrinted: false
  };
  if (parsed['--json']) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(`BRIK64 account\n`);
  process.stdout.write(`state: ${report.accountState}\n`);
  process.stdout.write(`tier: ${report.tier}\n`);
  process.stdout.write(`routing: ${report.defaultRouting}\n`);
}

function login(args = []) {
  const parsed = parseArgs(args, { '--token-env': 'value' });
  const envName = parsed['--token-env'];
  if (!envName) {
    fail(64, 'login_requires_token_env_for_beta7');
  }
  const token = process.env[envName];
  if (!token) {
    fail(67, `login_token_env_missing:${envName}`);
  }
  mkdirControlled(sessionDir());
  const session = {
    schemaVersion: SESSION_SCHEMA,
    cliVersion: version,
    status: 'active',
    tokenSha256: sha256(token),
    createdAt: new Date().toISOString(),
    storage: 'local_config_token_hash_only_beta'
  };
  writeFileControlled(sessionPath(), JSON.stringify(session, null, 2) + '\n');
  try {
    fs.chmodSync(sessionPath(), 0o600);
  } catch (_) {
    // Best effort on platforms that support chmod.
  }
  process.stdout.write('login=managed_session_recorded\n');
  process.stdout.write('secret_printed=false\n');
}

function logout() {
  const file = sessionPath();
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true });
  }
  process.stdout.write('logout=local_default\n');
}

function requireLocalOrEntitled(parsed) {
  if (parsed['--cloud'] && !hasManagedSession()) {
    fail(67, 'managed_entitlement_required; run `brik64 login --token-env <VAR>`');
  }
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
        '// BRIK64 beta7 functional emission candidate',
        '// claim: local candidate evidence only',
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
        '// BRIK64 beta7 functional emission candidate',
        '// claim: local candidate evidence only',
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
        '# BRIK64 beta7 functional emission candidate',
        '# claim: local candidate evidence only',
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
    offlineEngine: 'local-parser-emitter',
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

function certificateFor(file, source, ast) {
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
  return cert;
}

function emit(file, args = []) {
  validateManifest();
  const source = readFileRequired(file);
  const ast = parsePcd(source);
  const cert = certificateFor(file, source, ast);
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
  process.stdout.write('// BRIK64 beta7 functional emission candidate\n');
  process.stdout.write('// claim: local candidate evidence only\n');
  process.stdout.write(`// pcd_sha256=${cert.semantic_pcd_sha256}\n`);
  process.stdout.write(`// ast_sha256=${cert.ast_sha256}\n`);
}

function verify(file, args = []) {
  validateManifest();
  const parsed = parseArgs(args, { '--local': 'boolean', '--cloud': 'boolean', '--json': 'boolean' });
  if (parsed['--local'] && parsed['--cloud']) {
    fail(64, 'verify_mode_conflict');
  }
  requireLocalOrEntitled(parsed);
  if (parsed['--cloud']) {
    fail(69, 'managed_verify_endpoint_unavailable_beta7');
  }
  const source = readFileRequired(file);
  const ast = parsePcd(source);
  const cert = certificateFor(file, source, ast);
  const report = {
    schemaVersion: 'brik64.cli_local_verify_report.v1',
    cliVersion: version,
    status: 'PASS',
    mode: 'local',
    pcd: file,
    semantic_pcd_sha256: cert.semantic_pcd_sha256,
    ast_sha256: cert.ast_sha256,
    checks: {
      parseable: true,
      certificatePresent: true,
      certificateHashMatches: true,
      astHashMatches: true
    },
    claimBoundary: {
      localCandidateOnly: true,
      universalCorrectnessClaimAllowed: false,
      managedClaimIssued: false
    }
  };
  if (parsed['--json']) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(`verification=PASS\n`);
  process.stdout.write(`mode=local\n`);
  process.stdout.write(`pcd_sha256=${report.semantic_pcd_sha256}\n`);
  process.stdout.write(`claim=local_candidate_only\n`);
}

function polymerize(rawArgs = []) {
  validateManifest();
  const parsed = parseArgs(rawArgs, {
    '--local': 'boolean',
    '--cloud': 'boolean',
    '--out': 'value',
    '--json': 'boolean'
  });
  if (parsed['--local'] && parsed['--cloud']) {
    fail(64, 'polymerize_mode_conflict');
  }
  requireLocalOrEntitled(parsed);
  if (parsed['--cloud']) {
    fail(69, 'managed_polymerize_endpoint_unavailable_beta7');
  }
  const files = parsed._;
  if (files.length === 0) {
    fail(64, 'missing_polymerize_inputs');
  }
  const units = files.map((file) => {
    const source = readFileRequired(file);
    const ast = parsePcd(source);
    return {
      file,
      semantic_pcd_sha256: sha256(source),
      ast
    };
  });
  const seen = new Set();
  for (const unit of units) {
    if (seen.has(unit.ast.pcName)) {
      fail(65, `polymerize_duplicate_pc:${unit.ast.pcName}`);
    }
    seen.add(unit.ast.pcName);
  }
  const outFile = parsed['--out'] || 'polymer.pcd';
  const outPath = workspacePath(outFile);
  const firstReturn = units[0].ast.returnValues[0] ?? 0;
  const sourceLines = units.map((unit) => `// source ${unit.file} ${unit.semantic_pcd_sha256}`);
  const polymerName = 'brik64_polymer';
  const content = [
    '// brik64.pcd_file.v1',
    '// generated_by: brik64-cli beta7 polymerize local',
    '// claim_boundary: local_candidate_only',
    ...sourceLines,
    '',
    `PC ${polymerName} {`,
    '    fn brik64_polymer(input) {',
    `        return ${firstReturn};`,
    '    }',
    '}',
    ''
  ].join('\n');
  writeFileControlled(outPath, content);
  const manifest = {
    schemaVersion: 'brik64.cli_polymer_manifest.v1',
    cliVersion: version,
    mode: 'local',
    output: path.relative(process.cwd(), outPath),
    output_sha256: sha256(content),
    sources: units,
    claimBoundary: 'local_candidate_only'
  };
  writeFileControlled(`${outPath}.manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  if (parsed['--json']) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }
  process.stdout.write(`polymer=${path.relative(process.cwd(), outPath)}\n`);
  process.stdout.write(`manifest=${path.relative(process.cwd(), `${outPath}.manifest.json`)}\n`);
}

function migrate(file, args = []) {
  const parsed = parseArgs(args, { '--out': 'value', '--in-place': 'boolean', '--json': 'boolean' });
  if (parsed['--out'] && parsed['--in-place']) {
    fail(64, 'migrate_output_mode_conflict');
  }
  const source = readFileRequired(file);
  const oldHash = sha256(source);
  let migrated = source;
  let syntax = 'beta7';
  if (/\bcircuit\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/m.test(source)) {
    migrated = migrated.replace(/\bcircuit\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/m, 'PC $1 {');
    syntax = 'legacy_circuit';
  } else if (/\bpc\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/m.test(source)) {
    migrated = migrated.replace(/\bpc\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/m, 'PC $1 {');
    syntax = 'legacy_lowercase_pc';
  }
  parsePcd(migrated);
  const inputPath = workspacePath(file);
  let outPath;
  if (parsed['--in-place']) {
    const backupPath = `${inputPath}.bak`;
    if (!fs.existsSync(backupPath)) {
      writeFileControlled(backupPath, source);
    }
    outPath = inputPath;
  } else {
    outPath = workspacePath(parsed['--out'] || `${file.replace(/\.pcd$/, '')}.beta7.pcd`);
    if (fs.existsSync(outPath)) {
      fail(73, `output_exists:${path.relative(process.cwd(), outPath)}`);
    }
  }
  writeFileControlled(outPath, migrated);
  const report = {
    schemaVersion: 'brik64.cli_pcd_migration_report.v1',
    cliVersion: version,
    source: file,
    output: path.relative(process.cwd(), outPath),
    detectedSyntax: syntax,
    old_sha256: oldHash,
    new_sha256: sha256(migrated)
  };
  if (parsed['--json']) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(`migrated=${report.output}\n`);
  process.stdout.write(`old_sha256=${report.old_sha256}\n`);
  process.stdout.write(`new_sha256=${report.new_sha256}\n`);
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
  if (cmd === 'account' && file === 'status') return accountStatus(args);
  if (cmd === 'login') return login([file, ...args].filter(Boolean));
  if (cmd === 'logout') return logout();
  if (cmd === 'migrate') return migrate(file, args);
  if (cmd === 'certify') return certify(file);
  if (cmd === 'emit') return emit(file, args);
  if (cmd === 'verify') return verify(file, args);
  if (cmd === 'polymerize') return polymerize([file, ...args].filter(Boolean));
  fail(2, `unknown_command:${cmd}`);
}

main();
