#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.14.3';
const base = path.join(root, 'pcd', 'beta14_3');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function write(relativePath, content) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

const core = [
  ['MC_00', 'ADD8'], ['MC_01', 'SUB8'], ['MC_02', 'MUL8'], ['MC_03', 'DIV8'],
  ['MC_04', 'INC'], ['MC_05', 'DEC'], ['MC_06', 'ABS'], ['MC_07', 'CLAMP'],
  ['MC_08', 'AND8'], ['MC_09', 'OR8'], ['MC_10', 'XOR8'], ['MC_11', 'NOT8'],
  ['MC_12', 'SHL'], ['MC_13', 'SHR'], ['MC_14', 'ROL'], ['MC_15', 'ROR'],
  ['MC_16', 'LOAD'], ['MC_17', 'STORE'], ['MC_18', 'PUSH'], ['MC_19', 'POP'],
  ['MC_20', 'PEEK'], ['MC_21', 'SWAP'], ['MC_22', 'DUP'], ['MC_23', 'DROP'],
  ['MC_24', 'IF'], ['MC_25', 'LOOP'], ['MC_26', 'JUMP'], ['MC_27', 'CALL'],
  ['MC_28', 'RET'], ['MC_29', 'BREAK'], ['MC_30', 'CONTINUE'], ['MC_31', 'NOP'],
  ['MC_32', 'READ'], ['MC_33', 'WRITE'], ['MC_34', 'SEEK'], ['MC_35', 'FLUSH'],
  ['MC_36', 'OPEN'], ['MC_37', 'CLOSE'], ['MC_38', 'EOF'], ['MC_39', 'ERR'],
  ['MC_40', 'CONCAT'], ['MC_41', 'SPLIT'], ['MC_42', 'SUBSTR'], ['MC_43', 'LEN'],
  ['MC_44', 'UPPER'], ['MC_45', 'LOWER'], ['MC_46', 'TRIM'], ['MC_47', 'MATCH'],
  ['MC_48', 'HASH'], ['MC_49', 'ENCRYPT'], ['MC_50', 'DECRYPT'], ['MC_51', 'SIGN'],
  ['MC_52', 'VERIFY'], ['MC_53', 'RNG'], ['MC_54', 'DERIVE'], ['MC_55', 'SEAL'],
  ['MC_56', 'TIME'], ['MC_57', 'CPU'], ['MC_58', 'MEM'], ['MC_59', 'DISK'],
  ['MC_60', 'NET'], ['MC_61', 'PID'], ['MC_62', 'UID'], ['MC_63', 'ENV']
];

const extended = [
  ['MC_64', 'FADD'], ['MC_65', 'FSUB'], ['MC_66', 'FMUL'], ['MC_67', 'FDIV'],
  ['MC_68', 'FABS'], ['MC_69', 'FNEG'], ['MC_70', 'FSQRT'], ['MC_71', 'FMOD'],
  ['MC_72', 'SIN'], ['MC_73', 'COS'], ['MC_74', 'TAN'], ['MC_75', 'ATAN2'],
  ['MC_76', 'LOG'], ['MC_77', 'EXP'], ['MC_78', 'POW'], ['MC_79', 'FLOOR'],
  ['MC_80', 'TCP_CONN'], ['MC_81', 'TCP_SEND'], ['MC_82', 'TCP_RECV'], ['MC_83', 'UDP_SEND'],
  ['MC_84', 'DNS'], ['MC_85', 'HTTP_GET'], ['MC_86', 'HTTP_POST'], ['MC_87', 'TLS'],
  ['MC_88', 'FB_NEW'], ['MC_89', 'FB_PIXEL'], ['MC_90', 'FB_READ'], ['MC_91', 'FB_FILL'],
  ['MC_92', 'FB_COPY'], ['MC_93', 'FB_FLUSH'], ['MC_94', 'INPUT_POLL'], ['MC_95', 'INPUT_STATE'],
  ['MC_96', 'AU_NEW'], ['MC_97', 'AU_WRITE'], ['MC_98', 'AU_READ'], ['MC_99', 'AU_PLAY'],
  ['MC_100', 'AU_STOP'], ['MC_101', 'AU_MIX'], ['MC_102', 'AU_SAMPLE'], ['MC_103', 'AU_STATUS'],
  ['MC_104', 'DIR_LIST'], ['MC_105', 'DIR_CREATE'], ['MC_106', 'DIR_DELETE'], ['MC_107', 'CHMOD'],
  ['MC_108', 'CHOWN'], ['MC_109', 'LINK'], ['MC_110', 'WATCH'], ['MC_111', 'TEMP'],
  ['MC_112', 'SPAWN'], ['MC_113', 'JOIN'], ['MC_114', 'CHAN_NEW'], ['MC_115', 'CHAN_SEND'],
  ['MC_116', 'CHAN_RECV'], ['MC_117', 'MUTEX'], ['MC_118', 'ATOMIC'], ['MC_119', 'YIELD'],
  ['MC_120', 'FFI_LOAD'], ['MC_121', 'FFI_CALL'], ['MC_122', 'FFI_ALLOC'], ['MC_123', 'FFI_FREE'],
  ['MC_124', 'WASM_EXEC'], ['MC_125', 'PY_EVAL'], ['MC_126', 'JSON_PARSE'], ['MC_127', 'JSON_EMIT']
];

