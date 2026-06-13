#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { spawnSync } = require('child_process');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const version = '0.1.0-beta.14.4';
const SESSION_SCHEMA = 'brik64.cli_session.v1';
const TELEMETRY_SCHEMA = 'brik64.cli_telemetry_local_status.v1';
const ERROR_REPORT_SCHEMA = 'brik64.cli_error_report_local.v1';
const FEEDBACK_SCHEMA = 'brik64.cli_feedback_event.v1';
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

function redactValue(value) {
  return String(value || '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted_email]')
    .replace(/(token|secret|key|password)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/(?:ghp|github_pat|npm|pypi|sk|op)_[A-Za-z0-9_=-]{12,}/g, '[redacted_secret]')
    .replace(/\/(?:Users|home|var|tmp|private|Volumes)\/[^\s"']+/g, '[redacted_path]')
    .replace(new RegExp(process.cwd().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[workspace]');
}

function writeLastErrorReport(message) {
  try {
    const brikDir = path.resolve('.brik');
    if (!fs.existsSync(brikDir)) return;
    const reportDir = path.join(brikDir, 'error-reports');
    fs.mkdirSync(reportDir, { recursive: true });
    const command = process.argv.slice(2, 4).filter(Boolean).join(' ') || 'unknown';
    const report = {
      schemaVersion: ERROR_REPORT_SCHEMA,
      cliVersion: version,
      capturedAt: new Date().toISOString(),
      command,
      normalizedErrorCode: redactValue(String(message).split(/[;:\s]/)[0] || 'unknown_error'),
      redactedMessage: redactValue(message),
      rawSourceIncluded: false,
      rawPcdIncluded: false,
      absolutePathIncluded: false,
      networkSent: false
    };
    fs.writeFileSync(path.join(reportDir, 'last.json'), JSON.stringify(report, null, 2) + '\n');
  } catch (_) {
    // Error capture is best-effort and must never mask the original failure.
  }
}

function fail(code, message) {
  writeLastErrorReport(message);
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

function assertInsideWorkspace(resolved, errorCode = 64) {
  const cwd = path.resolve(process.cwd());
  if (resolved !== cwd && !resolved.startsWith(`${cwd}${path.sep}`)) {
    fail(errorCode, 'path_outside_workspace');
  }
}

function realpathIfExists(file) {
  try {
    return fs.realpathSync(file);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    fail(74, `filesystem_realpath_error:${error.code || 'unknown'}`);
  }
}

function workspacePath(inputPath, errorCode = 64, options = {}) {
  if (!inputPath || typeof inputPath !== 'string') {
    fail(errorCode, 'missing_path');
  }
  const resolved = path.resolve(inputPath);
  assertInsideWorkspace(resolved, errorCode);
  if (options.mustExist || options.realpath) {
    const real = realpathIfExists(resolved);
    if (!real) {
      if (options.mustExist) fail(66, `file_not_found:${inputPath}`);
      return resolved;
    }
    assertInsideWorkspace(real, errorCode);
    return real;
  }
  if (options.output) {
    if (fs.existsSync(resolved)) {
      const real = realpathIfExists(resolved);
      if (real) assertInsideWorkspace(real, errorCode);
    }
    const parent = path.dirname(resolved);
    const nearestExisting = fs.existsSync(parent) ? parent : findExistingParent(parent);
    const realParent = realpathIfExists(nearestExisting);
    if (realParent) assertInsideWorkspace(realParent, errorCode);
  }
  return resolved;
}

function findExistingParent(dir) {
  let current = path.resolve(dir);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
  return current;
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

function bannerSuppressed() {
  return globalThis.__BRIK64_QUIET === true
    || process.env.BRIK64_NO_BANNER === '1'
    || !process.stdout.isTTY;
}

function printBanner() {
  if (bannerSuppressed()) return;
  printBrik64Logo();
  process.stdout.write(`BRIK64 CLI ${version}\n`);
  process.stdout.write('status=public_beta\n');
}

const EXIT_CODES = [
  ['0', 'success'],
  ['2', 'unknown command'],
  ['64', 'policy or option gate'],
  ['65', 'PCD parse or validation error'],
  ['66', 'file not found'],
  ['67', 'certificate required'],
  ['68', 'hash mismatch'],
  ['69', 'managed endpoint unavailable'],
  ['70', 'internal guarded error'],
  ['73', 'output exists'],
  ['74', 'filesystem error']
];

const CORE_MONOMERS = [
  ['MC_00', 'ADD8', 'Arithmetic', ['u8', 'u8'], 'u8', 'add', true],
  ['MC_01', 'SUB8', 'Arithmetic', ['u8', 'u8'], 'u8', 'sub', true],
  ['MC_02', 'MUL8', 'Arithmetic', ['u8', 'u8'], 'u8', 'mul', true],
  ['MC_03', 'DIV8', 'Arithmetic', ['u8', 'u8'], 'tuple_u8_u8', 'div_tuple', false],
  ['MC_04', 'INC', 'Arithmetic', ['u8'], 'u8', 'inc', true],
  ['MC_05', 'DEC', 'Arithmetic', ['u8'], 'u8', 'dec', true],
  ['MC_06', 'ABS', 'Arithmetic', ['i8'], 'u8', 'abs', true],
  ['MC_07', 'CLAMP', 'Arithmetic', ['u8', 'u8', 'u8'], 'u8', 'clamp', true],
  ['MC_08', 'AND8', 'Logic', ['u8', 'u8'], 'u8', 'and', true],
  ['MC_09', 'OR8', 'Logic', ['u8', 'u8'], 'u8', 'or', true],
  ['MC_10', 'XOR8', 'Logic', ['u8', 'u8'], 'u8', 'xor', true],
  ['MC_11', 'NOT8', 'Logic', ['u8'], 'u8', 'not', true],
  ['MC_12', 'SHL', 'Logic', ['u8', 'u8'], 'u8', 'shl', true],
  ['MC_13', 'SHR', 'Logic', ['u8', 'u8'], 'u8', 'shr', true],
  ['MC_14', 'ROL', 'Logic', ['u8', 'u8'], 'u8', 'rol', true],
  ['MC_15', 'ROR', 'Logic', ['u8', 'u8'], 'u8', 'ror', true],
  ['MC_16', 'LOAD', 'Memory', ['u64'], 'u8', 'effect_boundary', false],
  ['MC_17', 'STORE', 'Memory', ['u64', 'u8'], 'unit', 'effect_boundary', false],
  ['MC_18', 'PUSH', 'Memory', ['u8'], 'unit', 'effect_boundary', false],
  ['MC_19', 'POP', 'Memory', [], 'u8', 'effect_boundary', false],
  ['MC_20', 'PEEK', 'Memory', [], 'u8', 'effect_boundary', false],
  ['MC_21', 'SWAP', 'Memory', [], 'unit', 'effect_boundary', false],
  ['MC_22', 'DUP', 'Memory', [], 'u8', 'effect_boundary', false],
  ['MC_23', 'DROP', 'Memory', [], 'unit', 'effect_boundary', false],
  ['MC_24', 'IF', 'Control', ['bool'], 'unit', 'effect_boundary', false],
  ['MC_25', 'LOOP', 'Control', ['u8'], 'unit', 'effect_boundary', false],
  ['MC_26', 'JUMP', 'Control', ['u64'], 'unit', 'effect_boundary', false],
  ['MC_27', 'CALL', 'Control', ['u64'], 'unit', 'effect_boundary', false],
  ['MC_28', 'RET', 'Control', [], 'unit', 'effect_boundary', false],
  ['MC_29', 'BREAK', 'Control', [], 'unit', 'effect_boundary', false],
  ['MC_30', 'CONTINUE', 'Control', [], 'unit', 'effect_boundary', false],
  ['MC_31', 'NOP', 'Control', [], 'unit', 'effect_boundary', false],
  ['MC_32', 'READ', 'IO', ['u64'], 'u8', 'effect_boundary', false],
  ['MC_33', 'WRITE', 'IO', ['u64', 'u8'], 'bool', 'effect_boundary', false],
  ['MC_34', 'SEEK', 'IO', ['u64'], 'bool', 'effect_boundary', false],
  ['MC_35', 'FLUSH', 'IO', [], 'bool', 'effect_boundary', false],
  ['MC_36', 'OPEN', 'IO', ['string'], 'u64', 'effect_boundary', false],
  ['MC_37', 'CLOSE', 'IO', ['u64'], 'bool', 'effect_boundary', false],
  ['MC_38', 'EOF', 'IO', [], 'bool', 'effect_boundary', false],
  ['MC_39', 'ERR', 'IO', [], 'u8', 'effect_boundary', false],
  ['MC_40', 'CONCAT', 'Strings', ['string', 'string'], 'string', 'effect_boundary', false],
  ['MC_41', 'SPLIT', 'Strings', ['string', 'string'], 'list_string', 'effect_boundary', false],
  ['MC_42', 'SUBSTR', 'Strings', ['string', 'u64', 'u64'], 'string', 'effect_boundary', false],
  ['MC_43', 'LEN', 'Strings', ['string'], 'u64', 'effect_boundary', false],
  ['MC_44', 'UPPER', 'Strings', ['string'], 'string', 'effect_boundary', false],
  ['MC_45', 'LOWER', 'Strings', ['string'], 'string', 'effect_boundary', false],
  ['MC_46', 'TRIM', 'Strings', ['string'], 'string', 'effect_boundary', false],
  ['MC_47', 'MATCH', 'Strings', ['string', 'string'], 'bool', 'effect_boundary', false],
  ['MC_48', 'HASH', 'Crypto', ['bytes'], 'bytes32', 'effect_boundary', false],
  ['MC_49', 'ENCRYPT', 'Crypto', ['bytes', 'bytes32'], 'bytes', 'effect_boundary', false],
  ['MC_50', 'DECRYPT', 'Crypto', ['bytes', 'bytes32'], 'bytes', 'effect_boundary', false],
  ['MC_51', 'SIGN', 'Crypto', ['bytes', 'bytes32'], 'bytes64', 'effect_boundary', false],
  ['MC_52', 'VERIFY', 'Crypto', ['bytes', 'bytes64', 'bytes32'], 'bool', 'effect_boundary', false],
  ['MC_53', 'RNG', 'Crypto', ['u64'], 'bytes', 'effect_boundary', false],
  ['MC_54', 'DERIVE', 'Crypto', ['bytes32', 'string'], 'bytes32', 'effect_boundary', false],
  ['MC_55', 'SEAL', 'Crypto', ['bytes', 'bytes32'], 'bytes', 'effect_boundary', false],
  ['MC_56', 'TIME', 'System', [], 'u64', 'effect_boundary', false],
  ['MC_57', 'CPU', 'System', [], 'u8', 'effect_boundary', false],
  ['MC_58', 'MEM', 'System', [], 'u64', 'effect_boundary', false],
  ['MC_59', 'DISK', 'System', [], 'u64', 'effect_boundary', false],
  ['MC_60', 'NET', 'System', ['string'], 'bool', 'effect_boundary', false],
  ['MC_61', 'PID', 'System', [], 'u64', 'effect_boundary', false],
  ['MC_62', 'UID', 'System', [], 'u64', 'effect_boundary', false],
  ['MC_63', 'ENV', 'System', ['string'], 'string', 'effect_boundary', false]
].map(([id, name, family, params, returnType, operation, executable]) => ({
  id,
  name,
  key: `${id}.${name}`,
  family,
  params,
  returnType,
  operation,
  executable,
  scope: 'core'
}));

const LEGACY_MONOMER_ALIASES = {
  'MC_04.MOD8': { id: 'MC_04', name: 'MOD8', key: 'MC_04.MOD8', family: 'Arithmetic', params: ['u8', 'u8'], returnType: 'u8', operation: 'mod', executable: true, scope: 'core', legacyAlias: true }
};

const EXTENDED_MONOMERS = [
  ['MC_64', 'FADD', 'Float64', ['f64', 'f64'], 'f64', 'fadd', true, 'contract_local'],
  ['MC_65', 'FSUB', 'Float64', ['f64', 'f64'], 'f64', 'fsub', true, 'contract_local'],
  ['MC_66', 'FMUL', 'Float64', ['f64', 'f64'], 'f64', 'fmul', true, 'contract_local'],
  ['MC_67', 'FDIV', 'Float64', ['f64', 'f64'], 'f64', 'fdiv', true, 'contract_local'],
  ['MC_68', 'FABS', 'Float64', ['f64'], 'f64', 'fabs', true, 'contract_local'],
  ['MC_69', 'FNEG', 'Float64', ['f64'], 'f64', 'fneg', true, 'contract_local'],
  ['MC_70', 'FSQRT', 'Float64', ['f64'], 'f64', 'fsqrt', true, 'contract_local'],
  ['MC_71', 'FMOD', 'Float64', ['f64', 'f64'], 'f64', 'fmod', true, 'contract_local'],
  ['MC_72', 'SIN', 'Math', ['f64'], 'f64', 'sin', true, 'contract_local'],
  ['MC_73', 'COS', 'Math', ['f64'], 'f64', 'cos', true, 'contract_local'],
  ['MC_74', 'TAN', 'Math', ['f64'], 'f64', 'tan', true, 'contract_local'],
  ['MC_75', 'ATAN2', 'Math', ['f64', 'f64'], 'f64', 'atan2', true, 'contract_local'],
  ['MC_76', 'LOG', 'Math', ['f64'], 'f64', 'log', true, 'contract_local'],
  ['MC_77', 'EXP', 'Math', ['f64'], 'f64', 'exp', true, 'contract_local'],
  ['MC_78', 'POW', 'Math', ['f64', 'f64'], 'f64', 'pow', true, 'contract_local'],
  ['MC_79', 'FLOOR', 'Math', ['f64'], 'i64', 'floor', true, 'contract_local'],
  ['MC_80', 'TCP_CONN', 'Network', ['string', 'u16'], 'u64', 'external_boundary', true, 'contract_external'],
  ['MC_81', 'TCP_SEND', 'Network', ['u64', 'bytes'], 'u64', 'external_boundary', true, 'contract_external'],
  ['MC_82', 'TCP_RECV', 'Network', ['u64', 'u64'], 'bytes', 'external_boundary', true, 'contract_external'],
  ['MC_83', 'UDP_SEND', 'Network', ['string', 'u16', 'bytes'], 'bool', 'external_boundary', true, 'contract_external'],
  ['MC_84', 'DNS', 'Network', ['string'], 'string', 'external_boundary', true, 'contract_external'],
  ['MC_85', 'HTTP_GET', 'Network', ['string'], 'tuple_u16_string', 'external_boundary', true, 'contract_external'],
  ['MC_86', 'HTTP_POST', 'Network', ['string', 'string'], 'tuple_u16_string', 'external_boundary', true, 'contract_external'],
  ['MC_87', 'TLS', 'Network', ['u64'], 'u64', 'external_boundary', true, 'contract_external'],
  ['MC_88', 'FB_NEW', 'Graphics', ['u32', 'u32'], 'u64', 'contract_handle', true, 'contract_external'],
  ['MC_89', 'FB_PIXEL', 'Graphics', ['u64', 'u32', 'u32', 'u32'], 'unit', 'contract_unit', true, 'contract_external'],
  ['MC_90', 'FB_READ', 'Graphics', ['u64', 'u32', 'u32'], 'u32', 'contract_u32', true, 'contract_external'],
  ['MC_91', 'FB_FILL', 'Graphics', ['u64', 'u32'], 'unit', 'contract_unit', true, 'contract_external'],
  ['MC_92', 'FB_COPY', 'Graphics', ['u64', 'u64'], 'unit', 'contract_unit', true, 'contract_external'],
  ['MC_93', 'FB_FLUSH', 'Graphics', ['u64'], 'unit', 'contract_unit', true, 'contract_external'],
  ['MC_94', 'INPUT_POLL', 'Graphics', [], 'bool', 'contract_bool', true, 'contract_external'],
  ['MC_95', 'INPUT_STATE', 'Graphics', ['u32'], 'u64', 'contract_u64', true, 'contract_external'],
  ['MC_96', 'AU_NEW', 'Audio', ['u32', 'u16', 'u16'], 'u64', 'contract_handle', true, 'contract_external'],
  ['MC_97', 'AU_WRITE', 'Audio', ['u64', 'bytes'], 'u64', 'contract_u64', true, 'contract_external'],
  ['MC_98', 'AU_READ', 'Audio', ['u64', 'u64'], 'bytes', 'contract_bytes', true, 'contract_external'],
  ['MC_99', 'AU_PLAY', 'Audio', ['u64'], 'bool', 'contract_bool', true, 'contract_external'],
  ['MC_100', 'AU_STOP', 'Audio', ['u64'], 'unit', 'contract_unit', true, 'contract_external'],
  ['MC_101', 'AU_MIX', 'Audio', ['bytes', 'bytes'], 'bytes', 'contract_bytes', true, 'contract_external'],
  ['MC_102', 'AU_SAMPLE', 'Audio', ['u64', 'u64'], 'bytes', 'contract_bytes', true, 'contract_external'],
  ['MC_103', 'AU_STATUS', 'Audio', ['u64'], 'u32', 'contract_u32', true, 'contract_external'],
  ['MC_104', 'DIR_LIST', 'Filesystem+', ['string'], 'list_string', 'external_boundary', true, 'contract_external'],
  ['MC_105', 'DIR_CREATE', 'Filesystem+', ['string'], 'bool', 'external_boundary', true, 'contract_external'],
  ['MC_106', 'DIR_DELETE', 'Filesystem+', ['string'], 'bool', 'external_boundary', true, 'contract_external'],
  ['MC_107', 'CHMOD', 'Filesystem+', ['string', 'u32'], 'bool', 'external_boundary', true, 'contract_external'],
  ['MC_108', 'CHOWN', 'Filesystem+', ['string', 'u32', 'u32'], 'bool', 'external_boundary', true, 'contract_external'],
  ['MC_109', 'LINK', 'Filesystem+', ['string', 'string'], 'bool', 'external_boundary', true, 'contract_external'],
  ['MC_110', 'WATCH', 'Filesystem+', ['string'], 'u64', 'external_boundary', true, 'contract_external'],
  ['MC_111', 'TEMP', 'Filesystem+', [], 'string', 'external_boundary', true, 'contract_external'],
  ['MC_112', 'SPAWN', 'Concurrency', ['u64'], 'u64', 'external_boundary', true, 'contract_external'],
  ['MC_113', 'JOIN', 'Concurrency', ['u64'], 'bytes', 'external_boundary', true, 'contract_external'],
  ['MC_114', 'CHAN_NEW', 'Concurrency', [], 'tuple_u64_u64', 'external_boundary', true, 'contract_external'],
  ['MC_115', 'CHAN_SEND', 'Concurrency', ['u64', 'bytes'], 'bool', 'external_boundary', true, 'contract_external'],
  ['MC_116', 'CHAN_RECV', 'Concurrency', ['u64'], 'bytes', 'external_boundary', true, 'contract_external'],
  ['MC_117', 'MUTEX', 'Concurrency', ['u64'], 'u64', 'external_boundary', true, 'contract_external'],
  ['MC_118', 'ATOMIC', 'Concurrency', ['u64', 'u64'], 'u64', 'external_boundary', true, 'contract_external'],
  ['MC_119', 'YIELD', 'Concurrency', [], 'unit', 'external_boundary', true, 'contract_external'],
  ['MC_120', 'FFI_LOAD', 'Interop', ['string'], 'u64', 'external_boundary', true, 'contract_external'],
  ['MC_121', 'FFI_CALL', 'Interop', ['u64', 'string', 'bytes'], 'bytes', 'external_boundary', true, 'contract_external'],
  ['MC_122', 'FFI_ALLOC', 'Interop', ['u64'], 'u64', 'external_boundary', true, 'contract_external'],
  ['MC_123', 'FFI_FREE', 'Interop', ['u64'], 'unit', 'external_boundary', true, 'contract_external'],
  ['MC_124', 'WASM_EXEC', 'Interop', ['bytes', 'string', 'bytes'], 'bytes', 'external_boundary', true, 'contract_external'],
  ['MC_125', 'PY_EVAL', 'Interop', ['string'], 'string', 'external_boundary', true, 'contract_external'],
  ['MC_126', 'JSON_PARSE', 'Interop', ['string'], 'bytes', 'contract_json_parse', true, 'contract_external'],
  ['MC_127', 'JSON_EMIT', 'Interop', ['bytes'], 'string', 'contract_json_emit', true, 'contract_external']
].map(([id, name, family, params, returnType, operation, executable, boundary]) => ({
  id,
  name,
  key: `${id}.${name}`,
  family,
  params,
  returnType,
  operation,
  executable,
  boundary,
  scope: 'extended'
}));

const MONOMERS = [...CORE_MONOMERS, ...EXTENDED_MONOMERS];
const MONOMER_BY_KEY = Object.fromEntries(MONOMERS.map((spec) => [spec.key, spec]));
const MONOMER_BY_ID = Object.fromEntries(MONOMERS.map((spec) => [spec.id, spec]));
const CORE_MONOMER_BY_KEY = Object.fromEntries(CORE_MONOMERS.map((spec) => [spec.key, spec]));
const CORE_MONOMER_BY_ID = Object.fromEntries(CORE_MONOMERS.map((spec) => [spec.id, spec]));

const COMMAND_HELP = {
  certify: [
    'certify <file.pcd>',
    'Writes a local candidate certificate beside the PCD.',
    'Example:',
    '  brik64 template --type gate --out pcd/order_gate.pcd',
    '  brik64 certify pcd/order_gate.pcd'
  ],
  explain: [
    'explain <file.pcd> [--json]',
    'Parses a PCD and reports PC, function, branch, import, and action diagnostics.',
    'Example:',
    '  brik64 explain pcd/order_gate.pcd'
  ],
  emit: [
    'emit <file.pcd> --target <ts|rust|python> --out <dir|file> [--tests]',
    'Emits executable local code only after a local candidate certificate exists.',
    'Example:',
    '  brik64 certify pcd/order_gate.pcd',
    '  brik64 emit pcd/order_gate.pcd --target ts --out out-ts --tests'
  ],
  lock: [
    'lock [--files <a.pcd,b.pcd>|<files...>] [--skip-errors] [--json]',
    'Writes brik64.lock.json for valid PCDs. Default mode fails closed on the first parse error.',
    'Example:',
    '  brik64 lock --files pcd/a.pcd,pdc/b.pcd --skip-errors --json'
  ],
  migrate: [
    'migrate <file.pcd> [--out <file>|--in-place] [--dry-run] [--force|-f] [--json]',
    'Converts supported legacy PCD syntax into the current PC/fn block form.',
    'Supported legacy inputs: lowercase pc/circuit blocks and pcd function wrappers.',
    'Example:',
    '  brik64 migrate old.pcd --dry-run --json'
  ],
  polymerize: [
    'polymerize <files.pcd...> [--local] [--inline] --out <file> [--json]',
    'Default local mode writes a root_dag_reference polymer. --inline writes all source functions into one PC.',
    'Example:',
    '  brik64 polymerize pcd/a.pcd pcd/b.pcd --inline --out polymer.pcd'
  ],
  lift: [
    'lift <js|ts|python> <path> --preview [--stub-only] [--include-source-comment] [--json]',
    'Creates local PCD candidates. By default Beta14.2 translates simple if/return patterns.',
    'Example:',
    '  brik64 lift js src/pricing.js --preview --json'
  ],
  doctor: [
    'doctor [--json]',
    'Checks manifest policy, PCD inventory, and PCD parse health.',
    'Example:',
    '  brik64 doctor --json'
  ],
  template: [
    'template --type <gate|utility|numeric-monomer> --out <file.pcd> [--force]',
    'Writes a starter PCD matching the public Beta14.2 parser profile.',
    'Example:',
    '  brik64 template --type numeric-monomer --out pcd/add8.pcd'
  ],
  update: [
    'update --check | --print-command | --install',
    'Checks brik64.com release metadata. --install updates only supported ~/.brik64/bin installs after SHA verification.',
    'Example:',
    '  brik64 update --check'
  ],
  skill: [
    'skill check-version [--path <SKILL.md>] [--json]',
    'Compares installed public BRIK64 skill text with this CLI version.',
    'Example:',
    '  brik64 skill check-version --json'
  ],
  monomers: [
    'monomers list --scope <core|extended|all> [--json]',
    'monomers explain MC_00.ADD8 [--json]',
    'monomers test --all [--target <registry|ts|python|rust>] [--json]',
    'Inspects the public monomer registry understood by this CLI.',
    'Example:',
    '  brik64 monomers explain MC_00.ADD8 --json',
    '  brik64 monomers test --all --json'
  ],
  'exit-codes': [
    'help exit-codes',
    'Shows process exit code meanings for CI and scripts.',
    ...EXIT_CODES.map(([code, meaning]) => `  ${code}  ${meaning}`)
  ]
};

function printCommandHelp(name) {
  const lines = COMMAND_HELP[name];
  if (!lines) fail(2, `unknown_help_topic:${name}`);
  printBanner();
  if (bannerSuppressed()) process.stdout.write(`BRIK64 CLI ${version}\nstatus=public_beta\n`);
  process.stdout.write(`\n${lines.join('\n')}\n`);
  if (name !== 'exit-codes') {
    process.stdout.write('\nCommon parser profile:\n');
    process.stdout.write('  PC name { fn name(input: i64) -> i64 { if (input > 0) return input; return 0; } }\n');
    process.stdout.write('  Core monomer calls use MC_XX.NAME(args). Effectful or non-scalar monomers fail closed unless a boundary exists.\n');
  }
}

function help(topic) {
  if (topic) return printCommandHelp(topic);
  printBanner();
  if (bannerSuppressed()) process.stdout.write(`BRIK64 CLI ${version}\nstatus=public_beta\n`);
  process.stdout.write('\ncommands:\n');
  process.stdout.write('  init                 create .brik metadata only\n');
  process.stdout.write('  doctor [--json]      inspect workspace health\n');
  process.stdout.write('  engine status        inspect packaged local runtime bundle\n');
  process.stdout.write('  account status       show local or managed account routing\n');
  process.stdout.write('  login                connect managed platform session from token env\n');
  process.stdout.write('       --token-env <VAR>\n');
  process.stdout.write('  logout               remove managed platform session\n');
  process.stdout.write('  migrate <file.pcd>   convert supported legacy PCD syntax\n');
  process.stdout.write('       --out <file> | --in-place [--force|-f]\n');
  process.stdout.write('  lift <js|ts|python> <path> --preview\n');
  process.stdout.write('       generate local PCD candidates without certification\n');
  process.stdout.write('  adoption report      summarize local lift preview evidence\n');
  process.stdout.write('       --json --out <file>\n');
  process.stdout.write('  explain <file.pcd>   explain parser/type/import diagnostics\n');
  process.stdout.write('       --json\n');
  process.stdout.write('  lock                 write brik64.lock.json for local hashes\n');
  process.stdout.write('       --files <files> --skip-errors --json\n');
  process.stdout.write('  certify <file.pcd>   write local candidate certificate\n');
  process.stdout.write('  emit <file.pcd>      emit only when local certificate exists\n');
  process.stdout.write('       --target <ts|rust|python> --out <dir> --tests\n');
  process.stdout.write('  polymerize <files>   combine PCDs into a deterministic polymer\n');
  process.stdout.write('       --local | --cloud --inline --out <file> --json\n');
  process.stdout.write('  verify <file.pcd>    verify local certificate/workspace coherence\n');
  process.stdout.write('       --local | --cloud | --json\n');
  process.stdout.write('  telemetry status     inspect local opt-in telemetry status\n');
  process.stdout.write('  telemetry enable|disable|export|purge-local|send\n');
  process.stdout.write('  telemetry explain    explain privacy boundaries\n');
  process.stdout.write('  feedback             write redacted local feedback preview\n');
  process.stdout.write('       --send          send only when telemetry is enabled\n');
  process.stdout.write('       --category <bug|docs|feature|install|compiler|sdk> --message <text>\n');
  process.stdout.write('  errors status        inspect local error-report status\n');
  process.stdout.write('  errors explain-last|send-last|purge-local\n');
  process.stdout.write('  template             scaffold a parser-supported PCD\n');
  process.stdout.write('       --type <gate|utility|numeric-monomer> --out <file.pcd>\n');
  process.stdout.write('  update               check or install the current public beta\n');
  process.stdout.write('       --check | --print-command | --install\n');
  process.stdout.write('  skill check-version  compare installed public skill text with CLI version\n');
  process.stdout.write('  monomers list|explain|test inspect parser-supported monomer registry\n');
  process.stdout.write('  help <command>       show command-specific examples\n');
  process.stdout.write('  help exit-codes      show CI exit code meanings\n');
  process.stdout.write('  --version            print version\n');
  process.stdout.write('\nPCD quick start:\n');
  process.stdout.write('  brik64 template --type gate --out pcd/order_gate.pcd\n');
  process.stdout.write('  brik64 certify pcd/order_gate.pcd\n');
  process.stdout.write('  brik64 emit pcd/order_gate.pcd --target ts --out out-ts --tests\n');
  process.stdout.write('\nEXIT CODES:\n');
  for (const [code, meaning] of EXIT_CODES) process.stdout.write(`  ${code}  ${meaning}\n`);
  process.stdout.write('\nreferences:\n');
  process.stdout.write('  docs                 https://docs.brik64.com/cli/install\n');
  process.stdout.write('  skill                https://github.com/brik64/brik64-tools-skills\n');
  process.stdout.write('  pcd standard         https://github.com/brik64/pcd-standard\n');
}

function readFileRequired(file) {
  if (!file) {
    fail(64, 'missing_file_argument');
  }
  const resolved = workspacePath(file, 64, { mustExist: true, realpath: true });
  if (path.extname(resolved) !== '.pcd') {
    fail(64, 'unsupported_file_extension');
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

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function tokenizeExpression(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    const two = source.slice(index, index + 2);
    if (['>=', '<=', '==', '!=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two });
      index += 2;
      continue;
    }
    if ('()+-*/%<>[],{}:.'.includes(char)) {
      tokens.push({ type: ['(', ')', '[', ']', '{', '}'].includes(char) ? 'paren' : (char === ',' ? 'comma' : (char === ':' ? 'colon' : (char === '.' ? 'dot' : 'op'))), value: char });
      index += 1;
      continue;
    }
    const number = source.slice(index).match(/^\d+(?:\.\d+)?/);
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const ident = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (ident) {
      tokens.push({ type: 'identifier', value: ident[0] });
      index += ident[0].length;
      continue;
    }
    fail(65, 'pcd_parse_error:unsupported_expression_token');
  }
  return tokens;
}

function parseExpression(source, params, imports = {}, constants = {}, localFunctions = {}, boundaryContracts = new Set()) {
  const tokens = tokenizeExpression(source);
  let index = 0;
  const precedence = {
    '||': 1,
    '&&': 2,
    '==': 3,
    '!=': 3,
    '>': 4,
    '<': 4,
    '>=': 4,
    '<=': 4,
    '+': 5,
    '-': 5,
    '*': 6,
    '/': 6,
    '%': 6,
  };

  function peek() {
    return tokens[index];
  }

  function consume(value) {
    const token = tokens[index];
    if (!token || (value && token.value !== value)) {
      fail(65, 'pcd_parse_error:malformed_expression');
    }
    index += 1;
    return token;
  }

  function parsePrimary() {
    const token = peek();
    if (!token) fail(65, 'pcd_parse_error:malformed_expression');
    let expression;
    if (token.type === 'number') {
      consume();
      expression = { type: 'NumberLiteral', value: token.value, numericType: Number.isInteger(token.value) ? 'i64' : 'f64' };
    } else if (token.type === 'identifier') {
      consume();
      if (/^MC_\d{2,3}$/.test(token.value) && peek() && peek().value === '.') {
        const monomerId = token.value;
        consume('.');
        const nameToken = consume();
        if (!nameToken || nameToken.type !== 'identifier') {
          fail(65, 'pcd_parse_error:unsupported_monomer_call; expected MC_XX.NAME(args)');
        }
        if (!peek() || peek().value !== '(') {
          fail(65, 'pcd_parse_error:unsupported_monomer_call; expected MC_XX.NAME(args)');
        }
        const monomerName = nameToken.value.toUpperCase();
        const spec = supportedMonomer(`${monomerId}.${monomerName}`);
        if (!spec) {
          const numericId = Number(monomerId.slice(3));
          if (Number.isInteger(numericId) && numericId >= 64 && numericId <= 127) {
            fail(65, `pcd_parse_error:extended_monomer_requires_contract:${monomerId}.${monomerName}`);
          }
          fail(65, `pcd_parse_error:unsupported_monomer_call:${monomerId}.${monomerName}`);
        }
        consume('(');
        const args = [];
        if (peek() && peek().value !== ')') {
          while (true) {
            args.push(parseBinary(1));
            if (peek() && peek().value === ',') {
              consume(',');
              if (peek() && peek().value === ')') fail(65, 'pcd_parse_error:trailing_call_comma');
              continue;
            }
            break;
          }
        }
        consume(')');
        if (args.length !== spec.arity) {
          fail(65, `pcd_parse_error:monomer_arity_mismatch:${spec.id}`);
        }
        if (!spec.executable && !boundaryContracts.has(spec.key)) {
          if (spec.operation === 'effect_boundary') {
            fail(65, `pcd_parse_error:effect_boundary_required:${spec.key}`);
          }
          if (spec.returnType && !['u8', 'i8', 'i32', 'i64', 'u64', 'bool'].includes(spec.returnType)) {
            fail(65, `pcd_parse_error:monomer_return_type_unsupported:${spec.key}`);
          }
          fail(65, `pcd_parse_error:effect_boundary_required:${spec.key}`);
        }
        if (spec.boundary === 'contract_external' && !boundaryContracts.has(spec.key) && !['contract_bool', 'contract_u32', 'contract_u64', 'contract_handle', 'contract_unit', 'contract_bytes', 'contract_json_parse', 'contract_json_emit'].includes(spec.operation)) {
          fail(65, `pcd_parse_error:external_effect_requires_extended_boundary:${spec.key}`);
        }
        expression = {
          type: 'MonomerCallExpression',
          monomer: spec.key,
          id: spec.id,
          name: spec.name,
          family: spec.family,
          operation: spec.operation,
          returnType: spec.returnType,
          boundary: boundaryContracts.has(spec.key) ? 'declared_boundary_contract' : (spec.boundary || (spec.scope === 'extended' ? 'contract_local' : 'pure_local_candidate')),
          legacyAlias: spec.legacyAlias === true,
          args
        };
      } else if (token.value === 'len' && peek() && peek().value === '(') {
        consume('(');
        const argument = parseBinary(1);
        consume(')');
        expression = { type: 'LenExpression', argument };
      } else if (token.value === 'has' && peek() && peek().value === '(') {
        consume('(');
        const object = parseBinary(1);
        consume(',');
        const keyToken = consume();
        if (keyToken.type !== 'identifier') {
          fail(65, 'pcd_parse_error:has_key_must_be_identifier');
        }
        consume(')');
        expression = { type: 'HasExpression', object, key: keyToken.value };
      } else if ((imports[token.value] || localFunctions[token.value]) && peek() && peek().value === '(') {
        const callee = token.value;
        const calleeSpec = imports[callee] || localFunctions[callee];
        consume('(');
        const args = [];
        if (peek() && peek().value !== ')') {
          while (true) {
            args.push(parseBinary(1));
            if (peek() && peek().value === ',') {
              consume(',');
              if (peek() && peek().value === ')') {
                fail(65, 'pcd_parse_error:trailing_call_comma');
              }
              continue;
            }
            break;
          }
        }
        consume(')');
        if (args.length !== calleeSpec.params.length) {
          fail(65, `pcd_parse_error:call_arity_mismatch:${callee}`);
        }
        expression = { type: 'CallExpression', callee, args, local: Boolean(localFunctions[callee]) };
      } else if (peek() && peek().value === '(') {
        fail(65, `pcd_parse_error:unknown_callable:${token.value}`);
      } else if (Object.prototype.hasOwnProperty.call(constants, token.value)) {
        expression = { type: 'ConstLiteral', name: token.value, value: constants[token.value] };
      } else if (!params.some((param) => param.name === token.value)) {
        fail(65, `pcd_parse_error:unknown_identifier:${token.value}`);
      } else {
        expression = { type: 'Identifier', name: token.value };
      }
    } else if (token.value === '-') {
      consume('-');
      expression = { type: 'UnaryExpression', operator: '-', argument: parsePrimary() };
    } else if (token.value === '(') {
      consume('(');
      expression = parseBinary(1);
      consume(')');
    } else if (token.value === '[') {
      consume('[');
      const elements = [];
      if (peek() && peek().value !== ']') {
        while (true) {
          elements.push(parseBinary(1));
          if (elements.length > 64) {
            fail(65, 'pcd_parse_error:list_literal_too_large');
          }
          if (peek() && peek().value === ',') {
            consume(',');
            if (peek() && peek().value === ']') {
              fail(65, 'pcd_parse_error:trailing_list_comma');
            }
            continue;
          }
          break;
        }
      }
      consume(']');
      expression = { type: 'ListLiteral', elements };
    } else if (token.value === '{') {
      consume('{');
      const entries = [];
      const seenKeys = new Set();
      if (peek() && peek().value !== '}') {
        while (true) {
          const keyToken = consume();
          if (keyToken.type !== 'identifier') {
            fail(65, 'pcd_parse_error:map_key_must_be_identifier');
          }
          if (seenKeys.has(keyToken.value)) {
            fail(65, `pcd_parse_error:duplicate_map_key:${keyToken.value}`);
          }
          seenKeys.add(keyToken.value);
          consume(':');
          entries.push({ key: keyToken.value, value: parseBinary(1) });
          if (entries.length > 64) {
            fail(65, 'pcd_parse_error:map_literal_too_large');
          }
          if (peek() && peek().value === ',') {
            consume(',');
            if (peek() && peek().value === '}') {
              fail(65, 'pcd_parse_error:trailing_map_comma');
            }
            continue;
          }
          break;
        }
      }
      consume('}');
      expression = { type: 'MapLiteral', entries };
    } else {
      fail(65, 'pcd_parse_error:malformed_expression');
    }
    while (peek() && ['[', '.'].includes(peek().value)) {
      if (peek().value === '[') {
        consume('[');
        const indexExpression = parseBinary(1);
        consume(']');
        expression = { type: 'IndexExpression', object: expression, index: indexExpression };
      } else {
        consume('.');
        const keyToken = consume();
        if (keyToken.type !== 'identifier') {
          fail(65, 'pcd_parse_error:member_key_must_be_identifier');
        }
        expression = { type: 'MemberExpression', object: expression, key: keyToken.value };
      }
    }
    return expression;
  }

  function parseBinary(minPrecedence) {
    let left = parsePrimary();
    while (peek() && peek().type === 'op' && precedence[peek().value] >= minPrecedence) {
      const operator = consume().value;
      const operatorPrecedence = precedence[operator];
      const right = parseBinary(operatorPrecedence + 1);
      left = { type: 'BinaryExpression', operator, left, right };
    }
    return left;
  }

  const expression = parseBinary(1);
  if (index !== tokens.length) {
    fail(65, 'pcd_parse_error:malformed_expression');
  }
  return expression;
}

function supportedMonomer(key) {
  const spec = MONOMER_BY_KEY[key] || LEGACY_MONOMER_ALIASES[key] || null;
  return spec ? { ...spec, arity: spec.params.length } : null;
}

function parseStatements(body, params, imports = {}, constants = {}, localFunctions = {}, boundaryContracts = new Set()) {
  const statements = [];
  let index = 0;

  function skipWhitespace() {
    while (index < body.length && /\s/.test(body[index])) index += 1;
  }

  function readBalanced(openChar, closeChar) {
    if (body[index] !== openChar) fail(65, 'pcd_parse_error:malformed_block');
    let depth = 0;
    const start = index;
    for (; index < body.length; index += 1) {
      if (body[index] === openChar) depth += 1;
      if (body[index] === closeChar) {
        depth -= 1;
        if (depth === 0) {
          const content = body.slice(start + 1, index);
          index += 1;
          return content;
        }
      }
    }
    fail(65, 'pcd_parse_error:unclosed_block');
  }

  while (index < body.length) {
    skipWhitespace();
    if (index >= body.length) break;
    if (body.slice(index).startsWith('return')) {
      index += 'return'.length;
      const semi = body.indexOf(';', index);
      if (semi === -1) fail(65, 'pcd_parse_error:missing_return_semicolon');
      const value = body.slice(index, semi).trim();
      if (!value) fail(65, 'pcd_parse_error:missing_return_value');
      statements.push({ type: 'ReturnStatement', argument: parseExpression(value, params, imports, constants, localFunctions, boundaryContracts) });
      index = semi + 1;
      continue;
    }
    if (body.slice(index).startsWith('if')) {
      index += 'if'.length;
      skipWhitespace();
      const condition = readBalanced('(', ')').trim();
      skipWhitespace();
      let consequent;
      if (body[index] === '{') {
        consequent = parseStatements(readBalanced('{', '}'), params, imports, constants, localFunctions, boundaryContracts);
      } else if (body.slice(index).startsWith('return')) {
        const semi = body.indexOf(';', index);
        if (semi === -1) fail(65, 'pcd_parse_error:missing_return_semicolon');
        const value = body.slice(index + 'return'.length, semi).trim();
        if (!value) fail(65, 'pcd_parse_error:missing_return_value');
        consequent = [{ type: 'ReturnStatement', argument: parseExpression(value, params, imports, constants, localFunctions, boundaryContracts) }];
        index = semi + 1;
      } else {
        fail(65, 'pcd_parse_error:malformed_if_body; wrap the if-body in braces or use `if (cond) return value;`');
      }
      skipWhitespace();
      let alternate = [];
      if (body.slice(index).startsWith('else')) {
        index += 'else'.length;
        skipWhitespace();
        if (body[index] === '{') {
          alternate = parseStatements(readBalanced('{', '}'), params, imports, constants, localFunctions, boundaryContracts);
        } else if (body.slice(index).startsWith('return')) {
          const semi = body.indexOf(';', index);
          if (semi === -1) fail(65, 'pcd_parse_error:missing_return_semicolon');
          const value = body.slice(index + 'return'.length, semi).trim();
          if (!value) fail(65, 'pcd_parse_error:missing_return_value');
          alternate = [{ type: 'ReturnStatement', argument: parseExpression(value, params, imports, constants, localFunctions, boundaryContracts) }];
          index = semi + 1;
        } else {
          fail(65, 'pcd_parse_error:malformed_else_body; wrap the else-body in braces or use `else return value;`');
        }
      }
      statements.push({
        type: 'IfStatement',
        condition: parseExpression(condition, params, imports, constants, localFunctions, boundaryContracts),
        consequent,
        alternate,
      });
      continue;
    }
    if (body.slice(index).startsWith('repeat')) {
      index += 'repeat'.length;
      skipWhitespace();
      const countMatch = body.slice(index).match(/^([A-Za-z_][A-Za-z0-9_]*|\d+)/);
      if (!countMatch) fail(65, 'pcd_parse_error:repeat_requires_literal_bound');
      const countToken = countMatch[1];
      const count = /^\d+$/.test(countToken) ? Number(countToken) : constants[countToken];
      if (count === undefined) fail(65, `pcd_parse_error:const_unknown:${countToken}`);
      if (!Number.isInteger(count) || count < 1 || count > 64) {
        fail(65, 'pcd_parse_error:repeat_bound_out_of_range');
      }
      index += countToken.length;
      skipWhitespace();
      const loopBody = readBalanced('{', '}');
      const bodyStatements = parseStatements(loopBody, params, imports, constants, localFunctions, boundaryContracts);
      if (bodyStatements.length === 0) {
        fail(65, 'pcd_parse_error:repeat_empty_body');
      }
      statements.push({ type: 'RepeatStatement', count, body: bodyStatements });
      continue;
    }
    fail(65, 'pcd_parse_error:unsupported_statement');
  }
  return statements;
}

function parseParam(raw) {
  const match = raw.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*([A-Za-z0-9_]+))?$/);
  if (!match) {
    fail(65, 'pcd_parse_error:invalid_param');
  }
  const [, name, type = 'i64'] = match;
  if (!isSupportedScalarType(type)) {
    fail(65, `pcd_parse_error:unsupported_param_type:${type}`);
  }
  return { name, type };
}

function isSupportedScalarType(type) {
  return ['i64', 'i32', 'u8', 'u64', 'bool', 'f64'].includes(type);
}

function isNumericType(type) {
  return isSupportedScalarType(type);
}

function rustType(type) {
  if (type === 'f64') return 'f64';
  if (type === 'i32') return 'i32';
  if (type === 'u8') return 'i64';
  if (type === 'u64') return 'i64';
  if (type === 'bool') return 'bool';
  return type === 'i32' ? 'i32' : 'i64';
}

function expressionTypeCompatible(actualType, expectedType) {
  return isNumericType(actualType) && isNumericType(expectedType);
}

function inferExpressionType(expression, paramTypes) {
  if (expression.type === 'NumberLiteral') return expression.numericType || (Number.isInteger(expression.value) ? 'i64' : 'f64');
  if (expression.type === 'ConstLiteral') return 'i64';
  if (expression.type === 'Identifier') return paramTypes[expression.name] || 'unknown';
  if (expression.type === 'UnaryExpression') {
    const argumentType = inferExpressionType(expression.argument, paramTypes);
    if (!isNumericType(argumentType)) fail(65, 'pcd_parse_error:unary_requires_numeric');
    return argumentType;
  }
  if (expression.type === 'ListLiteral') {
    for (const element of expression.elements) {
      if (!isNumericType(inferExpressionType(element, paramTypes))) {
        fail(65, 'pcd_parse_error:list_literal_requires_numeric_elements');
      }
    }
    return 'list_i64';
  }
  if (expression.type === 'MapLiteral') {
    for (const entry of expression.entries) {
      if (!isNumericType(inferExpressionType(entry.value, paramTypes))) {
        fail(65, 'pcd_parse_error:map_literal_requires_numeric_values');
      }
    }
    return 'map_i64';
  }
  if (expression.type === 'IndexExpression') {
    const objectType = inferExpressionType(expression.object, paramTypes);
    const indexType = inferExpressionType(expression.index, paramTypes);
    if (objectType !== 'list_i64') fail(65, 'pcd_parse_error:index_requires_list');
    if (!isNumericType(indexType)) fail(65, 'pcd_parse_error:index_requires_numeric');
    return 'i64';
  }
  if (expression.type === 'MemberExpression') {
    const objectType = inferExpressionType(expression.object, paramTypes);
    if (objectType !== 'map_i64') fail(65, 'pcd_parse_error:member_requires_map');
    if (expression.object.type === 'MapLiteral' && !expression.object.entries.some((entry) => entry.key === expression.key)) {
      fail(65, `pcd_parse_error:unknown_map_key:${expression.key}`);
    }
    return 'i64';
  }
  if (expression.type === 'LenExpression') {
    const argumentType = inferExpressionType(expression.argument, paramTypes);
    if (argumentType !== 'list_i64') fail(65, 'pcd_parse_error:len_requires_list');
    return 'i64';
  }
  if (expression.type === 'HasExpression') {
    const objectType = inferExpressionType(expression.object, paramTypes);
    if (objectType !== 'map_i64') fail(65, 'pcd_parse_error:has_requires_map');
    return 'i64';
  }
  if (expression.type === 'CallExpression') {
    for (const argument of expression.args) {
      if (!isNumericType(inferExpressionType(argument, paramTypes))) {
        fail(65, `pcd_parse_error:import_call_requires_numeric_args:${expression.callee}`);
      }
    }
    return 'i64';
  }
  if (expression.type === 'MonomerCallExpression') {
    for (const argument of expression.args) {
      if (!isNumericType(inferExpressionType(argument, paramTypes))) {
        fail(65, `pcd_parse_error:monomer_call_requires_numeric_args:${expression.monomer}`);
      }
    }
    if (expression.boundary === 'contract_external') {
      fail(65, `pcd_parse_error:external_effect_requires_extended_boundary:${expression.monomer}`);
    }
    if (expression.boundary === 'declared_boundary_contract') return 'i64';
    if (expression.returnType === 'f64') return 'f64';
    if (expression.returnType === 'bool') return 'bool';
    return isNumericType(expression.returnType) || ['u8', 'i8', 'u64'].includes(expression.returnType) ? 'i64' : expression.returnType;
  }
  if (expression.type === 'BinaryExpression') {
    const leftType = inferExpressionType(expression.left, paramTypes);
    const rightType = inferExpressionType(expression.right, paramTypes);
    if (['&&', '||'].includes(expression.operator)) {
      if (!['bool', 'i64', 'i32'].includes(leftType) || !['bool', 'i64', 'i32'].includes(rightType)) {
        fail(65, `pcd_parse_error:logical_requires_scalar:${expression.operator}`);
      }
      return 'bool';
    }
    if (['==', '!=', '>', '<', '>=', '<='].includes(expression.operator)) {
      if (!isNumericType(leftType) || !isNumericType(rightType)) {
        fail(65, `pcd_parse_error:comparison_requires_numeric:${expression.operator}`);
      }
      return 'bool';
    }
    if (!isNumericType(leftType) || !isNumericType(rightType)) {
      fail(65, `pcd_parse_error:binary_requires_numeric:${expression.operator}`);
    }
    return leftType === 'i64' || rightType === 'i64' ? 'i64' : 'i32';
  }
  fail(65, 'pcd_parse_error:unknown_expression_type');
}

function validateStatementTypes(statements, paramTypes, returnType) {
  for (const statement of statements) {
    if (statement.type === 'ReturnStatement') {
      const actualType = inferExpressionType(statement.argument, paramTypes);
      if (!expressionTypeCompatible(actualType, returnType)) {
        fail(65, `pcd_parse_error:return_type_mismatch:${actualType}_to_${returnType}`);
      }
      continue;
    }
    if (statement.type === 'IfStatement') {
      inferExpressionType(statement.condition, paramTypes);
      validateStatementTypes(statement.consequent, paramTypes, returnType);
      validateStatementTypes(statement.alternate, paramTypes, returnType);
      continue;
    }
    if (statement.type === 'RepeatStatement') {
      validateStatementTypes(statement.body, paramTypes, returnType);
      continue;
    }
    fail(65, 'pcd_parse_error:unknown_statement_type');
  }
}

function collectReturns(statements, values = []) {
  for (const statement of statements) {
    if (statement.type === 'ReturnStatement') {
      values.push(statement.argument);
    }
    if (statement.type === 'IfStatement') {
      collectReturns(statement.consequent, values);
      collectReturns(statement.alternate, values);
    }
    if (statement.type === 'RepeatStatement') {
      collectReturns(statement.body, values);
    }
  }
  return values;
}

function countBranches(statements) {
  return statements.reduce((count, statement) => {
    if (statement.type === 'RepeatStatement') return count + countBranches(statement.body);
    if (statement.type !== 'IfStatement') return count;
    return count + 1 + countBranches(statement.consequent) + countBranches(statement.alternate);
  }, 0);
}

function extractFunctionBlocks(source) {
  const functions = [];
  let index = 0;
  while (index < source.length) {
    const match = source.slice(index).match(/\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([A-Za-z0-9_]+)\s*)?\{/m);
    if (!match) {
      if (source.slice(index).trim().length > 0) {
        fail(65, 'pcd_parse_error:unsupported_pc_body_content');
      }
      break;
    }
    const start = index + match.index;
    if (source.slice(index, start).trim().length > 0) {
      fail(65, 'pcd_parse_error:unsupported_pc_body_content');
    }
    const open = source.indexOf('{', start);
    const close = findMatchingBrace(source, open);
    if (close === -1) {
      fail(65, 'pcd_parse_error:malformed_fn_block');
    }
    functions.push({
      name: match[1],
      paramsRaw: match[2],
      returnType: match[3] || 'i64',
      bodySource: source.slice(open + 1, close)
    });
    index = close + 1;
  }
  return functions;
}

function collectLocalCallsFromExpression(expression, calls = new Set()) {
  if (!expression || typeof expression !== 'object') return calls;
  if (expression.type === 'CallExpression' && expression.local) calls.add(expression.callee);
  for (const value of Object.values(expression)) {
    if (Array.isArray(value)) {
      for (const item of value) collectLocalCallsFromExpression(item, calls);
    } else if (value && typeof value === 'object') {
      collectLocalCallsFromExpression(value, calls);
    }
  }
  return calls;
}

function collectLocalCalls(statements, calls = new Set()) {
  for (const statement of statements) {
    if (statement.type === 'ReturnStatement') collectLocalCallsFromExpression(statement.argument, calls);
    if (statement.type === 'IfStatement') {
      collectLocalCallsFromExpression(statement.condition, calls);
      collectLocalCalls(statement.consequent, calls);
      collectLocalCalls(statement.alternate, calls);
    }
    if (statement.type === 'RepeatStatement') collectLocalCalls(statement.body, calls);
  }
  return calls;
}

function validateLocalFunctionGraph(functions) {
  const graph = {};
  for (const fn of Object.values(functions)) {
    graph[fn.name] = [...collectLocalCalls(fn.body)].sort();
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(name) {
    if (visiting.has(name)) fail(65, `pcd_parse_error:local_function_cycle:${name}`);
    if (visited.has(name)) return;
    visiting.add(name);
    for (const next of graph[name] || []) visit(next);
    visiting.delete(name);
    visited.add(name);
  }
  for (const name of Object.keys(graph)) visit(name);
}

function parsePcd(source, context = {}) {
  if (source.length === 0 || source.trim().length === 0) {
    fail(65, 'pcd_empty');
  }
  if (source.includes('\u0000')) {
    fail(65, 'pcd_binary_input');
  }
  if (Buffer.byteLength(source, 'utf8') > 1024 * 1024) {
    fail(65, 'pcd_too_large');
  }
  const baseDir = context.baseDir || process.cwd();
  const importStack = context.importStack || [];
  const stripped = stripPcdComments(source);
  const imports = {};
  const importGraph = {};
  let pcdSource = stripped.trimStart();
  while (pcdSource.startsWith('use ')) {
    const importMatch = pcdSource.match(/^use\s+([A-Za-z_][A-Za-z0-9_]*)\s*;\s*/);
    if (!importMatch) {
      fail(65, 'pcd_parse_error:malformed_import');
    }
    const importName = importMatch[1];
    const importPath = path.resolve(baseDir, `${importName}.pcd`);
    if (path.dirname(importPath) !== path.resolve(baseDir)) {
      fail(65, 'pcd_parse_error:import_path_outside_directory');
    }
    if (!fs.existsSync(importPath)) {
      fail(66, `pcd_import_not_found:${importName}`);
    }
    const realImportPath = workspacePath(importPath, 65, { mustExist: true, realpath: true });
    if (path.dirname(realImportPath) !== path.resolve(baseDir)) {
      fail(65, 'pcd_parse_error:import_path_outside_directory');
    }
    if (importStack.includes(realImportPath)) {
      fail(65, `pcd_parse_error:import_cycle:${importName}`);
    }
    const importedSource = fs.readFileSync(realImportPath, 'utf8');
    const importedAst = parsePcd(importedSource, {
      baseDir,
      importStack: [...importStack, realImportPath]
    });
    imports[importName] = importedAst;
    importGraph[importName] = {
      file: path.relative(baseDir, realImportPath),
      semantic_pcd_sha256: sha256(importedSource),
      imports: Object.keys(importedAst.imports || {}).sort()
    };
    pcdSource = pcdSource.slice(importMatch[0].length).trimStart();
  }
  const pcMatch = pcdSource.match(/\bPC\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*)\}\s*$/m);
  if (!pcMatch) {
    const legacyHint = /\bpc\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/m.test(pcdSource)
      || /\bcircuit\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/m.test(pcdSource);
    if (legacyHint) {
      fail(65, 'pcd_parse_error:missing_pc_block; legacy syntax detected; run `brik64 migrate <file>`');
    }
    fail(65, 'pcd_parse_error:missing_pc_block');
  }
  const pcStart = pcdSource.search(/\bPC\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/m);
  const pcOpen = pcdSource.indexOf('{', pcStart);
  const pcClose = findMatchingBrace(pcdSource, pcOpen);
  if (pcClose === -1 || pcdSource.slice(pcClose + 1).trim().length > 0) {
    fail(65, 'pcd_parse_error:malformed_pc_block');
  }
  const pcName = pcMatch[1];
  const pcBody = pcdSource.slice(pcOpen + 1, pcClose);
  const constants = {};
  let executablePcBody = pcBody;
  const boundaryContracts = new Set();
  const boundaryPattern = /^\s*boundary\s+(MC_\d{2,3}\.[A-Za-z_][A-Za-z0-9_]*)\s*;\s*/m;
  while (true) {
    const boundaryMatch = executablePcBody.match(boundaryPattern);
    if (!boundaryMatch) break;
    const key = boundaryMatch[1].replace(/\.(.+)$/, (_, name) => `.${name.toUpperCase()}`);
    const spec = supportedMonomer(key);
    if (!spec) fail(65, `pcd_parse_error:boundary_monomer_unknown:${key}`);
    if (boundaryContracts.size >= 128) fail(65, 'pcd_parse_error:boundary_contract_table_too_large');
    boundaryContracts.add(spec.key);
    executablePcBody = `${executablePcBody.slice(0, boundaryMatch.index)}${executablePcBody.slice(boundaryMatch.index + boundaryMatch[0].length)}`;
  }
  const constPattern = /^\s*const\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*i64\s*=\s*(-?\d+)\s*;\s*/m;
  while (true) {
    const constMatch = executablePcBody.match(constPattern);
    if (!constMatch) break;
    const [, name, literal] = constMatch;
    if (Object.prototype.hasOwnProperty.call(constants, name)) fail(65, `pcd_parse_error:const_duplicate:${name}`);
    if (Object.keys(constants).length >= 64) fail(65, 'pcd_parse_error:const_table_too_large');
    const value = Number(literal);
    if (!Number.isSafeInteger(value)) fail(65, `pcd_parse_error:const_out_of_bounds:${name}`);
    constants[name] = value;
    executablePcBody = `${executablePcBody.slice(0, constMatch.index)}${executablePcBody.slice(constMatch.index + constMatch[0].length)}`;
  }
  if (/\bconst\s+[A-Za-z_][A-Za-z0-9_]*\b/.test(executablePcBody)) {
    fail(65, 'pcd_parse_error:const_not_literal_or_wrong_scope');
  }
  const fnBlocks = extractFunctionBlocks(executablePcBody);
  if (fnBlocks.length === 0) {
    fail(65, 'pcd_parse_error:missing_fn_block');
  }
  const signatures = {};
  for (const block of fnBlocks) {
    if (Object.prototype.hasOwnProperty.call(signatures, block.name)) {
      fail(65, `pcd_parse_error:duplicate_fn:${block.name}`);
    }
    if (!isSupportedScalarType(block.returnType)) {
      fail(65, `pcd_parse_error:unsupported_return_type:${block.returnType}`);
    }
    const params = block.paramsRaw
      .split(',')
      .map((param) => param.trim())
      .filter(Boolean)
      .map(parseParam);
    const seenParams = new Set();
    for (const param of params) {
      if (seenParams.has(param.name)) {
        fail(65, `pcd_parse_error:duplicate_param:${param.name}`);
      }
      seenParams.add(param.name);
    }
    signatures[block.name] = {
      name: block.name,
      params: params.map((param) => param.name),
      paramTypes: Object.fromEntries(params.map((param) => [param.name, param.type])),
      returnType: block.returnType
    };
  }
  const entryName = signatures[pcName] ? pcName : fnBlocks[0].name;
  const parsedFunctions = {};
  for (const block of fnBlocks) {
    const signature = signatures[block.name];
    const params = signature.params.map((name) => ({ name, type: signature.paramTypes[name] }));
    const body = parseStatements(block.bodySource, params, imports, constants, signatures, boundaryContracts);
    validateStatementTypes(body, signature.paramTypes, signature.returnType);
    const returns = collectReturns(body);
    if (returns.length === 0) {
      fail(65, `pcd_parse_error:missing_return:${block.name}`);
    }
    parsedFunctions[block.name] = {
      ...signature,
      body,
      returnValues: returns.map((expression) => (expression.type === 'NumberLiteral' ? expression.value : null)),
      branchCount: countBranches(body)
    };
  }
  validateLocalFunctionGraph(parsedFunctions);
  const entry = parsedFunctions[entryName];
  return {
    schemaVersion: 'brik64.cli_ast.v1',
    pcName,
    fnName: entry.name,
    params: entry.params,
    paramTypes: entry.paramTypes,
    returnType: entry.returnType,
    imports,
    importGraph,
    constants,
    boundaryContracts: [...boundaryContracts].sort(),
    functions: parsedFunctions,
    entrypoint: {
      name: entry.name,
      explicit: entry.name === pcName,
      fallbackReason: entry.name === pcName ? null : 'pc_name_function_missing_first_function_selected'
    },
    body: entry.body,
    returnValues: entry.returnValues,
    branchCount: Object.values(parsedFunctions).reduce((sum, fn) => sum + fn.branchCount, 0),
    expressionDialect: 'brik64.cli_expr.v1',
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

function templateCommand(args = []) {
  const parsed = parseArgs(args, { '--type': 'value', '--out': 'value', '--force': 'boolean' });
  const type = parsed['--type'] || 'gate';
  const out = parsed['--out'];
  if (!out) fail(64, 'template_out_required');
  const templates = {
    gate: `// brik64.pcd_file.v1\n// claim_boundary: local_candidate_only\nPC order_gate {\n    fn order_gate(amount: i64, limit: i64) -> i64 {\n        if (amount <= 0) return 0;\n        if (amount > limit) return 0;\n        return 1;\n    }\n}\n`,
    utility: `// brik64.pcd_file.v1\n// claim_boundary: local_candidate_only\nPC math_utility {\n    fn add_one(input: i64) -> i64 {\n        return input + 1;\n    }\n    fn double(input: i64) -> i64 {\n        return input * 2;\n    }\n}\n`,
    'numeric-monomer': `// brik64.pcd_file.v1\n// claim_boundary: local_candidate_only\nPC add8_gate {\n    fn add8_gate(a: i64, b: i64) -> i64 {\n        return MC_00.ADD8(a, b);\n    }\n}\n`
  };
  if (!templates[type]) fail(64, `template_type_unsupported:${type}`);
  const outPath = workspacePath(out, 64, { output: true });
  if (fs.existsSync(outPath) && !parsed['--force']) fail(73, `output_exists:${path.relative(process.cwd(), outPath)}`);
  mkdirControlled(path.dirname(outPath));
  writeFileControlled(outPath, templates[type]);
  parsePcd(templates[type], { baseDir: path.dirname(outPath), importStack: [outPath] });
  process.stdout.write(`template=${path.relative(process.cwd(), outPath)}\n`);
  process.stdout.write(`type=${type}\n`);
}

function pcdInventory() {
  const results = [];
  const ignored = new Set(['.git', '.brik', 'node_modules', 'target', 'dist', 'build', 'evidence', 'engines', 'out-ts', 'out-rust', 'out-python']);
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      if (ignored.has(name)) continue;
      const file = path.join(dir, name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        walk(file);
        continue;
      }
      if (!name.endsWith('.pcd')) continue;
      const source = fs.readFileSync(file, 'utf8');
      results.push({
        file: path.relative(process.cwd(), file),
        semantic_pcd_sha256: sha256(source),
        bytes: Buffer.byteLength(source, 'utf8')
      });
    }
  }
  walk(process.cwd());
  return results.sort((a, b) => a.file.localeCompare(b.file));
}

function doctorManifestDiagnostics() {
  const manifestPath = path.resolve('.brik', 'manifest.json');
  const errors = [];
  const actions = [];
  if (!fs.existsSync(manifestPath)) {
    errors.push('manifest_missing:.brik/manifest.json');
    actions.push('Run `brik64 init` in the workspace root.');
    return { manifest: null, errors, actions };
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (_) {
    errors.push('manifest_parse_error');
    actions.push('Fix .brik/manifest.json or rerun `brik64 init` after backing up local state.');
    return { manifest: null, errors, actions };
  }
  const schema = manifest.schema || manifest.schemaVersion;
  if (schema !== 'brik64.cli_project_manifest.v1') {
    errors.push('manifest_schema_unsupported');
    actions.push('Regenerate the workspace manifest with a supported BRIK64 CLI.');
  }
  if (!manifest.cliVersion || typeof manifest.cliVersion !== 'string') {
    errors.push('manifest_cli_version_missing');
    actions.push('Regenerate the workspace manifest with `brik64 init`.');
  }
  const boundary = manifest.claimBoundary;
  if (!boundary || typeof boundary !== 'object') {
    errors.push('manifest_claim_boundary_missing');
    actions.push('Restore the claimBoundary block in .brik/manifest.json.');
  } else {
    const releaseAllowed = boundary.releaseAllowed ?? boundary.releaseAuthorized;
    if (releaseAllowed !== false) {
      errors.push('manifest_release_policy_invalid');
      actions.push('Set claimBoundary.releaseAllowed to false for local candidate workspaces.');
    }
  }
  return { manifest, errors, actions };
}

function buildDoctorReport() {
  const { manifest, errors, actions } = doctorManifestDiagnostics();
  const warnings = [];
  if (manifest) {
    const policy = manifest.engineTierPolicy || {};
    if (manifest.cliVersion !== version) {
      errors.push('manifest_cli_version_mismatch');
      actions.push('Reinitialize or migrate the workspace manifest for this CLI version.');
    }
    if (policy.publicOfflineRuntime !== 'local_runtime') {
      errors.push('engine_tier_policy_missing_local_runtime');
      actions.push('Restore engineTierPolicy.publicOfflineRuntime to local_runtime.');
    }
    if (policy.registeredManagedRuntime !== 'managed_platform') {
      errors.push('engine_tier_policy_missing_managed_platform');
      actions.push('Restore engineTierPolicy.registeredManagedRuntime to managed_platform.');
    }
    if (policy.internalArtifactFactory !== 'private_factory') {
      errors.push('engine_tier_policy_missing_private_factory');
      actions.push('Restore engineTierPolicy.internalArtifactFactory to private_factory.');
    }
    if (policy.l6DistributionAllowed !== false) {
      errors.push('engine_tier_policy_l6_distribution_open');
      actions.push('Set engineTierPolicy.l6DistributionAllowed to false.');
    }
    if (policy.l5EmbeddedFreeRuntimeAllowed !== false) {
      errors.push('engine_tier_policy_l5_free_embedding_open');
      actions.push('Set engineTierPolicy.l5EmbeddedFreeRuntimeAllowed to false.');
    }
  }
  const pcds = pcdInventory();
  const pcdValidation = [];
  for (const item of pcds) {
    const validation = validatePcdFileWithExplain(item.file);
    if (validation.ok) {
      pcdValidation.push({ file: item.file, status: 'PASS' });
    } else {
      const message = validation.error;
      pcdValidation.push({ file: item.file, status: 'FAIL', error: message });
      errors.push(`pcd_parse_error:${item.file}:${message}`);
      actions.push(`Fix or move ${item.file}; run \`brik64 explain ${item.file}\` for parser diagnostics.`);
    }
  }
  if (pcds.length === 0) {
    errors.push('pcd_inventory_empty');
    const rootPcds = fs.readdirSync(process.cwd()).filter((name) => name.endsWith('.pcd')).sort();
    if (rootPcds.length > 0) {
      actions.push('PCD files were found in the workspace root, but doctor inventories ./pcd. Move them into ./pcd or run certify/emit directly on the root file.');
    } else {
      actions.push('Add at least one .pcd file under ./pcd or run certify/emit directly on a specific .pcd file.');
    }
  }
  return {
    schemaVersion: 'brik64.cli_doctor_report.v1',
    cliVersion: version,
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    releaseEligible: false,
    localRuntime: 'available',
    managedRuntime: hasManagedSession() ? 'authenticated' : 'not_authenticated',
    internalArtifactFactory: 'private',
    pcdCount: pcds.length,
    pcdValidation: {
      valid: pcdValidation.filter((item) => item.status === 'PASS').length,
      invalid: pcdValidation.filter((item) => item.status === 'FAIL').length,
      files: pcdValidation
    },
    pcdInventorySha256: sha256(JSON.stringify(pcds)),
    releaseScope: 'local_candidate_only',
    diagnostics: {
      errors,
      warnings,
      actions: [...new Set(actions)]
    }
  };
}

function validatePcdFileWithExplain(file) {
  const result = spawnSync(process.execPath, [__filename, 'explain', file, '--quiet'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, BRIK64_NO_BANNER: '1' },
    maxBuffer: 4 * 1024 * 1024
  });
  if (result.status === 0) return { ok: true };
  return {
    ok: false,
    error: redactValue(`${result.stdout || ''}\n${result.stderr || ''}`.trim() || 'pcd_parse_error')
  };
}

function printDoctorHuman(report) {
  process.stdout.write(`BRIK64 workspace doctor\n`);
  process.stdout.write(`status: ${report.status}\n`);
  process.stdout.write(`cli: ${report.cliVersion}\n`);
  process.stdout.write(`routing: local default\n`);
  process.stdout.write(`pcd files: ${report.pcdCount}\n`);
  if (report.pcdValidation) {
    process.stdout.write(`pcd parse: ${report.pcdValidation.valid} valid, ${report.pcdValidation.invalid} invalid\n`);
  }
  process.stdout.write(`release eligible: no\n`);
  process.stdout.write(`release scope: local candidate only\n`);
  process.stdout.write(`\nDiagnostics\n`);
  if (report.diagnostics.errors.length === 0) {
    process.stdout.write(`errors: none\n`);
  } else {
    process.stdout.write(`Errors:\n`);
    for (const error of report.diagnostics.errors) {
      process.stdout.write(`- ${error}\n`);
    }
  }
  if (report.diagnostics.warnings.length === 0) {
    process.stdout.write(`warnings: none\n`);
  } else {
    process.stdout.write(`Warnings:\n`);
    for (const warning of report.diagnostics.warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
  }
  if (report.diagnostics.actions.length === 0) {
    process.stdout.write(`actions: none\n`);
  } else {
    process.stdout.write(`Actions:\n`);
    for (const action of report.diagnostics.actions) {
      process.stdout.write(`- ${action}\n`);
    }
  }
}

function doctor() {
  const args = parseArgs(process.argv.slice(3), { '--json': 'boolean' });
  const report = buildDoctorReport();
  if (args['--json']) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printDoctorHuman(report);
  }
  if (report.status !== 'PASS') {
    const message = report.diagnostics.errors.join('\n');
    writeLastErrorReport(message);
    process.stderr.write(`${message}\n`);
    process.exit(65);
  }
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

function publicMonomerRecord(spec) {
  return {
    id: spec.id,
    name: spec.name,
    key: spec.key,
    family: spec.family,
    tier: spec.scope,
    signature: `${spec.params.join(',')} -> ${spec.returnType}`,
    inputTypes: spec.params,
    outputType: spec.returnType,
    determinism: spec.boundary === 'contract_external' ? 'contract_bounded' : 'deterministic_local',
    scope: spec.scope,
    params: spec.params,
    returnType: spec.returnType,
    executableInPcd: spec.executable === true,
    pcdExecutable: spec.executable === true,
    sdkExecutable: true,
    emitTargets: ['ts', 'python', 'rust'],
    boundary: spec.boundary || (spec.executable ? 'pure_local_candidate' : 'boundary_required'),
    legacyAlias: spec.legacyAlias === true,
    fixtures: {
      valid: `${spec.key} valid fixture`,
      edge: `${spec.key} edge fixture`,
      failClosed: `${spec.key} fail-closed fixture`,
      variation: `${spec.key} variation fixture`
    }
  };
}

function monomersCommand(args = []) {
  const [subcommand, maybeValue, ...tail] = args;
  const value = maybeValue && !maybeValue.startsWith('--') ? maybeValue : null;
  const optionArgs = value ? tail : [maybeValue, ...tail].filter(Boolean);
  const parsed = parseArgs(optionArgs, { '--json': 'boolean', '--scope': 'value', '--target': 'value', '--all': 'boolean' });
  if (subcommand === 'list') {
    const scope = parsed['--scope'] || value || 'all';
    if (!['core', 'extended', 'all'].includes(scope)) fail(64, `monomer_scope_unsupported:${scope}`);
    const selected = scope === 'core' ? CORE_MONOMERS : scope === 'extended' ? EXTENDED_MONOMERS : MONOMERS;
    const monomers = selected.map(publicMonomerRecord);
    const report = {
      schemaVersion: 'brik64.cli_monomer_registry_report.v1',
      cliVersion: version,
      scope,
      coreCount: CORE_MONOMERS.length,
      extendedCount: EXTENDED_MONOMERS.length,
      totalCount: MONOMERS.length,
      monomers
    };
    if (parsed['--json']) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    for (const monomer of monomers) {
      process.stdout.write(`${monomer.key} ${monomer.family} ${monomer.executableInPcd ? 'pcd-executable' : 'boundary-required'}\n`);
    }
    return;
  }
  if (subcommand === 'explain') {
    const key = value;
    if (!key) fail(64, 'monomer_explain_requires_key');
    const spec = supportedMonomer(key) || MONOMER_BY_ID[key] || null;
    if (!spec) {
      fail(65, `monomer_not_found:${key}`);
    }
    const report = {
      schemaVersion: 'brik64.cli_monomer_explain_report.v1',
      cliVersion: version,
      monomer: publicMonomerRecord(spec),
      pcdSyntax: `${spec.key}(${spec.params.map((_, index) => `arg${index + 1}`).join(', ')})`,
      claimBoundary: spec.executable ? 'local_candidate_only' : 'recognized_not_executable_without_boundary'
    };
    if (parsed['--json']) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${report.monomer.key}\n`);
    process.stdout.write(`family=${report.monomer.family}\n`);
    process.stdout.write(`pcdExecutable=${report.monomer.executableInPcd}\n`);
    process.stdout.write(`boundary=${report.monomer.boundary}\n`);
    return;
  }
  if (subcommand === 'test') {
    const target = parsed['--target'] || 'registry';
    const subject = value || null;
    if (!['registry', 'ts', 'python', 'rust'].includes(target)) fail(64, `monomer_test_target_unsupported:${target}`);
    const candidates = subject && subject !== '--all'
      ? MONOMERS.filter((spec) => spec.id === subject || spec.key === subject)
      : MONOMERS;
    if (candidates.length === 0) fail(65, `monomer_not_found:${subject}`);
    const checks = candidates.map((spec) => {
      const record = publicMonomerRecord(spec);
      const missing = [];
      for (const field of ['id', 'name', 'tier', 'family', 'signature', 'inputTypes', 'outputType', 'determinism', 'pcdExecutable', 'sdkExecutable', 'emitTargets', 'boundary', 'fixtures']) {
        if (record[field] === undefined || record[field] === null) missing.push(field);
      }
      if (!record.emitTargets.includes(target) && target !== 'registry') missing.push(`emitTarget:${target}`);
      return {
        key: spec.key,
        status: missing.length === 0 ? 'PASS' : 'FAIL',
        tier: spec.scope,
        target,
        boundary: record.boundary,
        missing
      };
    });
    const failed = checks.filter((check) => check.status !== 'PASS');
    const report = {
      schemaVersion: 'brik64.cli_monomer_test_report.v1',
      cliVersion: version,
      target,
      scope: subject || 'all',
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      checks
    };
    if (parsed['--json']) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`monomers_test=${failed.length === 0 ? 'PASS' : 'FAIL'}\n`);
      process.stdout.write(`passed=${report.passed}\nfailed=${report.failed}\n`);
    }
    if (failed.length > 0) process.exit(65);
    return;
  }
  fail(64, `monomers_subcommand_required:list_or_explain_or_test`);
}

function certPathFor(file) {
  return `${workspacePath(file, 64, { mustExist: true, realpath: true })}.cert.json`;
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

function brikDir() {
  return path.resolve('.brik');
}

function telemetryConfigPath() {
  return path.join(brikDir(), 'telemetry.json');
}

function telemetryQueuePath() {
  return path.join(brikDir(), 'telemetry-queue.jsonl');
}

function feedbackQueuePath() {
  return path.join(brikDir(), 'feedback-queue.jsonl');
}

function readTelemetryConfig() {
  const file = telemetryConfigPath();
  if (!fs.existsSync(file)) {
    return {
      schemaVersion: 'brik64.cli_telemetry_config.v1',
      cliVersion: version,
      enabled: false,
      endpoint: 'https://brik64.com/api/telemetry/cli',
      feedbackEndpoint: 'https://brik64.com/api/feedback',
      errorReportEndpoint: 'https://brik64.com/api/error-reports'
    };
  }
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      schemaVersion: 'brik64.cli_telemetry_config.v1',
      cliVersion: version,
      enabled: config.enabled === true,
      endpoint: typeof config.endpoint === 'string' ? config.endpoint : 'https://brik64.com/api/telemetry/cli',
      feedbackEndpoint: typeof config.feedbackEndpoint === 'string' ? config.feedbackEndpoint : 'https://brik64.com/api/feedback',
      errorReportEndpoint: typeof config.errorReportEndpoint === 'string' ? config.errorReportEndpoint : 'https://brik64.com/api/error-reports'
    };
  } catch (_) {
    fail(65, 'telemetry_config_parse_error');
  }
}

function writeTelemetryConfig(config) {
  mkdirControlled(brikDir());
  writeFileControlled(telemetryConfigPath(), JSON.stringify(config, null, 2) + '\n');
}

function appendJsonLine(file, value) {
  mkdirControlled(path.dirname(file));
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`);
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-250)
    .map((line) => JSON.parse(line));
}

async function postJson(endpoint, payload) {
  if (typeof fetch !== 'function') {
    fail(69, 'network_fetch_unavailable');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    fail(69, `transport_http_error:${response.status}`);
  }
  return response.json().catch(() => ({ ok: true }));
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
    fail(64, 'login_requires_token_env');
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

function importedFunctionName(name) {
  return `__brik_import_${name}`;
}

function renderU8(value, target) {
  if (target === 'python') return `(((${value}) % 256 + 256) % 256)`;
  if (target === 'rust') return `(((${value}) % 256 + 256) % 256)`;
  return `(((${value}) % 256) + 256) % 256`;
}

function renderRustF64(value) {
  return `(${value} as f64)`;
}

function renderBoundaryContractValue(returnType, target) {
  if (returnType === 'bool') return target === 'python' ? 'False' : 'false';
  if (returnType === 'f64') return '0.0';
  if (returnType === 'unit') return '0';
  if (['string', 'bytes', 'bytes32', 'bytes64', 'list_string', 'tuple_u16_string', 'tuple_u64_u64'].includes(returnType)) return '0';
  return '0';
}

function renderExpression(expression, target) {
  if (expression.type === 'NumberLiteral') return String(expression.value);
  if (expression.type === 'ConstLiteral') return String(expression.value);
  if (expression.type === 'Identifier') return expression.name;
  if (expression.type === 'UnaryExpression') return `(-${renderExpression(expression.argument, target)})`;
  if (expression.type === 'ListLiteral') {
    return `[${expression.elements.map((element) => renderExpression(element, target)).join(', ')}]`;
  }
  if (expression.type === 'MapLiteral') {
    if (target === 'rust') fail(70, 'internal_codegen_error:rust_map_literal_requires_member_access');
    if (target === 'python') {
      return `{${expression.entries.map((entry) => `${JSON.stringify(entry.key)}: ${renderExpression(entry.value, target)}`).join(', ')}}`;
    }
    return `({${expression.entries.map((entry) => `${entry.key}: ${renderExpression(entry.value, target)}`).join(', ')}})`;
  }
  if (expression.type === 'IndexExpression') {
    const object = renderExpression(expression.object, target);
    const index = renderExpression(expression.index, target);
    if (target === 'rust') return `(${object})[(${index}) as usize]`;
    return `(${object})[${index}]`;
  }
  if (expression.type === 'MemberExpression') {
    if (expression.object.type === 'MapLiteral') {
      const entry = expression.object.entries.find((candidate) => candidate.key === expression.key);
      if (!entry) fail(65, `pcd_parse_error:unknown_map_key:${expression.key}`);
      return renderExpression(entry.value, target);
    }
    const object = renderExpression(expression.object, target);
    if (target === 'python') return `(${object})[${JSON.stringify(expression.key)}]`;
    if (target === 'rust') fail(70, 'internal_codegen_error:rust_dynamic_map_member_unsupported');
    return `(${object}).${expression.key}`;
  }
  if (expression.type === 'LenExpression') {
    const argument = renderExpression(expression.argument, target);
    if (target === 'python') return `len(${argument})`;
    if (target === 'rust') return `(${argument}).len() as i64`;
    return `(${argument}).length`;
  }
  if (expression.type === 'HasExpression') {
    if (expression.object.type === 'MapLiteral') {
      const exists = expression.object.entries.some((entry) => entry.key === expression.key);
      return exists ? '1' : '0';
    }
    const object = renderExpression(expression.object, target);
    if (target === 'python') return `(1 if ${JSON.stringify(expression.key)} in ${object} else 0)`;
    if (target === 'rust') fail(70, 'internal_codegen_error:rust_dynamic_map_has_unsupported');
    return `(Object.prototype.hasOwnProperty.call(${object}, ${JSON.stringify(expression.key)}) ? 1 : 0)`;
  }
  if (expression.type === 'CallExpression') {
    const args = expression.args.map((argument) => renderExpression(argument, target)).join(', ');
    return `${expression.local ? expression.callee : importedFunctionName(expression.callee)}(${args})`;
  }
  if (expression.type === 'MonomerCallExpression') {
    const args = expression.args.map((argument) => renderExpression(argument, target));
    if (expression.operation === 'add') return renderU8(`${args[0]} + ${args[1]}`, target);
    if (expression.operation === 'sub') return renderU8(`${args[0]} - ${args[1]}`, target);
    if (expression.operation === 'mul') return renderU8(`${args[0]} * ${args[1]}`, target);
    if (expression.operation === 'mod') return renderU8(`${args[0]} % ${args[1]}`, target);
    if (expression.operation === 'inc') return renderU8(`${args[0]} + 1`, target);
    if (expression.operation === 'dec') return renderU8(`${args[0]} - 1`, target);
    if (expression.operation === 'abs') {
      if (target === 'python') return `abs(${args[0]})`;
      if (target === 'rust') return `(${args[0]}).abs()`;
      return `Math.abs(${args[0]})`;
    }
    if (expression.operation === 'clamp') {
      if (target === 'python') return `min(max(${args[0]}, ${args[1]}), ${args[2]})`;
      if (target === 'rust') return `(${args[0]}).max(${args[1]}).min(${args[2]})`;
      return `Math.min(Math.max(${args[0]}, ${args[1]}), ${args[2]})`;
    }
    if (expression.operation === 'and') return renderU8(`${args[0]} & ${args[1]}`, target);
    if (expression.operation === 'or') return renderU8(`${args[0]} | ${args[1]}`, target);
    if (expression.operation === 'xor') return renderU8(`${args[0]} ^ ${args[1]}`, target);
    if (expression.operation === 'not') return renderU8(`${target === 'rust' ? '!' : '~'}${args[0]}`, target);
    if (expression.operation === 'shl') return renderU8(`${args[0]} << (${args[1]} & 7)`, target);
    if (expression.operation === 'shr') return renderU8(`${args[0]} >> (${args[1]} & 7)`, target);
    if (expression.operation === 'rol') return renderU8(`((${args[0]} << (${args[1]} & 7)) | (${args[0]} >> (8 - (${args[1]} & 7))))`, target);
    if (expression.operation === 'ror') return renderU8(`((${args[0]} >> (${args[1]} & 7)) | (${args[0]} << (8 - (${args[1]} & 7))))`, target);
    if (expression.operation === 'fadd') {
      if (target === 'rust') return `(${renderRustF64(args[0])} + ${renderRustF64(args[1])})`;
      return `(${args[0]} + ${args[1]})`;
    }
    if (expression.operation === 'fsub') {
      if (target === 'rust') return `(${renderRustF64(args[0])} - ${renderRustF64(args[1])})`;
      return `(${args[0]} - ${args[1]})`;
    }
    if (expression.operation === 'fmul') {
      if (target === 'rust') return `(${renderRustF64(args[0])} * ${renderRustF64(args[1])})`;
      return `(${args[0]} * ${args[1]})`;
    }
    if (expression.operation === 'fdiv') {
      if (target === 'python') return `(0 if ${args[1]} == 0 else (${args[0]} / ${args[1]}))`;
      if (target === 'rust') return `(if ${renderRustF64(args[1])} == 0.0 { 0.0 } else { ${renderRustF64(args[0])} / ${renderRustF64(args[1])} })`;
      return `(${args[1]} === 0 ? 0 : (${args[0]} / ${args[1]}))`;
    }
    if (expression.operation === 'fmod') {
      if (target === 'python') return `(0 if ${args[1]} == 0 else (${args[0]} % ${args[1]}))`;
      if (target === 'rust') return `(if ${renderRustF64(args[1])} == 0.0 { 0.0 } else { ${renderRustF64(args[0])} % ${renderRustF64(args[1])} })`;
      return `(${args[1]} === 0 ? 0 : (${args[0]} % ${args[1]}))`;
    }
    if (expression.operation === 'fabs') {
      if (target === 'python') return `abs(${args[0]})`;
      if (target === 'rust') return `${renderRustF64(args[0])}.abs()`;
      return `Math.abs(${args[0]})`;
    }
    if (expression.operation === 'fneg') return `(-${args[0]})`;
    if (expression.operation === 'fsqrt') {
      if (target === 'python') return `(${args[0]} ** 0.5)`;
      if (target === 'rust') return `${renderRustF64(args[0])}.sqrt()`;
      return `Math.sqrt(${args[0]})`;
    }
    if (expression.operation === 'sin') {
      if (target === 'python') return `__import__("math").sin(${args[0]})`;
      if (target === 'rust') return `${renderRustF64(args[0])}.sin()`;
      return `Math.sin(${args[0]})`;
    }
    if (expression.operation === 'cos') {
      if (target === 'python') return `__import__("math").cos(${args[0]})`;
      if (target === 'rust') return `${renderRustF64(args[0])}.cos()`;
      return `Math.cos(${args[0]})`;
    }
    if (expression.operation === 'tan') {
      if (target === 'python') return `__import__("math").tan(${args[0]})`;
      if (target === 'rust') return `${renderRustF64(args[0])}.tan()`;
      return `Math.tan(${args[0]})`;
    }
    if (expression.operation === 'atan2') {
      if (target === 'python') return `__import__("math").atan2(${args[0]}, ${args[1]})`;
      if (target === 'rust') return `${renderRustF64(args[0])}.atan2(${renderRustF64(args[1])})`;
      return `Math.atan2(${args[0]}, ${args[1]})`;
    }
    if (expression.operation === 'log') {
      if (target === 'python') return `__import__("math").log(${args[0]})`;
      if (target === 'rust') return `${renderRustF64(args[0])}.ln()`;
      return `Math.log(${args[0]})`;
    }
    if (expression.operation === 'exp') {
      if (target === 'python') return `__import__("math").exp(${args[0]})`;
      if (target === 'rust') return `${renderRustF64(args[0])}.exp()`;
      return `Math.exp(${args[0]})`;
    }
    if (expression.operation === 'pow') {
      if (target === 'python') return `(${args[0]} ** ${args[1]})`;
      if (target === 'rust') return `${renderRustF64(args[0])}.powf(${renderRustF64(args[1])})`;
      return `Math.pow(${args[0]}, ${args[1]})`;
    }
    if (expression.operation === 'floor') {
      if (target === 'python') return `int(__import__("math").floor(${args[0]}))`;
      if (target === 'rust') return `${renderRustF64(args[0])}.floor() as i64`;
      return `Math.floor(${args[0]})`;
    }
    if ([
      'effect_boundary',
      'external_boundary',
      'contract_handle',
      'contract_unit',
      'contract_u32',
      'contract_u64',
      'contract_bool',
      'contract_bytes',
      'contract_json_parse',
      'contract_json_emit'
    ].includes(expression.operation)) {
      return renderBoundaryContractValue(expression.returnType, target);
    }
    fail(70, `internal_codegen_error:unknown_monomer_operation:${expression.operation}`);
  }
  if (expression.type === 'BinaryExpression') {
    const left = renderExpression(expression.left, target);
    const right = renderExpression(expression.right, target);
    let operator = expression.operator;
    if (target === 'ts' && operator === '==') operator = '===';
    if (target === 'ts' && operator === '!=') operator = '!==';
    if (target === 'python' && operator === '&&') operator = 'and';
    if (target === 'python' && operator === '||') operator = 'or';
    return `(${left} ${operator} ${right})`;
  }
  fail(70, 'internal_codegen_error:unknown_expression');
}

function stripOuterParens(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return value;
  let depth = 0;
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && index < trimmed.length - 1) return value;
  }
  return trimmed.slice(1, -1);
}

function statementsAlwaysReturn(statements) {
  for (const statement of statements) {
    if (statement.type === 'ReturnStatement') return true;
    if (statement.type === 'IfStatement') {
      if (
        statement.alternate.length > 0 &&
        statementsAlwaysReturn(statement.consequent) &&
        statementsAlwaysReturn(statement.alternate)
      ) {
        return true;
      }
    }
    if (statement.type === 'RepeatStatement') {
      continue;
    }
  }
  return false;
}

function renderStatements(statements, target, indentLevel) {
  const unit = target === 'python' ? '    ' : '  ';
  const indent = unit.repeat(indentLevel);
  const lines = [];
  for (const statement of statements) {
    if (statement.type === 'ReturnStatement') {
      const expression = renderExpression(statement.argument, target);
      lines.push(`${indent}return ${target === 'rust' ? stripOuterParens(expression) : expression}${target === 'python' ? '' : ';'}`);
      continue;
    }
    if (statement.type === 'IfStatement') {
      const renderedCondition = renderExpression(statement.condition, target);
      const condition = target === 'rust' ? stripOuterParens(renderedCondition) : renderedCondition;
      if (target === 'python') {
        lines.push(`${indent}if ${condition}:`);
        lines.push(...renderStatements(statement.consequent, target, indentLevel + 1));
        if (statement.alternate.length > 0) {
          lines.push(`${indent}else:`);
          lines.push(...renderStatements(statement.alternate, target, indentLevel + 1));
        }
      } else {
        lines.push(`${indent}if ${condition} {`);
        lines.push(...renderStatements(statement.consequent, target, indentLevel + 1));
        if (statement.alternate.length > 0) {
          lines.push(`${indent}} else {`);
          lines.push(...renderStatements(statement.alternate, target, indentLevel + 1));
        }
        lines.push(`${indent}}`);
      }
      continue;
    }
    if (statement.type === 'RepeatStatement') {
      if (target === 'python') {
        lines.push(`${indent}for _ in range(${statement.count}):`);
        lines.push(...renderStatements(statement.body, target, indentLevel + 1));
      } else if (target === 'rust') {
        lines.push(`${indent}for _ in 0..${statement.count} {`);
        lines.push(...renderStatements(statement.body, target, indentLevel + 1));
        lines.push(`${indent}}`);
      } else {
        lines.push(`${indent}for (let __brik_i = 0; __brik_i < ${statement.count}; __brik_i += 1) {`);
        lines.push(...renderStatements(statement.body, target, indentLevel + 1));
        lines.push(`${indent}}`);
      }
      continue;
    }
    fail(70, 'internal_codegen_error:unknown_statement');
  }
  return lines;
}

function renderLocalFunctions(ast, target) {
  const lines = [];
  for (const fn of Object.values(ast.functions || {}).filter((candidate) => candidate.name !== ast.fnName)) {
    const params = fn.params.length > 0 ? fn.params : ['input'];
    if (target === 'python') {
      lines.push(`def ${fn.name}(${params.map((param) => `${param}=0`).join(', ')}):`);
      lines.push(...renderStatements(fn.body, target, 1));
      if (!statementsAlwaysReturn(fn.body)) {
        lines.push('    raise RuntimeError("pcd local helper reached non-returning path")');
      }
      lines.push('');
      continue;
    }
    if (target === 'rust') {
      lines.push(`fn ${fn.name}(${params.map((param) => `${param}: ${rustType(fn.paramTypes?.[param])}`).join(', ')}) -> ${rustType(fn.returnType)} {`);
      lines.push(...renderStatements(fn.body, target, 1).map((line) => line.replace(/^  /, '    ')));
      if (!statementsAlwaysReturn(fn.body)) {
        lines.push('    panic!("pcd local helper reached non-returning path");');
      }
      lines.push('}');
      lines.push('');
      continue;
    }
    lines.push(`function ${fn.name}(${params.map((param) => `${param} = 0`).join(', ')}) {`);
    lines.push(...renderStatements(fn.body, target, 1));
    if (!statementsAlwaysReturn(fn.body)) {
      lines.push('  throw new Error("pcd local helper reached non-returning path");');
    }
    lines.push('}');
    lines.push('');
  }
  return lines;
}

function renderPcdExpression(expression) {
  if (expression.type === 'NumberLiteral') return String(expression.value);
  if (expression.type === 'ConstLiteral') return expression.name || String(expression.value);
  if (expression.type === 'Identifier') return expression.name;
  if (expression.type === 'UnaryExpression') return `-${renderPcdExpression(expression.argument)}`;
  if (expression.type === 'ListLiteral') {
    return `[${expression.elements.map((element) => renderPcdExpression(element)).join(', ')}]`;
  }
  if (expression.type === 'MapLiteral') {
    return `{${expression.entries.map((entry) => `${entry.key}: ${renderPcdExpression(entry.value)}`).join(', ')}}`;
  }
  if (expression.type === 'IndexExpression') {
    return `${renderPcdExpression(expression.object)}[${renderPcdExpression(expression.index)}]`;
  }
  if (expression.type === 'MemberExpression') {
    return `${renderPcdExpression(expression.object)}.${expression.key}`;
  }
  if (expression.type === 'LenExpression') {
    return `len(${renderPcdExpression(expression.argument)})`;
  }
  if (expression.type === 'HasExpression') {
    return `has(${renderPcdExpression(expression.object)}, ${expression.key})`;
  }
  if (expression.type === 'CallExpression') {
    return `${expression.callee}(${expression.args.map((argument) => renderPcdExpression(argument)).join(', ')})`;
  }
  if (expression.type === 'MonomerCallExpression') {
    return `${expression.monomer}(${expression.args.map((argument) => renderPcdExpression(argument)).join(', ')})`;
  }
  if (expression.type === 'BinaryExpression') {
    return `(${renderPcdExpression(expression.left)} ${expression.operator} ${renderPcdExpression(expression.right)})`;
  }
  fail(70, 'internal_polymer_error:unknown_expression');
}

function renderPcdStatements(statements, indentLevel = 2) {
  const indent = '    '.repeat(indentLevel);
  const lines = [];
  for (const statement of statements) {
    if (statement.type === 'ReturnStatement') {
      lines.push(`${indent}return ${renderPcdExpression(statement.argument)};`);
      continue;
    }
    if (statement.type === 'IfStatement') {
      lines.push(`${indent}if ${renderPcdExpression(statement.condition)} {`);
      lines.push(...renderPcdStatements(statement.consequent, indentLevel + 1));
      if (statement.alternate.length > 0) {
        lines.push(`${indent}} else {`);
        lines.push(...renderPcdStatements(statement.alternate, indentLevel + 1));
      }
      lines.push(`${indent}}`);
      continue;
    }
    if (statement.type === 'RepeatStatement') {
      lines.push(`${indent}repeat ${statement.count} {`);
      lines.push(...renderPcdStatements(statement.body, indentLevel + 1));
      lines.push(`${indent}}`);
      continue;
    }
    fail(70, 'internal_polymer_error:unknown_statement');
  }
  return lines;
}

function renderSemanticPolymer(rootUnit, units) {
  const ast = rootUnit.ast;
  const sourceLines = units.map((unit) => `// source ${unit.file} ${unit.semantic_pcd_sha256}`);
  const importLines = Object.keys(ast.importGraph || {})
    .sort()
    .map((name) => `use ${name};`);
  const params = ast.params.map((param) => `${param}: ${ast.paramTypes[param] || 'i64'}`).join(', ');
  const constantLines = Object.entries(ast.constants || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `    const ${name}: i64 = ${value};`);
  const bodyLines = renderPcdStatements(ast.body, 2);
  return [
    '// brik64.pcd_file.v1',
    '// generated_by: brik64-cli beta14 semantic polymerize local',
    '// claim_boundary: local_candidate_only',
    '// semantic_mode: root_dag_reference',
    ...sourceLines,
    '',
    ...importLines,
    importLines.length > 0 ? '' : null,
    'PC brik64_polymer {',
    ...constantLines,
    constantLines.length > 0 ? '' : null,
    `    fn ${ast.fnName}(${params}) -> ${ast.returnType} {`,
    ...bodyLines,
    '    }',
    '}',
    ''
  ].filter((line) => line !== null).join('\n');
}

function renderInlinePolymer(units) {
  const names = new Set();
  const lines = [
    '// brik64.pcd_file.v1',
    '// generated_by: brik64-cli beta14.2 semantic polymerize local',
    '// claim_boundary: local_candidate_only',
    '// semantic_mode: inline_merged_functions',
    ...units.map((unit) => `// source ${unit.file} ${unit.semantic_pcd_sha256}`),
    '',
    'PC brik64_polymer {'
  ];
  for (const unit of units) {
    for (const fn of Object.values(unit.ast.functions || {})) {
      if (names.has(fn.name)) fail(65, `polymer_inline_name_collision:${fn.name}`);
      names.add(fn.name);
      const params = fn.params.map((param) => `${param}: ${fn.paramTypes[param] || 'i64'}`).join(', ');
      lines.push(`    fn ${fn.name}(${params}) -> ${fn.returnType} {`);
      lines.push(...renderPcdStatements(fn.body, 2));
      lines.push('    }');
      lines.push('');
    }
  }
  if (lines[lines.length - 1] === '') lines.pop();
  lines.push('}', '');
  return lines.join('\n');
}

function collectImportSources(ast, baseDir, collected = new Map()) {
  for (const [name, importedAst] of Object.entries(ast.imports || {})) {
    const importPath = path.resolve(baseDir, `${name}.pcd`);
    if (!fs.existsSync(importPath)) {
      fail(66, `pcd_import_not_found:${name}`);
    }
    const realImportPath = workspacePath(importPath, 65, { mustExist: true, realpath: true });
    if (path.dirname(realImportPath) !== path.resolve(baseDir)) {
      fail(65, 'pcd_parse_error:import_path_outside_directory');
    }
    const source = fs.readFileSync(realImportPath, 'utf8');
    const prior = collected.get(name);
    const current = { name, importPath: realImportPath, source, semantic_pcd_sha256: sha256(source) };
    if (prior && prior.semantic_pcd_sha256 !== current.semantic_pcd_sha256) {
      fail(65, `polymerize_import_name_conflict:${name}`);
    }
    collected.set(name, current);
    collectImportSources(importedAst, path.dirname(importPath), collected);
  }
  return collected;
}

function materializePolymerImports(rootUnit, outPath) {
  const outDir = path.dirname(outPath);
  const importSources = collectImportSources(rootUnit.ast, path.dirname(rootUnit.resolvedFile));
  const materialized = [];
  for (const source of importSources.values()) {
    const targetPath = path.join(outDir, `${source.name}.pcd`);
    if (path.resolve(source.importPath) === path.resolve(targetPath)) {
      continue;
    }
    if (fs.existsSync(targetPath)) {
      const targetSource = fs.readFileSync(targetPath, 'utf8');
      if (sha256(targetSource) !== source.semantic_pcd_sha256) {
        fail(65, `polymerize_import_output_conflict:${source.name}`);
      }
      materialized.push({
        name: source.name,
        source: path.relative(process.cwd(), source.importPath),
        output: path.relative(process.cwd(), targetPath),
        semantic_pcd_sha256: source.semantic_pcd_sha256,
        reused: true
      });
      continue;
    }
    writeFileControlled(targetPath, source.source);
    materialized.push({
      name: source.name,
      source: path.relative(process.cwd(), source.importPath),
      output: path.relative(process.cwd(), targetPath),
      semantic_pcd_sha256: source.semantic_pcd_sha256,
      reused: false
    });
  }
  return materialized;
}

function renderImportedFunctions(imports, target, seen = new Set()) {
  const lines = [];
  for (const [name, importedAst] of Object.entries(imports || {})) {
    if (seen.has(name)) continue;
    seen.add(name);
    lines.push(...renderImportedFunctions(importedAst.imports || {}, target, seen));
    const params = importedAst.params.length > 0 ? importedAst.params : ['input'];
    const fnName = importedFunctionName(name);
    if (target === 'python') {
      lines.push(`def ${fnName}(${params.map((param) => `${param}=0`).join(', ')}):`);
      lines.push(...renderStatements(importedAst.body, target, 1));
      if (!statementsAlwaysReturn(importedAst.body)) {
        lines.push('    raise RuntimeError("pcd import reached non-returning path")');
      }
      lines.push('');
      continue;
    }
    if (target === 'rust') {
      lines.push(`fn ${fnName}(${params.map((param) => `${param}: ${rustType(importedAst.paramTypes?.[param])}`).join(', ')}) -> ${rustType(importedAst.returnType)} {`);
      lines.push(...renderStatements(importedAst.body, target, 1).map((line) => line.replace(/^  /, '    ')));
      if (!statementsAlwaysReturn(importedAst.body)) {
        lines.push('    panic!("pcd import reached non-returning path");');
      }
      lines.push('}');
      lines.push('');
      continue;
    }
    lines.push(`function ${fnName}(${params.map((param) => `${param} = 0`).join(', ')}) {`);
    lines.push(...renderStatements(importedAst.body, target, 1));
    if (!statementsAlwaysReturn(importedAst.body)) {
      lines.push('  throw new Error("pcd import reached non-returning path");');
    }
    lines.push('}');
    lines.push('');
  }
  return lines;
}

function evaluateExpression(expression, env) {
  if (expression.type === 'NumberLiteral') return expression.value;
  if (expression.type === 'ConstLiteral') return expression.value;
  if (expression.type === 'Identifier') return env[expression.name] ?? 0;
  if (expression.type === 'UnaryExpression') return -evaluateExpression(expression.argument, env);
  if (expression.type === 'ListLiteral') return expression.elements.map((element) => evaluateExpression(element, env));
  if (expression.type === 'MapLiteral') {
    return Object.fromEntries(expression.entries.map((entry) => [entry.key, evaluateExpression(entry.value, env)]));
  }
  if (expression.type === 'IndexExpression') {
    const object = evaluateExpression(expression.object, env);
    const index = evaluateExpression(expression.index, env);
    if (!Array.isArray(object) || !Number.isInteger(index) || index < 0 || index >= object.length) {
      return undefined;
    }
    return object[index];
  }
  if (expression.type === 'LenExpression') {
    const argument = evaluateExpression(expression.argument, env);
    return Array.isArray(argument) ? argument.length : undefined;
  }
  if (expression.type === 'MemberExpression') {
    const object = evaluateExpression(expression.object, env);
    if (!object || Array.isArray(object) || typeof object !== 'object' || !(expression.key in object)) {
      return undefined;
    }
    return object[expression.key];
  }
  if (expression.type === 'HasExpression') {
    const object = evaluateExpression(expression.object, env);
    return object && !Array.isArray(object) && typeof object === 'object' && expression.key in object ? 1 : 0;
  }
  if (expression.type === 'CallExpression') {
    const imports = expression.local ? (env.__locals || {}) : (env.__imports || {});
    const importedAst = imports[expression.callee];
    if (!importedAst) return undefined;
    const args = expression.args.map((argument) => evaluateExpression(argument, env));
    const importedEnv = {
      __imports: importedAst.imports || env.__imports || {},
      __locals: env.__locals || {}
    };
    importedAst.params.forEach((param, index) => {
      importedEnv[param] = args[index];
    });
    return evaluateStatements(importedAst.body, importedEnv);
  }
  if (expression.type === 'MonomerCallExpression') {
    const args = expression.args.map((argument) => evaluateExpression(argument, env));
    if (args.some((value) => typeof value !== 'number')) return undefined;
    const u8 = (value) => ((value % 256) + 256) % 256;
    if (expression.operation === 'add') return u8(args[0] + args[1]);
    if (expression.operation === 'sub') return u8(args[0] - args[1]);
    if (expression.operation === 'mul') return u8(args[0] * args[1]);
    if (expression.operation === 'mod') return args[1] === 0 ? undefined : u8(args[0] % args[1]);
    if (expression.operation === 'inc') return u8(args[0] + 1);
    if (expression.operation === 'dec') return u8(args[0] - 1);
    if (expression.operation === 'abs') return Math.abs(args[0]);
    if (expression.operation === 'clamp') return Math.min(Math.max(args[0], args[1]), args[2]);
    if (expression.operation === 'and') return u8(args[0] & args[1]);
    if (expression.operation === 'or') return u8(args[0] | args[1]);
    if (expression.operation === 'xor') return u8(args[0] ^ args[1]);
    if (expression.operation === 'not') return u8(~args[0]);
    if (expression.operation === 'shl') return u8(args[0] << (args[1] & 7));
    if (expression.operation === 'shr') return u8(args[0] >> (args[1] & 7));
    if (expression.operation === 'rol') return u8((args[0] << (args[1] & 7)) | (args[0] >> (8 - (args[1] & 7))));
    if (expression.operation === 'ror') return u8((args[0] >> (args[1] & 7)) | (args[0] << (8 - (args[1] & 7))));
    if (expression.operation === 'fadd') return args[0] + args[1];
    if (expression.operation === 'fsub') return args[0] - args[1];
    if (expression.operation === 'fmul') return args[0] * args[1];
    if (expression.operation === 'fdiv') return args[1] === 0 ? 0 : args[0] / args[1];
    if (expression.operation === 'fmod') return args[1] === 0 ? 0 : args[0] % args[1];
    if (expression.operation === 'fabs') return Math.abs(args[0]);
    if (expression.operation === 'fneg') return -args[0];
    if (expression.operation === 'fsqrt') return Math.sqrt(args[0]);
    if (expression.operation === 'sin') return Math.sin(args[0]);
    if (expression.operation === 'cos') return Math.cos(args[0]);
    if (expression.operation === 'tan') return Math.tan(args[0]);
    if (expression.operation === 'atan2') return Math.atan2(args[0], args[1]);
    if (expression.operation === 'log') return Math.log(args[0]);
    if (expression.operation === 'exp') return Math.exp(args[0]);
    if (expression.operation === 'pow') return Math.pow(args[0], args[1]);
    if (expression.operation === 'floor') return Math.floor(args[0]);
    if ([
      'effect_boundary',
      'external_boundary',
      'contract_handle',
      'contract_unit',
      'contract_u32',
      'contract_u64',
      'contract_bool',
      'contract_bytes',
      'contract_json_parse',
      'contract_json_emit'
    ].includes(expression.operation)) return 0;
    return undefined;
  }
  if (expression.type === 'BinaryExpression') {
    const left = evaluateExpression(expression.left, env);
    if (expression.operator === '&&') return Boolean(left) && Boolean(evaluateExpression(expression.right, env));
    if (expression.operator === '||') return Boolean(left) || Boolean(evaluateExpression(expression.right, env));
    const right = evaluateExpression(expression.right, env);
    if (expression.operator === '+') return left + right;
    if (expression.operator === '-') return left - right;
    if (expression.operator === '*') return left * right;
    if (expression.operator === '/') return Math.trunc(left / right);
    if (expression.operator === '%') return left % right;
    if (expression.operator === '==') return left === right;
    if (expression.operator === '!=') return left !== right;
    if (expression.operator === '>') return left > right;
    if (expression.operator === '<') return left < right;
    if (expression.operator === '>=') return left >= right;
    if (expression.operator === '<=') return left <= right;
  }
  fail(70, 'internal_eval_error:unknown_expression');
}

function evaluateStatements(statements, env) {
  for (const statement of statements) {
    if (statement.type === 'ReturnStatement') {
      return evaluateExpression(statement.argument, env);
    }
    if (statement.type === 'IfStatement') {
      if (evaluateExpression(statement.condition, env)) {
        const consequent = evaluateStatements(statement.consequent, env);
        if (consequent !== undefined) return consequent;
      } else {
        const alternate = evaluateStatements(statement.alternate, env);
        if (alternate !== undefined) return alternate;
      }
    }
    if (statement.type === 'RepeatStatement') {
      for (let count = 0; count < statement.count; count += 1) {
        const repeated = evaluateStatements(statement.body, env);
        if (repeated !== undefined) return repeated;
      }
    }
  }
  return undefined;
}

function collectConditionValues(expression, values = new Set([0, 1, 2, 10])) {
  if (expression.type === 'NumberLiteral') {
    values.add(expression.value);
    values.add(expression.value + 1);
    values.add(expression.value - 1);
  }
  if (expression.type === 'ConstLiteral') {
    values.add(expression.value);
    values.add(expression.value + 1);
    values.add(expression.value - 1);
  }
  if (expression.type === 'UnaryExpression') collectConditionValues(expression.argument, values);
  if (expression.type === 'ListLiteral') {
    for (const element of expression.elements) collectConditionValues(element, values);
  }
  if (expression.type === 'MapLiteral') {
    for (const entry of expression.entries) collectConditionValues(entry.value, values);
  }
  if (expression.type === 'IndexExpression') {
    collectConditionValues(expression.object, values);
    collectConditionValues(expression.index, values);
  }
  if (expression.type === 'LenExpression') collectConditionValues(expression.argument, values);
  if (expression.type === 'MemberExpression') collectConditionValues(expression.object, values);
  if (expression.type === 'HasExpression') collectConditionValues(expression.object, values);
  if (expression.type === 'CallExpression') {
    for (const argument of expression.args) collectConditionValues(argument, values);
  }
  if (expression.type === 'MonomerCallExpression') {
    for (const argument of expression.args) collectConditionValues(argument, values);
  }
  if (expression.type === 'BinaryExpression') {
    collectConditionValues(expression.left, values);
    collectConditionValues(expression.right, values);
  }
  return values;
}

function collectStatementValues(statements, values = new Set([0, 1, 2, 10])) {
  for (const statement of statements) {
    if (statement.type === 'IfStatement') {
      collectConditionValues(statement.condition, values);
      collectStatementValues(statement.consequent, values);
      collectStatementValues(statement.alternate, values);
    }
    if (statement.type === 'RepeatStatement') {
      collectStatementValues(statement.body, values);
    }
  }
  return values;
}

function generatedCases(ast) {
  const params = ast.params.length > 0 ? ast.params : ['input'];
  const inputs = [...collectStatementValues(ast.body)]
    .filter((value) => Number.isInteger(value) && Math.abs(value) < 100000)
    .slice(0, 12);
  return inputs
    .map((input) => {
      const args = Object.fromEntries(params.map((param, index) => [param, index === 0 ? input : 1]));
      return {
        input,
        args,
        expected: evaluateStatements(ast.body, {
          ...args,
          __imports: ast.imports || {},
          __locals: ast.functions || {}
        })
      };
    })
    .filter((testCase) => testCase.expected !== undefined)
    .slice(0, 8);
}

function ensureExecutable(ast) {
  const cases = generatedCases(ast);
  if (cases.length === 0) {
    fail(65, 'pcd_parse_error:no_executable_return_path');
  }
  return cases;
}

function rustLiteral(value, type) {
  if (type === 'f64') return Number.isInteger(value) ? `${value}.0` : String(value);
  if (type === 'bool') return value ? 'true' : 'false';
  return String(Number.isFinite(value) ? Math.trunc(value) : 0);
}

function targetSpec(target, ast) {
  const astJson = encodedAst(ast);
  const cases = ensureExecutable(ast);
  const params = ast.params.length > 0 ? ast.params : ['input'];
  const tsParams = params.map((param) => `${param} = 0`).join(', ');
  const rustParams = params.map((param) => `${param}: ${rustType(ast.paramTypes?.[param])}`).join(', ');
  const pythonParams = params.map((param) => `${param}=0`).join(', ');
  const tsStatements = renderStatements(ast.body, 'ts', 1);
  const rustStatements = renderStatements(ast.body, 'rust', 1);
  const pythonStatements = renderStatements(ast.body, 'python', 1);
  const tsImports = renderImportedFunctions(ast.imports, 'ts');
  const rustImports = renderImportedFunctions(ast.imports, 'rust');
  const pythonImports = renderImportedFunctions(ast.imports, 'python');
  const tsHelpers = renderLocalFunctions(ast, 'ts');
  const rustHelpers = renderLocalFunctions(ast, 'rust');
  const pythonHelpers = renderLocalFunctions(ast, 'python');
  const safeName = ast.fnName.replace(/[^A-Za-z0-9_]/g, '_');
  const tsProgram = (hash) => [
    '// BRIK64 beta14 functional emission candidate',
    '// claim: local candidate evidence only',
    `export const pcdSha256 = "${hash}";`,
    `export const pcdAst = ${astJson};`,
    ...tsImports,
    ...tsHelpers,
    `export function run(${tsParams}) {`,
    ...tsStatements,
    ...(statementsAlwaysReturn(ast.body) ? [] : ['  throw new Error("pcd execution reached non-returning path");']),
    '}',
    '',
  ].join('\n');
  const tsTest = (hash, importPath = './program.mjs') => [
    `import { pcdSha256, run } from "${importPath}";`,
    '',
    'if (pcdSha256 !== "' + hash + '") throw new Error("pcd hash mismatch");',
    `const cases = ${JSON.stringify(cases)};`,
    'for (const testCase of cases) {',
    `  const actual = run(${params.map((param) => `testCase.args.${param}`).join(', ')});`,
    '  if (actual !== testCase.expected) {',
    '    throw new Error(`case ${testCase.input} expected ${testCase.expected} got ${actual}`);',
    '  }',
    '}',
    'console.log("brik64 generated ts test: PASS");',
    '',
  ].join('\n');
  const rustProgram = (hash) => [
    '// BRIK64 beta14 functional emission candidate',
    '// claim: local candidate evidence only',
    '#![allow(clippy::needless_return)]',
    `pub const PCD_SHA256: &str = "${hash}";`,
    `pub const PCD_AST_JSON: &str = r#"${astJson}"#;`,
    ...rustImports,
    ...rustHelpers,
    `pub fn run(${rustParams}) -> ${rustType(ast.returnType)} {`,
    ...rustStatements.map((line) => line.replace(/^  /, '    ')),
    ...(statementsAlwaysReturn(ast.body) ? [] : ['    panic!("pcd execution reached non-returning path");']),
    '}',
    '',
  ].join('\n');
  const rustTestMain = (hash) => [
    '#![allow(clippy::needless_return)]',
    `const PCD_SHA256: &str = "${hash}";`,
    `const PCD_AST_JSON: &str = r#"${astJson}"#;`,
    ...rustImports,
    ...rustHelpers,
    `fn run(${rustParams}) -> ${rustType(ast.returnType)} {`,
    ...rustStatements.map((line) => line.replace(/^  /, '    ')),
    ...(statementsAlwaysReturn(ast.body) ? [] : ['    panic!("pcd execution reached non-returning path");']),
    '}',
    '',
    'fn main() {',
    `    assert_eq!(PCD_SHA256, "${hash}");`,
    '    assert!(PCD_AST_JSON.contains("body"));',
    ...cases.map((testCase) => `    assert_eq!(run(${params.map((param) => rustLiteral(testCase.args[param], ast.paramTypes?.[param])).join(', ')}), ${rustLiteral(testCase.expected, ast.returnType)});`),
    '    println!("brik64 generated rust test: PASS");',
    '}',
    '',
  ].join('\n');
  const rustLib = (hash) => [
    ...rustProgram(hash).trimEnd().split('\n'),
    '',
    '#[cfg(test)]',
    'mod tests {',
    '    use super::*;',
    '',
    '    #[test]',
    '    fn generated_cases_pass() {',
    `        assert_eq!(PCD_SHA256, "${hash}");`,
    '        assert!(PCD_AST_JSON.contains("body"));',
    ...cases.map((testCase) => `        assert_eq!(run(${params.map((param) => rustLiteral(testCase.args[param], ast.paramTypes?.[param])).join(', ')}), ${rustLiteral(testCase.expected, ast.returnType)});`),
    '    }',
    '}',
    '',
  ].join('\n');
  const pythonProgram = (hash) => [
    '# BRIK64 beta14 functional emission candidate',
    '# claim: local candidate evidence only',
    `PCD_SHA256 = "${hash}"`,
    `PCD_AST_JSON = ${JSON.stringify(JSON.stringify(ast))}`,
    '',
    ...pythonImports,
    ...pythonHelpers,
    `def run(${pythonParams}):`,
    ...pythonStatements,
    ...(statementsAlwaysReturn(ast.body) ? [] : ['    raise RuntimeError("pcd execution reached non-returning path")']),
    '',
  ].join('\n');
  const pythonTest = (hash, importLine = 'from program import PCD_SHA256, run') => [
    importLine,
    '',
    `assert PCD_SHA256 == "${hash}"`,
    `cases = ${JSON.stringify(cases)}`,
    'for case in cases:',
    `    actual = run(${params.map((param) => `case["args"]["${param}"]`).join(', ')})`,
    '    assert actual == case["expected"], f"case {case[\'input\']} expected {case[\'expected\']} got {actual}"',
    'print("brik64 generated python test: PASS")',
    '',
  ].join('\n');
  const specs = {
    ts: {
      program: 'program.mjs',
      extension: '.mjs',
      test: 'program.test.mjs',
      code: tsProgram,
      testCode: (hash, importPath) => tsTest(hash, importPath),
      scaffoldFiles: (hash) => ({
        'package.json': JSON.stringify({
          name: `brik64-generated-${safeName}`,
          version: '0.0.0-beta14-local',
          private: true,
          type: 'module',
          scripts: { test: 'node program.test.mjs' }
        }, null, 2) + '\n',
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'ES2022',
            moduleResolution: 'Bundler',
            strict: true,
            noEmit: true
          },
          include: ['program.mjs', 'program.test.mjs', 'src/**/*.mjs']
        }, null, 2) + '\n',
        'src/program.mjs': tsProgram(hash),
        'src/program.test.mjs': tsTest(hash, './program.mjs')
      })
    },
    rust: {
      program: 'program.rs',
      extension: '.rs',
      test: 'program_test.rs',
      code: rustProgram,
      testCode: rustTestMain,
      scaffoldFiles: (hash) => ({
        'Cargo.toml': [
          '[package]',
          `name = "brik64-generated-${safeName.replace(/_/g, '-')}"`,
          'version = "0.0.0-beta14-local"',
          'edition = "2021"',
          'publish = false',
          '',
          '[lib]',
          'path = "src/lib.rs"',
          '',
        ].join('\n'),
        'src/lib.rs': rustLib(hash)
      })
    },
    python: {
      program: 'program.py',
      extension: '.py',
      test: 'test_program.py',
      code: pythonProgram,
      testCode: (hash, importLine) => pythonTest(hash, importLine),
      scaffoldFiles: (hash) => ({
        'pyproject.toml': [
          '[project]',
          `name = "brik64-generated-${safeName.replace(/_/g, '-')}"`,
        'version = "0.0.0-beta14-local"',
          'requires-python = ">=3.10"',
          '',
          '[tool.brik64]',
          'claim_boundary = "local_candidate_only"',
          '',
        ].join('\n'),
        'brik64_generated/__init__.py': 'from .program import PCD_SHA256, PCD_AST_JSON, run\n',
        'brik64_generated/program.py': pythonProgram(hash),
        'tests/test_program.py': pythonTest(hash, 'from brik64_generated.program import PCD_SHA256, run')
      })
    },
  };
  return specs[target] || null;
}

function emitPaths(outArg, spec, target) {
  const resolved = workspacePath(outArg, 64, { output: true });
  const ext = path.extname(resolved);
  const looksLikeFile = ext.length > 0;
  if (!looksLikeFile) {
    return {
      mode: 'directory',
      outDir: resolved,
      programPath: path.join(resolved, spec.program),
      testPath: path.join(resolved, spec.test)
    };
  }
  const expected = target === 'ts' ? new Set(['.mjs', '.js', '.ts']) : new Set([spec.extension]);
  if (!expected.has(ext)) {
    fail(64, `emit_output_extension_mismatch:${ext || 'none'}:${target}`);
  }
  const dir = path.dirname(resolved);
  const base = path.basename(resolved, ext);
  const testName = target === 'rust'
    ? `${base}_test.rs`
    : target === 'python'
      ? `test_${base}.py`
      : `${base}.test.mjs`;
  return {
    mode: 'file',
    outDir: dir,
    programPath: resolved,
    testPath: path.join(dir, testName)
  };
}

function certify(file) {
  validateManifest();
  const resolvedFile = workspacePath(file, 64, { mustExist: true, realpath: true });
  const source = readFileRequired(file);
  const ast = parsePcd(source, { baseDir: path.dirname(resolvedFile), importStack: [resolvedFile] });
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
  const resolvedFile = workspacePath(file, 64, { mustExist: true, realpath: true });
  const source = readFileRequired(file);
  const ast = parsePcd(source, { baseDir: path.dirname(resolvedFile), importStack: [resolvedFile] });
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
    const paths = emitPaths(options.outDir, spec, options.target);
    mkdirControlled(paths.outDir);
    const { programPath, testPath } = paths;
    writeFileControlled(programPath, spec.code(cert.semantic_pcd_sha256));
    if (options.tests) {
      const importPath = `./${path.basename(programPath)}`;
      if (options.target === 'ts') {
        writeFileControlled(testPath, spec.testCode(cert.semantic_pcd_sha256, importPath));
      } else if (options.target === 'python') {
        writeFileControlled(testPath, spec.testCode(cert.semantic_pcd_sha256, `from ${path.basename(programPath, '.py')} import PCD_SHA256, run`));
      } else {
        writeFileControlled(testPath, spec.testCode(cert.semantic_pcd_sha256));
      }
      if (paths.mode === 'directory') {
        const scaffoldFiles = spec.scaffoldFiles ? spec.scaffoldFiles(cert.semantic_pcd_sha256) : {};
        for (const [relativePath, content] of Object.entries(scaffoldFiles)) {
          const scaffoldPath = path.join(paths.outDir, relativePath);
          mkdirControlled(path.dirname(scaffoldPath));
          writeFileControlled(scaffoldPath, content);
        }
      }
    }
    process.stdout.write(`generated=${path.relative(process.cwd(), programPath)}\n`);
    if (options.tests) process.stdout.write(`tests=${path.relative(process.cwd(), testPath)}\n`);
    return;
  }
  process.stdout.write('// BRIK64 beta14 functional emission candidate\n');
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
    fail(69, 'managed_verify_endpoint_unavailable_beta14');
  }
  const resolvedFile = workspacePath(file, 64, { mustExist: true, realpath: true });
  const source = readFileRequired(file);
  const ast = parsePcd(source, { baseDir: path.dirname(resolvedFile), importStack: [resolvedFile] });
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
    '--json': 'boolean',
    '--inline': 'boolean'
  });
  if (parsed['--local'] && parsed['--cloud']) {
    fail(64, 'polymerize_mode_conflict');
  }
  requireLocalOrEntitled(parsed);
  if (parsed['--cloud']) {
    fail(69, 'managed_polymerize_endpoint_unavailable_beta14');
  }
  const files = parsed._;
  if (files.length === 0) {
    fail(64, 'missing_polymerize_inputs');
  }
  const units = files.map((file) => {
    const resolvedFile = workspacePath(file, 64, { mustExist: true, realpath: true });
    const source = readFileRequired(file);
    const ast = parsePcd(source, { baseDir: path.dirname(resolvedFile), importStack: [resolvedFile] });
    return {
      file,
      resolvedFile,
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
  const outPath = workspacePath(outFile, 64, { output: true });
  const rootUnit = units[units.length - 1];
  const inlineRequested = parsed['--inline'] || units.length > 1;
  const content = inlineRequested ? renderInlinePolymer(units) : renderSemanticPolymer(rootUnit, units);
  writeFileControlled(outPath, content);
  const materializedImports = inlineRequested ? [] : materializePolymerImports(rootUnit, outPath);
  const manifestSources = units.map((unit) => ({
    file: unit.file,
    semantic_pcd_sha256: unit.semantic_pcd_sha256,
    ast: unit.ast
  }));
  const manifest = {
    schemaVersion: 'brik64.cli_polymer_manifest.v1',
    cliVersion: version,
    mode: 'local',
    semanticMode: inlineRequested ? (parsed['--inline'] ? 'inline_merged_functions' : 'inline_merged_functions_default') : 'root_dag_reference',
    root: {
      file: rootUnit.file,
      pcName: rootUnit.ast.pcName,
      fnName: rootUnit.ast.fnName,
      semantic_pcd_sha256: rootUnit.semantic_pcd_sha256
    },
    output: path.relative(process.cwd(), outPath),
    output_sha256: sha256(content),
    materializedImports,
    sources: manifestSources,
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
  const parsed = parseArgs(args.map((arg) => (arg === '-f' ? '--force' : arg)), {
    '--out': 'value',
    '--in-place': 'boolean',
    '--json': 'boolean',
    '--force': 'boolean',
    '--dry-run': 'boolean'
  });
  if (parsed['--out'] && parsed['--in-place']) {
    fail(64, 'migrate_output_mode_conflict');
  }
  const source = readFileRequired(file);
  const resolvedFile = workspacePath(file, 64, { mustExist: true, realpath: true });
  const oldHash = sha256(source);
  let migrated = source;
  let syntax = 'beta14';
  if (/\bcircuit\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/m.test(source)) {
    migrated = migrated.replace(/\bcircuit\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/m, 'PC $1 {');
    syntax = 'legacy_circuit';
  } else if (/\bpc\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/m.test(source)) {
    migrated = migrated.replace(/\bpc\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/m, 'PC $1 {');
    syntax = 'legacy_lowercase_pc';
  } else {
    const legacyFn = source.match(/^\s*pcd\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([A-Za-z0-9_]+)\s*)?\{([\s\S]*)\}\s*$/m);
    if (legacyFn) {
      const [, name, params, returnType = 'i64', body] = legacyFn;
      migrated = [
        `PC ${name} {`,
        `    fn ${name}(${params}) -> ${returnType} {`,
        ...body.trim().split('\n').map((line) => `        ${line.trim()}`),
        '    }',
        '}',
        ''
      ].join('\n');
      syntax = 'legacy_pcd_function';
    }
  }
  parsePcd(migrated, { baseDir: path.dirname(resolvedFile), importStack: [resolvedFile] });
  const inputPath = resolvedFile;
  let outPath;
  if (parsed['--dry-run']) {
    outPath = parsed['--out'] ? workspacePath(parsed['--out'], 64, { output: true }) : inputPath;
  } else if (parsed['--in-place']) {
    const backupPath = `${inputPath}.bak`;
    if (!fs.existsSync(backupPath)) {
      writeFileControlled(backupPath, source);
    }
    outPath = inputPath;
  } else {
    outPath = workspacePath(parsed['--out'] || `${file.replace(/\.pcd$/, '')}.beta14.pcd`, 64, { output: true });
    if (fs.existsSync(outPath) && !parsed['--force']) {
      fail(73, `output_exists:${path.relative(process.cwd(), outPath)}`);
    }
  }
  if (!parsed['--dry-run']) writeFileControlled(outPath, migrated);
  const report = {
    schemaVersion: 'brik64.cli_pcd_migration_report.v1',
    cliVersion: version,
    source: file,
    output: path.relative(process.cwd(), outPath),
    dryRun: Boolean(parsed['--dry-run']),
    detectedSyntax: syntax,
    old_sha256: oldHash,
    new_sha256: sha256(migrated)
  };
  if (parsed['--json']) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(`migrated=${report.output}\n`);
  if (report.dryRun) process.stdout.write('dry_run=true\n');
  process.stdout.write(`old_sha256=${report.old_sha256}\n`);
  process.stdout.write(`new_sha256=${report.new_sha256}\n`);
}

function normalizeLiftExpression(expression, language) {
  let value = String(expression || '').trim();
  if (!value) return null;
  value = value
    .replace(/===/g, '==')
    .replace(/!==/g, '!=')
    .replace(/\btrue\b/gi, '1')
    .replace(/\bfalse\b/gi, '0');
  value = value
    .replace(/\bMath\.abs\s*\(/g, 'MC_06.ABS(')
    .replace(/\babs\s*\(/g, 'MC_06.ABS(');
  const jsClamp = value.match(/^Math\.min\s*\(\s*Math\.max\s*\((.+?),\s*(.+?)\)\s*,\s*(.+?)\s*\)$/);
  if (jsClamp) value = `MC_07.CLAMP(${jsClamp[1].trim()}, ${jsClamp[2].trim()}, ${jsClamp[3].trim()})`;
  const pyClamp = value.match(/^min\s*\(\s*max\s*\((.+?),\s*(.+?)\)\s*,\s*(.+?)\s*\)$/);
  if (pyClamp) value = `MC_07.CLAMP(${pyClamp[1].trim()}, ${pyClamp[2].trim()}, ${pyClamp[3].trim()})`;
  if (language === 'python') {
    value = value.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
  }
  if (/[^A-Za-z0-9_+\-*/%<>=!&|()[\],{}:.\s]/.test(value)) return null;
  return value;
}

function sanitizeCandidateName(name, fallback) {
  const safe = String(name || fallback || 'candidate').replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(safe) ? safe : `candidate_${safe}`;
}

function simpleBodyLinesFromSource(body, language) {
  const lines = [];
  const inlineIfPattern = language === 'python'
    ? /^[ \t]*if\s+(.+?)\s*:\s*\n[ \t]+return\s+(.+)$/gm
    : /\bif\s*\(([^)]+)\)\s*return\s+([^;]+);?/g;
  let match;
  while ((match = inlineIfPattern.exec(body))) {
    const condition = normalizeLiftExpression(match[1], language);
    const value = normalizeLiftExpression(match[2], language);
    if (condition && value) lines.push(`        if (${condition}) return ${value};`);
  }
  const returns = [...body.matchAll(language === 'python' ? /^[ \t]*return\s+(.+)$/gm : /\breturn\s+([^;]+);?/g)];
  if (returns.length > 0) {
    const final = normalizeLiftExpression(returns[returns.length - 1][1], language);
    if (final) lines.push(`        return ${final};`);
  }
  return lines.length > 0 ? lines : null;
}

function buildCandidatePcd(name, params, expression, options = {}) {
  const safeName = sanitizeCandidateName(name, 'candidate');
  const safeParams = params.map((param) => sanitizeCandidateName(param, 'input'));
  const signature = safeParams.map((param) => `${param}: i64`).join(', ');
  const bodyLines = options.bodyLines || [`        return ${expression};`];
  const sourceComment = options.sourceComment
    ? options.sourceComment.split('\n').slice(0, 40).map((line) => `// source: ${line.slice(0, 160)}`)
    : [];
  return [
    '// brik64.pcd_file.v1',
    `// generated_by: brik64-cli ${version} lift preview`,
    '// claim_boundary: local_candidate_only',
    ...sourceComment,
    'PC ' + safeName + ' {',
    `    fn ${safeName}(${signature}) -> i64 {`,
    ...bodyLines,
    '    }',
    '}',
    ''
  ].join('\n');
}

function extractJsLikeLiftCandidates(source, language) {
  const candidates = [];
  const warnings = [];
  const functionPattern = /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?::\s*[A-Za-z0-9_<>\[\]| ]+)?\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = functionPattern.exec(source))) {
    const name = match[1];
    const params = match[2].split(',').map((param) => param.trim().replace(/:.*/, '').trim()).filter(Boolean);
    const returnMatch = match[3].match(/\breturn\s+([^;]+);?/);
    const expression = normalizeLiftExpression(returnMatch && returnMatch[1], language);
    if (!expression) {
      warnings.push({ code: 'unsupported_construct', function: name, reason: 'missing_or_unsupported_return_expression' });
      continue;
    }
    candidates.push({ name, params, expression, bodyLines: simpleBodyLinesFromSource(match[3], language), sourceBody: match[3] });
  }
  const arrowPattern = /\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(?([^)=]*)\)?\s*=>\s*(?:\{[\s\S]*?\breturn\s+([^;]+);?\s*\}|([^;\n]+))/g;
  while ((match = arrowPattern.exec(source))) {
    const name = match[1];
    const params = match[2].split(',').map((param) => param.trim().replace(/:.*/, '').trim()).filter(Boolean);
    const expression = normalizeLiftExpression(match[3] || match[4], language);
    if (!expression) {
      warnings.push({ code: 'unsupported_construct', function: name, reason: 'missing_or_unsupported_arrow_expression' });
      continue;
    }
    candidates.push({ name, params, expression, bodyLines: match[3] ? simpleBodyLinesFromSource(match[3], language) : [`        return ${expression};`], sourceBody: match[3] || match[4] });
  }
  if (/\b(class|async|await|for|while|switch|try|catch)\b/.test(source)) {
    warnings.push({ code: 'unsupported_construct_present', reason: 'control_flow_or_runtime_construct_requires_future_lifter' });
  }
  return { candidates, warnings };
}

