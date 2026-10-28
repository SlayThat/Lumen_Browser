# Lumen

A fast, simple web browser for Windows 10 and 11 with a **Liquid Glass** toolbar: the tabs and address bar are see-through glass that bends and blurs the page behind them.

Lumen is built on Chromium (through Electron), so websites work the way they do in Chrome or Edge. It is free and open source (MIT licence).

> **Note:** This build is currently unsigned. If Windows SmartScreen blocks the app, click **More info** and then **Run anyway**.

## Download and install

1. Open the [Releases page](../../releases) and pick the newest version.
2. Download one of:
   - `Lumen-<version>-x64.exe`: the normal installer (recommended). It updates itself.
   - `Lumen-<version>-portable.exe`: runs without installing. It does not update itself. Use one of the two, not both.
3. Run it. If Windows shows a blue SmartScreen box, see the note above.

To make Lumen your main browser, open Lumen, go to **Settings > General > Make default**, and choose Lumen in the Windows page that opens.

## Features

- Liquid Glass toolbar with three looks: Glass, Frosted (lighter on your graphics card) and Off. Change it in Settings.
- Tabs you can drag to reorder, pin to the left (right-click a tab), sleeping background tabs, and private windows.
- Bookmarks bar, and import from Chrome, Edge, Brave or an exported bookmarks file (Settings > General).
- Blocks third-party ads and trackers (Settings > Privacy and security). It cannot block ads a site serves itself, such as YouTube video ads.
- Opens http:// addresses over https when the site supports it.
- One box for addresses and searches (DuckDuckGo by default, Google and Bing available).
- Find in page, per-site zoom, bookmarks, history and downloads.
- Privacy first: sites must ask before using your camera, microphone or location, and bad certificates are never accepted silently.

## What is not here yet

- No extensions. Chrome Web Store extensions do not work in Lumen.
- No password manager or sync. Only bookmarks can be imported, not history or passwords.
- No Netflix-style protected video (Widevine).

## Keyboard shortcuts

| Action | Keys |
|---|---|
| New tab / close tab / reopen closed tab | Ctrl+T / Ctrl+W / Ctrl+Shift+T |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab |
| Jump to tab 1 to 8 / last tab | Ctrl+1 to 8 / Ctrl+9 |
| Address bar | Ctrl+L |
| Back / forward / home | Alt+Left / Alt+Right / Alt+Home |
| Reload / hard reload | F5 / Ctrl+Shift+R |
| Find in page | Ctrl+F |
| Bookmark page | Ctrl+D |
| History / downloads / settings | Ctrl+H / Ctrl+J / Ctrl+, |
| Zoom in / out / reset | Ctrl+= / Ctrl+- / Ctrl+0 |
| New window / private window | Ctrl+N / Ctrl+Shift+N |
| Full screen / developer tools | F11 / F12 |

## If something looks wrong

- **The toolbar looks flat or slow:** Settings > Glass > Material > Frosted.
- **The screen goes black for a few seconds:** this is usually a graphics driver reset. Lumen then turns Glass off until you restart it. Updating your graphics driver helps.
- **Anything else:** please [open an issue](../../issues) and say what you did and what you saw. A screenshot helps.

## Build it yourself

You need Windows 10 or 11 and Node.js 20 or newer.

```
npm install
npm start          # run Lumen
npm run dist       # build the installer and portable exe into dist/
npm test           # run the unit tests
```

How it works inside, and notes for contributors, are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). How releases are made is in [PUBLISHING.md](PUBLISHING.md).

## Licence

MIT. See [LICENSE](LICENSE). Lumen includes Electron and Chromium, which have their own open-source licences.
