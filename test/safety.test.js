'use strict';
// Safety helpers, plus a check that every message the UI sends is allowed by the preload and handled by the main process.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const s = require('../src/main/safety');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

// risky files, including the tricks that hide an extension
for (const n of ['setup.exe', 'SETUP.EXE', 'a.bat', 'x.ps1', 'tool.AppImage', 'run.sh', 'photo.jpg.exe', 'setup.exe.', 'setup.exe . .', 'p.msi', 'a.jar', 'l.lnk', 'x.deb'])
  assert.ok(s.isRiskyFile(n), n + ' should be risky');
for (const n of ['photo.jpg', 'doc.pdf', 'song.mp3', 'notes.txt', 'archive.zip', 'noextension', 'report.docx', '.hidden'])
  assert.ok(!s.isRiskyFile(n), n + ' should be fine');

// file names
assert.strictEqual(s.safeFileName('../../etc/passwd'), 'passwd');
assert.strictEqual(s.safeFileName('..\\..\\Windows\\evil.dll'), 'evil.dll');
assert.strictEqual(s.safeFileName('a<b>c:d"e|f?g*h.txt'), 'a_b_c_d_e_f_g_h.txt');
assert.strictEqual(s.safeFileName('name.txt. . '), 'name.txt');
assert.strictEqual(s.safeFileName('...'), 'download');
assert.strictEqual(s.safeFileName(''), 'download');
assert.strictEqual(s.safeFileName(undefined), 'download');
assert.strictEqual(s.safeFileName('CON.txt'), '_CON.txt');
assert.strictEqual(s.safeFileName('nul'), '_nul');
assert.strictEqual(s.safeFileName('a\u0000b\u001fc.txt'), 'a_b_c.txt');
const long = s.safeFileName('x'.repeat(400) + '.pdf');
assert.ok(long.length <= 150 && long.endsWith('.pdf'));
assert.ok(!/[\\/]/.test(s.safeFileName('a/b\\c')));

// navigation
const ok = (u, f) => assert.ok(s.navAllowed(u, f), u + ' from ' + f);
const no = (u, f) => assert.ok(!s.navAllowed(u, f), u + ' from ' + f + ' should be blocked');
ok('https://a.com/', 'https://b.com/'); ok('http://a.com/', 'https://b.com/'); ok('view-source:https://a.com/', 'https://b.com/'); ok('blob:https://a.com/x', 'https://a.com/');
no('file:///etc/passwd', 'https://evil.com/'); no('file:///C:/Users/me/a.txt', 'http://evil.com/');
no('data:text/html,<script>1</script>', 'https://evil.com/');
ok('file:///home/me/a.html', 'file:///home/me/b.html'); ok('file:///home/me/a.html', 'about:blank'); ok('file:///home/me/a.html', 'lumen://newtab');
ok('lumen://newtab', 'lumen://error'); no('lumen://newtab', 'https://evil.com/'); no('lumen://app/index.html', 'https://evil.com/');
no('javascript:alert(1)', 'https://a.com/'); no('mailto:a@b.c', 'https://a.com/'); no('ms-settings:defaultapps', 'https://a.com/'); no('chrome://gpu', 'https://a.com/');

// UI -> main messages: every channel the UI uses must pass the preload and be registered in the main process
const ui = read('src/ui/ui.js'), pre = read('src/preload/ui-preload.js'), ipc = read('src/main/ipc.js');
const used = (re) => new Set([...ui.matchAll(re)].map(m => m[1]));
const sent = used(/L\.send\('([^']+)'/g), invoked = used(/L\.invoke\('([^']+)'/g);
const list = (name) => new Set([...pre.match(new RegExp('const ' + name + ' = new Set\\(\\[([\\s\\S]*?)\\]\\)'))[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
const SEND = list('SEND'), INVOKE = list('INVOKE');
const onCh = new Set([...ipc.matchAll(/\bon\('([^']+)'/g)].map(m => m[1])), handleCh = new Set([...ipc.matchAll(/\bhandle\('([^']+)'/g)].map(m => m[1]));
for (const c of sent) { assert.ok(SEND.has(c), 'preload blocks "' + c + '"'); assert.ok(onCh.has(c), 'main has no handler for "' + c + '"'); }
for (const c of invoked) { assert.ok(INVOKE.has(c), 'preload blocks invoke "' + c + '"'); assert.ok(handleCh.has(c), 'main has no handle for "' + c + '"'); }
for (const c of SEND) assert.ok(onCh.has(c), 'preload allows "' + c + '" but main ignores it');
console.log('safety tests passed');