function extractPythonLiftCandidates(source) {
  const candidates = [];
  const warnings = [];
  const functionPattern = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?\s*:\s*\n((?:[ \t]+.*\n?)*)/gm;
  let match;
  while ((match = functionPattern.exec(source))) {
    const name = match[1];
    const params = match[2].split(',').map((param) => param.trim().replace(/:.*/, '').replace(/=.*/, '').trim()).filter(Boolean);
    const returnMatch = match[3].match(/^[ \t]+return\s+(.+)$/m);
    const expression = normalizeLiftExpression(returnMatch && returnMatch[1], 'python');
    if (!expression) {
      warnings.push({ code: 'unsupported_construct', function: name, reason: 'missing_or_unsupported_return_expression' });
      continue;
    }
    candidates.push({ name, params, expression, bodyLines: simpleBodyLinesFromSource(match[3], 'python'), sourceBody: match[3] });
  }
  if (/\b(class|async|await|for|while|try|except|with)\b/.test(source)) {
    warnings.push({ code: 'unsupported_construct_present', reason: 'control_flow_or_runtime_construct_requires_future_lifter' });
  }
  return { candidates, warnings };
}

function extractRustLiftCandidates(source) {
  const candidates = [];
  const warnings = [];
  const functionPattern = /\b(?:pub\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*[A-Za-z0-9_]+)?\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = functionPattern.exec(source))) {
    const name = match[1];
    const params = match[2].split(',').map((param) => param.trim().replace(/:.*/, '').trim()).filter(Boolean);
    const returnMatch = match[3].match(/\breturn\s+([^;]+);?/) || match[3].trim().match(/^(.+?);?$/m);
    const expression = normalizeLiftExpression(returnMatch && returnMatch[1], 'rust');
    if (!expression) {
      warnings.push({ code: 'unsupported_construct', function: name, reason: 'missing_or_unsupported_return_expression' });
      continue;
    }
    candidates.push({ name, params, expression, bodyLines: simpleBodyLinesFromSource(match[3], 'rust') || [`        return ${expression};`], sourceBody: match[3] });
  }
  if (/\b(struct|enum|impl|trait|async|await|for|while|loop|match|unsafe)\b/.test(source)) {
    warnings.push({ code: 'unsupported_construct_present', reason: 'rust_complex_construct_requires_future_lifter' });
  }
  return { candidates, warnings };
}

