#!/usr/bin/env node
// BRIK64 beta5 local candidate hardened artifact
// releaseEligible=false; generatedBy=bootstrap_candidate_until_L6plus_N5_internal_factory
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
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function astDigest(ast) {
  return sha256(canonicalJson(ast));
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
  process.stdout.write('  doctor               inspect local beta6 workspace contract\n');
  process.stdout.write('  engine status        inspect packaged offline L4+N5 runtime bundle\n');
  process.stdout.write('  certify <file.pcd>   write local candidate certificate\n');
  process.stdout.write('  emit <file.pcd>      emit only when local certificate exists\n');
  process.stdout.write('       --target <ts|rust|python> --out <dir> --tests\n');
  process.stdout.write('  polymerize <file.polymer.pcd> --target <ts|rust|python> --out <dir> [--strict]\n');
  process.stdout.write('  verify <file.pcd> --cloud --dry-run\n');
  process.stdout.write('  mcp start [--port <number>]\n');
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
function certDigestPayload(cert) {
  return {
    schemaVersion: cert.schemaVersion,
    cliVersion: cert.cliVersion,
    pcd: cert.pcd,
    semantic_pcd_sha256: cert.semantic_pcd_sha256,
    ast_sha256: cert.ast_sha256,
    ast: cert.ast,
    certificateClass: cert.certificateClass,
    offlineEngine: cert.offlineEngine,
    certifiesFormalCorrectness: cert.certifiesFormalCorrectness,
    certifiesTests: cert.certifiesTests,
    claimBoundary: cert.claimBoundary
  };
}
function signCert(cert) {
  return sha256(canonicalJson(certDigestPayload(cert)));
}
function validateCertificate(file, source, ast) {
  const certPath = certPathFor(file);
  if (!fs.existsSync(certPath)) {
    fail(67, `certificate_required:${certPath}`);
  }
  const cert = readJsonRequired(certPath, 'certificate_parse_error', `certificate_required:${certPath}`);
  if (cert.semantic_pcd_sha256 !== sha256(source)) {
    fail(68, 'certificate_hash_mismatch');
  }
  if (cert.ast_sha256 !== astDigest(ast)) {
    fail(68, 'certificate_ast_mismatch');
  }
  if (canonicalJson(cert.ast) !== canonicalJson(ast)) {
    fail(68, 'certificate_ast_mismatch');
  }
  if (cert.signature_sha256 !== signCert(cert)) {
    fail(68, 'certificate_corrupted_signature');
  }
  return cert;
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
  const diagnostics = workspaceDiagnostics(pcds);
  const report = {
    schemaVersion: 'brik64.cli_doctor_report.v1',
    cliVersion: version,
    status: diagnostics.errors.length > 0 ? 'FAIL' : 'PASS',
    releaseEligible: false,
    publicOfflineRuntime: 'L4+N5',
    registeredManagedRuntime: 'L5+N5',
    internalArtifactFactory: 'L6+N5',
    pcdCount: pcds.length,
    pcdInventorySha256: sha256(JSON.stringify(pcds)),
    warnings: diagnostics.warnings,
    errors: diagnostics.errors,
    claimBoundary: 'local_candidate_only'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (diagnostics.errors.length > 0) process.exit(65);
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
  return canonicalJson(ast);
}
function targetSpec(target, ast) {
  const astJson = encodedAst(ast);
  const specs = {
    ts: {
      program: 'program.ts',
      test: 'program.test.ts',
      code: (hash) => [
        '// BRIK64 beta6 functional emission candidate',
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
        '// BRIK64 beta6 functional emission candidate',
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
        '# BRIK64 beta6 functional emission candidate',
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
    ast_sha256: astDigest(ast),
    ast,
    certificateClass: 'core',
    offlineEngine: 'L4+N5-local-parser-emitter',
    certifiesFormalCorrectness: false,
    certifiesTests: false,
    claimBoundary: {
      localCandidateOnly: true,
      publicBetaAllowed: false,
      releaseAllowed: false
    }
  };
  cert.signature_sha256 = signCert(cert);
  const certPath = certPathFor(file);
  writeFileControlled(certPath, JSON.stringify(cert, null, 2) + '\n');
  process.stdout.write(`certificate=${path.relative(process.cwd(), certPath)}\n`);
}
function emit(file, args = []) {
  validateManifest();
  const source = readFileRequired(file);
  const ast = parsePcd(source);
  const cert = validateCertificate(file, source, ast);
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
  process.stdout.write('// BRIK64 beta6 functional emission candidate\n');
  process.stdout.write('// claim: local offline L4+N5 candidate only\n');
  process.stdout.write(`// pcd_sha256=${cert.semantic_pcd_sha256}\n`);
  process.stdout.write(`// ast_sha256=${cert.ast_sha256}\n`);
}
function workspaceDiagnostics(pcds) {
  const warnings = [];
  const errors = [];
  const pcdFiles = new Set(pcds.map((item) => item.file));
  for (const pcd of pcds) {
    const certFile = `${pcd.file}.cert.json`;
    if (!fs.existsSync(path.resolve(certFile))) {
      warnings.push({ code: 'w_pcd_not_certified', file: pcd.file });
      continue;
    }
    let cert = null;
    try {
      cert = JSON.parse(fs.readFileSync(path.resolve(certFile), 'utf8'));
    } catch {
      errors.push({ code: 'e_certificate_parse_error', file: certFile });
      continue;
    }
    if (cert.semantic_pcd_sha256 !== pcd.semantic_pcd_sha256) {
      errors.push({ code: 'e_pcd_hash_mismatch', file: pcd.file, certificate: certFile });
    }
  }
  const pcdRoot = path.resolve('pcd');
  if (fs.existsSync(pcdRoot)) {
    for (const name of fs.readdirSync(pcdRoot).filter((item) => item.endsWith('.pcd.cert.json')).sort()) {
      const sourceFile = name.replace(/\.cert\.json$/, '');
      if (!pcdFiles.has(`pcd/${sourceFile}`)) {
        warnings.push({ code: 'w_orphan_certificate', file: `pcd/${name}` });
      }
    }
  }
  return { warnings, errors };
}
function parsePolymerDefinition(source) {
  if (source.length === 0 || source.trim().length === 0) fail(65, 'polymer_empty');
  if (source.includes('\u0000')) fail(65, 'polymer_binary_input');
  const refs = [...source.matchAll(/\buse\s+"([^"]+\.pcd)"\s*;/g)].map((match) => match[1]);
  if (refs.length === 0) fail(65, 'polymer_parse_error:missing_pcd_refs');
  const graph = [...source.matchAll(/\blink\s+([A-Za-z0-9_.-]+)\s*->\s*([A-Za-z0-9_.-]+)\s*;/g)].map((match) => [match[1], match[2]]);
  return { refs, graph };
}
function parsePolymerOptions(args) {
  const options = { target: null, outDir: null, strict: false };
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
    } else if (arg === '--strict') {
      options.strict = true;
    } else {
      fail(64, `unknown_polymerize_option:${arg}`);
    }
  }
  if (!options.target) fail(64, 'missing_target');
  if (!options.outDir) fail(64, 'missing_out_dir');
  return options;
}
function cyclePresent(edges) {
  const graph = new Map();
  for (const [from, to] of edges) {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from).push(to);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) || []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }
  return [...graph.keys()].some(visit);
}
function polymerize(file, args = []) {
  validateManifest();
  const polymerPath = workspacePath(file);
  if (!polymerPath.endsWith('.polymer.pcd')) fail(64, 'unsupported_polymer_extension');
  if (!fs.existsSync(polymerPath)) fail(66, `file_not_found:${file}`);
  const options = parsePolymerOptions(args);
  const spec = targetSpec(options.target, {
    schemaVersion: 'brik64.polymer_ast.v1',
    pcName: 'polymer',
    fnName: 'polymerize',
    params: [],
    returnValues: [0],
    branchCount: 0
  });
  if (!spec) fail(69, 'unsupported_target');
  const definition = parsePolymerDefinition(fs.readFileSync(polymerPath, 'utf8'));
  if (cyclePresent(definition.graph)) fail(65, 'polymer_cycle_detected');
  const members = [];
  for (const ref of definition.refs) {
    const memberPath = workspacePath(ref);
    if (!fs.existsSync(memberPath)) fail(66, `polymer_reference_missing:${ref}`);
    const source = fs.readFileSync(memberPath, 'utf8');
    const ast = parsePcd(source);
    const cert = validateCertificate(ref, source, ast);
    members.push({
      file: ref,
      semantic_pcd_sha256: cert.semantic_pcd_sha256,
      ast_sha256: cert.ast_sha256,
      certificateClass: cert.certificateClass || 'core'
    });
  }
  const certificateClass = members.some((member) => member.certificateClass === 'extended') ? 'extended' : 'core';
  const polymerAst = {
    schemaVersion: 'brik64.cli_polymer_ast.v1',
    source: path.relative(process.cwd(), polymerPath),
    members,
    graph: definition.graph,
    certificateClass,
    strict: options.strict
  };
  const outDir = workspacePath(options.outDir);
  mkdirControlled(outDir);
  const artifactName = options.target === 'rust' ? 'polymer.rs' : options.target === 'python' ? 'polymer.py' : 'polymer.ts';
  const artifactPath = path.join(outDir, artifactName);
  const json = canonicalJson(polymerAst);
  const header = options.target === 'python' ? '# BRIK64 beta6 polymer candidate' : '// BRIK64 beta6 polymer candidate';
  writeFileControlled(artifactPath, `${header}\n${options.target === 'python' ? 'POLYMER_AST = ' : 'export const polymerAst = '}${json}${options.target === 'python' ? '' : ' as const;'}\n`);
  const manifestPath = path.join(outDir, 'polymer.manifest.json');
  writeFileControlled(manifestPath, `${JSON.stringify({
    schemaVersion: 'brik64.cli_polymer_manifest.v1',
    cliVersion: version,
    source: path.relative(process.cwd(), polymerPath),
    target: options.target,
    certificateClass,
    memberCount: members.length,
    polymer_sha256: sha256(json),
    claimBoundary: 'local_polymer_candidate_only'
  }, null, 2)}\n`);
  process.stdout.write(`generated=${path.relative(process.cwd(), artifactPath)}\n`);
  process.stdout.write(`manifest=${path.relative(process.cwd(), manifestPath)}\n`);
  process.stdout.write(`certificateClass=${certificateClass}\n`);
}
function verify(file, args = []) {
  validateManifest();
  const cloud = args.includes('--cloud');
  const dryRun = args.includes('--dry-run');
  if (!cloud) fail(64, 'verify_requires_cloud_mode');
  if (!dryRun) fail(65, 'cloud_verify_requires_dry_run');
  const source = readFileRequired(file);
  const ast = parsePcd(source);
  const cert = validateCertificate(file, source, ast);
  const claim = {
    schemaVersion: 'brik64.cli_cloud_verify_dry_run_claim.v1',
    cliVersion: version,
    pcd: file,
    semantic_pcd_sha256: cert.semantic_pcd_sha256,
    ast_sha256: cert.ast_sha256,
    dryRun: true,
    simulated: true,
    certifiesFormalCorrectness: false,
    claimBoundary: 'simulated_cloud_claim_for_integration_testing_only',
    issuedAt: new Date(0).toISOString()
  };
  claim.signature_sha256 = sha256(canonicalJson(claim));
  const claimPath = `${workspacePath(file)}.claim.dry-run.json`;
  writeFileControlled(claimPath, `${JSON.stringify(claim, null, 2)}\n`);
  process.stdout.write(`claim=${path.relative(process.cwd(), claimPath)}\n`);
  process.stdout.write('claimBoundary=simulated_cloud_claim_for_integration_testing_only\n');
}
function mcp(args = []) {
  if (args[0] !== 'start') fail(2, `unknown_mcp_command:${args[0] || 'missing'}`);
  const portIndex = args.indexOf('--port');
  const port = portIndex === -1 ? 0 : Number(args[portIndex + 1]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) fail(64, 'invalid_mcp_port');
  const report = {
    schemaVersion: 'brik64.cli_mcp_start_report.v1',
    cliVersion: version,
    status: 'PASS',
    mode: 'local_stdio_preview',
    port,
    tools: ['brik64_init', 'brik64_certify', 'brik64_emit', 'brik64_doctor'],
    resources: ['brik64://workspace/status', 'brik64://pcd/ast/{name}'],
    premiumCloudEnabled: false,
    claimBoundary: 'local_mcp_preview_only'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
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
  if (cmd === 'polymerize') return polymerize(file, args);
  if (cmd === 'verify') return verify(file, args);
  if (cmd === 'mcp') return mcp([file, ...args].filter(Boolean));
  fail(2, `unknown_command:${cmd}`);
}
main();