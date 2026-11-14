'use strict';
// Electron side of the phishing warnings: keeps the list on disk, refreshes it, and answers "is this address listed?".
const fs = require('fs');
const path = require('path');
const { app, net } = require('electron');
const S = require('./state');
const SB = require('./safebrowse');

let set = null, started = false, busy = false, lastTry = 0;
const cacheFile = () => path.join(app.getPath('userData'), 'phishing-list.txt');

function loadCache() {
  try {
    const parsed = SB.parseList(fs.readFileSync(cacheFile(), 'utf8'));
    if (SB.looksValid(parsed)) set = parsed.set;
  } catch (e) { /* no cache yet */ }
}

function cacheAge() {
  try { return Date.now() - fs.statSync(cacheFile()).mtimeMs; } catch (e) { return Infinity; }
}

async function refresh() {
  if (busy || Date.now() - lastTry < 10 * 60 * 1000) return;
  busy = true; lastTry = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 60000);
    const res = await net.fetch(SB.SOURCE_URL, { signal: ctl.signal, headers: { 'user-agent': 'Lumen' } });
    clearTimeout(timer);
    if (!res.ok) return;
    const len = Number(res.headers.get('content-length') || 0);
    if (len > SB.MAX_BYTES) return;
    const text = await res.text();
    if (text.length > SB.MAX_BYTES) return;
    const parsed = SB.parseList(text);
    if (!SB.looksValid(parsed)) return;       // keep the list we already have
    set = parsed.set;
    const tmp = cacheFile() + '.tmp';
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, cacheFile());
  } catch (e) { /* offline or blocked: try again later, browsing is unaffected */ }
  finally { busy = false; }
}

function start() {
  if (started) return;
  started = true;
  loadCache();
  const tick = () => { if (S.settings.data.safeBrowsing && cacheAge() > SB.MAX_AGE_MS) refresh(); };
  setTimeout(tick, 15000);
  setInterval(tick, 3 * 3600 * 1000).unref();
}

// Called for every main-frame request. Cheap: a few number lookups.
function check(url) {
  if (!S.settings.data.safeBrowsing) return false;
  if (!started) start();
  const host = SB.hostOfUrl(url);
  return !S.sbAllow.has(host) && SB.isListed(set, host);
}

module.exports = { start, check, refresh };
