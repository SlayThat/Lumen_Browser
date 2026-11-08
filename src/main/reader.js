'use strict';
// Reader view: pulls the article out of a page and shows it as plain, calm text on lumen://reader.
//
// The extraction script runs inside the web page, so everything it returns is untrusted. sanitize() rebuilds a
// document from a fixed list of block types, caps every length, keeps only http(s) image addresses, and the page
// is rendered with escaped text and a strict CSP. Links inside the article are not kept; scripts, forms and
// frames never make it across.

const MAX_BLOCKS = 1500, MAX_TEXT = 6000, MAX_DOCS = 20;

// Runs in the page (via executeJavaScript). Returns a plain object, or null if there is no article.
const EXTRACT = `(function () {
  function txt(el) { return (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(); }
  function hidden(el) { var s = getComputedStyle(el); return s.display === 'none' || s.visibility === 'hidden'; }
  var SKIP = /^(NAV|ASIDE|FOOTER|HEADER|FORM|SCRIPT|STYLE|NOSCRIPT|BUTTON|IFRAME|SVG|CANVAS|VIDEO|AUDIO|SELECT|TEXTAREA|INPUT|DIALOG)$/;
  var JUNK = /(^|[\\s_-])(comment|comments|share|social|related|promo|newsletter|sidebar|advert|ad|cookie|banner|subscribe|breadcrumb|toc)([\\s_-]|$)/i;
  function junk(el) { return JUNK.test((el.className && el.className.baseVal === undefined ? el.className : '') + ' ' + (el.id || '')); }

  function score(el) {
    var ps = el.querySelectorAll('p'), s = 0;
    for (var i = 0; i < ps.length; i++) {
      var t = txt(ps[i]);
      if (t.length < 60) continue;
      var linkLen = 0, as = ps[i].querySelectorAll('a');
      for (var j = 0; j < as.length; j++) linkLen += txt(as[j]).length;
      if (linkLen / t.length > 0.5) continue;
      s += Math.min(t.length, 600) + (t.split(',').length - 1) * 8;
    }
    return s;
  }
  var root = null, best = 0;
  var cands = document.querySelectorAll('article, main, [role="main"], section, div');
  for (var c = 0; c < cands.length && c < 2500; c++) {
    var el = cands[c];
    if (SKIP.test(el.tagName) || hidden(el)) continue;
    var sc = score(el);
    // Prefer the tighter container: a parent only wins by a clear margin.
    if (el.tagName === 'ARTICLE') sc *= 1.3;
    if (sc > best * 1.05 || (sc > best && !root)) { best = sc; root = el; }
  }
  if (!root || best < 300) return null;

  var blocks = [], last = '';
  function push(b) {
    var key = b.t + '|' + (b.x || b.s || '');
    if (key === last) return;
    last = key; blocks.push(b);
  }
  function walk(el, depth) {
    if (depth > 30 || blocks.length >= 1500) return;
    for (var n = el.firstElementChild; n; n = n.nextElementSibling) {
      var tag = n.tagName;
      if (SKIP.test(tag) || hidden(n) || junk(n)) continue;
      if (/^H[1-6]$/.test(tag)) { var h = txt(n); if (h) push({ t: 'h', l: Math.min(4, Math.max(2, +tag[1])), x: h }); }
      else if (tag === 'P') { var p = txt(n); if (p.length > 1) push({ t: 'p', x: p }); }
      else if (tag === 'BLOCKQUOTE') { var q = txt(n); if (q) push({ t: 'q', x: q }); }
      else if (tag === 'PRE') { var cd = (n.innerText || '').replace(/\\s+$/, ''); if (cd) push({ t: 'code', x: cd }); }
      else if (tag === 'UL' || tag === 'OL') {
        var lis = n.children, ord = tag === 'OL';
        for (var i = 0; i < lis.length; i++) if (lis[i].tagName === 'LI') { var li = txt(lis[i]); if (li) push({ t: 'li', o: ord, n: i + 1, x: li }); }
      }
      else if (tag === 'IMG') {
        var src = n.currentSrc || n.src;
        if (src && (n.naturalWidth || 0) >= 240 && (n.naturalHeight || 0) >= 120) push({ t: 'img', s: src, x: n.alt || '' });
      }
      else if (tag === 'FIGURE') {
        var im = n.querySelector('img'), cap = n.querySelector('figcaption');
        if (im) { var s2 = im.currentSrc || im.src; if (s2 && (im.naturalWidth || 0) >= 240) push({ t: 'img', s: s2, x: cap ? txt(cap) : (im.alt || '') }); }
      }
      else if (tag === 'PICTURE') {
        var im2 = n.querySelector('img');
        if (im2) { var s3 = im2.currentSrc || im2.src; if (s3 && (im2.naturalWidth || 0) >= 240) push({ t: 'img', s: s3, x: im2.alt || '' }); }
      }
      else walk(n, depth + 1);
    }
  }
  walk(root, 0);
  var words = 0;
  blocks.forEach(function (b) { if (b.t === 'p' || b.t === 'li' || b.t === 'q') words += b.x.split(' ').length; });
  if (words < 80) return null;

  function meta(sel) { var m = document.querySelector(sel); return m ? (m.getAttribute('content') || '').trim() : ''; }
  var h1 = document.querySelector('h1');
  return {
    title: meta('meta[property="og:title"]') || (h1 ? txt(h1) : '') || document.title,
    byline: meta('meta[name="author"]') || meta('meta[property="article:author"]'),
    site: meta('meta[property="og:site_name"]') || location.hostname,
    blocks: blocks
  };
})()`;

