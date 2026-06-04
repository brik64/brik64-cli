const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { brik_cli_beta5_route2 } = require('./brik_cli_beta5_route2.js');

test('l6plus route2 fixture cases', () => {
  const payload = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures.json"), 'utf8'));
  for (const c of payload.cases || []) assert.equal(brik_cli_beta5_route2(...c.inputs), c.expected);
});
