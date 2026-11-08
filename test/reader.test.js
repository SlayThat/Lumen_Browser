'use strict';
// Reader view: whatever the page hands back is untrusted, so check it is rebuilt safely and rendered escaped.
const assert = require('assert');
const r = require('../src/main/reader');

assert.strictEqual(r.sanitize(null, 'https://a.com'), null);
assert.strictEqual(r.sanitize({ blocks: 'x' }, 'https://a.com'), null);
assert.strictEqual(r.sanitize({ blocks: [{ t: 'h', x: 'Only a heading' }] }, 'https://a.com'), null); // no paragraph, no article

const doc = r.sanitize({
  title: '<script>alert(1)</script>', byline: 'A & B', site: 'a.com',
  blocks: [
    { t: 'p', x: 'Hello <b>world</b>' },
    { t: 'script', x: 'alert(1)' },                       // unknown type dropped
    { t: 'img', s: 'javascript:alert(1)', x: 'bad' },     // not http(s)
    { t: 'img', s: 'file:///etc/passwd', x: 'bad' },
    { t: 'img', s: 'https://a.com/p.png', x: '" onerror="x' },
    { t: 'h', l: 99, x: 'Heading' },
    { t: 'li', o: true, n: 3, x: 'item' },
    null, 5, 'x'
  ]
}, 'javascript:alert(1)');
assert.strictEqual(doc.url, '');                           // a non-http page address is dropped
assert.deepStrictEqual(doc.blocks.map(b => b.t), ['p', 'img', 'h', 'li']);
assert.strictEqual(doc.blocks[2].l, 3);

const html = r.render(doc, { BASE_CSS: '', nonce: () => 'n', LOGO: '' });
assert.ok(!html.includes('<script>alert') && !html.includes('<b>world') && html.includes('&lt;b&gt;world&lt;/b&gt;'));
assert.ok(!html.includes('javascript:') && !html.includes('file:///'));
assert.ok(!/onerror="x/.test(html) && html.includes('&quot; onerror=&quot;x'));
assert.ok(html.includes("script-src 'nonce-n'") && html.includes("default-src 'none'"));

// size limits
const big = r.sanitize({ blocks: Array.from({ length: 5000 }, () => ({ t: 'p', x: 'a'.repeat(20000) })) }, 'https://a.com');
assert.strictEqual(big.blocks.length, 1500);
assert.strictEqual(big.blocks[0].x.length, 6000);

// stored documents: unknown ids give nothing, only the newest 20 are kept
assert.strictEqual(r.get('nope'), null);
const ids = Array.from({ length: 25 }, () => r.put(doc));
assert.strictEqual(r.get(ids[0]), null);
assert.ok(r.get(ids[24]));
console.log('reader tests passed');
