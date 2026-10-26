'use strict';
// Auto-update for installed (NSIS) copies. Portable, MSI and development runs skip it quietly.
const { app } = require('electron');
const S = require('./state');

let started = false;

function available() {
  return app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE && process.platform === 'win32';
}

function check(manual) {
  if (!available()) {
    if (manual) S.broadcast('toast', { text: 'Updates work in the installed version of Lumen.' });
    return;
  }
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { return; }
  if (!started) {
    started = true;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', i => S.broadcast('toast', { text: 'Downloading Lumen ' + i.version + '…' }));
    autoUpdater.on('update-downloaded', i => S.broadcast('toast', { text: 'Lumen ' + i.version + ' is ready. It installs when you close Lumen.' }));
    autoUpdater.on('update-not-available', () => { if (manual) S.broadcast('toast', { text: 'Lumen is up to date.' }); });
    autoUpdater.on('error', () => { if (manual) S.broadcast('toast', { text: 'Could not check for updates.' }); });
  }
  autoUpdater.checkForUpdates().catch(() => {});
}

module.exports = { check };
