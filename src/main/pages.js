'use strict';
// HTML for internal pages (new tab, error, proceed). Served through lumen:// with a strict CSP.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { APP_NAME } = require('./config');

let LOGO = '';
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon.png')).toString('base64'); } catch (e) { /* page works without it */ }

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function nonce() { return crypto.randomBytes(16).toString('base64'); }
function csp(n) {
  return `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}'; img-src data:; base-uri 'none'; form-action 'none'`;
}
function hue(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return h; }

const BASE_CSS = `
:root{color-scheme:light dark;--bg:#f2f4f8;--fg:#0c121a;--fg2:rgba(12,18,26,.62);--card:rgba(255,255,255,.62);--line:rgba(12,18,26,.12);--accent:#0a62d6;
--b1:#7fd4c4;--b2:#f2a65a;--b3:#8aa7ff}
@media (prefers-color-scheme:dark){:root{--bg:#10141b;--fg:#eef2f7;--fg2:rgba(238,242,247,.64);--card:rgba(255,255,255,.07);--line:rgba(255,255,255,.14);--accent:#6cb2ff;--b1:#1f7a70;--b2:#9a5a1e;--b3:#3b4fb8}}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{background:var(--bg);color:var(--fg);font:15px/1.5 "Segoe UI Variable Text","Segoe UI",system-ui,"Ubuntu","Cantarell","Noto Sans",sans-serif}
`;

