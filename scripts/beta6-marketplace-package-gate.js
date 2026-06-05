#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta6-marketplace-packages');
const repos = {
  js: '/Users/carlosjperez/Documents/GitHub/brik64-lib-js',
  python: '/Users/carlosjperez/Documents/GitHub/brik64-lib-python',
  rust: '/Users/carlosjperez/Documents/GitHub/brik64-lib-rust'
};

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function artifact(file, repoRoot) {
  if (!fs.existsSync(file)) return null;
  return {
    path: path.relative(repoRoot, file),
    absolutePath: file,
    sha256: sha256File(file),
    bytes: fs.statSync(file).size
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];

  const jsPackageJson = path.join(repos.js, 'package.json');
  const pyProject = path.join(repos.python, 'pyproject.toml');
  const rustCargo = path.join(repos.rust, 'Cargo.toml');

  const jsTarball = artifact(path.join(repos.js, 'evidence-beta6-pack', 'brik64-core-0.1.0-beta.6.tgz'), repos.js);
  const pythonWheel = artifact(path.join(repos.python, 'dist', 'brik64-0.1.0b6-py3-none-any.whl'), repos.python);
  const pythonSdist = artifact(path.join(repos.python, 'dist', 'brik64-0.1.0b6.tar.gz'), repos.python);
  const rustCrate = artifact(path.join(repos.rust, 'target', 'package', 'brik64-core-0.1.0-beta.6.crate'), repos.rust);

  if (!fs.existsSync(jsPackageJson)) failures.push('js_package_json_missing');
  if (!fs.existsSync(pyProject)) failures.push('python_pyproject_missing');
  if (!fs.existsSync(rustCargo)) failures.push('rust_cargo_toml_missing');

  const jsVersion = fs.existsSync(jsPackageJson) ? readJson(jsPackageJson).version : null;
  const pyProjectText = fs.existsSync(pyProject) ? fs.readFileSync(pyProject, 'utf8') : '';
  const rustCargoText = fs.existsSync(rustCargo) ? fs.readFileSync(rustCargo, 'utf8') : '';

  if (jsVersion !== '0.1.0-beta.6') failures.push(`js_version_drift:${jsVersion || 'missing'}`);
  if (!/version\s*=\s*"0\.1\.0b6"/.test(pyProjectText)) failures.push('python_version_drift');
  if (!/version\s*=\s*"0\.1\.0-beta\.6"/.test(rustCargoText)) failures.push('rust_version_drift');

  if (!jsTarball) failures.push('npm_package_not_packed_for_beta6_publication');
  if (!pythonWheel || !pythonSdist) failures.push('pypi_package_not_built_for_beta6_publication');
  if (!rustCrate) failures.push('cargo_package_not_packed_for_beta6_publication');

  const report = {
    schemaVersion: 'brik64.cli_beta6_marketplace_package_gate.v1',
    version: '0.1.0-beta.6',
    decision: failures.length === 0 ? 'PASS_MARKETPLACE_PACKAGE_GATE' : 'FAIL_MARKETPLACE_PACKAGE_GATE',
    releaseEligible: failures.length === 0,
    marketplacePublicationAllowed: failures.length === 0,
    packages: {
      npm: {
        repository: repos.js,
        packageName: '@brik64/core',
        version: jsVersion,
        artifact: jsTarball
      },
      pypi: {
        repository: repos.python,
        packageName: 'brik64',
        version: '0.1.0b6',
        wheel: pythonWheel,
        sdist: pythonSdist
      },
      cargo: {
        repository: repos.rust,
        crateName: 'brik64-core',
        version: '0.1.0-beta.6',
        artifact: rustCrate
      }
    },
    failures,
    boundary: 'Package artifacts are locally built beta6 publication inputs. This gate verifies readiness but does not mutate npm, PyPI or Cargo.'
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`marketplacePublicationAllowed=${failures.length === 0}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
