'use strict';
// Saved logins: ties the vault to the operating system's key storage, to the page tabs and to the toolbar.
// Passwords stay in this process. The toolbar only ever learns site names and usernames.
const path = require('path');
const { safeStorage, clipboard } = require('electron');
const S = require('./state');
const { Store } = require('./store');
const { Vault, originOf } = require('./vault');

let vault = null, availCache = null, warnedUnavailable = false;

const cipher = {
  async available() {
    if (availCache !== null) return availCache;
    try {
      let ok = await safeStorage.isAsyncEncryptionAvailable();
      // On Linux without a keychain Electron falls back to a fixed key, which is not real protection. Refuse that.
      if (ok && process.platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function') {
        const b = safeStorage.getSelectedStorageBackend();
        if (b === 'basic_text' || b === 'unknown') ok = false;
      }
      availCache = !!ok;
    } catch (e) { availCache = false; }
    return availCache;
  },
  encrypt: (s) => safeStorage.encryptStringAsync(s),
  async decrypt(buf) { const r = await safeStorage.decryptStringAsync(buf); return r.result; }
};

function get() {
  if (!vault) {
    S.passwordStore = new Store('passwords', { items: [], never: [] });
    vault = new Vault(S.passwordStore, cipher);
  }
  return vault;
}

const enabled = () => !!S.settings.data.passwords;

// ---- per tab ----
function attach(tab, wc) {
  const mine = (e) => e.senderFrame && e.senderFrame === wc.mainFrame;

  wc.ipc.on('pw:forms', async (e, has) => {
    if (!mine(e) || typeof has !== 'boolean') return;
    tab.pwItems = [];
    if (has && enabled()) {
      const origin = originOf(e.senderFrame.url);
      const v = get();
      if (origin && v.items.some(i => i.origin === origin) && await v.available()) {
        const items = await v.forOrigin(origin);
        if (!wc.isDestroyed() && originOf(wc.getURL()) === origin) tab.pwItems = items;
      }
    }
    tab.win.pushPw(false);
  });

  wc.ipc.on('pw:captured', async (e, d) => {
    if (!mine(e) || !enabled() || tab.win.isPrivate) return;
    if (!d || typeof d.u !== 'string' || typeof d.p !== 'string') return;
    const origin = originOf(e.senderFrame.url);
    if (!origin) return;
    const v = get();
    if (!(await v.available())) {
      if (!warnedUnavailable) { warnedUnavailable = true; tab.win.toast('Password saving needs the system keychain, which is not available here'); }
      return;
    }
    const c = await v.check(origin, d.u.trim(), d.p);
    if (c.kind !== 'new' && c.kind !== 'update') return;
    tab.pwAsk = { kind: c.kind, origin, user: d.u.trim(), pass: d.p, id: c.id || '', at: Date.now() };
    tab.win.pushPw(true);
  });

  wc.on('did-start-navigation', (details) => {
    if (details && details.isMainFrame && !details.isSameDocument) { tab.pwItems = []; if (tab === tab.win.active) tab.win.pushPw(false); }
  });
}

// What the toolbar may know about a tab. Never includes a password.
function stateFor(tab) {
  if (!tab) return { items: [], ask: null };
  let ask = tab.pwAsk;
  if (ask && Date.now() - ask.at > 120000) ask = tab.pwAsk = null;
  return {
    items: (tab.pwItems || []).slice(0, 20),
    ask: ask ? { kind: ask.kind, origin: ask.origin, user: ask.user } : null
  };
}

async function answer(win, action) {
  const tab = win.active;
  const ask = tab && tab.pwAsk;
  if (!ask) return;
  tab.pwAsk = null;
  if (action === 'save') {
    const r = await get().save(ask.origin, ask.user, ask.pass);
    win.toast(r.kind === 'update' ? 'Password updated' : r.kind === 'new' ? 'Password saved' : 'Could not save the password');
  } else if (action === 'never') {
    get().setNever(ask.origin);
    win.toast('Lumen will not offer to save passwords for ' + new URL(ask.origin).hostname);
  }
  win.pushPw(false);
}

async function fill(win, id) {
  const tab = win.active;
  const wc = tab && tab.wc;
  if (!wc || typeof id !== 'string') return;
  const origin = originOf(wc.getURL());
  if (!origin) return;
  const s = await get().secret(id, origin);     // only a login saved for this exact site opens
  if (!s || wc.isDestroyed() || originOf(wc.getURL()) !== origin) return;
  wc.mainFrame.send('pw:fill', { u: s.u, p: s.p });
}

async function list() {
  const v = get();
  const ok = await v.available();
  return { enabled: enabled(), available: ok, platform: process.platform, items: ok ? await v.list() : [] };
}

async function copy(win, id) {
  if (typeof id !== 'string') return;
  const s = await get().secret(id);
  if (!s) return;
  clipboard.writeText(s.p);
  win.toast('Password copied. It is cleared from the clipboard in 30 seconds');
  setTimeout(() => { try { if (clipboard.readText() === s.p) clipboard.clear(); } catch (e) { /* nothing to do */ } }, 30000).unref();
}

function remove(id) { if (typeof id === 'string') get().remove(id); }
function clearAll() { get().clear(); }

module.exports = { attach, stateFor, answer, fill, list, copy, remove, clearAll, get };
