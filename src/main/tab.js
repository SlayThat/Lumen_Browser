'use strict';
const { WebContentsView } = require('electron');
const S = require('./state');
const C = require('./config');
const { classify, hostOf } = require('./omnibox');
const nf = require('./netfilter');

let nextTabId = 1;
const GESTURE_MS = 1500;
const NEWTAB = 'lumen://newtab';

class Tab {
  constructor(win, opts) {
    this.id = nextTabId++;
    this.win = win;
    this.url = opts.url || NEWTAB;
    this.title = opts.title || '';
    this.favicon = '';
    this.loading = false;
    this.audible = false;
    this.view = null;
    this.sleeping = false;
    this.lastActive = Date.now();
    this.errorFor = '';
    this.pinned = !!opts.pinned;
    this.upgrade = null;
    this.cssKey = null;
    this.insetGen = 0;
    this.lastGesture = 0;
    this.ctxParams = null;
    if (opts.sleeping) this.sleeping = true; else this.createView();
  }

  get wc() {
    return this.view && !this.view.webContents.isDestroyed() ? this.view.webContents : null;
  }

  createView() {
    const view = new WebContentsView({
      webPreferences: {
        partition: this.win.partition,
        contextIsolation: true, nodeIntegration: false, sandbox: true,
        webviewTag: false, spellcheck: true
      }
    });
    view.setBackgroundColor(this.win.pageBg());
    this.view = view;
    this.sleeping = false;
    S.wcToTab.set(view.webContents.id, this);
    this.bind(view.webContents);
    this.load(this.url);
  }

  ensureAwake() {
    if (!this.view) this.createView();
  }

  load(url) {
    const wc = this.wc;
    if (!wc) return;
    wc.loadURL(url).catch(() => { /* failures are reported through did-fail-load */ });
  }