function liftSourceFiles(resolved, language) {
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory()) return [resolved];
  const extensions = {
    js: new Set(['.js', '.mjs', '.cjs']),
    ts: new Set(['.ts', '.tsx']),
    python: new Set(['.py']),
    rust: new Set(['.rs'])
  }[language];
  const files = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      if (['.git', '.brik', 'node_modules', 'target', 'dist', 'build'].includes(name)) continue;
      const file = path.join(dir, name);
      const childStat = fs.lstatSync(file);
      if (childStat.isSymbolicLink()) continue;
      if (childStat.isDirectory()) {
        walk(file);
        continue;
      }
      if (extensions.has(path.extname(name))) files.push(file);
    }
  }
  walk(resolved);
  if (files.length === 0) fail(66, `lift_no_source_files:${language}`);
  if (files.length > 256) fail(65, 'lift_source_file_limit_exceeded');
  return files;
}

function lift(language, sourcePath, args = []) {
  const parsed = parseArgs(args, {
    '--preview': 'boolean',
    '--out': 'value',
    '--json': 'boolean',
    '--stub-only': 'boolean',
    '--include-source-comment': 'boolean'
  });
  if (!['js', 'ts', 'python', 'rust'].includes(language)) fail(64, `lift_language_unsupported:${language}`);
  if (!parsed['--preview']) fail(64, 'lift_preview_required');
  const resolved = workspacePath(sourcePath, 64, { mustExist: true, realpath: true });
  const files = liftSourceFiles(resolved, language);
  const chunks = files.map((file) => fs.readFileSync(file, 'utf8'));
  const source = chunks.join('\n');
  if (source.includes('\u0000')) fail(65, 'lift_binary_input');
  if (Buffer.byteLength(source, 'utf8') > 1024 * 1024) fail(65, 'lift_source_too_large');
  const sourceSha256 = sha256(source);
  const outDir = workspacePath(
    parsed['--out'] || path.join('.brik', 'lift-preview', `${language}-${sourceSha256.slice(0, 8)}`),
    64,
    { output: true }
  );
  const extracted = language === 'python'
    ? extractPythonLiftCandidates(source)
    : language === 'rust'
      ? extractRustLiftCandidates(source)
      : extractJsLikeLiftCandidates(source, language);
  const candidatesDir = path.join(outDir, 'candidates');
  mkdirControlled(candidatesDir);
  const written = [];
  const warnings = [...extracted.warnings];
  for (const candidate of extracted.candidates) {
    const pcd = buildCandidatePcd(candidate.name, candidate.params, candidate.expression, {
      bodyLines: parsed['--stub-only'] ? [`        return ${candidate.expression};`] : candidate.bodyLines,
      sourceComment: parsed['--include-source-comment'] ? candidate.sourceBody : null
    });
    try {
      parsePcd(pcd, { baseDir: candidatesDir });
    } catch (_) {
      warnings.push({ code: 'candidate_validation_failed', function: candidate.name });
      continue;
    }
    const fileName = `${sanitizeCandidateName(candidate.name, 'candidate')}.pcd`;
    writeFileControlled(path.join(candidatesDir, fileName), pcd);
    written.push({
      function: candidate.name,
      file: path.join('candidates', fileName),
      semantic_pcd_sha256: sha256(pcd),
      translationStatus: parsed['--stub-only'] ? 'stub' : (candidate.bodyLines ? 'best_effort_simple_body' : 'expression_only')
    });
  }
  const manifest = {
    schemaVersion: 'brik64.cli_lift_preview.v1',
    cliVersion: version,
    language,
    source: {
      pathHash: sha256(path.relative(process.cwd(), resolved)),
      sourceSha256,
      bytes: Buffer.byteLength(source, 'utf8'),
      fileCount: files.length,
      rawSourceIncluded: false,
      rawSourceCommentIncluded: Boolean(parsed['--include-source-comment']),
      absolutePathIncluded: false
    },
    previewOnly: true,
    certificatesGenerated: false,
    networkSent: false,
    candidateCount: written.length,
    warningCount: warnings.length,
    candidates: written,
    warningCodes: [...new Set(warnings.map((warning) => warning.code))].sort(),
    claimBoundary: 'local_candidate_only'
  };
  mkdirControlled(outDir);
  writeFileControlled(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileControlled(path.join(outDir, 'warnings.jsonl'), warnings.map((warning) => JSON.stringify(warning)).join('\n') + (warnings.length ? '\n' : ''));
  if (parsed['--json']) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }
  process.stdout.write(`lift_preview=${path.relative(process.cwd(), outDir)}\n`);
  process.stdout.write(`candidates=${written.length}\n`);
  process.stdout.write(`warnings=${warnings.length}\n`);
}

