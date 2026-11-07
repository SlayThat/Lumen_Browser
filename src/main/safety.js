'use strict';
// Small, pure security helpers (no Electron), so they can be tested on their own.

// File types that run code or change the system when opened. Lumen never opens these for you.
const RISKY = new Set(['exe', 'msi', 'msix', 'msp', 'appx', 'bat', 'cmd', 'com', 'scr', 'pif', 'lnk', 'url', 'ps1', 'psm1', 'vbs', 'vbe',
  'js', 'jse', 'wsf', 'wsh', 'hta', 'cpl', 'jar', 'reg', 'dll', 'sys', 'inf', 'chm', 'iso', 'img', 'vhd', 'vhdx', 'gadget',
  'appimage', 'deb', 'rpm', 'sh', 'run', 'bin', 'desktop', 'command', 'app', 'pkg', 'dmg', 'apk', 'py', 'pl', 'rb']);
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

// Windows ignores trailing dots and spaces, so "setup.exe. " is still setup.exe.
function extensionOf(name) {
  const clean = String(name || '').replace(/[. ]+$/, '');
  const i = clean.lastIndexOf('.');
  return i < 0 ? '' : clean.slice(i + 1).toLowerCase();
}
function isRiskyFile(name) { return RISKY.has(extensionOf(name)); }

// A file name that is safe to create in the downloads folder: no folders, no control or reserved characters.
function safeFileName(name) {
  let n = String(name || '').split(/[\\/]/).pop();
  n = n.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/[. ]+$/, '').replace(/^[. ]+/, '');
  if (!n) n = 'download';
  const i = n.lastIndexOf('.');
  const base = i > 0 ? n.slice(0, i) : n, ext = i > 0 ? n.slice(i) : '';
  if (RESERVED.test(base)) n = '_' + n;
  if (n.length > 150) { const e = ext.slice(0, 20); n = n.slice(0, 150 - e.length) + e; }
  return n;
}

// May a page at `from` navigate the tab to `url`? Local files and data: pages can only be reached from other local pages.
function navAllowed(url, from) {
  const local = !from || from === 'about:blank' || /^(lumen|file|data):/i.test(from);
  if (/^(https?|about|view-source|blob):/i.test(url)) return true;
  if (/^lumen:/i.test(url)) return /^lumen:/i.test(from) || !from || from === 'about:blank';
  if (/^(file|data):/i.test(url)) return local;
  return false;
}

module.exports = { isRiskyFile, safeFileName, navAllowed, extensionOf };
