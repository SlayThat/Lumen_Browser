'use strict';
// The login dropdown that opens under a username or password box, like Chrome's. It is a small view of its own, sized to
// the dropdown, so the rest of the page stays clickable. It only ever shows usernames; the password is filled by the
// main process after the user picks a row (see passwords.js).
const path = require('path');
const { WebContentsView } = require('electron');
const S = require('./state');

const ROW_H = 38, PAD = 6, MIN_W = 240, MAX_ROWS = 6;

// Where to put the dropdown, in window coordinates. rect is the input's box in page pixels; zoom is the page zoom;
// page is the page view's bounds in the window; win is the window's content size.
function place(rect, zoom, page, win, rows) {
  const n = Math.max(1, Math.min(rows, MAX_ROWS));
  const height = n * ROW_H + PAD * 2;
  const z = zoom > 0 ? zoom : 1;
  const fx = page.x + rect.x * z, fy = page.y + rect.y * z, fw = rect.w * z, fh = rect.h * z;
  const width = Math.round(Math.min(Math.max(fw, MIN_W), Math.max(MIN_W, win.w - 16)));
  let x = Math.round(fx);
  x = Math.max(8, Math.min(x, win.w - width - 8));
  let y = Math.round(fy + fh + 2);
  if (y + height > win.h - 4) y = Math.max(4, Math.round(fy - height - 2));   // no room below: open above the box
  return { x, y, width, height };
}

class Autofill {
  constructor(win) {
    this.win = win;
    this.view = null;
    this.ready = false;
    this.items = [];
    this.sel = -1;
    this.tab = null;
    this.shown = false;
  }

  ensure() {
    if (this.view) return;
    this.view = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'ui-preload.js'),
        partition: 'lumen-ui',
        contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false, spellcheck: false
      }
    });
    this.view.setBackgroundColor('#00000000');
    const wc = this.view.webContents;
    this.id = wc.id;
    S.uiToWin.set(wc.id, this.win);
    wc.on('will-navigate', (e) => e.preventDefault());
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('did-finish-load', () => { this.ready = true; this.push(); });
    wc.loadURL('lumen://app/autofill.html').catch(() => {});
    this.view.setVisible(false);
    this.win.bw.contentView.addChildView(this.view);
  }

  push() {
    if (!this.view || !this.ready) return;
    const wc = this.view.webContents;
    if (!wc.isDestroyed()) wc.send('af:items', { items: this.items, sel: this.sel, isPrivate: !!this.win.isPrivate });
  }

  // Open (or move) the dropdown for the active tab. rect comes from the page; it is only used for placement.
  show(tab, rect) {
    if (!tab || tab !== this.win.active || !tab.view || !(tab.pwItems || []).length) return this.hide();
    this.ensure();
    const sameList = this.shown && this.tab === tab && JSON.stringify(this.items) === JSON.stringify(tab.pwItems);
    this.tab = tab;
    this.items = tab.pwItems.slice(0, 20).map(i => ({ id: i.id, user: i.user }));
    if (!sameList) this.sel = -1;
    const [w, h] = this.win.bw.getContentSize();
    const pos = place(rect, tab.wc.getZoomFactor(), tab.view.getBounds(), { w, h }, this.items.length);
    this.view.setBounds(pos);
    this.view.setVisible(true);
    // On top of the page, below the glass toolbar.
    this.win.bw.contentView.addChildView(this.view);
    this.win.bw.contentView.addChildView(this.win.ui);
    this.shown = true;
    this.push();
    this.tell(true);
  }

  hide() {
    if (!this.shown) return;
    this.shown = false;
    this.sel = -1;
    if (this.view) this.view.setVisible(false);
    this.tell(false);
  }

  // Tell the page's own script whether the dropdown is open and has a highlighted row, so arrow keys and Enter work.
  tell(open) {
    const t = this.tab;
    if (!t || !t.wc || t.wc.isDestroyed()) return;
    try { t.wc.mainFrame.send('pw:pop', { open, sel: this.sel >= 0 }); } catch (e) { /* page is gone */ }
  }

  // Keys typed in the page box while the dropdown is open.
  nav(key) {
    if (!this.shown) return;
    const n = this.items.length;
    if (key === 'down') this.sel = (this.sel + 1) % n;
    else if (key === 'up') this.sel = this.sel <= 0 ? n - 1 : this.sel - 1;
    else if (key === 'esc') return this.hide();
    else if (key === 'enter') { if (this.sel >= 0 && this.items[this.sel]) this.pick(this.items[this.sel].id); return; }
    this.push();
    this.tell(true);
  }

  pick(id) {
    if (typeof id !== 'string' || !this.items.some(i => i.id === id)) return;
    this.hide();
    require('./passwords').fill(this.win, id);
  }

  // The page box lost focus. Wait a moment: a click on the dropdown itself also blurs the box.
  blurSoon(tab) {
    clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => {
      if (this.view && !this.view.webContents.isDestroyed() && this.view.webContents.isFocused()) return;
      if (this.tab === tab) this.hide();
    }, 250);
  }

  dispose() {
    clearTimeout(this.blurTimer);
    if (!this.view) return;
    S.uiToWin.delete(this.id);
    try { this.win.bw.contentView.removeChildView(this.view); } catch (e) { /* already gone */ }
    try { if (!this.view.webContents.isDestroyed()) this.view.webContents.close(); } catch (e) { /* already gone */ }
    this.view = null;
  }
}

module.exports = { Autofill, place, ROW_H, PAD };