function adoptionReport(args = []) {
  const parsed = parseArgs(args, { '--json': 'boolean', '--out': 'value' });
  const previewRoot = path.resolve('.brik', 'lift-preview');
  const manifests = [];
  if (fs.existsSync(previewRoot)) {
    for (const dir of fs.readdirSync(previewRoot).sort()) {
      const manifestPath = path.join(previewRoot, dir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifests.push({ dir, manifest });
      } catch (_) {
        manifests.push({ dir, manifest: null, parseError: true });
      }
    }
  }
  const pcds = pcdInventory();
  const report = {
    schemaVersion: 'brik64.cli_adoption_report.v1',
    cliVersion: version,
    status: 'PASS',
    liftPreviewRuns: manifests.length,
    scannedFiles: manifests.filter((entry) => entry.manifest).length,
    generatedCandidates: manifests.reduce((sum, entry) => sum + (entry.manifest ? entry.manifest.candidateCount || 0 : 0), 0),
    unsupportedWarnings: manifests.reduce((sum, entry) => sum + (entry.manifest ? entry.manifest.warningCount || 0 : 0), 0),
    pcdInventoryCount: pcds.length,
    pcdInventorySha256: sha256(JSON.stringify(pcds)),
    privacy: {
      rawSourceIncluded: false,
      networkSent: false,
      absolutePathIncluded: false
    },
    claimBoundary: 'local_candidate_only'
  };
  if (parsed['--out']) {
    const out = workspacePath(parsed['--out'], 64, { output: true });
    mkdirControlled(path.dirname(out));
    writeFileControlled(out, JSON.stringify(report, null, 2) + '\n');
  }
  if (parsed['--json']) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write('BRIK64 adoption report\n');
  process.stdout.write(`lift preview runs: ${report.liftPreviewRuns}\n`);
  process.stdout.write(`generated candidates: ${report.generatedCandidates}\n`);
  process.stdout.write(`unsupported warnings: ${report.unsupportedWarnings}\n`);
  process.stdout.write(`pcd inventory: ${report.pcdInventoryCount}\n`);
}

