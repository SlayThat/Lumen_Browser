# Security

## Reporting a problem

Please report security problems privately through the repository's **Security** tab (Report a vulnerability), not in a public issue. Include the Lumen version, what you did and what happened.

## What Lumen does and does not do

Lumen is a Chromium-based browser (Electron). Its own code is in `src/`, and you can read all of it.

- It does not collect or send analytics, crash reports or personal data. It has no server of its own.
- The only connection Lumen makes that you did not ask for is the update check, which asks GitHub Releases whether a newer version exists (installed copy only).
- It does not run other programs or read other programs' files. It writes to the registry only to register itself as a browser option for Windows (in the installer, and when you press **Make default**).
- It reads another browser's bookmarks file only when you press **Import** in Settings, and only the bookmarks (not passwords, cookies or history). You can also import from a file you choose yourself.
- Pages run in sandboxed processes with Node.js turned off. Camera, microphone, location and similar permissions ask first.

## Why scanners sometimes flag the installer

Lumen is new, so it has no reputation yet, and the installer is not code-signed yet. Automated sandboxes (such as ANY.RUN or VirusTotal behaviour reports) judge programs by what they do, and every Windows installer built with NSIS does the things they look for: it unpacks a 7-zip archive into `%TEMP%`, drops its own helper `System.dll`, reads the computer name, locale and time zone, and checks for existing installs. Every Chromium-based browser also keeps cookies and a profile in its data folder. Those signals can add up to a "stealer" or "malicious" tag for a harmless program. That is a false positive.

## Check your download

Each release lists SHA-256 checksums in `SHA256SUMS.txt`, and the files are built by GitHub Actions from the public source with a signed build attestation.

1. Compare the hash. In PowerShell: `Get-FileHash .\Lumen-<version>-x64.exe -Algorithm SHA256`, then compare it with the line in `SHA256SUMS.txt` on the release page.
2. Verify the attestation (needs the GitHub CLI): `gh attestation verify .\Lumen-<version>-x64.exe --repo SlayThat/Lumen_Browser`.
3. Only download from this repository's **Releases** page.

You can also build it yourself from the source, which is described in the README.
