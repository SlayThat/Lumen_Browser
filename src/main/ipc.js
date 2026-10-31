'use strict';
// All IPC from the glass UI. Every message is checked: sender must be a Lumen UI view
// showing lumen://app/, and every argument is validated before use.
const fs = require('fs');
const { app, ipcMain, shell, session, clipboard, dialog } = require('electron');
const importer = require('./importer');
const S = require('./state');
const C = require('./config');
const { Win } = require('./win');
const { classify } = require('./omnibox');

const isStr = (v, max = 4096) => typeof v === 'string' && v.length <= max;
const isInt = (v) => Number.isInteger(v);
const isBool = (v) => typeof v === 'boolean';
const num = (lo, hi) => (v) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

const SETTINGS = {
  searchEngine: v => isStr(v, 32) && !!C.ENGINES[v],
  homePage: v => isStr(v, 2048) && classify(v).type !== 'empty',
  theme: v => ['system', 'light', 'dark'].includes(v),
  glassMode: v => ['glass', 'frosted', 'off'].includes(v),
  underlay: isBool,
  'glass.blur': num(0, 24),
  'glass.refraction': num(0, 60),
  'glass.saturation': num(0.8, 1.8),
  'glass.tint': num(0, 0.6),
  sleepMinutes: v => isInt(v) && v >= 0 && v <= 720,
  restoreSession: isBool,
  adblock: isBool,
  httpsFirst: isBool,
  bookmarksBar: isBool
};

function winFrom(event) {
  const win = S.uiToWin.get(event.sender.id);
  if (!win || win.closed) return null;
  const frame = event.senderFrame;
  if (!frame || !String(frame.url).startsWith('lumen://app/')) return null;
  return win;
}

function on(channel, fn) {
  ipcMain.on(channel, (event, ...args) => {
    const win = winFrom(event);
    if (!win) return;
    try { fn(win, ...args); } catch (e) { console.error('[ipc]', channel, e); }
  });
}
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    const win = winFrom(event);
    if (!win) return null;
    try { return fn(win, ...args); } catch (e) { console.error('[ipc]', channel, e); return null; }
  });
}