function buildExplainReport(file) {
  const resolvedFile = workspacePath(file, 64, { mustExist: true, realpath: true });
  const source = readFileRequired(file);
  try {
    const ast = parsePcd(source, { baseDir: path.dirname(resolvedFile), importStack: [resolvedFile] });
    return {
      schemaVersion: 'brik64.cli_explain_report.v1',
      cliVersion: version,
      status: 'PASS',
      file,
      semantic_pcd_sha256: sha256(source),
      pcName: ast.pcName,
      fnName: ast.fnName,
      constants: ast.constants,
      importGraph: ast.importGraph,
      branchCount: ast.branchCount,
      diagnostics: {
        errors: [],
        warnings: [],
        actions: ['PCD parsed successfully. Run `brik64 certify <file.pcd>` to create local candidate evidence.']
      },
      claimBoundary: 'local_candidate_only'
    };
  } catch (error) {
    return {
      schemaVersion: 'brik64.cli_explain_report.v1',
      cliVersion: version,
      status: 'FAIL',
      file,
      semantic_pcd_sha256: sha256(source),
      diagnostics: {
        errors: [redactValue(error && error.message ? error.message : 'pcd_parse_error')],
        warnings: [],
        actions: ['Review the reported parser/type/import rule. If legacy syntax is detected, run `brik64 migrate <file.pcd>`.']
      },
      claimBoundary: 'local_candidate_only'
    };
  }
}

