# Lumen

> **Note:** This build is currently unsigned. If Windows SmartScreen blocks the app, click 'More info' and then 'Run anyway'.

A Chromium-based browser (Electron) for Windows 10 and 11 with a Liquid Glass style toolbar, tab strip and menus.
The glass is an approximation drawn by a WebGL2 shader. It is not Apple's shader.

## Run it

1. Install Node.js 20 or newer.
2. In this folder:
   ```
   npm install
   npm start
   ```
3. Build an installer and a portable exe: `npm run dist` (output in `dist/`).
4. `npm run check` syntax-checks every script.

## Keyboard shortcuts

| Action | Keys |
|---|---|
| New tab / close tab / reopen closed tab | Ctrl+T / Ctrl+W / Ctrl+Shift+T |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab (also Ctrl+PageDown / PageUp) |
| Jump to tab 1 to 8 / last tab | Ctrl+1 to 8 / Ctrl+9 |
| Address bar | Ctrl+L, Alt+D, F6 |
| Back / forward / home | Alt+Left / Alt+Right / Alt+Home |
| Reload / hard reload | F5, Ctrl+R / Ctrl+Shift+R, Ctrl+F5 |
| Find in page | Ctrl+F (Enter next, Shift+Enter previous) |
| Bookmark page | Ctrl+D |
| History / downloads / settings | Ctrl+H / Ctrl+J / Ctrl+, |
| Zoom in / out / reset (per site) | Ctrl+= / Ctrl+- / Ctrl+0 |
| New window / private window | Ctrl+N / Ctrl+Shift+N |
| Full screen / dev tools / print | F11 / F12 or Ctrl+Shift+I / Ctrl+P |

## How the glass works

- The window holds one **page view** per tab and one transparent **UI view** on top.
- By default the page starts **below** the toolbar, so fixed page headers (YouTube, Gmail) are never hidden. The glass samples the top of the page and mirrors it upward, so the toolbar still picks up the page's colors and changes as you scroll.
- Settings has an experimental switch, "Let pages scroll under the toolbar". With it on, the page fills the whole window and the glass bends the real content behind it. Fixed headers will sit under the toolbar.
- The main process captures that region with `capturePage`, halves its resolution, and sends it to the UI view. It captures about 15 times a second while the page changes, slows down when nothing changes, and pauses when the window is unfocused or minimized.
- The UI view draws that frame in a WebGL2 shader inside each `[data-glass]` element: rounded-rectangle shape, edge refraction, small RGB dispersion at the rim, blur that is soft in the middle and sharp at the rim, saturation boost, a tint that adapts to the page brightness behind it, rim light, shadow and grain.
- **Why the UI never blocks the page:** the UI view is only as tall as it needs to be. It is 92 px tall normally, grows for the find bar, suggestions and prompts, and covers the whole window only while a menu or panel is open. A page cannot be clicked in the top 92 px, because the toolbar is there.
- Settings has three materials: Glass, Frosted (blur only, lighter on the GPU) and Off (solid surfaces). Lumen offers Frosted if drawing gets slow.

## Security

Every view runs with context isolation and the sandbox on, no Node, no `webview`. The UI preload exposes a whitelist of channels, and the main process checks that each message comes from the Lumen UI and validates every argument. Internal pages are served through `lumen://` with a strict Content-Security-Policy. Certificate errors show an error page and are never accepted silently. Permissions (camera, microphone, location, notifications, clipboard read, screen capture) ask first; everything else is denied.

## Rename it

Edit `APP_NAME` in `src/main/config.js`, and `productName` in `package.json`.

## Known limitations

- Typed addresses without a scheme go to https. Pages reached by typing `http://` show "Not secure". There is no automatic http to https upgrade for links.
- Pop-ups open as tabs only after a click or key press. Login flows that need `window.opener` (some OAuth pop-ups) will not work.
- No extensions, no password manager, no sync, no Widevine DRM (Netflix and similar will not play).
- Electron needs updating regularly to get Chromium security fixes. Do not use this for banking until you have a plan for that.
- Capturing frames uses some GPU all the time the window is focused.

## Not tested

This was written without being able to run Windows or Electron. The places most likely to need a fix on first run:

1. **Transparent UI view over the page.** If the toolbar shows a black or white box, the UI view is not transparent on your setup.
2. **Window buttons.** The window is frameless with round close, minimize and maximize dots on the left. Set `NATIVE_CAPTION_BUTTONS` to `true` in `config.js` to use the system buttons on the right instead, which keeps the Windows 11 snap layouts flyout.
3. **Window dragging** from the empty tab-row area (`-webkit-app-region: drag` inside a view).
4. **Frame capture** (`capturePage` on the page view): if the glass stays flat, check the console for errors from `captureTick`.
5. **The shader** on your GPU. Open the UI's developer tools by launching with `--remote-debugging-port=9222` and look for shader compile errors.

Send any error message or screenshot back and it can be fixed.

## If the screen goes black or flickers

A black screen for a few seconds usually means the graphics driver reset. Lumen asks for the low-power GPU, captures the page at most about 8 times a second, and if Chromium's graphics process crashes it turns Glass off for that session (your saved setting is kept, so Glass comes back on the next start).
To check for a driver reset, open Windows Event Viewer, then Windows Logs, then System, and look for "Display" errors around that time. To see Chromium's GPU log, run `npx electron . --enable-logging --log-file=lumen-gpu.log`.


## Logo and releasing

The logo lives in `build/logo.svg` (icons: `build/icon.ico`, `build/icon.png`; copies in `src/assets/`). `npm run dist` builds the installer and portable exe with it.
See `PUBLISHING.md` for signing, updates and what a public release needs.
