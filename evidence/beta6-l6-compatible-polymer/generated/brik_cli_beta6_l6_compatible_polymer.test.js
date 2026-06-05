const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { brik_cli_beta6_l6_compatible_polymer } = require('./brik_cli_beta6_l6_compatible_polymer.js');

test('l6plus route2 fixture cases', () => {
  const payload = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures.json"), 'utf8'));
  for (const c of payload.cases || []) assert.equal(brik_cli_beta6_l6_compatible_polymer(...c.inputs), c.expected);
});
