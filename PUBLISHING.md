# Releasing Lumen to the public

What this needs before other people install it, based on what was checked in October 2026. Sources are at the bottom.
Items marked "not checked" come from general knowledge and should be verified before you rely on them.

## 1. Sign the installer (the biggest hurdle)

An unsigned installer gets a strong Windows SmartScreen block, and some companies block it entirely.
Signing does not remove the warning on day one. Since 2024 even EV certificates no longer give instant reputation, so every option builds trust over time as people install it.

| Option | Cost | Who can use it |
|---|---|---|
| Microsoft Store (MSIX) | Free; Microsoft re-signs the package | Anyone who passes Store certification. No SmartScreen warning |
| Azure Artifact Signing (formerly Trusted Signing) | about $9.99 a month | Organizations in the USA, Canada, EU or UK. Individuals in the USA or Canada only |
| OV certificate | $150 to $300 a year | Worldwide. The key must live on a hardware token or HSM |
| EV certificate | $400 and up a year | Worldwide. No SmartScreen advantage over OV any more |
| SignPath Foundation | Free | Qualifying open-source projects |

Tips: keep the same signing identity across releases so reputation carries over, avoid changing certificates close to a release, and start with a small audience before a wide launch.
Electron-builder can sign during `npm run dist` once you have a certificate.

## 2. Logo and icons (done)

`build/logo.svg` is the source. `build/icon.ico` (16 to 256 px layers) and `build/icon.png` are generated from it. The installer, the portable exe, the window and the new tab page use them.
Electron-builder looks for `build/icon.ico` by default. To change the logo, edit `logo.svg`, re-export the PNG and ICO, and copy them into `src/assets/` as well, because the running app reads the window icon from there.
The logo looks a bit like a camera lens. If that is a problem for you, change the artwork before launch.

## 3. Updates

A browser must update often, because Chromium security fixes ship every few weeks. Electron releases follow Chromium. Plan to rebuild on each new Electron release and add in-app updates (`electron-updater` with GitHub Releases is the usual route; not checked here).
Do not recommend Lumen for banking or other sensitive use until updates are automatic.

## 4. Extensions and video

- Electron does not support Chrome Web Store extensions. It loads only unpacked extensions, supports a subset of the `chrome.*` APIs, does not remember extensions across restarts, and does not support `storage.sync`. Do not promise users that their Chrome extensions will work.
- Netflix, Disney+ and similar sites need Widevine DRM, which stock Electron does not include. A fork of Electron with Widevine exists (castLabs). Only the titles of those pages were seen, so check the licensing terms before using it.

## 5. Things a public browser is expected to have

Not built yet, in rough order of how much users will notice:
1. Set as default browser, plus links opened from other apps.
2. Import bookmarks and history from Chrome, Edge or Firefox.
3. An ad and tracker blocker.
4. A password manager or system password autofill.
5. A proper bookmarks bar, and tab groups or pinned tabs.
6. Accessibility and language support (the UI is English only).

## 6. Legal and housekeeping

- Check the name. "Lumen" is used by many products, so search trademark registers for your country and for software before launching.
- Add a privacy policy. Lumen sends nothing to any server of its own, but pages, search engines and favicons are requested from the internet.
- Credit open-source software. Electron is MIT licensed and Chromium is BSD-style licensed; ship their license files with the app (electron-builder includes Electron's).
- Choose a license for Lumen's own code. `package.json` says UNLICENSED for now, which means nobody else may reuse it.
- Add a crash and bug-report path, even if it is just an email address or a GitHub Issues page.

## Sources

- electron-builder, Icons and images: https://www.electron.build/docs/features/icons-and-images
- Microsoft, Code signing options for Windows apps: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- ToDesktop, EV certs no longer give immediate SmartScreen reputation: https://www.todesktop.com/blog/posts/windows-apps-psa-ev-certs-do-not-grant-immediate-reputation-anymore
- Electron, Chrome extension support: https://www.electronjs.org/docs/latest/api/extensions

## MSI installer

`npm run dist` now also builds an `.msi` (electron-builder's MSI target). It needs the WiX Toolset, which electron-builder downloads on Windows; I could not test the build here. The MSI is machine-wide (per-machine), so it asks for admin rights. Sign the .msi too, and for open source on GitHub, attach it to a GitHub Release. Pick a licence (MIT is common) before making the repo public.
