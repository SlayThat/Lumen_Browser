'use strict';
// "What's new" page shown once after Lumen updates. Add a new entry at the top of NOTES for every release.
// Plain text only: it is escaped when the page is built.
const NOTES = [
  { version: '0.5.1', title: 'Security update', items: [
    'Lumen no longer starts downloaded programs and scripts for you. Opening one from the downloads list shows it in its folder instead.',
    'Download names are cleaned, so a site cannot choose a folder or a reserved name for the file.',
    'Web pages can no longer jump to local files or data: pages. Local files can only link to other local files.',
    'Pages cannot reach USB, serial, HID or Bluetooth devices.',
    'The app itself is built with Electron’s Node and debugging switches turned off, so it cannot be hijacked through environment variables.',
    'Fixed: the Mute tab and Close tabs to the right menu items from 0.4.0 did nothing. They work now.'
  ] },
  { version: '0.5.0', title: 'A look at what changed', items: [
    'This page: after Lumen updates, it opens once to show what is new. You can open it again from Settings, under Updates.'
  ] },
  { version: '0.4.0', title: 'Small things for everyday browsing', items: [
    'Mute any tab. Right-click it and choose Mute, or click its speaker icon.',
    'Picture in picture. Right-click a video and choose Picture in picture.',
    'Two new tab menu items: Copy tab address and Close tabs to the right.'
  ] },
  { version: '0.3.1', title: 'Lumen on Linux', items: [
    'Lumen now runs on Linux. Download the .deb, or the AppImage, which updates itself.',
    'Glass on Linux is new and lightly tested. If it cannot run on your graphics setup, Lumen falls back to the plain theme.'
  ] },
  { version: '0.2.2', title: 'Bug fixes', items: [
    'Smoother glass: the streaks behind the toolbar are gone.',
    'Fixes for saving settings, closing other tabs (pinned tabs stay), and restoring tabs when the last window closes.'
  ] }
];

function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v || ''));
  return m ? [+m[1], +m[2], +m[3]] : null;
}
// -1, 0 or 1; null when either side is not a version
function compare(a, b) {
  const x = parse(a), y = parse(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}
// Show the page when this launch is a newer version than the one last seen and we have notes for it.
// A brand-new install, a downgrade and a version without notes stay quiet.
function shouldShow({ lastSeen, current, firstRun }) {
  if (firstRun) return false;
  if (!NOTES.some(n => n.version === current)) return false;
  if (!lastSeen) return true; // updated from a version that did not track this
  return compare(lastSeen, current) === -1;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function section(n) {
  return `<section><h2>${esc(n.title)} <span>${esc(n.version)}</span></h2><ul>${n.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>`;
}
// pages: { BASE_CSS, nonce, csp, LOGO } come from pages.js to keep one look and one CSP.
function render(current, pages) {
  const cur = NOTES.find(n => n.version === current) || NOTES[0];
  const older = NOTES.filter(n => n !== cur);
  const n = pages.nonce();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>What’s new in Lumen</title>
<meta http-equiv="Content-Security-Policy" content="${pages.csp(n)}">
<style>${pages.BASE_CSS}
body{background:
 radial-gradient(60vmax 40vmax at 12% -6%,var(--b1),transparent 60%),
 radial-gradient(55vmax 38vmax at 92% 4%,var(--b2),transparent 58%),var(--bg);background-attachment:fixed}
main{max-width:640px;margin:0 auto;padding:clamp(40px,10vh,100px) 24px 64px}
header{display:flex;align-items:center;gap:14px;margin-bottom:26px}
header img{width:48px;height:48px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.25)}
h1{font-size:26px;line-height:1.15;margin:0;font-weight:650;letter-spacing:-.01em}
header p{margin:2px 0 0;color:var(--fg2);font-size:13.5px}
section{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px 22px;margin-bottom:14px;backdrop-filter:blur(10px)}
h2{font-size:16px;margin:0 0 8px;font-weight:650}
h2 span{font-weight:500;font-size:12.5px;color:var(--fg2);margin-left:6px}
ul{margin:0;padding-left:20px}li{margin:6px 0}
h3{font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg2);margin:30px 0 12px;font-weight:600}
a.btn{display:inline-block;margin-top:14px;font:inherit;font-weight:600;color:#fff;background:var(--accent);border-radius:999px;padding:10px 22px;text-decoration:none}
a.btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
</style></head><body><main>
<header>${pages.LOGO ? `<img src="${pages.LOGO}" alt="" width="48" height="48">` : ''}<div><h1>What’s new in Lumen</h1><p>You are on version ${esc(current)}</p></div></header>
${section(cur)}
${older.length ? `<h3>Earlier</h3>${older.map(section).join('')}` : ''}
<a class="btn" href="lumen://newtab">Start browsing</a>
</main></body></html>`;
}

module.exports = { NOTES, compare, shouldShow, render };
