'use strict';
const assert = require('assert');
const nf = require('../src/main/netfilter');
const imp = require('../src/main/importer');

// ---- blocklist ----
assert(nf.isBlockedHost('doubleclick.net'));
assert(nf.isBlockedHost('stats.g.doubleclick.net'));
assert(!nf.isBlockedHost('notdoubleclick.net'));
assert(!nf.isBlockedHost('example.com'));
assert(!nf.isBlockedHost('com'));
assert(!nf.isBlockedHost(''));
assert(nf.BLOCKED.every(d => d === d.toLowerCase() && d.includes('.')));
const req = (url, type) => ({ url, resourceType: type });
assert.strictEqual(nf.shouldBlock(req('https://x.doubleclick.net/a.js', 'script'), 'https://news.example.com/'), true);
assert.strictEqual(nf.shouldBlock(req('https://doubleclick.net/', 'mainFrame'), 'https://news.example.com/'), false, 'never block navigations');
assert.strictEqual(nf.shouldBlock(req('https://www.doubleclick.net/x.js', 'script'), 'https://doubleclick.net/'), false, 'first party is not blocked');
assert.strictEqual(nf.shouldBlock(req('https://cdn.example.com/a.js', 'script'), 'https://news.example.com/'), false);

// ---- https upgrade ----
assert.strictEqual(nf.upgradeUrl('http://example.com/a?b=1#c'), 'https://example.com/a?b=1#c');
assert.strictEqual(nf.upgradeUrl('https://example.com/'), null);
assert.strictEqual(nf.upgradeUrl('http://localhost/'), null);
assert.strictEqual(nf.upgradeUrl('http://localhost:3000/'), null);
assert.strictEqual(nf.upgradeUrl('http://192.168.0.1/'), null);
assert.strictEqual(nf.upgradeUrl('http://router/'), null);
assert.strictEqual(nf.upgradeUrl('http://printer.local/'), null);
assert.strictEqual(nf.upgradeUrl('http://example.com:8080/'), null);
assert.strictEqual(nf.upgradeUrl('http://[::1]/'), null);
assert.strictEqual(nf.upgradeUrl('not a url'), null);
assert.strictEqual(nf.upgradeUrl('http://old.example.org/', new Set(['old.example.org'])), null, 'already failed over https');
assert(nf.shouldFallBack(-102) && nf.shouldFallBack(-107) && nf.shouldFallBack(-201) && nf.shouldFallBack(-118));
assert(!nf.shouldFallBack(-3) && !nf.shouldFallBack(-105) && !nf.shouldFallBack(-300) && !nf.shouldFallBack(0));

// ---- import ----
const chrome = JSON.stringify({ roots: {
  bookmark_bar: { type: 'folder', children: [
    { type: 'url', name: 'A', url: 'https://a.example/' },
    { type: 'folder', name: 'F', children: [{ type: 'url', name: 'Deep', url: 'http://deep.example/x' }] },
    { type: 'url', name: 'JS', url: 'javascript:alert(1)' }] },
  other: { type: 'folder', children: [{ type: 'url', name: 'Other', url: 'https://o.example/' }] }
} });
const c = imp.parseChromiumBookmarks(chrome);
assert.deepStrictEqual(c.map(b => [b.title, b.bar]), [['A', true], ['Deep', true], ['Other', false]]);
assert.deepStrictEqual(imp.parseChromiumBookmarks('garbage'), []);
assert.deepStrictEqual(imp.parseChromiumBookmarks('{}'), []);
const html = `<DL><p><DT><A HREF="https://x.example/?a=1&amp;b=2" ADD_DATE="1">Tom &amp; Jerry <b>!</b></A>
<DT><A href='http://y.example/'>Y</A><DT><A HREF="file:///c:/secret">no</A><DT><A HREF="javascript:1">no</A></DL>`;
const h = imp.parseHtmlBookmarks(html);
assert.deepStrictEqual(h.map(b => [b.url, b.title]), [['https://x.example/?a=1&b=2', 'Tom & Jerry !'], ['http://y.example/', 'Y']]);
const items = [{ id: 'z', url: 'https://a.example/', title: 'A', time: 1 }];
let n = 0;
const added = imp.mergeBookmarks(items, c.concat(c), 5, () => 'id' + (n++));
assert.strictEqual(added, 2); assert.strictEqual(items.length, 3);
assert.strictEqual(imp.mergeBookmarks(items, c, 5, () => 'q'), 0, 'importing twice adds nothing');
const files = imp.bookmarkFiles({ LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' });
assert(files.chrome.includes('Chrome') && files.edge.includes('Edge') && files.brave.includes('Brave'));
assert.deepStrictEqual(imp.bookmarkFiles({}), {});
console.log('netfilter + importer tests passed');