function explain(file, args = []) {
  const parsed = parseArgs(args, { '--json': 'boolean' });
  const report = buildExplainReport(file);
  if (parsed['--json']) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`BRIK64 explain\n`);
    process.stdout.write(`status: ${report.status}\n`);
    process.stdout.write(`file: ${file}\n`);
    if (report.status === 'PASS') {
      process.stdout.write(`pc: ${report.pcName}\n`);
      process.stdout.write(`fn: ${report.fnName}\n`);
      process.stdout.write(`constants: ${Object.keys(report.constants || {}).length}\n`);
      process.stdout.write(`imports: ${Object.keys(report.importGraph || {}).length}\n`);
    }
    for (const error of report.diagnostics.errors) process.stdout.write(`error: ${error}\n`);
    for (const action of report.diagnostics.actions) process.stdout.write(`action: ${action}\n`);
  }
  if (report.status !== 'PASS') process.exit(65);
}

function lock(args = []) {
  validateManifest();
  const parsed = parseArgs(args, { '--json': 'boolean', '--files': 'value', '--skip-errors': 'boolean' });
  const explicitFiles = [];
  if (parsed['--files']) {
    explicitFiles.push(...parsed['--files'].split(',').map((item) => item.trim()).filter(Boolean));
  }
  explicitFiles.push(...parsed._);
  const pcds = explicitFiles.length > 0
    ? explicitFiles.map((file) => {
      const resolved = workspacePath(file, 64, { mustExist: true, realpath: true });
      const source = fs.readFileSync(resolved, 'utf8');
      return { file: path.relative(process.cwd(), resolved), semantic_pcd_sha256: sha256(source), bytes: Buffer.byteLength(source, 'utf8') };
    })
    : pcdInventory();
  const entries = [];
  const parseErrors = [];
  for (const item of pcds) {
    const filePath = path.resolve(item.file);
    const source = fs.readFileSync(filePath, 'utf8');
    const validation = validatePcdFileWithExplain(item.file);
    if (!validation.ok) {
      parseErrors.push({ file: item.file, error: validation.error });
      if (!parsed['--skip-errors']) {
        fail(65, `pcd_parse_error:${item.file}:${validation.error}`);
      }
      continue;
    }
    const ast = parsePcd(source, { baseDir: path.dirname(filePath), importStack: [filePath] });
    entries.push({
      file: item.file,
      semantic_pcd_sha256: item.semantic_pcd_sha256,
      ast_sha256: sha256(JSON.stringify(ast)),
      importGraph: ast.importGraph,
      constants: ast.constants
    });
  }
  if (entries.length === 0 && parseErrors.length > 0) {
    fail(65, `pcd_parse_error:${parseErrors[0].file}:${parseErrors[0].error}`);
  }
  const lockFile = {
    schemaVersion: 'brik64.cli_lockfile.v1',
    cliVersion: version,
    generatedAt: new Date().toISOString(),
    releaseEligible: false,
    partial: parseErrors.length > 0,
    errors: parseErrors,
    pcds: entries,
    lock_sha256: sha256(JSON.stringify(entries)),
    claimBoundary: 'local_candidate_only'
  };
  writeFileControlled(path.resolve('brik64.lock.json'), JSON.stringify(lockFile, null, 2) + '\n');
  if (parsed['--json']) {
    process.stdout.write(`${JSON.stringify(lockFile, null, 2)}\n`);
    return;
  }
  process.stdout.write('lock=brik64.lock.json\n');
  process.stdout.write(`pcd_count=${entries.length}\n`);
  process.stdout.write(`lock_sha256=${lockFile.lock_sha256}\n`);
}