function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
function httpUrl(v) {
  if (typeof v !== 'string' || v.length > 2048) return '';
  try { const u = new URL(v); return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : ''; } catch (e) { return ''; }
}

// Turn whatever the page returned into a safe document, or null.
function sanitize(raw, pageUrl) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.blocks)) return null;
  const blocks = [];
  for (const b of raw.blocks.slice(0, MAX_BLOCKS)) {
    if (!b || typeof b !== 'object') continue;
    switch (b.t) {
      case 'h': { const x = str(b.x, 400); if (x) blocks.push({ t: 'h', l: [2, 3, 4].includes(b.l) ? b.l : 3, x }); break; }
      case 'p': case 'q': { const x = str(b.x, MAX_TEXT); if (x) blocks.push({ t: b.t, x }); break; }
      case 'code': { const x = str(b.x, MAX_TEXT * 2); if (x) blocks.push({ t: 'code', x }); break; }
      case 'li': { const x = str(b.x, MAX_TEXT); if (x) blocks.push({ t: 'li', o: b.o === true, n: Number.isInteger(b.n) && b.n > 0 && b.n < 10000 ? b.n : 1, x }); break; }
      case 'img': { const s = httpUrl(b.s); if (s) blocks.push({ t: 'img', s, x: str(b.x, 300) }); break; }
      default: break;
    }
  }
  if (!blocks.some(b => b.t === 'p')) return null;
  const title = str(raw.title, 300) || 'Untitled';
  // the page's own copy of the title would show twice
  const dup = blocks.findIndex(b => b.t === 'h' && b.x.trim().toLowerCase() === title.trim().toLowerCase());
  if (dup >= 0 && dup < 3) blocks.splice(dup, 1);
  return { url: httpUrl(pageUrl), title, byline: str(raw.byline, 200), site: str(raw.site, 120), blocks };
}

// Documents live in memory only, one per reader tab, newest 20 kept.
const docs = new Map();
function put(doc) {
  const id = require('crypto').randomBytes(12).toString('hex');
  docs.set(id, doc);
  if (docs.size > MAX_DOCS) docs.delete(docs.keys().next().value);
  return id;
}
function get(id) { return docs.get(String(id)) || null; }

function minutes(doc) {
  let w = 0;
  for (const b of doc.blocks) if (b.t === 'p' || b.t === 'li' || b.t === 'q') w += b.x.split(' ').length;
  return Math.max(1, Math.round(w / 230));
}

