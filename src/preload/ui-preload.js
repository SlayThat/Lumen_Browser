'use strict';
// Minimal bridge for the glass UI. Only whitelisted channels pass; the main process validates again.
const { contextBridge, ipcRenderer } = require('electron');

const SEND = new Set(['tab:new', 'tab:close', 'tab:activate', 'tab:move', 'tab:duplicate', 'tab:closeOthers', 'tab:reload',
  'cmd', 'navTo', 'nav:goto', 'find', 'find:stop', 'layout', 'window', 'focusPage', 'ctx:run', 'ctx:close', 'perm:answer',
  'bookmarks:remove', 'history:remove', 'history:clear', 'download:act', 'downloads:clear', 'settings:set', 'data:clear', 'clipboard:copy', 'app:defaultBrowser', 'app:checkUpdate', 'tab:pin', 'bookmark:bar', 'import:bookmarks']);
const INVOKE = new Set(['nav:history', 'suggest', 'bookmarks:list', 'history:list', 'downloads:list', 'settings:get', 'bookmarks:bar', 'import:sources']);
const RECEIVE = new Set(['state', 'frame', 'cmd', 'find:result', 'settings', 'downloads', 'perm:ask', 'ctx:show', 'toast']);

contextBridge.exposeInMainWorld('lumen', {
  send(channel, ...args) { if (SEND.has(channel)) ipcRenderer.send(channel, ...args); },
  invoke(channel, ...args) { return INVOKE.has(channel) ? ipcRenderer.invoke(channel, ...args) : Promise.resolve(null); },
  on(channel, cb) {
    if (!RECEIVE.has(channel) || typeof cb !== 'function') return;
    ipcRenderer.on(channel, (event, payload) => cb(payload));
  }
});
