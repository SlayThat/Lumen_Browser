'use strict';
const path = require('path');
const { BrowserWindow, WebContentsView, nativeTheme, shell } = require('electron');
const S = require('./state');
const C = require('./config');
const { Tab, NEWTAB } = require('./tab');
const ctxmenu = require('./ctxmenu');
const { prepare } = require('./session');
const { isSecureUrl } = require('./omnibox');

let nextWinId = 1;
const MAX_CLOSED = 20;

class Win {
  constructor(opts = {}) {
    this.id = nextWinId++;
    this.isPrivate = !!opts.isPrivate;
    this.partition = this.isPrivate ? 'lumen-private-' + this.id : 'persist:lumen';
    prepare(this.partition, { isPrivate: this.isPrivate });
    prepare('lumen-ui', { ui: true });

    this.tabs = [];
    this.activeId = 0;
    this.closedTabs = [];
    this.uiMode = 'strip';
    this.uiExtra = 0;
    this.htmlFs = false;
    this.closing = false;
    this.closed = false;
    this.uiReady = false;
    this.perms = new Map();
    this.permSeq = 0;
    this.ctx = null;
    this.stateTimer = null;
    this.saveTimer = null;
    this.capTimer = null;
    this.capSame = 0;
    this.lastHash = null;

    const native = C.NATIVE_CAPTION_BUTTONS;
    this.bw = new BrowserWindow(Object.assign({
      width: 1320, height: 860, minWidth: 520, minHeight: 380,
      show: false, title: C.APP_NAME, autoHideMenuBar: true,
      icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
      backgroundColor: this.windowBg()
    }, native
      ? { titleBarStyle: 'hidden', titleBarOverlay: { color: '#00000000', symbolColor: this.symbolColor(), height: C.CAPTION_H } }
      : { frame: false }));
    this.bw.setMenuBarVisibility(false);

    this.ui = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'ui-preload.js'),
        partition: 'lumen-ui',
        contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false, spellcheck: false
      }
    });
    this.ui.setBackgroundColor('#00000000');
    this.bw.contentView.addChildView(this.ui);
    const uwc = this.ui.webContents;
    this.uiId = uwc.id;
    S.uiToWin.set(uwc.id, this);
    S.windows.add(this);

    uwc.on('before-input-event', (event, input) => { if (this.handleKey(input, event)) event.preventDefault(); });
    uwc.on('will-navigate', (e) => e.preventDefault());
    uwc.setWindowOpenHandler(() => ({ action: 'deny' }));
    uwc.on('render-process-gone', () => { this.uiReady = false; this.lastHash = null; if (!this.closed) uwc.reload(); });
    uwc.on('did-finish-load', () => {
      this.uiReady = true;
      this.lastHash = null;
      this.pushState(true);
      this.send('settings', S.view());
      this.send('downloads', S.downloadSnapshot());
      if (!this.bw.isVisible() && !this.closed) { this.bw.show(); }
      if (S.startNotice) { const n = S.startNotice; S.startNotice = null; setTimeout(() => this.toast(n), 700); }
      this.captureSoon();
    });
    uwc.loadURL('lumen://app/index.html').catch(() => {});

    this.bw.on('resize', () => this.layout());
    this.bw.on('maximize', () => { this.layout(); this.pushState(); });
    this.bw.on('unmaximize', () => { this.layout(); this.pushState(); });
    this.bw.on('enter-full-screen', () => this.onFullscreenChange());
    this.bw.on('leave-full-screen', () => this.onFullscreenChange());
    this.bw.on('focus', () => this.captureSoon());
    this.bw.on('close', () => {
      this.closing = true;
      if (!this.isPrivate && Array.from(S.windows).some(w => w !== this && !w.closing && !w.isPrivate)) Win.saveSession();
    });
    this.bw.on('closed', () => this.onClosed());

    // initial tabs
    const urls = (opts.tabs && opts.tabs.length) ? opts.tabs : [{ url: opts.url || NEWTAB }];
    const wanted = Math.max(opts.active || 0, 0);
    // Restored tabs start asleep (no page loaded) except the one that will be shown.
    urls.forEach((t, i) => this.newTab(t.url, { background: true, title: t.title, noFocus: true, sleeping: !!opts.tabs && i !== wanted }));
    const idx = Math.min(wanted, this.tabs.length - 1);
    this.activate(this.tabs[idx].id, { focus: false });
    this.layout();
    this.captureTick();
  }

  // ---------- appearance ----------
  isDark() { return this.isPrivate || nativeTheme.shouldUseDarkColors; }
  windowBg() { return this.isDark() ? '#12161c' : '#eef1f5'; }
  pageBg() { return this.isDark() ? '#15181e' : '#ffffff'; }
  symbolColor() { return this.isDark() ? '#ffffff' : '#111111'; }
  updateAppearance() {
    if (this.closed) return;
    this.bw.setBackgroundColor(this.windowBg());
    if (C.NATIVE_CAPTION_BUTTONS) {
      try { this.bw.setTitleBarOverlay({ color: '#00000000', symbolColor: this.symbolColor(), height: C.CAPTION_H }); } catch (e) { /* not supported */ }
    }
    this.pushState();
  }

  // ---------- layout ----------
  isFullscreen() { return this.bw.isFullScreen() || this.htmlFs; }
  inset() { return (S.settings.data.underlay && !this.isFullscreen()) ? C.STRIP_H : 0; }
  uiHeight() {
    const [, h] = this.bw.getContentSize();
    if (this.isFullscreen()) return 0;
    if (this.uiMode === 'full') return h;
    return Math.min(h, C.STRIP_H + (this.uiMode === 'extra' ? this.uiExtra : 0));
  }
  layout() {
    if (this.closed) return;
    const [w, h] = this.bw.getContentSize();
    const full = this.isFullscreen();
    const uiH = this.uiHeight();
    this.ui.setBounds({ x: 0, y: 0, width: w, height: uiH });
    this.ui.setVisible(uiH > 0);
    const a = this.active;
    if (a && a.view) {
      const top = (S.settings.data.underlay || full) ? 0 : C.STRIP_H;
      a.view.setBounds({ x: 0, y: top, width: w, height: Math.max(0, h - top) });
    }
    this.pushState();
  }
  setUiLayout(mode, extra) {
    this.uiMode = mode;
    this.uiExtra = extra;
    this.layout();
    this.captureSoon();
  }
  onFullscreenChange() {
    this.layout();
    this.tabs.forEach(t => t.applyInset());
    this.pushState();
    this.captureSoon();
  }
  setHtmlFullscreen(on) {
    this.htmlFs = on;
    if (on) { this.fsFromHtml = !this.bw.isFullScreen(); if (this.fsFromHtml) this.bw.setFullScreen(true); }
    else if (this.fsFromHtml) { this.fsFromHtml = false; this.bw.setFullScreen(false); }
    this.onFullscreenChange();
  }
  detachView(view) {
    try { this.bw.contentView.removeChildView(view); } catch (e) { /* not attached */ }
  }

  // ---------- tabs ----------
  get active() { return this.tabs.find(t => t.id === this.activeId) || null; }
  findTab(id) { return this.tabs.find(t => t.id === id) || null; }

  newTab(url, opts = {}) {
    const t = new Tab(this, { url: url || NEWTAB, title: opts.title, sleeping: !!opts.sleeping });
    let at = this.tabs.length;
    if (opts.opener) { const i = this.tabs.indexOf(opts.opener); if (i >= 0) at = i + 1; }
    this.tabs.splice(at, 0, t);
    if (!opts.background) {
      this.activate(t.id, { focus: !opts.noFocus });
      if (t.url === NEWTAB && !opts.noFocus) this.command('focusAddress');
    }
    this.pushState();
    this.scheduleSave();
    return t;
  }

  activate(id, opts = {}) {
    const t = this.findTab(id);
    if (!t) return;
    const prev = this.active;
    if (prev && prev !== t) {
      prev.stopFind();
      prev.lastActive = Date.now();
      if (prev.view) this.detachView(prev.view);
    }
    this.activeId = id;
    t.lastActive = Date.now();
    t.ensureAwake();
    this.bw.contentView.addChildView(t.view);
    this.bw.contentView.addChildView(this.ui); // keep the glass UI on top
    this.layout();
    t.applyInset();
    t.applyZoom();
    if (opts.focus !== false && t.wc && t.url !== NEWTAB) t.wc.focus();
    this.lastHash = null;
    this.pushState();
    this.scheduleSave();
    this.captureSoon();
  }

  closeTab(id) {
    const i = this.tabs.findIndex(t => t.id === id);
    if (i < 0) return;
    const t = this.tabs[i];
    if (!this.isPrivate && /^https?:/i.test(t.url)) {
      this.closedTabs.push({ url: t.url, title: t.title });
      if (this.closedTabs.length > MAX_CLOSED) this.closedTabs.shift();
    }
    const wasActive = t.id === this.activeId;
    this.tabs.splice(i, 1);
    t.dispose();
    if (!this.tabs.length) { this.bw.close(); return; }
    if (wasActive) {
      const next = this.tabs[Math.min(i, this.tabs.length - 1)];
      this.activeId = 0;
      this.activate(next.id);
    }
    this.pushState();
    this.scheduleSave();
  }

  moveTab(id, index) {
    const i = this.tabs.findIndex(t => t.id === id);
    if (i < 0 || !Number.isInteger(index)) return;
    const [t] = this.tabs.splice(i, 1);
    this.tabs.splice(Math.max(0, Math.min(index, this.tabs.length)), 0, t);
    this.pushState();
    this.scheduleSave();
  }

  cycleTab(dir) {
    if (this.tabs.length < 2) return;
    const i = this.tabs.findIndex(t => t.id === this.activeId);
    this.activate(this.tabs[(i + dir + this.tabs.length) % this.tabs.length].id);
  }

  sleepTick() {
    const mins = S.settings.data.sleepMinutes;
    if (!mins) return;
    const cutoff = Date.now() - mins * 60000;
    for (const t of this.tabs) {
      if (t.id !== this.activeId && t.view && t.lastActive < cutoff) t.sleep();
    }
    this.pushState();
  }

  // ---------- commands ----------
  command(name, arg) {
    const a = this.active;
    switch (name) {
      case 'newTab': this.newTab(NEWTAB); break;
      case 'closeTab': this.closeTab(Number.isInteger(arg) ? arg : this.activeId); break;
      case 'reopenTab': { const c = this.closedTabs.pop(); if (c) this.newTab(c.url, { title: c.title }); break; }
      case 'cycleTab': this.cycleTab(arg); break;
      case 'gotoTab': { const t = arg >= 9 ? this.tabs[this.tabs.length - 1] : this.tabs[arg - 1]; if (t) this.activate(t.id); break; }
      case 'focusAddress': this.ui.webContents.focus(); this.send('cmd', { name: 'focusAddress' }); break;
      case 'find': this.ui.webContents.focus(); this.send('cmd', { name: 'find' }); break;
      case 'panel': this.ui.webContents.focus(); this.send('cmd', { name: 'panel', arg }); break;
      case 'bookmark': if (a && /^https?:/i.test(a.url)) { const on = S.toggleBookmark(a.url, a.title); this.toast(on ? 'Bookmarked' : 'Bookmark removed'); this.pushState(); } break;
      case 'reload': if (a) a.reload(!!arg); break;
      case 'stop': if (a) a.stop(); break;
      case 'back': if (a) a.back(); break;
      case 'forward': if (a) a.forward(); break;
      case 'home': if (a) a.navigate(S.settings.data.homePage); break;
      case 'zoom': if (a) { a.setZoom(arg); } break;
      case 'fullscreen': this.bw.setFullScreen(!this.bw.isFullScreen()); break;
      case 'devtools': if (a && a.wc) a.wc.toggleDevTools(); break;
      case 'print': if (a && a.wc) a.wc.print(); break;
      case 'newWindow': new Win({}); break;
      case 'newPrivateWindow': new Win({ isPrivate: true }); break;
      default: break;
    }
  }

  handleKey(input, event) {
    if (input.type !== 'keyDown') return false;
    const ctrl = input.control || input.meta;
    const shift = input.shift;
    const alt = input.alt;
    const k = String(input.key || '').toLowerCase();
    const run = (n, a) => { this.command(n, a); return true; };
    if (ctrl && !alt) {
      switch (k) {
        case 't': return shift ? run('reopenTab') : run('newTab');
        case 'w': return run('closeTab');
        case 'n': return shift ? run('newPrivateWindow') : run('newWindow');
        case 'l': return run('focusAddress');
        case 'f': return run('find');
        case 'd': return run('bookmark');
        case 'h': return run('panel', 'history');
        case 'j': return run('panel', 'downloads');
        case 'r': return run('reload', shift);
        case 'p': return run('print');
        case '=': case '+': return run('zoom', 'in');
        case '-': case '_': return run('zoom', 'out');
        case '0': return run('zoom', 'reset');
        case 'tab': return run('cycleTab', shift ? -1 : 1);
        case 'pageup': return run('cycleTab', -1);
        case 'pagedown': return run('cycleTab', 1);
        case ',': return run('panel', 'settings');
        case 'i': if (shift) return run('devtools'); break;
        case 'delete': if (shift) return run('panel', 'settings'); break;
        default: if (/^[1-9]$/.test(k)) return run('gotoTab', parseInt(k, 10));
      }
    }
    if (alt && !ctrl) {
      if (k === 'arrowleft') return run('back');
      if (k === 'arrowright') return run('forward');
      if (k === 'home') return run('home');
      if (k === 'd') return run('focusAddress');
    }
    if (k === 'f5') return run('reload', ctrl);
    if (k === 'f6') return run('focusAddress');
    if (k === 'f11') return run('fullscreen');
    if (k === 'f12') return run('devtools');
    return false;
  }

  // ---------- UI messaging ----------
  send(channel, payload) {
    const wc = this.ui && this.ui.webContents;
    if (this.closed || !wc || wc.isDestroyed() || !this.uiReady) return;
    wc.send(channel, payload);
  }
  toast(text) { this.send('toast', { text }); }

  snapshot() {
    const a = this.active;
    const url = a ? a.url : '';
    const f = a ? a.zoomFactor() : 1;
    let canBack = false, canFwd = false;
    if (a && a.wc) { const h = a.wc.navigationHistory; canBack = h.canGoBack(); canFwd = h.canGoForward(); }
    return {
      winId: this.id, isPrivate: this.isPrivate,
      caption: C.NATIVE_CAPTION_BUTTONS ? 'native' : 'custom', captionW: C.CAPTION_W,
      maximized: this.bw.isMaximized(), fullscreen: this.isFullscreen(),
      activeId: this.activeId,
      tabs: this.tabs.map(t => t.info()),
      nav: {
        url: url === NEWTAB ? '' : url,
        canBack, canFwd, loading: !!(a && a.loading),
        secure: isSecureUrl(url),
        bookmarked: !!url && S.isBookmarked(url),
        bookmarkable: /^https?:/i.test(url),
        zoom: f
      },
      stripH: C.STRIP_H,
      size: this.bw.getContentSize()
    };
  }
  pushState(now) {
    if (now) { clearTimeout(this.stateTimer); this.stateTimer = null; this.send('state', this.snapshot()); return; }
    if (this.stateTimer) return;
    this.stateTimer = setTimeout(() => { this.stateTimer = null; this.send('state', this.snapshot()); }, 24);
  }

  // ---------- context menu ----------
  showContext(tab, params) {
    if (tab !== this.active) return;
    const items = ctxmenu.build(tab, params);
    if (!items.length) return;
    const top = (S.settings.data.underlay || this.isFullscreen()) ? 0 : C.STRIP_H;
    this.ctx = { tab, params };
    this.send('ctx:show', { x: params.x, y: params.y + top, items });
  }
  runContext(id) {
    const c = this.ctx;
    this.ctx = null;
    if (c && this.tabs.includes(c.tab)) ctxmenu.run(this, c.tab, c.params, id);
  }

  // ---------- permissions ----------
  askPermission(origin, permission, label) {
    return new Promise((resolve) => {
      const id = ++this.permSeq;
      this.perms.set(id, resolve);
      this.send('perm:ask', { id, origin, permission, label });
    });
  }
  answerPermission(id, allow, remember) {
    const r = this.perms.get(id);
    if (r) { this.perms.delete(id); r({ allow: !!allow, remember: !!remember }); }
  }

  // ---------- glass frame capture ----------
  captureSoon() {
    if (this.closed) return;
    clearTimeout(this.capTimer);
    this.capTimer = setTimeout(() => this.captureTick(), 25);
  }
  async captureTick() {
    if (this.closed) return;
    clearTimeout(this.capTimer);
    let next = 120;
    try {
      const set = S.view();
      const a = this.active;
      const wc = a && a.wc;
      const awake = !this.bw.isMinimized() && this.bw.isVisible() && this.bw.isFocused();
      if (set.glassMode === 'off' || this.isFullscreen() || !wc || !awake || !this.uiReady) {
        next = 500;
      } else {
        const [w, h] = this.bw.getContentSize();
        const uiH = this.uiHeight();
        // Page under the toolbar: capture exactly what is behind the glass.
        // Page below the toolbar: capture the top of the page and let the shader mirror it upward.
        let rect, ch, mirror = 0;
        if (set.underlay) { rect = { x: 0, y: 0, width: w, height: uiH }; ch = uiH; }
        else {
          ch = Math.max(1, Math.min(h - C.STRIP_H, Math.max(C.STRIP_H, uiH - C.STRIP_H)));
          rect = { x: 0, y: 0, width: w, height: ch }; mirror = C.STRIP_H;
        }
        const img = await wc.capturePage(rect);
        if (!this.closed && this.active === a && !img.isEmpty()) {
          const scaled = img.resize({ width: Math.max(1, Math.round(w * 0.5)), quality: 'good' });
          const size = scaled.getSize();
          const buf = scaled.toBitmap(); // BGRA
          let hsh = 0, lum = 0, n = 0;
          for (let i = 0; i < buf.length - 3; i += 52) {
            const b = buf[i], g = buf[i + 1], r = buf[i + 2];
            hsh = (hsh * 31 + ((r << 16) | (g << 8) | b)) | 0;
            lum += 0.2126 * r + 0.7152 * g + 0.0722 * b; n++;
          }
          const key = hsh + ':' + size.width + 'x' + size.height;
          if (key !== this.lastHash) {
            this.lastHash = key; this.capSame = 0;
            this.send('frame', { w: size.width, h: size.height, cw: w, ch, mirror, lum: n ? lum / n / 255 : 0.5, buf });
          } else { this.capSame++; }
        }
        next = this.capSame > 8 ? 800 : (this.capSame > 2 ? 300 : 120);
      }
    } catch (e) {
      next = 600;
    }
    if (!this.closed) this.capTimer = setTimeout(() => this.captureTick(), next);
  }

  // ---------- session ----------
  sessionData() {
    const tabs = this.tabs.filter(t => /^(https?|file|lumen):/i.test(t.url));
    const act = this.active;
    const idx = Math.max(0, tabs.indexOf(act));
    return { tabs: tabs.map(t => ({ url: t.url, title: t.title })), active: idx };
  }
  scheduleSave() {
    if (this.isPrivate) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => Win.saveSession(), 800);
  }
  static saveSession() {
    const wins = Array.from(S.windows).filter(w => !w.isPrivate && !w.closing).map(w => w.sessionData()).filter(d => d.tabs.length);
    if (!wins.length) return;
    S.sessionStore.data.windows = wins;
    S.sessionStore.save();
  }

  onClosed() {
    this.closed = true;
    clearTimeout(this.capTimer); clearTimeout(this.stateTimer); clearTimeout(this.saveTimer);
    for (const r of this.perms.values()) r({ allow: false, remember: false });
    this.perms.clear();
    this.tabs.forEach(t => { try { t.dispose(); } catch (e) { /* ignore */ } });
    this.tabs = [];
    S.windows.delete(this);
    S.uiToWin.delete(this.uiId);
  }

  // ---------- settings ----------
  static onSettingsChanged(key) {
    if (key === 'theme') nativeTheme.themeSource = S.settings.data.theme;
    for (const w of S.windows) {
      if (w.closed) continue;
      w.send('settings', S.view());
      if (key === 'underlay') { w.layout(); w.tabs.forEach(t => t.applyInset()); w.lastHash = null; }
      if (key === 'glassMode') { w.lastHash = null; w.captureSoon(); }
      if (key === 'theme') w.updateAppearance();
    }
  }
}

module.exports = { Win };
