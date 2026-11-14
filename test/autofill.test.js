'use strict';
const assert = require('assert');
const Module = require('module');
// autofill.js loads Electron; the placement function does not need it
const orig = Module._load;
Module._load = function (req, ...a) { return req === 'electron' ? { WebContentsView: function () {} } : orig.call(this, req, ...a); };
const { place, ROW_H, PAD } = require('../src/main/autofill');
Module._load = orig;

const win = { w: 1200, h: 800 }, page = { x: 0, y: 92, width: 1200, height: 708 };
// opens under the box, as wide as the box (but not narrower than the minimum)
let p = place({ x: 300, y: 200, w: 320, h: 36 }, 1, page, win, 2);
assert.deepStrictEqual(p, { x: 300, y: 92 + 200 + 36 + 2, width: 320, height: 2 * ROW_H + PAD * 2 });
p = place({ x: 300, y: 200, w: 100, h: 30 }, 1, page, win, 1);
assert.strictEqual(p.width, 240);
// page zoom and the sidebar offset move it
p = place({ x: 100, y: 100, w: 300, h: 40 }, 1.5, { x: 232, y: 92, width: 900, height: 700 }, win, 1);
assert.strictEqual(p.x, 232 + 150); assert.strictEqual(p.y, Math.round(92 + 150 + 60 + 2)); assert.strictEqual(p.width, 450);
// stays inside the window on the right
p = place({ x: 1100, y: 100, w: 300, h: 36 }, 1, page, win, 1);
assert.ok(p.x + p.width <= win.w - 8);
// no room below: opens above the box
p = place({ x: 300, y: 650, w: 300, h: 36 }, 1, page, win, 3);
assert.ok(p.y + p.height <= 92 + 650, 'above the box'); assert.ok(p.y >= 4);
// many logins: height is capped at six rows
assert.strictEqual(place({ x: 10, y: 10, w: 300, h: 30 }, 1, page, win, 40).height, 6 * ROW_H + PAD * 2);
// a window narrower than the minimum width still gets a sane box
p = place({ x: 0, y: 10, w: 100, h: 30 }, 1, page, { w: 200, h: 600 }, 1);
assert.ok(p.x >= 8 && p.width >= 240 - 0);
// zero or odd zoom falls back to 1
assert.strictEqual(place({ x: 10, y: 10, w: 300, h: 30 }, 0, page, win, 1).x, 10);
console.log('autofill tests passed');