const cliPcds = [
  'cli_entrypoint', 'cli_help_version', 'cli_template', 'cli_certify_verify',
  'cli_emit', 'cli_lift', 'cli_polymerize', 'cli_monomers', 'cli_update_release'
];

for (const name of cliPcds) {
  write(`pcd/beta14_3/cli/${name}.pcd`, `// brik64.pcd_file.v1
// beta14_3_source_contract: ${name}
// claim_boundary: source_contract_candidate; requires L6+N5 materialization evidence before publication.
PC ${name} {
    fn ${name}(command_id) {
        if (command_id == 1) { return 1; }
        return 0;
    }
}
`);
}

for (const [id, name] of core) {
  write(`pcd/beta14_3/monomers/core/${id}_${name}.pcd`, `// brik64.pcd_file.v1
// monomer: ${id}.${name}
// tier: core
// claim_boundary: source_contract_candidate
PC ${id}_${name} {
    fn ${id}_${name}(command_id) {
        if (command_id == 1) { return 1; }
        return 0;
    }
}
`);
}

for (const [id, name] of extended) {
  write(`pcd/beta14_3/monomers/extended/${id}_${name}.pcd`, `// brik64.pcd_file.v1
// monomer: ${id}.${name}
// tier: extended
// certification-profile: extended_contract
// claim_boundary: source_contract_candidate
PC ${id}_${name} {
    fn ${id}_${name}(command_id) {
        if (command_id == 1) { return 1; }
        return 0;
    }
}
`);
}

for (const language of ['js', 'ts', 'python', 'rust']) {
  write(`pcd/beta14_3/lift/lift_${language}.pcd`, `// brik64.pcd_file.v1
// lift_language: ${language}
// claim_boundary: source_contract_candidate
PC lift_${language} {
    fn lift_${language}(command_id) {
        if (command_id == 1) { return 1; }
        return 0;
    }
}
`);
}

for (const name of ['monomer_128_matrix', 'target_parity_ts_python_rust', 'adversarial_release_gate', 'external_audit_contract']) {
  write(`pcd/beta14_3/harness/${name}.pcd`, `// brik64.pcd_file.v1
// harness: ${name}
// claim_boundary: source_contract_candidate
PC ${name} {
    fn ${name}(command_id) {
        if (command_id == 1) { return 1; }
        return 0;
    }
}
`);
}

for (const name of ['beta14_3_release_train', 'docs_web_sdk_skills_sync']) {
  write(`pcd/beta14_3/release/${name}.pcd`, `// brik64.pcd_file.v1
// release_contract: ${name}
// claim_boundary: source_contract_candidate
PC ${name} {
    fn ${name}(command_id) {
        if (command_id == 1) { return 1; }
        return 0;
    }
}
`);
}

const files = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) walk(file);
    else if (file.endsWith('.pcd')) files.push(file);
  }
}
walk(base);

const evidenceDir = path.join(root, 'evidence', 'beta14_3-l6-generation');
fs.mkdirSync(evidenceDir, { recursive: true });
const hashes = files.map((file) => `${sha256(fs.readFileSync(file))}\t${path.relative(root, file)}`);
fs.writeFileSync(path.join(evidenceDir, 'input_pcd_hashes.tsv'), hashes.join('\n') + '\n');
fs.writeFileSync(path.join(evidenceDir, 'serial.txt'), `BETA14_3_SOURCE_CONTRACT_PENDING_L6_${Date.now()}\n`);
fs.writeFileSync(path.join(evidenceDir, 'l6plus_engine_manifest.json'), JSON.stringify({
  schemaVersion: 'brik64.beta14_3_l6plus_engine_manifest.v1',
  version,
  status: 'PENDING_REMOTE_L6_PREFLIGHT',
  publicationAllowed: false,
  claimBoundary: 'No L6+N5 generation claim until remote healthcheck/audit/materialization evidence is attached.'
}, null, 2) + '\n');
fs.writeFileSync(path.join(evidenceDir, 'generated_artifact_manifest.json'), JSON.stringify({
  schemaVersion: 'brik64.beta14_3_generated_artifact_manifest.v1',
  version,
  artifactStatus: 'NOT_GENERATED_BY_L6_YET',
  publicationAllowed: false,
  inputPcdCount: files.length
}, null, 2) + '\n');
fs.writeFileSync(path.join(evidenceDir, 'seal_report.json'), JSON.stringify({
  schemaVersion: 'brik64.beta14_3_seal_report.v1',
  version,
  decision: 'BLOCKED_PENDING_L6_MATERIALIZATION',
  inputPcdCount: files.length,
  inputPcdHash: sha256(hashes.join('\n') + '\n')
}, null, 2) + '\n');

process.stdout.write(`generated_pcds=${files.length}\n`);
process.stdout.write(`evidence=${path.relative(root, evidenceDir)}\n`);
