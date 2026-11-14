'use strict';
const assert = require('assert');
const SB = require('../src/main/safebrowse');

// parsing: plain list, hosts-file lines, comments, junk, wildcard, safe sites dropped
const text = ['# comment', '', 'evil-login.example', 'bad.example.com', '0.0.0.0 hosts.style.test', '*.wild.test', 'not a domain', 'x', 'UPPER.Case.test',
  'google.com', 'sub.google.com', 'paypal-secure.test.', '1.2.3.4', 'a..b.test'].join('\r\n');
const p = SB.parseList(text);
assert.ok(p.set.has(SB.hash53('bad.example.com')));
assert.ok(p.set.has(SB.hash53('hosts.style.test')));
assert.ok(p.set.has(SB.hash53('wild.test')));
assert.ok(p.set.has(SB.hash53('upper.case.test')));
assert.ok(p.set.has(SB.hash53('paypal-secure.test')));
assert.ok(!p.set.has(SB.hash53('google.com')), 'popular sites are never stored');
assert.ok(!p.set.has(SB.hash53('1.2.3.4')) && !p.set.has(SB.hash53('a..b.test')));

// matching: exact, subdomain of a listed domain, not a sibling or a parent
assert.ok(SB.isListed(p.set, 'bad.example.com'));
assert.ok(SB.isListed(p.set, 'login.bad.example.com'));
assert.ok(SB.isListed(p.set, 'a.b.wild.test'));
assert.ok(!SB.isListed(p.set, 'example.com'));
assert.ok(!SB.isListed(p.set, 'good.example.com'));
assert.ok(!SB.isListed(p.set, 'notbad.example.com'));
assert.ok(!SB.isListed(p.set, 'localhost') && !SB.isListed(p.set, '127.0.0.1') && !SB.isListed(p.set, ''));
assert.ok(!SB.isListed(null, 'bad.example.com'));

// safe sites win even if a list contained a subdomain entry or their parent was listed
const q = SB.parseList('mail.google.com\nevil.test');
assert.ok(!SB.isListed(q.set, 'mail.google.com') && !SB.isListed(q.set, 'google.com'));
const forced = new Set([SB.hash53('google.com'), SB.hash53('evil.github.io')]);
assert.ok(!SB.isListed(forced, 'www.google.com') && !SB.isListed(forced, 'evil.github.io'));

// validity: an error page or tiny file must not replace a real list
assert.ok(!SB.looksValid(SB.parseList('<html>Not found</html>')));
assert.ok(!SB.looksValid(p));
const big = SB.parseList(Array.from({ length: 5000 }, (_, i) => 'site' + i + '.test').join('\n'));
assert.ok(SB.looksValid(big));
assert.ok(SB.isListed(big.set, 'x.site4999.test') && !SB.isListed(big.set, 'site5000.test'));

// host extraction
assert.strictEqual(SB.hostOfUrl('https://Bad.Example.com./x?y#z'), 'bad.example.com');
assert.strictEqual(SB.hostOfUrl('nonsense'), '');

// no collisions across a large list, and the stored size stays small
const N = 400000; const names = [];
for (let i = 0; i < N; i++) names.push('d' + i.toString(36) + '-' + ((i * 7919) % 1000003).toString(36) + '.test');
const before = process.memoryUsage().heapUsed;
const big2 = SB.parseList(names.join('\n'));
const used = (process.memoryUsage().heapUsed - before) / 1048576;
assert.strictEqual(big2.set.size, N, 'no hash collisions among ' + N + ' domains');
console.log('safebrowse tests passed (400k entries: ~' + Math.round(used) + ' MB)');