  bind(wc) {
    const win = this.win;
    const changed = () => win.pushState();

    wc.on('page-title-updated', (e, title) => {
      this.title = title;
      if (!win.isPrivate) S.setHistoryTitle(this.url, title);
      changed();
    });
    wc.on('page-favicon-updated', (e, favicons) => {
      this.favicon = (favicons || []).find(f => /^(https?:|data:image\/)/i.test(f)) || '';
      changed();
    });
    wc.on('did-start-loading', () => { this.loading = true; changed(); });
    wc.on('did-stop-loading', () => { this.loading = false; changed(); win.captureSoon(); });
    wc.on('media-started-playing', () => { this.audible = true; changed(); });
    wc.on('media-paused', () => { this.audible = false; changed(); });

    wc.on('did-navigate', (e, url) => {
      if (url.startsWith('lumen://error')) this.url = this.errorFor || this.url;
      else { this.errorFor = ''; this.url = url; this.upgrade = null; }
      if (!win.isPrivate && !url.startsWith('lumen://')) S.addHistory(url, wc.getTitle());
      this.applyInset();
      this.applyZoom();
      win.scheduleSave();
      changed();
    });
    wc.on('did-navigate-in-page', (e, url, isMainFrame) => {
      if (!isMainFrame) return;
      this.url = url;
      if (!win.isPrivate) S.addHistory(url, wc.getTitle());
      win.scheduleSave();
      changed();
    });
    wc.on('dom-ready', () => { this.applyInset(); this.applyZoom(); });

    wc.on('did-fail-load', (e, code, desc, validatedURL, isMainFrame) => {
      if (!isMainFrame || code === -3) return; // -3 = aborted (user navigated away)
      if (validatedURL.startsWith('lumen://error')) return;
      // HTTPS-first: the site has no working https, so open it over http once and say so.
      if (/^https:\/\//i.test(validatedURL) && nf.shouldFallBack(code)) {
        const host = nf.hostOfUrl(validatedURL);
        const u = this.upgrade;
        // Only a load that we upgraded may fall back. An https:// address the user typed never drops to http.
        if (u && u.host === host && Date.now() - u.at < 60000 && !S.httpAllow.has(host)) {
          this.upgrade = null;
          S.httpAllow.add(host);
          win.toast(host + ' has no secure connection, so it opened over http.');
          wc.loadURL('http://' + validatedURL.slice(8)).catch(() => {});
          return;
        }
      }
      this.errorFor = validatedURL;
      this.url = validatedURL;
      this.showError(desc, code, validatedURL);
    });
    wc.on('render-process-gone', (e, details) => {
      if (details.reason === 'clean-exit') return;
      this.errorFor = this.url;
      this.showError('PAGE_CRASHED', details.reason, this.url);
    });

    wc.on('context-menu', (e, params) => { this.ctxParams = params; win.showContext(this, params); });
    wc.on('found-in-page', (e, result) => win.send('find:result', { active: result.activeMatchOrdinal, matches: result.matches }));

    wc.on('will-navigate', (details, maybeUrl) => {
      const url = typeof maybeUrl === 'string' ? maybeUrl : details.url;
      if (!this.navAllowed(url, wc.getURL())) { details.preventDefault(); win.toast('Blocked a navigation to ' + (url.split(':')[0] || 'that') + ': links'); }
    });
    wc.on('will-redirect', (details, maybeUrl) => {
      const url = typeof maybeUrl === 'string' ? maybeUrl : details.url;
      if (!this.navAllowed(url, wc.getURL())) details.preventDefault();
    });

    wc.setWindowOpenHandler((details) => {
      const url = details.url;
      const gesture = Date.now() - this.lastGesture < GESTURE_MS || !S.inputEventSeen;
      if (/^https?:/i.test(url) && gesture) {
        win.newTab(url, { background: details.disposition === 'background-tab', opener: this });
      } else {
        win.toast('Pop-up blocked');
      }
      return { action: 'deny' };
    });

    wc.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown') this.lastGesture = Date.now();
      if (win.handleKey(input, event)) event.preventDefault();
    });
    wc.on('input-event', (e, ev) => {
      S.inputEventSeen = true;
      if (ev && (ev.type === 'mouseDown' || ev.type === 'touchStart')) this.lastGesture = Date.now();
    });
    wc.on('enter-html-full-screen', () => win.setHtmlFullscreen(true));
    wc.on('leave-html-full-screen', () => win.setHtmlFullscreen(false));
  }

  navAllowed(url, from) {
    if (/^(https?|file|about|view-source|blob|data):/i.test(url)) return true;
    if (/^lumen:/i.test(url)) return /^lumen:/i.test(from) || from === '' || from === 'about:blank';
    return false;
  }

  showError(desc, code, url) {
    const wc = this.wc;
    if (!wc) return;
    const q = new URLSearchParams({ desc: desc || '', code: String(code), url });
    wc.loadURL('lumen://error?' + q.toString()).catch(() => {});
  }

  // ---- navigation ----
  navigate(text) {
    const r = classify(text, S.settings.data.searchEngine);
    if (r.type === 'empty') return;
    this.url = r.url;
    this.ensureAwake();
    this.load(r.url);
    this.win.pushState();
  }
  back() { const wc = this.wc; if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); }
  forward() { const wc = this.wc; if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); }
  reload(hard) { const wc = this.wc; if (!wc) return; if (this.errorFor) { this.load(this.errorFor); return; } hard ? wc.reloadIgnoringCache() : wc.reload(); }
  stop() { const wc = this.wc; if (wc) wc.stop(); }
  historyList() {
    const wc = this.wc;
    if (!wc) return { entries: [], index: 0 };
    const h = wc.navigationHistory;
    return { entries: h.getAllEntries().map(e => ({ url: e.url, title: e.title })), index: h.getActiveIndex() };
  }
  goToIndex(i) { const wc = this.wc; if (wc) wc.navigationHistory.goToIndex(i); }

  // ---- find ----
  find(text, opts) {
    const wc = this.wc;
    if (!wc) return;
    if (!text) { wc.stopFindInPage('clearSelection'); this.win.send('find:result', { active: 0, matches: 0 }); return; }
    wc.findInPage(text, { forward: opts.forward !== false, findNext: !!opts.findNext, matchCase: !!opts.matchCase });
  }
  stopFind() { const wc = this.wc; if (wc) wc.stopFindInPage('clearSelection'); }

  // ---- zoom ----
  zoomFactor() { return S.settings.data.zoom[hostOf(this.url)] || 1; }
  applyZoom() {
    const wc = this.wc;
    if (wc) wc.setZoomFactor(this.zoomFactor());
  }
  setZoom(dir) {
    const steps = C.ZOOM_STEPS;
    const cur = this.zoomFactor();
    let i = steps.reduce((best, v, idx) => Math.abs(v - cur) < Math.abs(steps[best] - cur) ? idx : best, 0);
    let f = 1;
    if (dir === 'in') f = steps[Math.min(steps.length - 1, i + 1)];
    else if (dir === 'out') f = steps[Math.max(0, i - 1)];
    const host = hostOf(this.url);
    if (host) {
      if (f === 1) delete S.settings.data.zoom[host]; else S.settings.data.zoom[host] = f;
      S.settings.save();
    }
    this.applyZoom();
    this.win.pushState();
    return f;
  }

  // ---- toolbar underlay ----
  applyInset() {
    const wc = this.wc;
    if (!wc) return;
    const px = this.win.inset();
    const gen = ++this.insetGen;
    const old = this.cssKey;
    this.cssKey = null;
    if (old) wc.removeInsertedCSS(old).catch(() => {});
    if (px > 0) {
      wc.insertCSS(`html{padding-top:${px}px !important;box-sizing:border-box !important;scroll-padding-top:${px}px !important}`)
        .then(k => {
          // Two calls close together (navigate + dom-ready): only the newest keeps its CSS, so none is left behind.
          if (gen === this.insetGen) this.cssKey = k;
          else { const w = this.wc; if (w) w.removeInsertedCSS(k).catch(() => {}); }
        }).catch(() => {});
    }
  }

  // ---- sleeping ----
  canSleep() {
    const wc = this.wc;
    return !!wc && !this.loading && !this.audible && !wc.isCurrentlyAudible() && !wc.isDevToolsOpened();
  }
  sleep() {
    if (!this.canSleep()) return;
    this.closeView();
    this.sleeping = true;
  }
  closeView() {
    const view = this.view;
    if (!view) return;
    this.view = null;
    this.win.detachView(view);
    const wc = view.webContents;
    S.wcToTab.delete(wc.id);
    try { if (!wc.isDestroyed()) wc.close({ waitForBeforeUnload: false }); } catch (e) { /* already gone */ }
  }
  dispose() { this.closeView(); }

  info() {
    let title = this.title;
    if (!title) title = this.url === NEWTAB ? 'New Tab' : (hostOf(this.url) || this.url || 'New Tab');
    return { id: this.id, title, url: this.url, favicon: this.favicon, loading: this.loading, sleeping: this.sleeping, audible: this.audible, pinned: this.pinned };
  }
}

module.exports = { Tab, NEWTAB };