function register() {
  // ---- tabs ----
  on('tab:new', (w, url) => w.newTab(isStr(url, 2048) && url ? classify(url, S.settings.data.searchEngine).url : undefined));
  on('tab:close', (w, id) => { if (isInt(id)) w.closeTab(id); });
  on('tab:activate', (w, id) => { if (isInt(id)) w.activate(id); });
  on('tab:move', (w, o) => { if (o && isInt(o.id) && isInt(o.index)) w.moveTab(o.id, o.index); });
  on('tab:pin', (w, o) => { if (o && isInt(o.id) && isBool(o.pinned)) w.pinTab(o.id, o.pinned); });
  on('tab:duplicate', (w, id) => { const t = isInt(id) && w.findTab(id); if (t) w.newTab(t.url, { opener: t }); });
  on('tab:closeOthers', (w, id) => { if (!isInt(id)) return; w.tabs.filter(t => t.id !== id && !t.pinned).forEach(t => w.closeTab(t.id)); });
  on('tab:reload', (w, id) => { const t = isInt(id) && w.findTab(id); if (t) { t.ensureAwake(); t.reload(false); } });
  on('cmd', (w, name, arg) => {
    const allowed = ['newTab', 'closeTab', 'reopenTab', 'reload', 'stop', 'back', 'forward', 'home', 'zoom', 'fullscreen', 'devtools', 'print', 'newWindow', 'newPrivateWindow', 'bookmark'];
    if (isStr(name, 32) && allowed.includes(name)) w.command(name, arg === 'in' || arg === 'out' || arg === 'reset' ? arg : (isBool(arg) ? arg : undefined));
  });

  // ---- navigation ----
  on('navTo', (w, text) => { const a = w.active; if (a && isStr(text, 2048)) { a.navigate(text); if (a.wc) a.wc.focus(); } });
  handle('nav:history', (w) => { const a = w.active; return a ? a.historyList() : { entries: [], index: 0 }; });
  on('nav:goto', (w, i) => { const a = w.active; if (a && isInt(i)) a.goToIndex(i); });
  handle('suggest', (w, q) => isStr(q, 256) ? S.suggest(q, 6) : []);

  // ---- find ----
  on('find', (w, o) => { const a = w.active; if (a && o && isStr(o.text, 256)) a.find(o.text, o); });
  on('find:stop', (w) => { const a = w.active; if (a) a.stopFind(); });

  // ---- layout / window ----
  on('layout', (w, o) => {
    if (!o || !['strip', 'extra', 'full'].includes(o.mode)) return;
    const extra = isInt(o.extra) ? Math.max(0, Math.min(900, o.extra)) : 0;
    w.setUiLayout(o.mode, extra);
  });
  on('window', (w, action) => {
    if (action === 'minimize') w.bw.minimize();
    else if (action === 'maximize') (w.bw.isMaximized() ? w.bw.unmaximize() : w.bw.maximize());
    else if (action === 'close') w.bw.close();
  });
  on('focusPage', (w) => { const a = w.active; if (a && a.wc) a.wc.focus(); });

  // ---- context menu ----
  on('ctx:run', (w, id) => { if (isStr(id, 40)) w.runContext(id); });
  on('ctx:close', (w) => { w.ctx = null; });

  // ---- permissions ----
  on('perm:answer', (w, o) => { if (o && isInt(o.id)) w.answerPermission(o.id, o.allow === true, o.remember === true); });

  // ---- bookmarks / history ----
  handle('bookmarks:bar', () => S.barItems());
  on('bookmark:bar', (w, o) => { if (o && isStr(o.id, 64) && isBool(o.bar)) { S.setBookmarkBar(o.id, o.bar); S.allWins().forEach(x => x.pushState()); } });
  const BROWSERS = { chrome: 'Chrome', edge: 'Edge', brave: 'Brave' };
  handle('import:sources', () => {
    const files = importer.bookmarkFiles(process.env);
    return Object.keys(BROWSERS).filter(k => files[k] && fs.existsSync(files[k])).map(k => ({ key: k, label: BROWSERS[k] }));
  });
  on('import:bookmarks', async (w, source) => {
    try {
      let list = [];
      if (source === 'file') {
        const r = await dialog.showOpenDialog(w.bw, { title: 'Import bookmarks', properties: ['openFile'], filters: [{ name: 'Bookmark files', extensions: ['html', 'htm', 'json'] }] });
        if (r.canceled || !r.filePaths[0]) return;
        const st = fs.statSync(r.filePaths[0]);
        if (st.size > 50 * 1024 * 1024) return w.toast('That file is too large to import');
        const text = fs.readFileSync(r.filePaths[0], 'utf8');
        list = /\.json$/i.test(r.filePaths[0]) ? importer.parseChromiumBookmarks(text) : importer.parseHtmlBookmarks(text);
      } else if (BROWSERS[source]) {
        const f = importer.bookmarkFiles(process.env)[source];
        if (!f || !fs.existsSync(f)) return w.toast('Could not find ' + BROWSERS[source] + ' bookmarks');
        list = importer.parseChromiumBookmarks(fs.readFileSync(f, 'utf8'));
      } else return;
      const n = importer.mergeBookmarks(S.bookmarks.data.items, list, Date.now(), () => S.newId());
      if (n) { S.bookmarks.save(); S.barRev++; }
      S.allWins().forEach(x => { if (!x.closed) x.pushState(); });
      w.toast(list.length ? ('Imported ' + n + ' bookmark' + (n === 1 ? '' : 's') + (n < list.length ? ' (' + (list.length - n) + ' already saved)' : '')) : 'No bookmarks found in that file');
    } catch (e) { w.toast('Could not import bookmarks'); }
  });
  handle('bookmarks:list', () => S.bookmarks.data.items.slice().reverse());
  on('bookmarks:remove', (w, id) => { if (isStr(id, 64)) { S.removeBookmark(id); w.pushState(); } });
  handle('history:list', (w, q) => S.listHistory(isStr(q, 256) ? q : '', 400));
  on('history:remove', (w, url) => { if (isStr(url, 4096)) S.removeHistory(url); });
  on('history:clear', (w) => { S.clearHistory(); w.toast('History cleared'); });

  // ---- downloads ----
  handle('downloads:list', () => S.downloadSnapshot());
  on('download:act', (w, o) => {
    if (!o || !isInt(o.id)) return;
    const d = S.downloads.find(x => x.id === o.id);
    if (!d) return;
    if (o.action === 'open' && d.state === 'completed') shell.openPath(d.path).then(err => { if (err) w.toast('Could not open the file'); });
    else if (o.action === 'show') shell.showItemInFolder(d.path);
    else if (o.action === 'cancel' && d.item) d.item.cancel();
    else if (o.action === 'remove') { S.downloads = S.downloads.filter(x => x !== d); S.broadcast('downloads', S.downloadSnapshot()); }
  });
  on('downloads:clear', () => { S.downloads = S.downloads.filter(d => d.state === 'progressing'); S.broadcast('downloads', S.downloadSnapshot()); });

  // ---- default browser / updates ----
  on('app:defaultBrowser', (w) => {
    try { app.setAsDefaultProtocolClient('http'); app.setAsDefaultProtocolClient('https'); } catch (e) { /* the settings page still opens */ }
    shell.openExternal('ms-settings:defaultapps').catch(() => w.toast('Open Windows Settings, then Default apps, and choose Lumen'));
  });
  on('app:checkUpdate', (w) => require('./updater').check(true));

  // ---- settings ----
  handle('settings:get', () => S.view());
  on('settings:set', (w, o) => {
    if (!o || !isStr(o.key, 40) || !SETTINGS[o.key] || !SETTINGS[o.key](o.value)) return;
    let value = o.value;
    if (o.key === 'homePage') value = classify(value, S.settings.data.searchEngine).url;
    const parts = o.key.split('.');
    let t = S.settings.data;
    while (parts.length > 1) t = t[parts.shift()];
    t[parts[0]] = value;
    S.settings.save();
    Win.onSettingsChanged(o.key);
  });
  on('data:clear', async (w, what) => {
    try {
      const ses = session.fromPartition('persist:lumen');
      if (what === 'history' || what === 'all') S.clearHistory();
      if (what === 'cache' || what === 'all') await ses.clearCache();
      if (what === 'cookies' || what === 'all') await ses.clearStorageData();
      if (what === 'all') { S.permissions.data.items = {}; S.permissions.save(); S.certAllow.clear(); }
      w.toast('Cleared');
    } catch (e) { w.toast('Could not clear that data'); }
  });
  on('clipboard:copy', (w, text) => { if (isStr(text, 4096)) clipboard.writeText(text); });
}

module.exports = { register };
