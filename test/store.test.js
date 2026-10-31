'use strict';
// Store: an unreadable settings file must be kept as a copy, and a normal save must round-trip.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-store-'));
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'electron') return { app: { getPath: () => dir } };
  return origLoad.call(this, request, ...rest);
};
const { Store } = require('../src/main/store');

// first run: no file, no copy
let s = new Store('a', { x: 1 });
assert.strictEqual(s.data.x, 1);
assert.strictEqual(s.raw, null);
assert.ok(!fs.existsSync(path.join(dir, 'a.json.broken')));

// save and reload
s.data.x = 5; s.flush();
s = new Store('a', { x: 1, y: 2 });
assert.strictEqual(s.data.x, 5);
assert.strictEqual(s.data.y, 2);

// damaged file: defaults are used and the damaged bytes are kept
fs.writeFileSync(path.join(dir, 'b.json'), '{ not json');
s = new Store('b', { x: 1 });
assert.strictEqual(s.data.x, 1);
assert.strictEqual(fs.readFileSync(path.join(dir, 'b.json.broken'), 'utf8'), '{ not json');
s.flush();
assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'b.json'), 'utf8')).x, 1);

fs.rmSync(dir, { recursive: true, force: true });
console.log('store tests passed');
