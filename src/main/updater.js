'use strict';
// Auto-update for the installed Windows copy and for the Linux AppImage. Portable, .deb and development runs skip it quietly.
const { app } = require('electron');
const S = require('./state');

let started = false;
let manualCheck = false; // whether the check in progress was started by the user (decides which toasts show)

function available() {
  if (!app.isPackaged) return false;
  if (process.platform === 'win32') return !process.env.PORTABLE_EXECUTABLE_FILE;
  if (process.platform === 'linux') return !!process.env.APPIMAGE;
  return false;
}

function check(manual) {
  if (!available()) {
    if (manual) S.broadcast('toast', { text: process.platform === 'linux' ? 'Automatic updates work in the AppImage. For the .deb, download the new version from the website.' : 'Updates work in the installed version of Lumen.' });
    return;
  }
  manualCheck = !!manual;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { return; }
  if (!started) {
    started = true;
    autoUpdater.allowDowngrade = false;   // never install an older version
    autoUpdater.allowPrerelease = false;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', i => S.broadcast('toast', { text: 'Downloading Lumen ' + i.version + '…' }));
    autoUpdater.on('update-downloaded', i => S.broadcast('toast', { text: 'Lumen ' + i.version + ' is ready. It installs when you close Lumen.' }));
    autoUpdater.on('update-not-available', () => { if (manualCheck) S.broadcast('toast', { text: 'Lumen is up to date.' }); });
    autoUpdater.on('error', () => { if (manualCheck) S.broadcast('toast', { text: 'Could not check for updates.' }); });
  }
  autoUpdater.checkForUpdates().catch(() => {});
}

module.exports = { check };