// "youtube.com" -> "Youtube", "bbc.co.uk" -> "Bbc": a short, steady name for a site.
function siteName(host) {
  const parts = host.split('.');
  let i = parts.length - 2;
  if (i > 0 && parts[i].length <= 3 && parts[parts.length - 1].length === 2) i--;
  const w = parts[Math.max(i, 0)] || host;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function renderNewTab({ engineUrl, engineName, sites }) {
  const n = nonce();
  const rows = sites.slice(0, 8).map(s => {
    let host = s.origin; try { host = new URL(s.origin).hostname.replace(/^www\./, ''); } catch (e) {}
    return `<li><a href="${esc(s.origin)}" style="--h:${hue(host)}"><i></i><b>${esc(siteName(host))}</b><em>${esc(host)}</em></a></li>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>New Tab</title>
<meta http-equiv="Content-Security-Policy" content="${csp(n)}">
<style>${BASE_CSS}
:root{--bg:#f3efe7;--fg:#201d18;--mut:#8a8372;--line:#ddd6c7;--rule:#201d18;--acc:#0a62d6;--hov:rgba(10,98,214,.07);--glow:rgba(10,98,214,.07);--ser:"Iowan Old Style","Palatino Linotype","Source Serif 4","Noto Serif","Liberation Serif",Georgia,serif}
@media (prefers-color-scheme:dark){:root{--bg:#14171c;--fg:#ece8df;--mut:#8b8f96;--line:#2c3138;--rule:#ece8df;--acc:#6cb2ff;--hov:rgba(255,255,255,.06);--glow:rgba(108,178,255,.10)}}
body{background:radial-gradient(60vmax 28vmax at 50% -12%,var(--glow),transparent 70%),var(--bg);color:var(--fg);background-attachment:fixed}
main{max-width:680px;margin:0 auto;padding:clamp(48px,17vh,170px) 28px 64px}
.t{display:flex;align-items:center;gap:10px;font:400 14px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;color:var(--mut);letter-spacing:.04em}
.t b{width:9px;height:9px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 4px var(--glow)}
h1{font:400 clamp(38px,7vw,54px)/1.05 var(--ser);margin:16px 0 40px;letter-spacing:-.015em}
form{display:flex;align-items:baseline;gap:12px;border-bottom:1.5px solid var(--rule);padding-bottom:10px;transition:border-color .15s}
form:focus-within{border-color:var(--acc)}
form span{font:13px ui-monospace,Consolas,monospace;color:var(--mut)}
input{flex:1;min-width:0;font:inherit;font-size:19px;color:var(--fg);background:none;border:0;outline:0;caret-color:var(--acc)}
input::placeholder{color:var(--mut)}
ul{list-style:none;margin:44px 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:0 40px}
@media (max-width:560px){ul{grid-template-columns:1fr}}
li a{display:flex;gap:12px;align-items:center;padding:11px 8px;margin:0 -8px;border-bottom:1px solid var(--line);text-decoration:none;color:inherit;min-width:0}
li a:hover{background:var(--hov)}li a:focus-visible{outline:2px solid var(--acc);outline-offset:-2px}
li i{width:10px;height:10px;border-radius:50%;background:hsl(var(--h) 45% 52%);flex:none}
li b{font-weight:600;white-space:nowrap}
li em{margin-left:auto;font:12px ui-monospace,Consolas,monospace;color:var(--mut);font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.empty{margin-top:44px;color:var(--mut)}
</style></head><body><main>
<div class="t"><b></b><span id="d"></span></div>
<h1 id="g">Hello.</h1>
<form id="f"><span aria-hidden="true">⌕</span><input id="q" type="text" placeholder="Search ${esc(engineName)} or type an address" autocomplete="off" spellcheck="false" autofocus aria-label="Search or enter address"></form>
${rows ? `<ul aria-label="Frequently visited">${rows}</ul>` : `<p class="empty">Sites you visit often will appear here.</p>`}
</main>
<script nonce="${n}">
var ENGINE=${JSON.stringify(engineUrl)};
(function(){
 var now=new Date(),h=now.getHours();
 document.getElementById('g').textContent=h<5?'Good night.':h<12?'Good morning.':h<18?'Good afternoon.':'Good evening.';
 function tick(){var t=new Date();
  document.getElementById('d').textContent=(t.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})+' · '+t.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})).toUpperCase()}
 tick();setInterval(tick,20000);
})();
document.getElementById('f').addEventListener('submit',function(e){
 e.preventDefault();var s=document.getElementById('q').value.trim();if(!s)return;
 var url;
 if(/^https?:\\/\\//i.test(s)){url=s}
 else if(!/\\s/.test(s)&&/^([\\w-]+\\.)+[a-z]{2,}(:\\d+)?([\\/?#]\\S*)?$/i.test(s)){url='https://'+s}
 else{url=ENGINE.replace('%s',encodeURIComponent(s))}
 location.href=url;
});
</script></body></html>`;
}

const ERRORS = {
  ERR_INTERNET_DISCONNECTED: ["You're offline", 'Check your network connection, then try again.'],
  ERR_NETWORK_CHANGED: ['The network changed', 'Your connection changed while the page was loading. Try again.'],
  ERR_NAME_NOT_RESOLVED: ["Can't find this site", 'The address may be misspelled, or the site may not exist.'],
  ERR_CONNECTION_REFUSED: ['The site refused the connection', 'The server is not accepting connections right now.'],
  ERR_CONNECTION_TIMED_OUT: ['The site took too long to respond', 'The server did not answer in time.'],
  ERR_TIMED_OUT: ['The site took too long to respond', 'The server did not answer in time.'],
  ERR_CONNECTION_RESET: ['The connection was reset', 'Something interrupted the connection. Try again.'],
  ERR_CONNECTION_CLOSED: ['The connection was closed', 'The server closed the connection without answering.'],
  ERR_ADDRESS_UNREACHABLE: ["Can't reach this address", 'The address cannot be reached from this network.'],
  ERR_TOO_MANY_REDIRECTS: ['Too many redirects', 'This page keeps redirecting. Clearing cookies for the site may help.'],
  ERR_BLOCKED_BY_CLIENT: ['The page was blocked', 'This address is blocked.'],
  READER_EXPIRED: ['This reader page has expired', 'Reader pages are not saved. Open the original article and press F9 again.'],
  PAGE_CRASHED: ['This page crashed', 'The page stopped working. Reloading may fix it.']
};

function renderError({ desc, url, code, token }) {
  const n = nonce();
  const isCert = /^ERR_CERT_/.test(desc);
  const [title, body] = isCert
    ? ["This connection isn't private", "Lumen could not verify this site's security certificate. Someone on the network could be pretending to be the site."]
    : (ERRORS[desc] || ['This page can’t be loaded', 'Something went wrong while loading the page.']);
  let host = ''; try { host = new URL(url).hostname; } catch (e) {}
  const proceed = isCert && host
    ? `<p class="small"><a id="proceed" href="lumen://proceed?host=${encodeURIComponent(host)}&amp;token=${encodeURIComponent(token)}&amp;url=${encodeURIComponent(url)}">Proceed to ${esc(host)} (unsafe)</a></p>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta http-equiv="Content-Security-Policy" content="${csp(n)}">
<style>${BASE_CSS}
main{max-width:560px;margin:0 auto;padding:clamp(60px,18vh,170px) 24px}
.code{font:600 12px/1 ui-monospace,Consolas,monospace;letter-spacing:.06em;color:var(--fg2);margin-bottom:16px}
h1{font-weight:650;font-size:30px;line-height:1.15;margin:0 0 10px;letter-spacing:-.01em}
p{color:var(--fg2);margin:0 0 22px}
.url{font:13px/1.4 ui-monospace,Consolas,monospace;word-break:break-all;color:var(--fg2);margin-bottom:26px}
button{font:inherit;font-weight:600;color:#fff;background:var(--accent);border:0;border-radius:999px;padding:11px 24px;cursor:pointer}
button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.small{font-size:13px;margin-top:28px}.small a{color:var(--fg2)}
</style></head><body><main>
<div class="code">${esc(desc || 'ERROR')} (${esc(code)})</div>
<h1>${esc(title)}</h1><p>${esc(body)}</p>
<div class="url">${esc(url)}</div>
<button id="retry" type="button">Try again</button>
${proceed}
</main><script nonce="${n}">
document.getElementById('retry').addEventListener('click',function(){location.href=${JSON.stringify(url)}});
</script></body></html>`;
}

function renderWarning({ url, host, token }) {
  const n = nonce();
  const go = `lumen://sbproceed?host=${encodeURIComponent(host)}&amp;token=${encodeURIComponent(token)}&amp;url=${encodeURIComponent(url)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Deceptive site ahead</title>
<meta http-equiv="Content-Security-Policy" content="${csp(n)}">
<style>${BASE_CSS}
body{background:#3a0d12;color:#fff}
main{max-width:600px;margin:0 auto;padding:clamp(60px,18vh,170px) 24px}
.code{font:600 12px/1 ui-monospace,Consolas,monospace;letter-spacing:.06em;color:#ffb3ba;margin-bottom:16px}
h1{font-weight:650;font-size:32px;line-height:1.15;margin:0 0 12px;letter-spacing:-.01em}
p{color:#ffd9dc;margin:0 0 22px}
.url{font:13px/1.4 ui-monospace,Consolas,monospace;word-break:break-all;color:#ffb3ba;margin-bottom:28px}
button{font:inherit;font-weight:650;color:#3a0d12;background:#fff;border:0;border-radius:999px;padding:12px 26px;cursor:pointer}
button:focus-visible,a:focus-visible{outline:2px solid #fff;outline-offset:3px}
.small{font-size:13px;margin-top:34px}.small a{color:#ffb3ba}
</style></head><body><main>
<div class="code">PHISHING WARNING</div>
<h1>Deceptive site ahead</h1>
<p>${esc(host)} is on a list of sites reported for phishing. Attackers on sites like this try to trick you into giving away passwords, card numbers or other private details.</p>
<div class="url">${esc(url)}</div>
<button id="back" type="button">Back to safety</button>
<p class="small"><a id="go" href="${go}">I understand the risk, open the site anyway</a></p>
<p class="small">Lumen checks addresses against a list stored on this computer. No address you visit is sent anywhere. A site can be listed by mistake. You can turn this off in Settings.</p>
</main><script nonce="${n}">
document.getElementById('back').addEventListener('click',function(){if(history.length>1)history.back();else location.href='lumen://newtab';});
</script></body></html>`;
}
function renderProceed(url) {
  const n = nonce();
  return `<!doctype html><html><head><meta charset="utf-8"><title>Continuing</title>
<meta http-equiv="Content-Security-Policy" content="${csp(n)}"></head><body>
<script nonce="${n}">location.replace(${JSON.stringify(url)})</script></body></html>`;
}

function renderWhatsNew(version) {
  return require('./whatsnew').render(version, { BASE_CSS, nonce, csp, LOGO });
}

function renderReaderDoc(doc) {
  return require('./reader').render(doc, { BASE_CSS, nonce, LOGO });
}

module.exports = { renderNewTab, renderError, renderWarning, renderProceed, renderWhatsNew, renderReaderDoc };
