'use strict';
const { app, protocol, Menu, nativeTheme, BrowserWindow } = require('electron');
const C = require('./config');
const S = require('./state');
const { hostOf } = require('./omnibox');

// Window occlusion tracking is a known cause of black or frozen frames with layered views on Windows.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

protocol.registerSchemesAsPrivileged([{
  scheme: C.SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

app.setAppUserModelId('dev.lumen.browser');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let Win;
  const urlFromArgv = (argv) => argv.slice(1).find(a => /^https?:\/\//i.test(a));

  app.on('second-instance', (e, argv) => {
    if (!Win) return;
    const url = urlFromArgv(argv);
    const wins = S.allWins().filter(w => !w.closed && !w.isPrivate);
    const w = wins[wins.length - 1];
    if (w) {
      if (w.bw.isMinimized()) w.bw.restore();
      w.bw.focus();
      if (url) w.newTab(url);
    } else new Win({ url });
  });

  app.whenReady().then(() => {
    S.init();
    Menu.setApplicationMenu(null);
    nativeTheme.themeSource = S.settings.data.theme;
    Win = require('./win').Win;
    require('./ipc').register();

    const saved = S.sessionStore.data.windows;
    const argvUrl = urlFromArgv(process.argv);
    if (S.settings.data.restoreSession && Array.isArray(saved) && saved.length) {
      saved.forEach((w, i) => new Win({ tabs: w.tabs, active: w.active, url: i === 0 ? argvUrl : undefined }));
      if (argvUrl) { const w = S.allWins()[0]; if (w) w.newTab(argvUrl); }
    } else {
      new Win({ url: argvUrl });
    }

    setInterval(() => S.allWins().forEach(w => { if (!w.closed) w.sleepTick(); }), 60000);
    nativeTheme.on('updated', () => S.allWins().forEach(w => w.updateAppearance()));
  });

  // Never silently accept a bad certificate. The error page offers an explicit "proceed" per host.
  app.on('certificate-error', (event, wc, url, error, cert, callback) => {
    event.preventDefault();
    callback(S.certAllow.has(hostOf(url)));
  });

  app.on('web-contents-created', (e, contents) => {
    contents.on('will-attach-webview', ev => ev.preventDefault());
  });

  // If the graphics process dies, stop drawing glass for this session only (the saved setting is untouched).
  app.on('child-process-gone', (e, details) => {
    if (details.type === 'GPU' && details.reason !== 'clean-exit' && S.settings && !S.gpuDown) {
      S.gpuDown = true;
      require('./win').Win.onSettingsChanged('glassMode');
      S.broadcast('toast', { text: 'The graphics process stopped, so Glass is off until you restart Lumen.' });
    }
  });

  app.on('before-quit', () => S.flushAll());
  app.on('window-all-closed', () => app.quit());
}
