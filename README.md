# Lumen

A fast, simple web browser for Windows 10 and 11 and for Linux with a **Liquid Glass** toolbar: the tabs and address bar are see-through glass that bends and blurs the page behind them.

Lumen is built on Chromium (through Electron), so websites work the way they do in Chrome or Edge. It is free and open source (GPL-3.0 licence).

> **Note:** This build is currently unsigned. If Windows SmartScreen blocks the app, click **More info** and then **Run anyway**.

If you like Lumen, a ⭐ **star on GitHub** (the button at the top right of this page) helps other people find it. Thank you!

## Download and install

1. Open the [Releases page](../../releases) and pick the newest version.
2. Download one of:
   - `Lumen-<version>-x64.exe`: the normal installer (recommended). It updates itself.
   - `Lumen-<version>-portable.exe`: runs without installing. It does not update itself. Use one of the two, not both.
3. Run it. If Windows shows a blue SmartScreen box, see the note above.

### Linux (new, needs testing)

Linux support is new and has had less testing than Windows. If something does not work, please [open an issue](../../issues) and say which distribution you use.

Download one of these from the [Releases page](../../releases):

- `Lumen-<version>-linux-amd64.deb`: for Debian, Ubuntu, Linux Mint and similar. Install it with `sudo apt install ./Lumen-<version>-linux-amd64.deb`. Recommended, and it adds Lumen to your applications menu. Update by installing the newer file.
- `Lumen-<version>-linux-x86_64.AppImage`: runs on most distributions without installing. Make it runnable with `chmod +x Lumen-<version>-linux-x86_64.AppImage`, then double-click it or run it. It updates itself. On Ubuntu 24.04 and newer the system may block the AppImage's browser sandbox; if it will not start, use the `.deb` instead.

Only 64-bit Intel and AMD (x64) is built for now. If the glass looks flat or the toolbar is solid, your graphics drivers may not support it; Lumen then falls back to a plain theme on its own.

To make Lumen your main browser, open Lumen, go to **Settings > General > Make default**. On Windows, choose Lumen in the page that opens. On Linux it is set for you; if it does not stick, open your system's Default applications settings.

## Is Lumen safe?

Yes, and you can check it yourself: the source is all here, releases are built by GitHub Actions, and each release has a checksum file and a signed build attestation. Lumen does not collect or send your data.

Some antivirus and sandbox services flag new, unsigned installers like this one by mistake. That's a false positive. [SECURITY.md](SECURITY.md) explains why it happens and how to verify your download. A code-signing certificate is planned and will remove most of these warnings over time.

## Features

- Liquid Glass toolbar with three looks: Glass, Frosted (lighter on your graphics card) and Off. Change it in Settings.
- Tabs you can drag to reorder, pin to the left (right-click a tab), sleeping background tabs, and private windows.
- Bookmarks bar, and import from Chrome, Edge, Brave or an exported bookmarks file (Settings > General).
- Blocks third-party ads and trackers (Settings > Privacy and security). It cannot block ads a site serves itself, such as YouTube video ads.
- Opens http:// addresses over https when the site supports it, and warns before opening sites on a list of reported phishing sites (the list is checked on your PC; no addresses are sent anywhere).
- Saves logins, encrypted with your system keychain, and fills one only when you pick it, on the exact site it was saved for (Settings > Passwords).
- Tab search (Ctrl+Shift+A) and optional vertical tabs (Settings > General, experimental).
- One box for addresses and searches (DuckDuckGo by default, Google and Bing available).
- Reader view: a clean, distraction-free page for articles (F9). Mute tabs, picture in picture for videos, and a What's new page after each update.
- Find in page, per-site zoom, bookmarks, history, and a download button with a live progress ring.
- Privacy first: sites must ask before using your camera, microphone or location, and bad certificates are never accepted silently.

## What is not here yet

- Extensions are experimental: they are off by default (turn them on in Settings), have no toolbar buttons yet, and not every extension works.
- No sync, and no import of history or passwords. Only bookmarks can be imported. The password manager is new and basic: it saves, fills and removes logins, with no generator or breach check.
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
| Reader view | F9 or Ctrl+Alt+R |
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

You need Node.js 20 or newer, on Windows 10 or 11 or on Linux.

```
npm install
npm start          # run Lumen
npm run dist:win    # on Windows: build the installer and portable exe into dist/
npm run dist:linux  # on Linux: build the AppImage and .deb into dist/
npm test           # run the unit tests
```

How it works inside, and notes for contributors, are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). How releases are made is in [PUBLISHING.md](PUBLISHING.md).

## Licence

GPL-3.0. See [LICENSE](LICENSE). Versions released up to 0.6.0 were published under the MIT licence and stay available under it. Lumen includes Electron and Chromium, which have their own open-source licences.
