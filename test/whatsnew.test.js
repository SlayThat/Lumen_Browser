'use strict';
// What's new: when it shows, and that the page escapes text and has notes for the version being shipped.
const assert = require('assert');
const w = require('../src/main/whatsnew');
const pkg = require('../package.json');

assert.strictEqual(w.compare('0.4.0', '0.5.0'), -1);
assert.strictEqual(w.compare('0.10.0', '0.9.0'), 1);
assert.strictEqual(w.compare('1.0.0', '1.0.0'), 0);
assert.strictEqual(w.compare('x', '1.0.0'), null);

const cur = w.NOTES[0].version;
assert.strictEqual(w.shouldShow({ lastSeen: '0.4.0', current: cur, firstRun: false }), true);
assert.strictEqual(w.shouldShow({ lastSeen: '', current: cur, firstRun: false }), true);     // updated from a build that did not track it
assert.strictEqual(w.shouldShow({ lastSeen: '', current: cur, firstRun: true }), false);     // fresh install
assert.strictEqual(w.shouldShow({ lastSeen: cur, current: cur, firstRun: false }), false);   // already seen
assert.strictEqual(w.shouldShow({ lastSeen: '9.9.9', current: cur, firstRun: false }), false); // downgrade
assert.strictEqual(w.shouldShow({ lastSeen: '0.1.0', current: '0.0.1', firstRun: false }), false); // no notes for it

// every release needs a note, or the page stays silent for it
assert.ok(w.NOTES.some(n => n.version === pkg.version), 'add a NOTES entry for ' + pkg.version + ' in src/main/whatsnew.js');
assert.strictEqual(w.NOTES[0].version, pkg.version, 'the newest NOTES entry should be the version in package.json');

const pages = { BASE_CSS: '', nonce: () => 'n', csp: () => "default-src 'none'", LOGO: '' };
const html = w.render(cur, pages);
assert.ok(html.includes('What’s new') && html.includes('class="chip'));
// every feature of every release is complete, and older notes keep a plain list
for (const n of w.NOTES) {
  assert.ok(n.features ? n.features.length >= 1 : (n.title && n.items && n.items.length), n.version + ' needs features or items');
  for (const f of n.features || []) { assert.ok(f.chip && f.title && f.text, n.version + ' feature is missing text'); assert.ok([1, 2, 3, 4].includes(f.color), n.version + ' feature needs color 1-4'); }
}
// text is escaped everywhere
w.NOTES.unshift({ version: '9.0.0', features: [{ chip: '<b>x</b>', title: '<script>x</script>', text: 'a & "b"', steps: ['<img src=x>'], color: 1, art: 'rows', rows: [['<i>', '"q"']] }] });
const bad = w.render('9.0.0', pages);
assert.ok(!bad.includes('<script>x') && !bad.includes('<img src=x>') && !bad.includes('<b>x</b>') && bad.includes('&lt;script&gt;') && bad.includes('a &amp; &quot;b&quot;'));
w.NOTES.shift();
console.log('whatsnew tests passed');