async function telemetry(args = []) {
  const sub = args[0];
  const config = readTelemetryConfig();
  if (sub === 'status') {
    const report = {
      schemaVersion: TELEMETRY_SCHEMA,
      cliVersion: version,
      enabled: config.enabled,
      transport: config.enabled ? 'opt_in' : 'disabled',
      localQueue: '.brik/telemetry-queue.jsonl',
      queuedEvents: readJsonLines(telemetryQueuePath()).length,
      networkSent: false,
      collectedFieldsWhenEnabled: ['cliVersion', 'os', 'arch', 'command', 'target', 'normalizedErrorCode', 'durationBucket', 'success'],
      forbiddenFields: ['rawSource', 'pcdSource', 'absolutePath', 'repoName', 'email', 'token', 'rawStdout', 'rawStderr']
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  if (sub === 'enable' || sub === 'disable') {
    const next = { ...config, cliVersion: version, enabled: sub === 'enable', updatedAt: new Date().toISOString() };
    writeTelemetryConfig(next);
    process.stdout.write(`telemetry=${next.enabled ? 'enabled' : 'disabled'}\n`);
    process.stdout.write('raw_source_included=false\n');
    return;
  }
  if (sub === 'export') {
    const report = {
      schemaVersion: 'brik64.cli_telemetry_export.v1',
      cliVersion: version,
      enabled: config.enabled,
      events: readJsonLines(telemetryQueuePath()),
      rawSourceIncluded: false,
      rawPcdIncluded: false,
      absolutePathIncluded: false
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  if (sub === 'purge-local') {
    fs.rmSync(telemetryQueuePath(), { force: true });
    fs.rmSync(feedbackQueuePath(), { force: true });
    fs.rmSync(path.resolve('.brik', 'feedback-preview.json'), { force: true });
    process.stdout.write('purged=local_telemetry_feedback\n');
    return;
  }
  if (sub === 'send') {
    if (!config.enabled) fail(64, 'telemetry_not_enabled');
    const events = readJsonLines(telemetryQueuePath());
    const result = await postJson(config.endpoint, {
      schemaVersion: 'brik64.cli_telemetry_batch.v1',
      cliVersion: version,
      events
    });
    process.stdout.write(`${JSON.stringify({ ok: true, sent: events.length, result }, null, 2)}\n`);
    return;
  }
  if (sub === 'explain') {
    process.stdout.write('BRIK64 telemetry is disabled by default in beta14.\n');
    process.stdout.write('Telemetry is opt-in, redacted, exportable, purgeable, and never includes raw source, PCD bodies, absolute paths, tokens, emails, raw stdout, or raw stderr.\n');
    process.stdout.write('beta14 networkSent=false unless telemetry send is explicitly invoked after enable\n');
    return;
  }
  fail(64, 'unknown_telemetry_command');
}

async function feedback(args = []) {
  const parsed = parseArgs(args, { '--dry-run': 'boolean', '--send': 'boolean', '--category': 'value', '--message': 'value' });
  const allowed = new Set(['bug', 'docs', 'feature', 'install', 'compiler', 'sdk']);
  const category = parsed['--category'] || 'bug';
  if (!allowed.has(category)) fail(64, `feedback_category_unsupported:${category}`);
  const message = redactValue(parsed['--message'] || '');
  const config = readTelemetryConfig();
  const report = {
    schemaVersion: FEEDBACK_SCHEMA,
    cliVersion: version,
    capturedAt: new Date().toISOString(),
    category,
    redactedMessage: message,
    networkSent: false,
    rawSourceIncluded: false,
    rawPcdIncluded: false,
    absolutePathIncluded: false
  };
  mkdirControlled(brikDir());
  writeFileControlled(path.join(brikDir(), 'feedback-preview.json'), JSON.stringify(report, null, 2) + '\n');
  appendJsonLine(feedbackQueuePath(), report);
  if (parsed['--send']) {
    if (!config.enabled) fail(64, 'telemetry_not_enabled');
    const result = await postJson(config.feedbackEndpoint, report);
    process.stdout.write(`${JSON.stringify({ ...report, networkSent: true, result }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

async function errorsCommand(args = []) {
  const sub = args[0];
  const reportPath = path.resolve('.brik', 'error-reports', 'last.json');
  if (sub === 'status') {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 'brik64.cli_error_report_status.v1',
      cliVersion: version,
      lastReportPresent: fs.existsSync(reportPath),
      networkSent: false,
      reportPath: '.brik/error-reports/last.json'
    }, null, 2)}\n`);
    return;
  }
  if (sub === 'explain-last') {
    if (!fs.existsSync(reportPath)) fail(66, 'error_report_last_missing');
    process.stdout.write(fs.readFileSync(reportPath, 'utf8'));
    return;
  }
  if (sub === 'purge-local') {
    fs.rmSync(path.resolve('.brik', 'error-reports'), { recursive: true, force: true });
    process.stdout.write('purged=local_error_reports\n');
    return;
  }
  if (sub === 'send-last') {
    const config = readTelemetryConfig();
    if (!config.enabled) fail(64, 'telemetry_not_enabled');
    if (!fs.existsSync(reportPath)) fail(66, 'error_report_last_missing');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const result = await postJson(config.errorReportEndpoint, report);
    process.stdout.write(`${JSON.stringify({ ok: true, networkSent: true, result }, null, 2)}\n`);
    return;
  }
  fail(64, 'unknown_errors_command');
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': `brik64-cli/${version}` } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`http_${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          reject(new Error('json_parse_error'));
        }
      });
    }).on('error', reject);
  });
}

