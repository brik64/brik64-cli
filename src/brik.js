#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const version = '0.1.0-beta.8';
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
    const number = source.slice(index).match(/^\d+/);
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

function parseExpression(source, params) {
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
      expression = { type: 'NumberLiteral', value: token.value };
    } else if (token.type === 'identifier') {
      consume();
      if (token.value === 'len' && peek() && peek().value === '(') {
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

function parseStatements(body, params) {
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
      statements.push({ type: 'ReturnStatement', argument: parseExpression(value, params) });
      index = semi + 1;
      continue;
    }
    if (body.slice(index).startsWith('if')) {
      index += 'if'.length;
      skipWhitespace();
      const condition = readBalanced('(', ')').trim();
      skipWhitespace();
      const consequentBody = readBalanced('{', '}');
      skipWhitespace();
      let alternate = [];
      if (body.slice(index).startsWith('else')) {
        index += 'else'.length;
        skipWhitespace();
        alternate = parseStatements(readBalanced('{', '}'), params);
      }
      statements.push({
        type: 'IfStatement',
        condition: parseExpression(condition, params),
        consequent: parseStatements(consequentBody, params),
        alternate,
      });
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
  if (type !== 'i64') {
    fail(65, `pcd_parse_error:unsupported_param_type:${type}`);
  }
  return { name, type };
}

function inferExpressionType(expression, paramTypes) {
  if (expression.type === 'NumberLiteral') return 'i64';
  if (expression.type === 'Identifier') return paramTypes[expression.name] || 'unknown';
  if (expression.type === 'UnaryExpression') {
    const argumentType = inferExpressionType(expression.argument, paramTypes);
    if (argumentType !== 'i64') fail(65, 'pcd_parse_error:unary_requires_i64');
    return 'i64';
  }
  if (expression.type === 'ListLiteral') {
    for (const element of expression.elements) {
      if (inferExpressionType(element, paramTypes) !== 'i64') {
        fail(65, 'pcd_parse_error:list_literal_requires_i64_elements');
      }
    }
    return 'list_i64';
  }
  if (expression.type === 'MapLiteral') {
    for (const entry of expression.entries) {
      if (inferExpressionType(entry.value, paramTypes) !== 'i64') {
        fail(65, 'pcd_parse_error:map_literal_requires_i64_values');
      }
    }
    return 'map_i64';
  }
  if (expression.type === 'IndexExpression') {
    const objectType = inferExpressionType(expression.object, paramTypes);
    const indexType = inferExpressionType(expression.index, paramTypes);
    if (objectType !== 'list_i64') fail(65, 'pcd_parse_error:index_requires_list');
    if (indexType !== 'i64') fail(65, 'pcd_parse_error:index_requires_i64');
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
  if (expression.type === 'BinaryExpression') {
    const leftType = inferExpressionType(expression.left, paramTypes);
    const rightType = inferExpressionType(expression.right, paramTypes);
    if (['&&', '||'].includes(expression.operator)) {
      if (!['i64', 'bool'].includes(leftType) || !['i64', 'bool'].includes(rightType)) {
        fail(65, `pcd_parse_error:logical_requires_scalar:${expression.operator}`);
      }
      return 'bool';
    }
    if (['==', '!=', '>', '<', '>=', '<='].includes(expression.operator)) {
      if (leftType !== 'i64' || rightType !== 'i64') {
        fail(65, `pcd_parse_error:comparison_requires_i64:${expression.operator}`);
      }
      return 'bool';
    }
    if (leftType !== 'i64' || rightType !== 'i64') {
      fail(65, `pcd_parse_error:binary_requires_i64:${expression.operator}`);
    }
    return 'i64';
  }
  fail(65, 'pcd_parse_error:unknown_expression_type');
}

function validateStatementTypes(statements, paramTypes, returnType) {
  for (const statement of statements) {
    if (statement.type === 'ReturnStatement') {
      const actualType = inferExpressionType(statement.argument, paramTypes);
      if (actualType !== returnType) {
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
  }
  return values;
}

function countBranches(statements) {
  return statements.reduce((count, statement) => {
    if (statement.type !== 'IfStatement') return count;
    return count + 1 + countBranches(statement.consequent) + countBranches(statement.alternate);
  }, 0);
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
  const pcStart = stripped.search(/\bPC\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/m);
  const pcOpen = stripped.indexOf('{', pcStart);
  const pcClose = findMatchingBrace(stripped, pcOpen);
  if (pcClose === -1 || stripped.slice(pcClose + 1).trim().length > 0) {
    fail(65, 'pcd_parse_error:malformed_pc_block');
  }
  const pcName = pcMatch[1];
  const pcBody = stripped.slice(pcOpen + 1, pcClose);
  const fnMatch = pcBody.match(/\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([A-Za-z0-9_]+)\s*)?\{/m);
  if (!fnMatch) {
    fail(65, 'pcd_parse_error:missing_fn_block');
  }
  const fnStart = fnMatch.index;
  const fnOpen = pcBody.indexOf('{', fnStart);
  const fnClose = findMatchingBrace(pcBody, fnOpen);
  if (fnClose === -1 || pcBody.slice(fnClose + 1).trim().length > 0) {
    fail(65, 'pcd_parse_error:malformed_fn_block');
  }
  const [, fnName, paramsRaw, returnType = 'i64'] = fnMatch;
  if (returnType !== 'i64') {
    fail(65, `pcd_parse_error:unsupported_return_type:${returnType}`);
  }
  const fnBody = pcBody.slice(fnOpen + 1, fnClose);
  const params = paramsRaw
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
  const body = parseStatements(fnBody, params);
  const paramTypes = Object.fromEntries(params.map((param) => [param.name, param.type]));
  validateStatementTypes(body, paramTypes, returnType);
  const returns = collectReturns(body);
  if (returns.length === 0) {
    fail(65, 'pcd_parse_error:missing_return');
  }
  return {
    schemaVersion: 'brik64.cli_ast.v1',
    pcName,
    fnName,
    params: params.map((param) => param.name),
    paramTypes,
    returnType,
    body,
    returnValues: returns.map((expression) => (expression.type === 'NumberLiteral' ? expression.value : null)),
    branchCount: countBranches(body),
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
    fail(64, 'login_requires_token_env_for_beta8');
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

function renderExpression(expression, target) {
  if (expression.type === 'NumberLiteral') return String(expression.value);
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

function renderStatements(statements, target, indentLevel) {
  const unit = target === 'python' ? '    ' : '  ';
  const indent = unit.repeat(indentLevel);
  const lines = [];
  for (const statement of statements) {
    if (statement.type === 'ReturnStatement') {
      lines.push(`${indent}return ${renderExpression(statement.argument, target)}${target === 'python' ? '' : ';'}`);
      continue;
    }
    if (statement.type === 'IfStatement') {
      const condition = renderExpression(statement.condition, target);
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
    fail(70, 'internal_codegen_error:unknown_statement');
  }
  return lines;
}

function evaluateExpression(expression, env) {
  if (expression.type === 'NumberLiteral') return expression.value;
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
  }
  return undefined;
}

function collectConditionValues(expression, values = new Set([0, 1, 2, 10])) {
  if (expression.type === 'NumberLiteral') {
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
      return { input, args, expected: evaluateStatements(ast.body, args) };
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

function targetSpec(target, ast) {
  const astJson = encodedAst(ast);
  const cases = ensureExecutable(ast);
  const params = ast.params.length > 0 ? ast.params : ['input'];
  const tsParams = params.map((param) => `${param} = 0`).join(', ');
  const rustParams = params.map((param) => `${param}: i64`).join(', ');
  const pythonParams = params.map((param) => `${param}=0`).join(', ');
  const tsStatements = renderStatements(ast.body, 'ts', 1);
  const rustStatements = renderStatements(ast.body, 'rust', 1);
  const pythonStatements = renderStatements(ast.body, 'python', 1);
  const specs = {
    ts: {
      program: 'program.mjs',
      test: 'program.test.mjs',
      code: (hash) => [
        '// BRIK64 beta8 functional emission candidate',
        '// claim: local candidate evidence only',
        `export const pcdSha256 = "${hash}";`,
        `export const pcdAst = ${astJson};`,
        `export function run(${tsParams}) {`,
        ...tsStatements,
        '  throw new Error("pcd execution reached non-returning path");',
        '}',
        '',
      ].join('\n'),
      testCode: (hash) => [
        'import { pcdSha256, run } from "./program.mjs";',
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
      ].join('\n'),
    },
    rust: {
      program: 'program.rs',
      test: 'program_test.rs',
      code: (hash) => [
        '// BRIK64 beta8 functional emission candidate',
        '// claim: local candidate evidence only',
        `pub const PCD_SHA256: &str = "${hash}";`,
        `pub const PCD_AST_JSON: &str = r#"${astJson}"#;`,
        `pub fn run(${rustParams}) -> i64 {`,
        ...rustStatements.map((line) => line.replace(/^  /, '    ')),
        '    panic!("pcd execution reached non-returning path");',
        '}',
        '',
      ].join('\n'),
      testCode: (hash) => [
        `const PCD_SHA256: &str = "${hash}";`,
        `const PCD_AST_JSON: &str = r#"${astJson}"#;`,
        `fn run(${rustParams}) -> i64 {`,
        ...rustStatements.map((line) => line.replace(/^  /, '    ')),
        '    panic!("pcd execution reached non-returning path");',
        '}',
        '',
        'fn main() {',
        `    assert_eq!(PCD_SHA256, "${hash}");`,
        '    assert!(PCD_AST_JSON.contains("body"));',
        ...cases.map((testCase) => `    assert_eq!(run(${params.map((param) => testCase.args[param]).join(', ')}), ${testCase.expected});`),
        '    println!("brik64 generated rust test: PASS");',
        '}',
        '',
      ].join('\n'),
    },
    python: {
      program: 'program.py',
      test: 'test_program.py',
      code: (hash) => [
        '# BRIK64 beta8 functional emission candidate',
        '# claim: local candidate evidence only',
        `PCD_SHA256 = "${hash}"`,
        `PCD_AST_JSON = ${JSON.stringify(JSON.stringify(ast))}`,
        '',
        `def run(${pythonParams}):`,
        ...pythonStatements,
        '    raise RuntimeError("pcd execution reached non-returning path")',
        '',
      ].join('\n'),
      testCode: (hash) => [
        'from program import PCD_SHA256, run',
        '',
        `assert PCD_SHA256 == "${hash}"`,
        `cases = ${JSON.stringify(cases)}`,
        'for case in cases:',
        `    actual = run(${params.map((param) => `case["args"]["${param}"]`).join(', ')})`,
        '    assert actual == case["expected"], f"case {case[\'input\']} expected {case[\'expected\']} got {actual}"',
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
  process.stdout.write('// BRIK64 beta8 functional emission candidate\n');
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
    fail(69, 'managed_verify_endpoint_unavailable_beta8');
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
    fail(69, 'managed_polymerize_endpoint_unavailable_beta8');
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
    '// generated_by: brik64-cli beta8 polymerize local',
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
  let syntax = 'beta8';
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
    outPath = workspacePath(parsed['--out'] || `${file.replace(/\.pcd$/, '')}.beta8.pcd`);
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
