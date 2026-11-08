'use strict';
// "What's new" page shown once after Lumen updates. Add a new entry at the top of NOTES for every release.
// The newest entry has `features` (the big page: one headline per feature, with a small drawing).
// Older entries keep a plain `items` list, shown under "Earlier versions". All text is escaped when the page is built.
//
// feature: { chip, title, text, steps?: [..], art?: 'newtab' | 'whatsnew' | 'downloads' | 'menu' | 'rows', rows?: [[label, state], ..], color: 1-4 }
const NOTES = [
  { version: '0.8.2', features: [
    { chip: 'Shortcut fix', title: 'Ctrl+Alt+R works on every keyboard', color: 1, art: 'rows', rows: [['English keyboard', 'Works'], ['Cyrillic and other layouts', 'Works now'], ['F9', 'Always works']],
      text: 'Ctrl+Alt+R for Reader view did not work on some keyboard layouts. It now uses the physical R key, so it works on any layout.' }
  ] },
  { version: '0.8.1', features: [
    { chip: 'Reader view shortcut', title: 'Ctrl+Alt+R opens Reader view', color: 1, art: 'rows', rows: [['F9', 'Reader view'], ['Ctrl+Alt+R', 'Reader view']],
      text: 'Reader view now also opens with Ctrl+Alt+R. F9 still works. Press either one again to go back to the page.' }
  ] },
  { version: '0.8.0', features: [
    { chip: 'Reader view', title: 'Read articles without the clutter', color: 1, art: 'rows', rows: [['Ads and pop-ups', 'Gone'], ['Text size', 'Your choice'], ['Light and dark', 'Follows Lumen']],
      text: 'Reader view shows just the article: the title, the text and the pictures, in a calm page that follows your light or dark theme. It works on pages with a real article, such as news stories and blog posts.',
      steps: ['Open an article.', 'Press F9, or choose Reader view in the menu or when you right-click the page.', 'Use A− and A+ at the top to change the text size. Press F9 again to go back.'] },
    { chip: 'Stays private', title: 'Nothing from the page runs', color: 2, art: 'rows', rows: [['Scripts from the site', 'Not copied'], ['Forms and frames', 'Not copied'], ['Reader pages', 'Not saved']],
      text: 'Lumen copies only text and pictures out of the page. The site’s own scripts never run in reader view, and reader pages are not saved to your history.' }
  ] },
  { version: '0.7.1', features: [
    { chip: 'A new icon', title: 'A new Lumen icon', color: 1, art: 'rows', rows: [['Taskbar and desktop', 'New icon'], ['Installer', 'New icon'], ['New tab and What’s new pages', 'New icon']],
      text: 'Lumen has a new icon: two overlapping sheets of glass, one blue and one amber. It is simpler, reads clearly at small sizes and matches the new look of the browser.' }
  ] },
  { version: '0.7.0', features: [
    { chip: 'Extensions (experimental)', title: 'Add extensions from the Chrome Web Store', color: 1, art: 'rows', rows: [['Dark mode for every site', 'Extension'], ['Password manager', 'Extension'], ['Translate a page', 'Extension']],
      text: 'Lumen can now run Chrome extensions. It is experimental and off by default, so Lumen works exactly as before unless you turn it on.',
      steps: ['Open Settings and turn on Allow extensions, then restart Lumen.', 'Visit chromewebstore.google.com and choose Add on an extension.', 'Remove extensions any time in Settings. They do not run in private windows.'] },
    { chip: 'Your choice, always asked', title: 'Lumen asks before adding one', color: 2, art: 'rows', rows: [['Add “Extension name”?', 'Ask first'], ['Permissions it asks for', 'Shown'], ['Private windows', 'Never']],
      text: 'Every extension shows the permissions it wants before it is added. Extensions can read and change the pages you visit, so add only ones you trust.' }
  ] },
  { version: '0.6.0', features: [
    { chip: 'A calmer new tab', title: 'A new tab that gets out of your way', color: 1, art: 'newtab',
      text: 'The new tab page is simpler: a greeting, the date, a search line and the sites you visit most. It follows your light or dark theme.',
      steps: ['Open a new tab with Ctrl+T.', 'Type to search or enter an address.', 'Click one of your top sites to jump back to it.'] },
    { chip: 'A clearer What’s new', title: 'What’s new, one change at a time', color: 2, art: 'whatsnew',
      text: 'After an update, this page opens once. Pick a change in the row at the bottom to read about it, or press Next.',
      steps: ['Pick a card, or press Next.', 'Open this page again from Settings, under Updates.'] }
  ] },
  { version: '0.5.1', features: [
    { chip: 'Safer downloads', title: 'Downloads can’t run on their own', color: 1, art: 'downloads',
      text: 'Lumen no longer starts programs and scripts you download. Opening one from the list shows it in its folder, and you decide whether to run it.',
      steps: ['Download a file as usual.', 'Open the downloads list with Ctrl+J.', 'Programs, scripts and installers open in their folder instead of starting.'] },
    { chip: 'Local files stay local', title: 'Web pages can’t reach your files', color: 2, art: 'rows', rows: [['file:///home/you/notes.txt', 'Blocked'], ['data:text/html,…', 'Blocked'], ['https://example.com', 'Allowed']],
      text: 'A web page can no longer send your tab to local files or data: pages. Only local pages can link to other local pages. Download names are also cleaned.' },
    { chip: 'No device access', title: 'Pages can’t use your devices', color: 3, art: 'rows', rows: [['USB devices', 'Never'], ['Serial ports', 'Never'], ['Bluetooth and HID', 'Never'], ['Camera and microphone', 'Ask first']],
      text: 'Pages cannot reach USB, serial, HID or Bluetooth devices. Camera, microphone and location still ask you first.' },
    { chip: 'Mute and close-right fixed', title: 'Two tab menu items work now', color: 4, art: 'menu',
      text: 'Mute tab and Close tabs to the right, added in 0.4.0, did nothing. They work now.' }
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

// Small drawings of the feature, built from the same text rules (everything user-visible goes through esc).
const ART = {
  downloads: () => `<div class="card"><div class="row"><div class="ic">PDF</div><div>report.pdf<small>1.2 MB · Done</small></div><div class="act">Open</div></div>
<div class="row hi"><div class="ic warn">EXE</div><div>setup.exe<small>48 MB · Done</small></div><div class="act">Show in folder</div></div>
<div class="note">Lumen does not run programs for you.</div></div>`,
  menu: () => `<div class="card menu"><div class="mi">Reload tab</div><div class="mi">Duplicate tab</div><div class="mi hi">Mute tab</div><div class="mi">Copy tab address</div><div class="sep"></div><div class="mi">Close tab</div><div class="mi hi">Close tabs to the right</div><div class="mi">Close other tabs</div></div>`,
  rows: (f) => `<div class="card">${(f.rows || []).map(r => `<div class="row"><div>${esc(r[0])}</div><div class="act ${/^(Blocked|Never)$/.test(r[1]) ? 'no' : ''}">${esc(r[1])}</div></div>`).join('')}</div>`,
  newtab: () => `<div class="card mini"><small>FRI 7 NOV · 09:41</small><h4>Good morning.</h4><div class="ul">Search or type an address</div><div class="pl"><span><i style="--h:8"></i>Youtube</span><span><i style="--h:215"></i>Google</span><span><i style="--h:140"></i>Github</span><span><i style="--h:30"></i>Wikipedia</span></div></div>`,
  whatsnew: () => `<div class="card mini"><div class="pl one"><span class="c c1">Safer downloads</span><span class="c c2 sel">Local files stay local</span><span class="c c3">No device access</span></div><h4 class="sm">One change at a time</h4><div class="ul">Pick a card, or press Next</div></div>`
};

function panel(f, i) {
  const art = (ART[f.art] || ART.rows)(f);
  const steps = (f.steps || []).length ? `<ol>${f.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '';
  return `<section class="panel" data-i="${i}"${i ? ' hidden' : ''}><div class="copy"><h1>${esc(f.title)}</h1><p>${esc(f.text)}</p>${steps}</div><div class="stage">${art}</div></section>`;
}
function oldSection(n) {
  return `<section class="old"><h3>${esc(n.title)} <span>${esc(n.version)}</span></h3><ul>${n.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>`;
}

// pages: { BASE_CSS, nonce, csp, LOGO } come from pages.js to keep one CSP.
function render(current, pages) {
  const cur = NOTES.find(n => n.version === current) || NOTES[0];
  const feats = cur.features || [];
  const older = NOTES.filter(n => n !== cur && n.items);
  const n = pages.nonce();
  const body = feats.length
    ? `<div class="panels">${feats.map(panel).join('')}</div>
<div class="btns"><button class="b" id="next" type="button"${feats.length < 2 ? ' hidden' : ''}>Next</button><a class="b o" href="lumen://newtab">Start browsing</a></div>
<nav class="chips" aria-label="Changes">${feats.map((f, i) => `<button type="button" class="chip c${f.color || 1}${i ? '' : ' sel'}" data-i="${i}">${esc(f.chip)}</button>`).join('')}${feats.length > 1 ? '<span class="arrows"><button type="button" id="prev" aria-label="Previous">‹</button><button type="button" id="fwd" aria-label="Next">›</button></span>' : ''}</nav>`
    : `<div class="panels"><section class="panel"><div class="copy"><h1>${esc(cur.title || 'What’s new')}</h1><ul>${(cur.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div></section></div><div class="btns"><a class="b" href="lumen://newtab">Start browsing</a></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>What’s new in Lumen</title>
<meta http-equiv="Content-Security-Policy" content="${pages.csp(n)}">
<style>${pages.BASE_CSS}
:root{--bg:#f3efe7;--fg:#201d18;--mut:#7d7767;--line:#ddd6c7;--stage:#e9e3d6;--acc:#0a62d6;--btn:#201d18;--btnfg:#fff;--card:#fff;--cardfg:#201d18;--cardmut:#6b7280;--hi:#eef3fb;--c1:#dfe7f3;--c2:#f3e3a9;--c3:#d9e9d2;--c4:#f0d6d0;--sel:#1a1a1a;--ser:"Iowan Old Style","Palatino Linotype","Source Serif 4","Noto Serif","Liberation Serif",Georgia,serif}
@media (prefers-color-scheme:dark){:root{--bg:#14171c;--fg:#ece8df;--mut:#9a9ca1;--line:#2c3138;--stage:#1d2128;--acc:#6cb2ff;--btn:#ece8df;--btnfg:#14171c;--card:#262b33;--cardfg:#ece8df;--cardmut:#9aa0a8;--hi:#2d3a4d;--c1:#26364d;--c2:#4a4126;--c3:#27403a;--c4:#4a2e2f;--sel:#ece8df}}
body{background:var(--bg);color:var(--fg)}
.bar{height:60px;display:flex;align-items:center;gap:14px;padding:0 28px;border-bottom:1px solid var(--line)}
.bar img{width:26px;height:26px;border-radius:8px}
.bar strong{font-weight:600;font-size:18px}.bar i{width:1px;height:22px;background:var(--line)}.bar span{color:var(--mut);font-size:14px}
.wrap{max-width:1120px;margin:0 auto;padding:0 28px}
.panel{display:grid;grid-template-columns:1fr 1.15fr;gap:56px;align-items:center;padding:56px 0 32px}
.panel[hidden]{display:none}
h1{font:400 44px/1.08 var(--ser);letter-spacing:-.015em;margin:0 0 18px}
.copy p{margin:0 0 18px;color:var(--mut);font-size:16px}
ol,.copy ul{margin:0 0 8px;padding-left:20px}ol li,.copy li{margin:4px 0}
.btns{display:flex;gap:12px;margin-top:-6px}
.b{font-weight:600;font-size:15px;line-height:1;font-family:inherit;padding:13px 26px;border-radius:999px;border:1.5px solid var(--btn);background:var(--btn);color:var(--btnfg);cursor:pointer;text-decoration:none}
.b.o{background:none;color:var(--btn)}.b:focus-visible,.chip:focus-visible,.arrows button:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
.stage{background:var(--stage);border-radius:26px;padding:44px;min-height:340px;display:grid;place-items:center}
.card{width:100%;max-width:430px;background:var(--card);color:var(--cardfg);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.12);padding:8px}
.row{display:flex;align-items:center;gap:12px;padding:12px;border-radius:9px;font-size:14px}.row.hi{background:var(--hi)}
.ic{width:30px;height:30px;border-radius:8px;background:#6b7280;color:#fff;display:grid;place-items:center;font-weight:700;font-size:11px;line-height:1;font-family:inherit;flex:none}.ic.warn{background:#b45309}
small{display:block;color:var(--cardmut);font-size:12px}
.act{margin-left:auto;font-weight:600;font-size:12.5px;color:var(--acc);border:1px solid color-mix(in srgb,var(--acc) 30%,transparent);border-radius:7px;padding:5px 10px;white-space:nowrap}.act.no{color:#b3261e;border-color:#e8c4c1}
.note{margin:6px 12px 6px;font-size:12.5px;color:var(--cardmut)}
.menu{max-width:240px}.mi{padding:8px 12px;border-radius:7px;font-size:14px}.mi.hi{background:var(--hi)}.sep{height:1px;background:var(--line);margin:5px 8px}
.mini{padding:26px 28px}.mini small{font:12.5px ui-monospace,Consolas,monospace;letter-spacing:.04em}
.mini h4{font:400 34px/1.1 var(--ser);margin:8px 0 18px}.mini h4.sm{font-size:24px;margin:20px 0 14px}
.ul{border-bottom:1.5px solid var(--cardfg);padding-bottom:8px;color:var(--cardmut);font-size:14px}
.pl{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:16px;font-size:13px}.pl.one{margin:0}.pl span{display:flex;align-items:center;gap:7px}
.pl i{width:8px;height:8px;border-radius:50%;background:hsl(var(--h) 45% 52%)}
.c{padding:7px 12px;border-radius:9px;font-weight:600;font-size:12.5px;color:#201d18}.c.sel{outline:2px solid #1a1a1a}
.chips{display:flex;gap:14px;align-items:center;margin:26px 0 24px}
.chip{flex:1;font-weight:600;font-size:14.5px;line-height:1.3;font-family:inherit;text-align:left;color:#201d18;border-radius:16px;padding:16px 18px;min-height:72px;border:2.5px solid transparent;cursor:pointer}
.chip.c1,.c.c1{background:var(--c1)}.chip.c2,.c.c2{background:var(--c2)}.chip.c3,.c.c3{background:var(--c3)}.chip.c4,.c.c4{background:var(--c4)}
@media (prefers-color-scheme:dark){.chip,.c{color:#ece8df}.c.sel{outline-color:#ece8df}}
.chip.sel{border-color:var(--sel)}
.arrows{display:flex;gap:10px}.arrows button{width:44px;height:44px;border-radius:50%;border:0;background:var(--c1);color:var(--acc);font-size:20px;cursor:pointer}
.older{margin:8px 0 60px;color:var(--mut)}.older summary{cursor:pointer;font-size:14px}
.old h3{font-size:15px;margin:22px 0 6px;color:var(--fg)}.old h3 span{font-weight:400;color:var(--mut);font-size:12.5px;margin-left:6px}.old ul{margin:0;padding-left:20px;color:var(--fg)}
@media (max-width:820px){.panel{grid-template-columns:1fr;gap:28px}.chips{flex-wrap:wrap}.chip{flex:1 1 40%}}
</style></head><body>
<div class="bar">${pages.LOGO ? `<img src="${pages.LOGO}" alt="" width="26" height="26">` : ''}<strong>What’s new</strong><i></i><span>You are on Lumen ${esc(current)}</span></div>
<div class="wrap">${body}
${older.length ? `<details class="older"><summary>Earlier versions</summary>${older.map(oldSection).join('')}</details>` : ''}</div>
<script nonce="${n}">
(function(){
 var P=[].slice.call(document.querySelectorAll('.panel[data-i]')),C=[].slice.call(document.querySelectorAll('.chip'));
 if(P.length<2)return;var i=0;
 function go(k){i=(k+P.length)%P.length;P.forEach(function(p,j){p.hidden=j!==i});C.forEach(function(c,j){c.classList.toggle('sel',j===i)});
  var nx=document.getElementById('next');if(nx)nx.hidden=(i===P.length-1)}
 C.forEach(function(c,j){c.addEventListener('click',function(){go(j)})});
 document.getElementById('next').addEventListener('click',function(){go(i+1)});
 document.getElementById('fwd').addEventListener('click',function(){go(i+1)});
 document.getElementById('prev').addEventListener('click',function(){go(i-1)});
})();
</script></body></html>`;
}

module.exports = { NOTES, compare, shouldShow, render };
