'use strict';
// Per-session setup: lumen:// protocol, permissions, downloads, user agent.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { session, app, shell } = require('electron');
const S = require('./state');
const C = require('./config');
const { hostOf } = require('./omnibox');
const pages = require('./pages');

const UI_ROOT = path.join(__dirname, '..', 'ui');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

function htmlResponse(body) {
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function serveStatic(pathname) {
  let rel = decodeURIComponent(pathname || '/');
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(UI_ROOT, rel));
  if (!file.startsWith(UI_ROOT + path.sep)) return new Response('Forbidden', { status: 403 });
  try {
    const data = await fs.promises.readFile(file);
    return new Response(data, { headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' } });
  } catch (e) { return new Response('Not found', { status: 404 }); }
}

function lumenHandler(isUi) {
  return async (request) => {
    let u;
    try { u = new URL(request.url); } catch (e) { return new Response('Bad request', { status: 400 }); }
    switch (u.hostname) {
      case 'app':
        return isUi ? serveStatic(u.pathname) : new Response('Forbidden', { status: 403 });
      case 'newtab': {
        const set = S.settings.data;
        const eng = C.ENGINES[set.searchEngine] || C.ENGINES.duckduckgo;
        return htmlResponse(pages.renderNewTab({ engineUrl: eng.url, engineName: eng.name, sites: S.topSites(8) }));
      }
      case 'error': {
        const q = u.searchParams;
        const url = q.get('url') || '';
        const token = crypto.randomBytes(16).toString('hex');
        S.proceedTokens.add(token);
        if (S.proceedTokens.size > 50) S.proceedTokens.delete(S.proceedTokens.values().next().value);
        return htmlResponse(pages.renderError({ desc: q.get('desc') || '', url, code: q.get('code') || '', token }));
      }
      case 'proceed': {
        const q = u.searchParams;
        const token = q.get('token'); const host = q.get('host'); const url = q.get('url') || '';
        if (!token || !S.proceedTokens.has(token) || !host || hostOf(url) !== host) return new Response('Forbidden', { status: 403 });
        S.proceedTokens.delete(token);
        S.certAllow.add(host);
        return htmlResponse(pages.renderProceed(url));
      }
      default:
        return new Response('Not found', { status: 404 });
    }
  };
}

// Permissions the user is asked about. Everything not listed here is denied.
const ASK = {
  media: 'use your camera and microphone',
  geolocation: 'know your location',
  notifications: 'show notifications',
  'clipboard-read': 'read your clipboard',
  'display-capture': 'share your screen'
};
const ALWAYS = new Set(['fullscreen', 'clipboard-sanitized-write']);

function describe(permission, details) {
  if (permission === 'media') {
    const t = (details && details.mediaTypes) || [];
    if (t.includes('video') && t.includes('audio')) return 'use your camera and microphone';
    if (t.includes('video')) return 'use your camera';
    if (t.includes('audio')) return 'use your microphone';
  }
  return ASK[permission];
}

function originOf(url) { try { return new URL(url).origin; } catch (e) { return ''; } }

function uniquePath(dir, name) {
  const ext = path.extname(name); const base = path.basename(name, ext);
  let p = path.join(dir, name); let i = 1;
  while (fs.existsSync(p)) { p = path.join(dir, `${base} (${i})${ext}`); i++; }
  return p;
}

function setupDownloads(ses) {
  ses.on('will-download', (event, item) => {
    const dir = app.getPath('downloads');
    const savePath = uniquePath(dir, item.getFilename() || 'download');
    item.setSavePath(savePath);
    const rec = { id: S.nextDownloadId++, name: path.basename(savePath), path: savePath, url: item.getURL(), total: item.getTotalBytes(), received: 0, state: 'progressing', time: Date.now(), item };
    S.downloads.unshift(rec);
    const push = () => S.broadcast('downloads', S.downloadSnapshot());
    item.on('updated', (e, state) => {
      rec.received = item.getReceivedBytes(); rec.total = item.getTotalBytes();
      rec.state = state === 'interrupted' ? 'interrupted' : (item.isPaused() ? 'paused' : 'progressing');
      push();
    });
    item.once('done', (e, state) => {
      rec.state = state; rec.received = item.getReceivedBytes(); rec.item = null; push();
      if (state === 'completed') S.broadcast('toast', { text: `Downloaded ${rec.name}` });
    });
    push();
  });
}
S.downloadSnapshot = () => S.downloads.slice(0, 100).map(d => ({ id: d.id, name: d.name, path: d.path, total: d.total, received: d.received, state: d.state, time: d.time }));

function prepare(partition, opts) {
  if (S.prepared.has(partition)) return session.fromPartition(partition);
  S.prepared.add(partition);
  const ses = session.fromPartition(partition);
  const isUi = !!(opts && opts.ui);
  const isPrivate = !!(opts && opts.isPrivate);

  ses.protocol.handle(C.SCHEME, lumenHandler(isUi));

  if (isUi) {
    ses.setPermissionRequestHandler((wc, p, cb) => cb(false));
    ses.setPermissionCheckHandler(() => false);
    return ses;
  }

  // Remove "Electron/x" and the app name so sites treat us like Chrome.
  ses.setUserAgent(ses.getUserAgent().replace(/\s?Electron\/\S+/i, '').replace(/\s?lumen-browser\/\S+/i, '').replace(/\s?Lumen\/\S+/i, ''));

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (ALWAYS.has(permission)) return callback(true);
    const label = describe(permission, details);
    const tab = S.wcToTab.get(wc.id);
    if (!label || !tab) return callback(false);
    const origin = originOf((details && details.requestingUrl) || wc.getURL());
    if (!origin || !/^https:|^http:\/\/localhost/i.test(origin)) return callback(false);
    const key = origin + '|' + permission;
    const remembered = S.permissions.data.items[key];
    if (remembered === 'allow') return callback(true);
    if (remembered === 'deny') return callback(false);
    tab.win.askPermission(origin, permission, label).then(r => {
      if (r.remember && !isPrivate) { S.permissions.data.items[key] = r.allow ? 'allow' : 'deny'; S.permissions.save(); }
      callback(!!r.allow);
    }).catch(() => callback(false));
  });
  ses.setPermissionCheckHandler((wc, permission, requestingOrigin) => {
    if (ALWAYS.has(permission)) return true;
    return S.permissions.data.items[requestingOrigin + '|' + permission] === 'allow';
  });

  setupDownloads(ses);
  return ses;
}

module.exports = { prepare };