async function updateCommand(args = []) {
  const parsed = parseArgs(args, { '--check': 'boolean', '--print-command': 'boolean', '--install': 'boolean', '--json': 'boolean' });
  if (!parsed['--check'] && !parsed['--print-command'] && !parsed['--install']) fail(64, 'update_mode_required');
  const manifest = await fetchJson('https://brik64.com/cli/beta.json');
  const latest = manifest.currentVersion || manifest.version;
  const installer = 'curl -fsSL https://brik64.com/cli/install.sh | bash';
  const report = {
    schemaVersion: 'brik64.cli_update_check.v1',
    cliVersion: version,
    latestVersion: latest,
    updateAvailable: Boolean(latest && latest !== version),
    installCommand: installer,
    releaseManifest: manifest.releaseManifest || null
  };
  if (parsed['--json']) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write(`current=${version}\nlatest=${latest || 'unknown'}\nupdate_available=${report.updateAvailable ? 'yes' : 'no'}\n`);
    if (parsed['--print-command']) process.stdout.write(`${installer}\n`);
  }
  if (parsed['--install']) {
    const current = fs.realpathSync(process.argv[1]);
    const supportedDir = path.join(process.env.HOME || '', '.brik64', 'bin');
    if (!current.startsWith(`${supportedDir}${path.sep}`)) {
      fail(64, 'update_install_unsupported_location; rerun `curl -fsSL https://brik64.com/cli/install.sh | bash`');
    }
    process.stdout.write('update_install_delegated_to_installer\n');
    process.stdout.write(`${installer}\n`);
  }
}

function skillCheckVersion(args = []) {
  const parsed = parseArgs(args, { '--path': 'value', '--json': 'boolean' });
  const candidates = parsed['--path'] ? [parsed['--path']] : [
    path.join(process.env.HOME || '', '.codex', 'skills', 'brik64', 'SKILL.md'),
    path.join(process.env.HOME || '', '.agents', 'skills', 'brik64', 'SKILL.md')
  ];
  const files = candidates.map((candidate) => {
    const resolved = path.resolve(candidate);
    if (!fs.existsSync(resolved)) return { path: candidate, status: 'missing' };
    const text = fs.readFileSync(resolved, 'utf8');
    const match = text.match(/0\.1\.0-beta\.\d+(?:\.\d+)?/);
    return {
      path: candidate,
      status: match && match[0] === version ? 'aligned' : 'drift',
      detectedVersion: match ? match[0] : null
    };
  });
  const report = {
    schemaVersion: 'brik64.cli_skill_version_check.v1',
    cliVersion: version,
    status: files.every((file) => file.status === 'aligned' || file.status === 'missing') ? 'PASS' : 'FAIL',
    files,
    action: 'Install or update https://github.com/brik64/brik64-tools-skills when drift is reported.'
  };
  if (parsed['--json']) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write(`skill_check=${report.status}\n`);
    for (const file of files) process.stdout.write(`${file.status} ${file.path}${file.detectedVersion ? ` ${file.detectedVersion}` : ''}\n`);
  }
  if (report.status !== 'PASS') process.exit(65);
}

async function main() {
  const raw = process.argv.slice(2);
  const normalized = [];
  for (const arg of raw) {
    if (arg === '--quiet' || arg === '-q' || arg === '--no-banner') {
      globalThis.__BRIK64_QUIET = true;
      continue;
    }
    normalized.push(arg);
  }
  const [cmd, file, ...args] = normalized;
  if (!cmd || cmd === '--help') return help();
  if (cmd === 'help') return help(file);
  if (file === '--help') return help(cmd);
  if (cmd === '--version' || cmd === 'version') {
    printBanner();
    if (bannerSuppressed()) process.stdout.write(`BRIK64 CLI ${version}\nstatus=public_beta\n`);
    return;
  }
  if (cmd === 'init') return init();
  if (cmd === 'template') return templateCommand([file, ...args].filter(Boolean));
  if (cmd === 'doctor') return doctor();
  if (cmd === 'engine' && file === 'status') return engineStatus();
  if (cmd === 'monomers') return monomersCommand([file, ...args].filter(Boolean));
  if (cmd === 'account' && file === 'status') return accountStatus(args);
  if (cmd === 'login') return login([file, ...args].filter(Boolean));
  if (cmd === 'logout') return logout();
  if (cmd === 'migrate') return migrate(file, args);
  if (cmd === 'lift') return lift(file, args[0], args.slice(1));
  if (cmd === 'adoption' && file === 'report') return adoptionReport(args);
  if (cmd === 'explain') return explain(file, args);
  if (cmd === 'lock') return lock([file, ...args].filter(Boolean));
  if (cmd === 'telemetry') return telemetry([file, ...args].filter(Boolean));
  if (cmd === 'feedback') return feedback([file, ...args].filter(Boolean));
  if (cmd === 'errors') return errorsCommand([file, ...args].filter(Boolean));
  if (cmd === 'update') return updateCommand([file, ...args].filter(Boolean));
  if (cmd === 'skill' && file === 'check-version') return skillCheckVersion(args);
  if (cmd === 'certify') return certify(file);
  if (cmd === 'emit') return emit(file, args);
  if (cmd === 'verify') return verify(file, args);
  if (cmd === 'polymerize') return polymerize([file, ...args].filter(Boolean));
  fail(2, `unknown_command:${cmd}`);
}

main().catch((error) => {
  fail(70, `internal_async_error:${redactValue(error && error.message ? error.message : 'unknown')}`);
});
