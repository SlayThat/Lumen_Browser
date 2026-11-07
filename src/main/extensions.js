'use strict';
// Experimental extension support, built on electron-chrome-extensions and electron-chrome-web-store.
// Only loaded when Settings > Extensions is on. Every call is guarded: a failure here must never break browsing.
// Extensions live in the normal profile only (not in private windows) and are added from the Chrome Web Store.
const path = require('path');
const { app, dialog } = require('electron');
const S = require('./state');

const PARTITION = 'persist:lumen';
let api = null;     // ElectronChromeExtensions
let store = null;   // electron-chrome-web-store
let ses = null;

const enabled = () => !!S.settings.data.extensions;
const normalWins = () => S.allWins().filter(w => !w.closed && !w.isPrivate);
// Extensions may open web pages and their own pages, nothing else.
const okUrl = (u) => typeof u === 'string' && /^(https?:|chrome-extension:)/i.test(u);

function addTab(t) {
  if (!api || !t || t.win.isPrivate) return;
  const wc = t.wc;
  if (wc) { try { api.addTab(wc, t.win.bw); } catch (e) { console.error('[extensions] addTab', e); } }
}
function selectTab(t) {
  if (!api || !t || t.win.isPrivate) return;
  const wc = t.wc;
  if (wc) { try { api.selectTab(wc); } catch (e) { /* not tracked yet */ } }
}

async function createTab(details) {
  const w = (typeof details.windowId === 'number' && normalWins().find(x => x.bw.id === details.windowId)) || normalWins()[0];
  if (!w) throw new Error('No window is open');
  const t = w.newTab(details.url && okUrl(details.url) ? details.url : undefined, { background: details.active === false });
  t.ensureAwake();
  return [t.wc, w.bw];
}
function selectTabFor(wc) { const t = S.wcToTab.get(wc.id); if (t && !t.win.closed) t.win.activate(t.id); }
function removeTabFor(wc) { const t = S.wcToTab.get(wc.id); if (t && !t.win.closed) t.win.closeTab(t.id); }

async function beforeInstall(d) {
  const win = d.browserWindow && !d.browserWindow.isDestroyed() ? d.browserWindow : undefined;
  const perms = [].concat(d.manifest.permissions || [], d.manifest.host_permissions || []).filter(p => typeof p === 'string');
  const r = await dialog.showMessageBox(win, {
    type: 'question', title: 'Add extension', message: 'Add “' + d.localizedName + '” to Lumen?',
    detail: 'Extensions can read and change the pages you visit. Add only ones you trust.' + (perms.length ? '\n\nIt asks for: ' + perms.slice(0, 15).join(', ') + (perms.length > 15 ? ', and more' : '') : ''),
    icon: d.icon, buttons: ['Cancel', 'Add extension'], defaultId: 0, cancelId: 0, noLink: true
  });
  return { action: r.response === 1 ? 'allow' : 'deny' };
}

async function init() {
  if (!enabled() || api) return;
  try {
    const { ElectronChromeExtensions } = require('electron-chrome-extensions');
    store = require('electron-chrome-web-store');
    ses = require('./session').prepare(PARTITION);
    api = new ElectronChromeExtensions({
      session: ses,
      createTab, selectTab: selectTabFor, removeTab: removeTabFor
    });
    await store.installChromeWebStore({ session: ses, extensionsPath: path.join(app.getPath('userData'), 'Extensions'), beforeInstall });
    // Manifest V3 extensions run in a service worker; start them now.
    await Promise.all(ses.extensions.getAllExtensions().map(async (ext) => {
      const m = ext.manifest || {};
      if (m.manifest_version === 3 && m.background && m.background.service_worker) {
        await ses.serviceWorkers.startWorkerForScope(ext.url).catch((e) => console.error('[extensions] worker', e));
      }
    }));
  } catch (e) {
    console.error('[extensions] could not start', e);
    api = null;
  }
}

function list() {
  if (!api || !ses) return [];
  try {
    return ses.extensions.getAllExtensions().map(x => ({ id: x.id, name: String(x.name || x.id), version: String(x.version || '') }));
  } catch (e) { return []; }
}
async function remove(id) {
  if (!api || !store || typeof id !== 'string' || !/^[a-p]{32}$/.test(id)) return false;
  try { await store.uninstallExtension(id, { session: ses, extensionsPath: path.join(app.getPath('userData'), 'Extensions') }); return true; }
  catch (e) { console.error('[extensions] remove', e); return false; }
}

module.exports = { init, addTab, selectTab, list, remove, enabled: () => !!api };
