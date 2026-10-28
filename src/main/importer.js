'use strict';
// Bookmark import. Pure functions, so they can be tested without Electron.
const path = require('path');

const isWeb = (u) => typeof u === 'string' && /^https?:\/\//i.test(u) && u.length <= 4096;

// Chrome, Edge and Brave all store bookmarks as JSON: { roots: { bookmark_bar, other, synced } }.
function parseChromiumBookmarks(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return []; }
  const out = [];
  const walk = (node, bar) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'url' && isWeb(node.url)) out.push({ url: node.url, title: String(node.name || '').slice(0, 300), bar });
    if (Array.isArray(node.children)) node.children.forEach(c => walk(c, bar));
  };
  const roots = (data && data.roots) || {};
  for (const key of Object.keys(roots)) walk(roots[key], key === 'bookmark_bar');
  return out;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') {
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
  }
  return Object.prototype.hasOwnProperty.call(ENT, e.toLowerCase()) ? ENT[e.toLowerCase()] : m;
});

// The "Netscape bookmark file" that Firefox, Chrome, Edge and Safari can export.
function parseHtmlBookmarks(text) {
  const out = [];
  const re = /<a\s[^>]*?href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(text)))) {
    const url = decode(m[2] !== undefined ? m[2] : m[3]);
    if (!isWeb(url)) continue;
    out.push({ url, title: decode(m[4].replace(/<[^>]*>/g, '')).trim().slice(0, 300), bar: false });
  }
  return out;
}

// Where each browser keeps its default profile on Windows.
function bookmarkFiles(env) {
  const local = env.LOCALAPPDATA || '';
  if (!local) return {};
  const f = (...p) => path.join(local, ...p, 'User Data', 'Default', 'Bookmarks');
  return {
    chrome: f('Google', 'Chrome'),
    edge: f('Microsoft', 'Edge'),
    brave: f('BraveSoftware', 'Brave-Browser')
  };
}

// Adds new bookmarks to `items` (skipping URLs already there). Returns how many were added.
function mergeBookmarks(items, imported, now, makeId) {
  const seen = new Set(items.map(b => b.url));
  let added = 0;
  for (const b of imported) {
    if (seen.has(b.url)) continue;
    seen.add(b.url);
    items.push({ id: makeId(), url: b.url, title: b.title || b.url, time: now, bar: !!b.bar });
    added++;
  }
  return added;
}

module.exports = { parseChromiumBookmarks, parseHtmlBookmarks, bookmarkFiles, mergeBookmarks };
