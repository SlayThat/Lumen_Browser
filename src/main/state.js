'use strict';
// Shared application state: stores, window registry, history/bookmark helpers.
const { Store } = require('./store');
const C = require('./config');
const { hostOf } = require('./omnibox');

const S = {
  windows: new Set(),
  wcToTab: new Map(),     // webContents id -> Tab
  uiToWin: new Map(),     // ui webContents id -> Win
  prepared: new Set(),    // session partitions that have been set up
  certAllow: new Set(),   // hosts the user chose to proceed to despite a certificate error
  proceedTokens: new Set(),
  downloads: [],
  nextDownloadId: 1,
  inputEventSeen: false,
  gpuDown: false,
  settings: null, history: null, bookmarks: null, sessionStore: null, permissions: null,
  hIndex: new Map(),
  httpAllow: new Set(),   // hosts that failed over https this session and are loaded over http
  blockedCount: 0,
  barRev: 1,              // bumps whenever the bookmarks bar contents change

  init() {
    this.settings = new Store('settings', C.DEFAULT_SETTINGS);
    if (this.settings.raw) {
      const rv = this.settings.raw.version || 0;
      const d = this.settings.data;
      if (rv < 2) { // pages start below the toolbar and the glass defaults changed
        d.underlay = C.DEFAULT_SETTINGS.underlay;
        d.glass = Object.assign({}, C.DEFAULT_SETTINGS.glass);
      }
      if (rv < 3) d.glassMode = 'glass'; // Glass is the default; clears an "Off" left behind by the old crash guard
      if (rv < C.DEFAULT_SETTINGS.version) { d.version = C.DEFAULT_SETTINGS.version; this.settings.save(); }
    }
    this.history = new Store('history', { items: [] });
    this.bookmarks = new Store('bookmarks', { items: [] });
    this.sessionStore = new Store('session', { windows: [] });
    this.permissions = new Store('permissions', { items: {} });
    for (const it of this.history.data.items) this.hIndex.set(it.url, it);
  },
  // Settings as the UI and capture loop should see them (Glass is forced off after a GPU crash).
  view() {
    const d = this.settings.data;
    return Object.assign({}, d, { adblockCount: this.blockedCount }, this.gpuDown ? { glassMode: 'off' } : {});
  },
  flushAll() {
    for (const s of [this.settings, this.history, this.bookmarks, this.sessionStore, this.permissions]) if (s) s.flush();
  },

  // ---- history ----
  addHistory(url, title) {
    if (!/^https?:/i.test(url)) return;
    let it = this.hIndex.get(url);
    const items = this.history.data.items;
    if (it) {
      it.time = Date.now(); it.visits = (it.visits || 1) + 1;
      if (title) it.title = title;
      const i = items.indexOf(it);
      if (i >= 0 && i !== items.length - 1) { items.splice(i, 1); items.push(it); }
    } else {
      it = { url, title: title || '', time: Date.now(), visits: 1 };
      items.push(it); this.hIndex.set(url, it);
      while (items.length > C.HISTORY_MAX) { const old = items.shift(); this.hIndex.delete(old.url); }
    }
    this.history.save();
  },
  setHistoryTitle(url, title) {
    const it = this.hIndex.get(url);
    if (it && title && it.title !== title) { it.title = title; this.history.save(); }
  },
  removeHistory(url) {
    const it = this.hIndex.get(url);
    if (!it) return;
    this.history.data.items = this.history.data.items.filter(x => x !== it);
    this.hIndex.delete(url); this.history.save();
  },
  clearHistory() { this.history.data.items = []; this.hIndex.clear(); this.history.save(); },
  listHistory(q, limit) {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    const items = this.history.data.items;
    for (let i = items.length - 1; i >= 0 && out.length < limit; i--) {
      const it = items[i];
      const hay = (it.title + ' ' + it.url).toLowerCase();
      if (words.every(w => hay.includes(w))) out.push({ url: it.url, title: it.title, time: it.time });
    }
    return out;
  },
  topSites(n) {
    const by = new Map();
    for (const it of this.history.data.items) {
      let o; try { o = new URL(it.url).origin; } catch (e) { continue; }
      const cur = by.get(o) || { origin: o, visits: 0, time: 0, title: '', best: 0 };
      cur.visits += it.visits || 1; cur.time = Math.max(cur.time, it.time);
      if ((it.visits || 1) >= cur.best && it.title) { cur.title = it.title; cur.best = it.visits || 1; }
      by.set(o, cur);
    }
    return Array.from(by.values()).sort((a, b) => (b.visits - a.visits) || (b.time - a.time)).slice(0, n);
  },
  suggest(q, limit) {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const seen = new Set(); const out = [];
    const match = (title, url) => { const h = (title + ' ' + url).toLowerCase(); return words.every(w => h.includes(w)); };
    for (const b of this.bookmarks.data.items) {
      if (match(b.title || '', b.url) && !seen.has(b.url)) { seen.add(b.url); out.push({ kind: 'bookmark', title: b.title, url: b.url }); }
    }
    const scored = [];
    for (const it of this.history.data.items) {
      if (seen.has(it.url) || !match(it.title || '', it.url)) continue;
      const age = (Date.now() - it.time) / 86400000;
      scored.push({ it, score: (it.visits || 1) * 2 + Math.max(0, 14 - age) });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const s of scored) { out.push({ kind: 'history', title: s.it.title, url: s.it.url }); if (out.length >= limit) break; }
    return out.slice(0, limit);
  },

  // ---- bookmarks ----
  isBookmarked(url) { return this.bookmarks.data.items.some(b => b.url === url); },
  toggleBookmark(url, title) {
    const items = this.bookmarks.data.items;
    const i = items.findIndex(b => b.url === url);
    if (i >= 0) { items.splice(i, 1); this.bookmarks.save(); this.barRev++; return false; }
    items.push({ id: this.newId(), url, title: title || hostOf(url) || url, time: Date.now(), bar: true });
    this.bookmarks.save(); this.barRev++; return true;
  },
  removeBookmark(id) {
    this.bookmarks.data.items = this.bookmarks.data.items.filter(b => b.id !== id);
    this.bookmarks.save(); this.barRev++;
  },
  setBookmarkBar(id, bar) {
    const b = this.bookmarks.data.items.find(x => x.id === id);
    if (!b) return;
    b.bar = !!bar; this.bookmarks.save(); this.barRev++;
  },
  barItems() { return this.bookmarks.data.items.filter(b => b.bar !== false).slice(0, 300).map(b => ({ id: b.id, url: b.url, title: b.title })); },
  newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },

  // ---- helpers ----
  allWins() { return Array.from(this.windows); },
  broadcast(channel, payload) { for (const w of this.windows) w.send(channel, payload); }
};

module.exports = S;
