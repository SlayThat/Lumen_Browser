# Developing Lumen

Technical notes for contributors.

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

## Renaming

Edit `APP_NAME` in `src/main/config.js`, and `productName` in `package.json`.

## Logo

The logo source is `build/logo.svg`. Icons are `build/icon.ico` and `build/icon.png`, with copies in `src/assets/` that the running app reads.