function render(doc, { BASE_CSS, nonce, LOGO }) {
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = nonce();
  const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}'; img-src data: https: http:; base-uri 'none'; form-action 'none'`;
  let body = '', inList = '';
  const close = () => { if (inList) { body += `</${inList}>`; inList = ''; } };
  for (const b of doc.blocks) {
    if (b.t === 'li') {
      const tag = b.o ? 'ol' : 'ul';
      if (inList !== tag) { close(); body += b.o ? `<ol start="${b.n}">` : '<ul>'; inList = tag; }
      body += `<li>${esc(b.x)}</li>`;
      continue;
    }
    close();
    if (b.t === 'h') body += `<h${b.l}>${esc(b.x)}</h${b.l}>`;
    else if (b.t === 'p') body += `<p>${esc(b.x)}</p>`;
    else if (b.t === 'q') body += `<blockquote>${esc(b.x)}</blockquote>`;
    else if (b.t === 'code') body += `<pre><code>${esc(b.x)}</code></pre>`;
    else if (b.t === 'img') body += `<figure><img src="${esc(b.s)}" alt="${esc(b.x)}" referrerpolicy="no-referrer" loading="lazy">${b.x ? `<figcaption>${esc(b.x)}</figcaption>` : ''}</figure>`;
  }
  close();
  const orig = doc.url ? `<a class="orig" href="${esc(doc.url)}">Original page</a>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(doc.title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>${BASE_CSS}
:root{--bg:#f6f2ea;--fg:#221f1a;--mut:#8a8372;--line:#ddd6c7;--acc:#0a62d6;--code:rgba(34,31,26,.06);--ser:"Iowan Old Style","Palatino Linotype","Source Serif 4","Noto Serif","Liberation Serif",Georgia,serif;--fs:20px}
@media (prefers-color-scheme:dark){:root{--bg:#15181d;--fg:#e6e2d9;--mut:#8b8f96;--line:#2c3138;--acc:#6cb2ff;--code:rgba(255,255,255,.07)}}
body{background:var(--bg);color:var(--fg)}
.bar{position:sticky;top:0;display:flex;align-items:center;gap:14px;padding:12px 22px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);font:13px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;color:var(--mut)}
.bar .sp{flex:1}
.bar button,.bar a{font:inherit;color:var(--fg);background:none;border:1px solid var(--line);border-radius:8px;padding:6px 10px;cursor:pointer;text-decoration:none}
.bar button:hover,.bar a:hover{border-color:var(--acc);color:var(--acc)}
.bar img{width:18px;height:18px;border-radius:5px;vertical-align:-4px;margin-right:6px}
article{max-width:680px;margin:0 auto;padding:48px 24px 120px;font:var(--fs)/1.7 var(--ser)}
h1{font:700 clamp(30px,5vw,42px)/1.15 var(--ser);letter-spacing:-.01em;margin:0 0 14px}
.meta{font:14px/1.4 ui-monospace,"Cascadia Mono",Consolas,monospace;color:var(--mut);margin:0 0 38px;padding-bottom:22px;border-bottom:1px solid var(--line)}
p{margin:0 0 1.15em}
h2,h3,h4{font-family:var(--ser);line-height:1.25;margin:1.8em 0 .6em}
h2{font-size:1.5em}h3{font-size:1.25em}h4{font-size:1.05em}
blockquote{margin:1.4em 0;padding:2px 0 2px 20px;border-left:3px solid var(--acc);color:var(--fg);font-style:italic}
ul,ol{margin:0 0 1.15em;padding-left:1.4em}li{margin:.3em 0}
pre{background:var(--code);border-radius:10px;padding:14px 16px;overflow:auto;font:14px/1.5 ui-monospace,"Cascadia Mono",Consolas,monospace}
figure{margin:1.6em 0}figure img{max-width:100%;height:auto;border-radius:10px;display:block}
figcaption{font:13px/1.4 ui-monospace,Consolas,monospace;color:var(--mut);margin-top:8px}
</style></head><body>
<div class="bar"><span><img src="${LOGO}" alt="">Reader view</span><span class="sp"></span><button id="sm" type="button" title="Smaller text">A−</button><button id="lg" type="button" title="Larger text">A+</button>${orig}</div>
<article><h1>${esc(doc.title)}</h1><p class="meta">${esc(doc.site)}${doc.byline ? ' · ' + esc(doc.byline) : ''} · ${minutes(doc)} min read</p>${body}</article>
<script nonce="${n}">
(function(){var fs=20;try{var v=parseInt(localStorage.getItem('lumen.reader.fs'),10);if(v>=14&&v<=34)fs=v;}catch(e){}
function set(v){fs=Math.min(34,Math.max(14,v));document.documentElement.style.setProperty('--fs',fs+'px');try{localStorage.setItem('lumen.reader.fs',fs);}catch(e){}}
set(fs);document.getElementById('sm').onclick=function(){set(fs-2)};document.getElementById('lg').onclick=function(){set(fs+2)};})();
</script></body></html>`;
}

module.exports = { EXTRACT, sanitize, put, get, render, minutes };
