'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function merge(def, raw) {
  if (!isObj(def) || !isObj(raw)) return raw === undefined ? def : raw;
  const out = Object.assign({}, def);
  for (const k of Object.keys(raw)) out[k] = isObj(def[k]) ? merge(def[k], raw[k]) : raw[k];
  return out;
}

// Tiny JSON store: debounced, atomic writes.
class Store {
  constructor(name, defaults) {
    this.file = path.join(app.getPath('userData'), name + '.json');
    this.data = JSON.parse(JSON.stringify(defaults));
    this.timer = null;
    this.raw = null; // what was on disk before merging defaults (null on first run)
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.raw = raw;
      this.data = merge(defaults, raw);
    } catch (e) { /* first run or unreadable: use defaults */ }
  }
  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  }
  flush() {
    clearTimeout(this.timer);
    try {
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      fs.renameSync(tmp, this.file);
    } catch (e) { console.error('Store write failed:', e.message); }
  }
}
module.exports = { Store };
